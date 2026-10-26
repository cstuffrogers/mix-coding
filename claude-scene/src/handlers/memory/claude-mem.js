import { readFileSync, existsSync, readdirSync, unlinkSync, statSync, appendFileSync, renameSync } from 'fs';
import { join } from 'path';
import { CLAUDE_MEM_DIR } from '../../lib/paths.js';
import { ensureDir, writeFileAtomic, withFileLock } from '../../lib/fs-utils.js';
import { normalizeProjectPath, safeTypeName, DEDUPE_WINDOW_MS } from './project-scope.js';

// CLAUDE_MEM_DIR 是 import 时冻结的常量；解析放到调用时，测试与多环境才能把
// 全局库指到沙箱，而不是写进开发者真实的 ~/.claude/memory。
export function claudeMemDir() {
  return process.env.CLAUDE_MEM_HOME || CLAUDE_MEM_DIR;
}

const ITEMS_CAP = 500;
const MD_CAP = 100;
const MD_CONTENT_CAP = 500;

// 超过上限的条目不是凭空消失，而是落到 archive/*.jsonl 里 —— 静默删用户的
// 记忆是不可接受的，至少留一份可追溯的原文。
function archiveRecords(dir, records) {
  if (!records.length) return;
  try {
    const archiveDir = join(claudeMemDir(), 'archive');
    ensureDir(archiveDir);
    const lines = records.map(r => JSON.stringify({ archived_at: new Date().toISOString(), ...r }));
    appendFileSync(join(archiveDir, `${dir}-items.jsonl`), lines.join('\n') + '\n', 'utf-8');
  } catch { /* 归档失败不阻断写入 */ }
}

function archiveMarkdown(names) {
  if (!names.length) return;
  try {
    const archiveDir = join(claudeMemDir(), 'archive');
    ensureDir(archiveDir);
    appendFileSync(join(archiveDir, 'markdown-pruned.log'), names.map(n => `${new Date().toISOString()}\t${n}`).join('\n') + '\n', 'utf-8');
  } catch { /* 归档失败不阻断写入 */ }
}

