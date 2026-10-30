#!/usr/bin/env node
/**
 * 把仓库里的 `.pi/prompts/*.md` 收敛到 pi 的个人模板目录（默认 `~/.pi/agent/prompts`）。
 *
 * 为什么需要这个文件：原来的安装器只会**拷**，从不**删**。于是仓库里退役掉的名字
 * （`/hunt` 第二十四轮被合并进 `/review`，仓库里已经删了）在用户机上一直活着 ——
 * 本机实测 `~/.pi/agent/prompts/` 有 34 个、仓库只有 33 个，多出来的那个正是 `hunt.md`。
 * 安装器只把这两个数字打出来（「源 33，目标 34」），没有人会去看。
 *
 * 删除策略（**用户的个人模板不能碰**）：
 *   只删两种东西 ——
 *     1. 上一轮由本脚本写下的清单（`.mix-coding-installed.json`）里有、这次源里没了；
 *     2. `RETIRED_PROMPTS` 里的退役名（给「还没有清单」的老安装做一次迁移）。
 *   用户在同一个目录里自己写的模板既不在清单里、也不在退役名单里，永远不删。
 *
 * 安全阀：源目录读不到 10 个以上 `.md` 就直接报错退出，绝不在源是空的情况下清目标 ——
 * 那会把用户的模板目录一次抹光。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 清单文件名（不是 `.md`，pi 不会把它当成模板）。 */
export const MANIFEST = '.mix-coding-installed.json';

/** 源目录至少要读到这么多个模板，否则判定「路径给错了」，一个字节都不动。 */
export const SRC_FLOOR = 10;

/**
 * 已退役的命令名（第二十四轮起合并进别的场景）。仍然留在仓库里的那 7 个是**别名 stub**
 * （11 行，正文就是「X 已合并进 Y，请运行 /Y」），因此源里还有就不删；源里没了才清目标。
 */
export const RETIRED_PROMPTS = ['hunt', 'e2e', 'monitor', 'analyze', 'audit', 'design', 'simplify', 'polish'];

/** CRLF 与 LF 视为同一份内容 —— 仓库开了 autocrlf，逐字节比对会天天假漂移。 */
function normalize(text) {
  return text.replaceAll('\r\n', '\n');
}

function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort();
}

function readManifest(dst) {
  const file = join(dst, MANIFEST);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    return Array.isArray(parsed.installed) ? parsed.installed.filter((n) => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * @param {{src: string, dst: string, dryRun?: boolean, retired?: string[]}} options
 * @returns {{written: string[], unchanged: string[], pruned: string[], kept: string[], srcCount: number}}
 */
export function syncPrompts({ src, dst, dryRun = false, retired = RETIRED_PROMPTS }) {
  const names = listMd(src);
  if (names.length < SRC_FLOOR) {
    throw new Error(`源目录 ${src} 只读到 ${names.length} 个 .md（下限 ${SRC_FLOOR}）—— 路径给错了？一个字节都没动`);
  }

  const previous = readManifest(dst);
  const sourceSet = new Set(names);
  const dstFiles = listMd(dst);

  const written = [];
  const unchanged = [];
  const pruned = [];
  for (const name of names) {
    const from = join(src, name);
    const to = join(dst, name);
    const next = normalize(readFileSync(from, 'utf-8'));
    const has = dstFiles.includes(name);
    if (has && normalize(readFileSync(to, 'utf-8')) === next) {
      unchanged.push(name);
      continue;
    }
    written.push(name);
    if (!dryRun) {
      mkdirSync(dst, { recursive: true });
      writeFileSync(to, next);
    }
  }

  // 只删「自己装过的」+「退役的」；用户在同一个目录里另存的模板不在这两个集合里
  const candidates = new Set([...previous.filter((n) => n.endsWith('.md')), ...retired.map((n) => `${n}.md`)]);
  for (const name of dstFiles) {
    if (sourceSet.has(name) || !candidates.has(name)) continue;
    pruned.push(name);
    if (!dryRun) rmSync(join(dst, name), { force: true });
  }

  const kept = dstFiles.filter((name) => !sourceSet.has(name) && !candidates.has(name));
  if (!dryRun) {
    mkdirSync(dst, { recursive: true });
    writeFileSync(join(dst, MANIFEST), `${JSON.stringify({ installed: names }, null, 2)}\n`);
  }
  return { written, unchanged, pruned, kept, srcCount: names.length };
}

function defaultSrc() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '.pi', 'prompts');
}

function defaultDst() {
  return join(homedir(), '.pi', 'agent', 'prompts');
}

function parseArgs(argv) {
  const out = { src: defaultSrc(), dst: defaultDst(), dryRun: false, check: false, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--check') out.check = true;
    else if (arg === '--quiet') out.quiet = true;
    else if (arg === '--src') out.src = resolve(argv[(i += 1)]);
    else if (arg === '--dst') out.dst = resolve(argv[(i += 1)]);
    else throw new Error(`认不出的参数：${arg}`);
  }
  return out;
}

/** 全 ASCII 的汇报行：调用方可能是 GBK 的 .bat（没有 chcp），中文会变乱码。 */
function reportAscii(result) {
  const lines = [
    `sync: src=${result.srcCount} write=${result.written.length} prune=${result.pruned.length} unchanged=${result.unchanged.length}`,
    ...result.written.map((n) => `write: ${n}`),
    ...result.pruned.map((n) => `prune: ${n}`),
  ];
  for (const line of lines) console.log(line);
}

/** `--check` 的 ASCII 汇报：调用方只看退出码，输出是给人排查用的。 */
function reportCheck(result) {
  console.log(
    `check: src=${result.srcCount} identical=${result.unchanged.length} to-write=${result.written.length} to-prune=${result.pruned.length}`,
  );
  if (result.written.length > 0) console.log(`to-write: ${result.written.join(' ')}`);
  if (result.pruned.length > 0) console.log(`to-prune: ${result.pruned.join(' ')}`);
}

function main() {
  const { src, dst, dryRun, check, quiet } = parseArgs(process.argv.slice(2));
  const result = syncPrompts({ src, dst, dryRun: dryRun || check });
  if (check) {
    reportCheck(result);
    process.exit(result.written.length + result.pruned.length > 0 ? 1 : 0);
  }
  if (quiet || dryRun) {
    reportAscii(result);
    return;
  }
  console.log(`源 ${result.srcCount} 个模板 → ${dst}`);
  if (result.written.length > 0) console.log(`写入/更新 ${result.written.length}：${result.written.join(' ')}`);
  if (result.pruned.length > 0) console.log(`清理退役 ${result.pruned.length}：${result.pruned.join(' ')}`);
  if (result.kept.length > 0) console.log(`保留个人模板 ${result.kept.length}：${result.kept.join(' ')}`);
  console.log(`已是最新 ${result.unchanged.length} 个`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}