export function readClaudeMemItems(category) {
  const name = safeTypeName(category);
  const itemsFile = join(claudeMemDir(), 'areas', 'topics', name, 'items.json');
  if (!existsSync(itemsFile)) return [];
  try {
    const parsed = JSON.parse(readFileSync(itemsFile, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/**
 * 实际存在 items.json 的分类目录。分类名 = 工作流类型（review / audit /
 * mobile-review …），种类随场景增长，不能靠调用方列一份固定白名单 —— 写进去
 * 却召不回来、list 也数不到，记忆等于丢了。
 */
export function listClaudeMemCategories() {
  const topics = join(claudeMemDir(), 'areas', 'topics');
  if (!existsSync(topics)) return [];
  try {
    return readdirSync(topics, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(name => existsSync(join(topics, name, 'items.json')))
      .sort();
  } catch { return []; }
}

export function writeClaudeMemItem(category, entry, project = null, options = {}) {
  const name = safeTypeName(category);
  const dir = join(claudeMemDir(), 'areas', 'topics', name);
  ensureDir(dir);
  const itemsFile = join(dir, 'items.json');
  // 读-改-写必须互斥：两个会话同时跑同一个项目时，后写的一方会拿旧快照
  // 覆盖前一方，条目静默消失（实测 4 进程 × 5 次只落 23 条）。
  return withFileLock(join(dir, '.items.lock'), () => {
    let items = [];
    if (existsSync(itemsFile)) {
      try {
        items = JSON.parse(readFileSync(itemsFile, 'utf-8'));
      } catch {
        // 文件坏了不能当空数组直接盖掉：先整份搬到 archive 留底，再重建。
        salvageCorrupt(itemsFile, name);
      }
    }
    if (!Array.isArray(items)) { items = []; }
    // 同分类里已有同指纹的记录就不再写：这个后端一次场景重复跑会堆出 N 份
    // 完全相同的副本（清单计数一路涨，召回却去重成一条，用户看到的
    // 「记忆在变多」是假的）。
    // 只看「最新一条」会漏（两个场景交替写同一分类时重复件排第二位），
    // 所以扫「窗口内全部条目」+ **同一项目**（别的项目写同样内容是另一条记忆）。
    // 条目数已由 ITEMS_CAP（500/类型）封顶，比再拍一个 slice 窗口更不会漏。
    const fingerprint = options.fingerprint || '';
    // project 是这个后端唯一能区分「哪条属于哪个项目」的字段：全局库里的记录
    // 一混在一起，召回就无法分辨上下文。传 null 时不写，老条目保持无归属。
    const scopePath = normalizeProjectPath(project?.path);
    if (fingerprint && items.some(it => (
      it?.fingerprint === fingerprint
      && withinWindow(it.stored_at)
      && sameProjectPath(it?.project?.path, scopePath)
    ))) {
      return { skipped: true, count: items.length };
    }
    const scoped = scopePath ? { ...entry, project: { path: scopePath, name: project.name || '' } } : { ...entry };
    const stamped = { ...scoped, stored_at: new Date().toISOString() };
    if (fingerprint) stamped.fingerprint = fingerprint;
    items.unshift(stamped);
    if (items.length > ITEMS_CAP) {
      // 旧实现直接 slice 掉最老的 —— 用户看不到任何提示，记忆就没了。
      const dropped = items.slice(ITEMS_CAP);
      archiveRecords(name, dropped);
      items = items.slice(0, ITEMS_CAP);
    }
    writeFileAtomic(itemsFile, JSON.stringify(items, null, 2));
    return { skipped: false, count: items.length };
  });
}

/**
 * items.json 解析失败时的抢救：把坏文件原样搬到 archive，而不是静默重建成空数组。
 * 没有这步，一次崩溃留下的半截 JSON 会让整类记忆在下一次写入时彻底消失。
 */
function salvageCorrupt(itemsFile, name) {
  try {
    const dir = join(claudeMemDir(), 'archive');
    ensureDir(dir);
    const stamp = new Date().toISOString().replaceAll(':', '-');
    renameSync(itemsFile, join(dir, `${name}-items-corrupt-${stamp}.json`));
  } catch { /* 抢救失败也不阻断写入 */ }
}

// markdown 文件名是 `<type>-<2026-10-26T...>.md`，type 本身可能带连字符
// （mobile-review），所以只能剥时间戳尾巴，不能按 '-' 切。
function typeFromMarkdownName(file) {
  const match = /^(.+?)-\d{4}-\d{2}-\d{2}T[^.]*\.md$/.exec(file);
  return match ? match[1] : '';
}

export function readClaudeMemMarkdown() {
  const mdDir = join(claudeMemDir(), 'memory');
  if (!existsSync(mdDir)) return [];
  try {
    return readdirSync(mdDir)
      .filter(f => f.endsWith('.md'))
      // 文件名是 `<type>-<ISO>.md`，倒序就是「新 → 旧」。不排序时 readdir 给的
      // 是正序，召回把最旧的 markdown 记录当成最新的抬到前面，其余后端却是新的在前，
      // 两边的“第一条”根本不是同一件事，去重配不上对。
      .sort((a, b) => b.localeCompare(a))
      .map(f => {
        const content = readFileSync(join(mdDir, f), 'utf-8');
        // truncated 必须显式 —— 截断后的内容一旦被回写成新记忆，500 字的残片
        // 就成了「完整记忆」，和之前 agentmemory 的截断回写是同一类放大。
        const truncated = content.length > MD_CONTENT_CAP;
        return {
          source: 'claude-mem',
          file: f,
          // 文件名是 `<type>-<ISO>.md`，补上 type，否则 filters.type / category
          // 对 markdown 归档完全失效（旧实现这些行没有任何类型标识）。
          type: typeFromMarkdownName(f),
          content: content.slice(0, MD_CONTENT_CAP),
          truncated,
          length: content.length,
          projectPath: readMarkdownProject(content),
        };
      });
  } catch { return []; }
}

// markdown 归档没有 JSON 字段可放归属，只好写在头部一行 `- 路径: ...`。
// 老文件没有这一行 → '' → 召回时归为「未标归属」，不会被当成别项目的。
function readMarkdownProject(content) {
  const match = content.match(/^- 路径: (.+)$/m);
  const value = match?.[1]?.trim() || '';
  return value === '未标注' ? '' : value;
}

export function writeClaudeMemMarkdown(type, data, project = null, options = {}) {
  const name = safeTypeName(type);
  const dir = join(claudeMemDir(), 'memory');
  ensureDir(dir);
  // markdown 落的是完整正文，同类型里已有同指纹的文件就不再写一份。
  // 只读最新 10 个文件的头部（指纹写在标题区），不做全量扫描。
  const fingerprint = options.fingerprint || '';
  if (fingerprint && hasFingerprintInWindow(dir, name, fingerprint, normalizeProjectPath(project?.path))) {
    return { skipped: true, file: null };
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${ts}.md`;
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const scopePath = normalizeProjectPath(project?.path);
  const origin = scopePath
    ? `- 项目: ${project.name || ''}\n- 路径: ${scopePath}\n`
    : '- 项目: 未标注\n- 路径: 未标注\n';
  const markdown = `# ${name} — ${new Date().toISOString()}\n\n- 内容指纹: ${fingerprint || '未标注'}\n${origin}\n${content}\n`;
  writeFileAtomic(join(dir, filename), markdown);

  // 超过上限时按 **mtime** 删最旧的。旧实现按文件名排序（`type-ts.md`），
  // 等价于先按类型字母序分组 —— 实测把最新的 general/review 归档全删了，
  // 却留下最旧的 aaa。容量控制必须看时间，不能看类型名。
  try {
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        try { return { f, mtime: statSync(join(dir, f)).mtimeMs }; } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime); // 新 → 旧
    const pruned = files.slice(MD_CAP).map(x => x.f);
    for (const old of pruned) {
      // 归档而不是只记下名字：日志里只有文件名的话，内容就真没了。
      // （markdown 与 items.json 内容重叠，但两者不保证同时存在。）
      try {
        const archiveDir = join(claudeMemDir(), 'archive', 'markdown');
        ensureDir(archiveDir);
        renameSync(join(dir, old), join(archiveDir, old));
      } catch {
        try { unlinkSync(join(dir, old)); } catch { /* 已被别处删掉 */ }
      }
    }
    archiveMarkdown(pruned);
  } catch { /* cleanup best-effort */ }

  return { skipped: false, file: filename };
}

// 判重必须带上项目：A 项目写过一份内容，B 项目写同样的内容不能被当成重复
// 而丢掉 —— 召回是按项目过滤的，B 就再也看不到这条记录了。
function sameProjectPath(a, b) {
  return normalizeProjectPath(a) === normalizeProjectPath(b);
}

const NEWLINE = String.fromCodePoint(10);

function withinWindow(stamp) {
  const t = new Date(stamp || 0).getTime();
  return Number.isFinite(t) && Date.now() - t < DEDUPE_WINDOW_MS;
}

// 同类型最近的文件里有没有相同指纹（读不到就当没有，宁可多写不误判）。
// 窗口只看「最近 10 个文件」不够：别的项目交替写同一类型时，本项目那条
// 会被挤出窗口，于是同内容又落一份（实测 12 个其他项目插在中间就复现）。
// 按 mtime 新→旧扫，遇到比窗口更老的就停，另加 MAX_FP_SCAN 兜底。
const MAX_FP_SCAN = 60;

function hasFingerprintInWindow(dir, name, fingerprint, scopePath) {
  try {
    const files = readdirSync(dir)
      .filter(f => f.startsWith(`${name}-`) && f.endsWith('.md'))
      .map(f => {
        try { return { f, mtime: statSync(join(dir, f)).mtimeMs }; } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    let inspected = 0;
    for (const { f, mtime } of files) {
      if (mtime < cutoff) break;
      if (inspected >= MAX_FP_SCAN) break;
      inspected++;
      const head = readFileSync(join(dir, f), 'utf-8').slice(0, 400);
      const hit = /内容指纹:\s*([0-9a-f]{8,})/.exec(head);
      if (!hit || hit[1] !== fingerprint) continue;
      // 同一份内容在另一个项目里是另一条记忆，不能跳过。
      // 按行切分而不是正则取整行：不会回溯，也不怕 CRLF。
      const pathLine = head.split(NEWLINE).find(line => line.startsWith('- 路径:'));
      if (sameProjectPath(pathLine?.slice(6).trim(), scopePath)) return true;
    }
    return false;
  } catch { return false; }
}
