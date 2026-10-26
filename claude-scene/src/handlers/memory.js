import chalk from 'chalk';
import { readClaudeMemItems, writeClaudeMemItem, readClaudeMemMarkdown, writeClaudeMemMarkdown, listClaudeMemCategories } from './memory/claude-mem.js';
import { readAgentmemory, writeAgentmemory, getAgentmemoryStats, getAgentmemoryScopeCounts } from './memory/agentmemory.js';
import { readNexoData, writeNexoEvent } from './memory/nexo.js';
import { queryCodeGraph } from './memory/codegraph.js';
import { loadProjectMemories, loadAllProjectMemories, saveProjectMemory, matchFilter, deduplicateProjectMemories } from './memory/project-memory.js';
import { projectScope, classifyScope, includeInRecall, safeTypeName } from './memory/project-scope.js';

// 老记忆集中在这四类。写新的会按工作流类型落盘（review / audit / mobile-review…
// 几十种），所以召回与计数必须把真实存在的目录都枚举进来，否则写进去的 items
// 永远召不回来 —— 验证脚本里 `audit` / `mobile-review` 各写了 1 条，list 却只
// 数到 1 条（只有 general）。
const CORE_CATEGORIES = ['general', 'architecture', 'decision', 'pattern'];

function claudeMemCategories(category) {
  if (category) return [safeTypeName(category)];
  return [...new Set([...CORE_CATEGORIES, ...listClaudeMemCategories()])];
}

function claudeMemItems(category) {
  return claudeMemCategories(category)
    .flatMap(cat => readClaudeMemItems(cat).map(item => ({ ...item, category: cat })));
}

// 来源标签只列真正贡献了召回结果的后端。旧实现无条件写死五个来源，于是
// 「召回了 0 条」也声称来自项目/Claude-Mem/agentmemory/NEXO/CodeGraph。
const SOURCE_LABELS = {
  'project-memory': '项目',
  'claude-mem': 'Claude-Mem',
  agentmemory: 'agentmemory',
  nexo: 'NEXO',
  codegraph: 'CodeGraph',
};

// 每个后端的召回配额。旧实现是 max(5, ceil(limit/5))，而拼接顺序把 project-memory
// 和 claude-mem 排在最前，于是 limit=10 时这两家各占 5 条就把配额吃光，NEXO /
// agentmemory / codegraph 一条都进不来 —— 返回语却宣称五个来源都有。改成均分。
export function recallQuota(limit, backendCount) {
  const n = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
  const b = Number.isFinite(backendCount) && backendCount > 0 ? backendCount : 1;
  return Math.max(1, Math.ceil(n / b));
}

// 全局后端（claude-mem / agentmemory / NEXO）里的每条记录都要标上归属：
// project = 本项目、unscoped = 打标之前的历史、cross-project = 别的项目。
// 只有第三种默认不召回 —— 把 A 项目的审查结论当 B 项目的上下文是错上下文。
function annotateScope(records, scope, crossProject, cap) {
  let excluded = 0;
  const kept = [];
  for (const record of records) {
    // 两种形状：agentmemory/NEXO/markdown 用平铺的 projectPath，
    // claude-mem items.json 用嵌套的 project.path。
    const storedPath = record.projectPath || record.project?.path || '';
    const recordScope = classifyScope(storedPath, scope);
    if (!includeInRecall(recordScope, { crossProject })) {
      excluded++;
      continue;
    }
    kept.push({ ...record, scope: recordScope });
  }
  const limited = Number.isFinite(cap) && cap > 0 ? kept.slice(0, cap) : kept;
  // 只统计「真的进了召回池」的无归属条数。扫到的历史总量可能有几百条，
  // 写进召回消息会被读成「召回了 600 条」。
  const unscoped = limited.filter(r => r.scope === 'unscoped').length;
  return { kept: limited, unscoped, excluded };
}

function scopeSuffix(unscoped, excluded) {
  const parts = [];
  if (unscoped > 0) parts.push(`${unscoped} 条未标归属的旧记录（打标前写入）`);
  if (excluded > 0) parts.push(`已排除 ${excluded} 条其他项目记录`);
  return parts.length ? `；${parts.join('，')}` : '';
}

// 一处算清「本项目 / 无归属 / 其他」。旧实现直接用 readAgentmemory(..., scope.path)
// 的长度当「本项目 N 条」，而那个 SQL 条件是「本项目 OR 无归属」，于是把历史垃圾
// 也算进了本项目。
function scopeCounts(records, scope, pathOf = r => r.projectPath || r.project?.path) {
  const counts = { project: 0, unscoped: 0, other: 0 };
  for (const record of records) {
    const kind = classifyScope(pathOf(record), scope);
    if (kind === 'project') counts.project++;
    else if (kind === 'unscoped') counts.unscoped++;
    else counts.other++;
  }
  return counts;
}

function formatCounts(counts) {
  return `本项目 ${counts.project} / 无归属 ${counts.unscoped} / 其他 ${counts.other}`;
}

// category 参数只对按类型分目录的后端有意义；这条记录没有 type 时不因此丢掉。
function byCategory(records, category) {
  if (!category) return records;
  const want = safeTypeName(category);
  return records.filter(r => !r.type || safeTypeName(r.type) === want);
}

// ── Public handlers ──────────────────────────────────────────────
// 把一条召回记录压成一行给终端看。
// 召回结果原先只放在 context.recalled_memories 里，全引擎没有任何地方读它
// （回写也已禁掉），也就是说 LLM 永远看不到召回来的内容，召回等于没发生。
// CLI 驱动的工作流里，只有 stdout 是注入通道。
function memoryBody(m) {
  if (m.source === 'codegraph') return `${m.summary?.nodes ?? 0} 节点 / ${m.summary?.files ?? 0} 文件`;
  // data 优先：claude-mem items 的 snippet 与 NEXO 的包装 JSON 都围着同一份 data，
  // 用结构化 data 比对才能把「同一条记忆的不同副本」认出来。
  if (m.data !== undefined) return JSON.stringify(m.data);
  return String(m.data_snippet || m.content || '');
}

// 同一条记忆会同时落在 5 个后端（项目记忆 / items / markdown / agentmemory /
// NEXO）里，召回如果不去重，一条内容会被当成 5–8 条上下文重复注入。
// markdown 归档带标题头，正文是 items 的超集，所以用「包含即重复」而不仅相等。
function dedupeMemories(rows) {
  const kept = [];
  const seen = [];
  for (const row of rows) {
    const body = memoryBody(row).replace(/\s+/g, '');
    const tag = String(row.category || row.type || '');
    if (!body) { kept.push(row); continue; }
    const dup = seen.some(s => s.tag === tag && (s.body === body ||
      (body.length >= 80 && s.body.includes(body)) ||
      (s.body.length >= 80 && body.includes(s.body))));
    if (dup) continue;
    seen.push({ tag, body });
    kept.push(row);
  }
  return kept;
}

function formatMemoryLine(m, index) {
  const when = String(m.timestamp || m.stored_at || m.file || '').slice(0, 19);
  const tag = m.source === 'codegraph'
    ? 'codegraph'
    : String(m.category || m.type || m.source || '');
  const oneLine = memoryBody(m).replace(/\s+/g, ' ').trim().slice(0, 140);
  return `${index}. [${tag}] ${when} ${oneLine}`;
}

function printRecall(recalled) {
  if (!recalled.length) return;
  console.log(chalk.dim('  ↳ 历史记忆:'));
  recalled.forEach((m, i) => console.log(chalk.dim(`    ${formatMemoryLine(m, i + 1)}`)));
}

export async function handleMemoryRecall(_action, params, targetPath, context) {
  // mode（full/brief）只是展示详略，不能影响"读哪几个分类"——旧实现用 mode
  // 控制分类枚举，于是 brief 模式会跳过写过的分类。现在只接受 category。
  const category = params?.category;
  const limit = params?.limit ?? 10;
  const filters = params?.filters;
  const crossProject = params?.cross_project === true;
  const scope = projectScope(targetPath);

  const backendCount = 5;

  const allMemories = [];

  // project-memory 本身就在 <项目>/.claude/memory 里，按 targetPath 定位（不能
  // 用 import 时冻结的 PROJECT_ROOT，否则 --target 跑别的项目会读到引擎自己的记忆）
  const projectMemories = category ? loadProjectMemories(category, targetPath) : loadAllProjectMemories(targetPath);
  // Cap per-backend to avoid one source dominating the limit
  const perSourceLimit = recallQuota(limit, backendCount);
  allMemories.push(...projectMemories.slice(0, perSourceLimit).map(m => ({ ...m, source: 'project-memory', scope: 'project' })));

  const cmScoped = annotateScope(claudeMemItems(category), scope, crossProject, perSourceLimit);
  allMemories.push(...cmScoped.kept.map(m => ({ ...m, source: 'claude-mem', projectPath: m.project?.path || '' })));
  // markdown 归档也是全局的，同样要过归属过滤；文件名前缀就是分类，
  // category 参数不传时全读（旧实现不分 category，过滤等于没生效）
  const mdRecords = category
    ? readClaudeMemMarkdown().filter(m => m.file.startsWith(`${safeTypeName(category)}-`))
    : readClaudeMemMarkdown();
  const cmMdScoped = annotateScope(mdRecords, scope, crossProject, perSourceLimit);
  allMemories.push(...cmMdScoped.kept);

  // agentmemory 在 SQL 层就过滤掉别的项目（cross_project 时才放开全库）
  // 按 category 过滤时得先多读一点再筛（后端不支持在存储层按类型查）。
  // 旧行为是只取 perSourceLimit 条再筛，一旦最近的几条不是目标类型就返回空，
  // 看上去就像「这个类型的记忆不存在」。
  const fetchLimit = category ? Math.max(perSourceLimit * 20, 200) : perSourceLimit;
  const amRaw = crossProject
    ? readAgentmemory(fetchLimit)
    : readAgentmemory(fetchLimit, null, scope.path);
  const amScoped = annotateScope(byCategory(amRaw, category), scope, crossProject, perSourceLimit);
  allMemories.push(...amScoped.kept);

  const nexoScoped = annotateScope(byCategory(readNexoData(fetchLimit), category), scope, crossProject, perSourceLimit);
  allMemories.push(...nexoScoped.kept);

  // codegraph 也必须按 targetPath 定位：它是外部工具在图项目里生成的，
  // 用 import 时冻结的 PROJECT_ROOT 就会把引擎自己的符号图当目标项目的。
  const cg = queryCodeGraph(perSourceLimit, targetPath);
  if (cg.nodes > 0) allMemories.push({ source: 'codegraph', summary: cg });

  // 5 backends total (project-memory, claude-mem, agentmemory, NEXO, CodeGraph)

  const matched = filters
    ? allMemories.filter(m => matchFilter(m, filters))
    : allMemories;
  const recalled = dedupeMemories(matched).slice(0, limit);

  if (context) context.recalled_memories = recalled;
  printRecall(recalled);

  const total = recalled.length;
  const used = [...new Set(recalled.map(m => SOURCE_LABELS[m.source] || m.source))];
  const sourceNote = used.length ? `，来源: ${used.join('/')}` : '';
  const unscoped = cmScoped.unscoped + cmMdScoped.unscoped + amScoped.unscoped + nexoScoped.unscoped;
  const excluded = cmScoped.excluded + cmMdScoped.excluded + amScoped.excluded + nexoScoped.excluded;
  return `项目记忆已召回（${total} 条${sourceNote}${scopeSuffix(unscoped, excluded)}）`;
}

export async function handleMemoryRemember(_action, params, targetPath, context) {
  const type = params?.type || 'general';
  const scope = projectScope(targetPath);
  // 没有显式 data 时用 context 里的当轮结果拼（与 autoRemember 同一形状），
  // **不能**把刚召回的历史行当成新记忆写回去 —— 场景里 remember 步骤都只传
  // {type}，于是每轮都把上一轮的记忆存成本轮成果，一层套一层，旧库里
  // `data_snippet` 里套 `data_snippet` 的膨胀就是这么来的。
  const baseData = params?.data || params?.content || {};

  // Enrich with context findings (same richness as autoRemember)
  const data = typeof baseData === 'object' && !Array.isArray(baseData)
    ? {
        ...baseData,
        findings: {
          security: context?.securityScanResult || baseData.findings?.security || {},
          testPassed: context?.testPassed ?? baseData.findings?.testPassed,
          fixApplied: context?.fixApplied ?? baseData.findings?.fixApplied,
          codeMetricsFindings: context?.codeMetricsFindings ?? baseData.findings?.codeMetricsFindings,
          antiPatternFindings: context?.antiPatternFindings ?? baseData.findings?.antiPatternFindings,
          consistencyScore: context?.consistencyScore ?? baseData.findings?.consistencyScore,
          performancePassed: context?.performancePassed,
          complexityPassed: context?.complexityPassed,
          gateBlocked: context?.gateBlocked,
          lintPassed: context?.lintPassed,
          coveragePassed: context?.coveragePassed,
          deadLinkPassed: context?.deadLinkPassed,
          buildLeakPassed: context?.buildLeakPassed,
          gitLeaksPassed: context?.gitLeaksPassed,
        },
        gateSummary: context?.lastGateResult || baseData.gateSummary,
        completedSteps: context?.completedSteps || baseData.completedSteps || [],
        prompt: context?.prompt || baseData.prompt || '',
        workflow: context?._sceneId || baseData.source || baseData.workflow,
      }
    : baseData;
  let count = 0;
  let entry;
  let duplicated = false;

  try {
    entry = saveProjectMemory(type, data, {
      selection: context?.selectedOption,
      consistencyScore: context?.consistencyScore,
    }, targetPath);
    // duplicate = 1 小时内已有**完全相同**的内容，没再写一份。
    duplicated = entry?.duplicate === true;
    if (context) context.last_memory_id = entry.id;
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 项目记忆写入失败: ${e.message}`));
  }

  try {
    writeClaudeMemItem(type, { id: entry?.id, type, data_snippet: typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200) }, scope);
    writeClaudeMemMarkdown(type, data, scope);
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ Claude-Mem 写入失败: ${e.message}`));
  }

  try {
    const amResult = writeAgentmemory(type, data, [], scope.path);
    if (amResult.ok) {
      count++;
    }
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ agentmemory 写入失败: ${e.message}`));
  }

  try {
    writeNexoEvent(type, data, scope);
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ NEXO 写入失败: ${e.message}`));
  }

  if (context) context._memorySaved = true;
  return `已保存到记忆（${count} 后端${duplicated ? '，项目记忆命中相同内容未重复写入' : ''}）`;
}

export function handleConsolidate(_action, _params, targetPath) {

  const stats = {};

  const pmStats = deduplicateProjectMemories(targetPath);
  stats.projectMemory = pmStats;

  const cmItems = claudeMemItems();
  stats.claudeMem = { entries: cmItems.length, categories: [...new Set(cmItems.map(i => i.category))] };

  const amStats = getAgentmemoryStats();
  stats.agentmemory = amStats;

  const cg = queryCodeGraph(20, targetPath);
  stats.codegraph = { nodes: cg.nodes, edges: cg.edges, files: cg.files };

  // 去重就是删文件，删了几条必须说出来 —— 静默删除用户的记忆不可接受。
  const removedNote = pmStats.removed > 0
    ? `，删除重复 ${pmStats.removed} 条`
    : '';
  const skipNote = pmStats.skipped > 0 ? `，${pmStats.skipped} 条无内容不可比对未动` : '';
  return `记忆整理完成（项目 ${stats.projectMemory.kept}${removedNote}${skipNote} / Claude-Mem ${stats.claudeMem.entries} / agentmemory ${amStats.count} / CodeGraph ${cg.nodes} 节点）`;
}

export function handleListMemories(_action, _params, targetPath) {
  const scope = projectScope(targetPath);
  const memories = loadAllProjectMemories(targetPath);
  const cmAll = claudeMemItems();
  const cmCounts = scopeCounts(cmAll, scope, i => i.project?.path);
  const amCounts = getAgentmemoryScopeCounts(scope.path);
  const nexoAll = readNexoData(5000);
  const nexoCounts = scopeCounts(nexoAll, scope);
  const amStats = getAgentmemoryStats();
  const cg = queryCodeGraph(20, targetPath);

  if (memories.length) {
    memories.slice(0, 10).forEach((m, i) => {
      console.log(chalk.dim(`  ${i + 1}. [${m.type}] ${m.id} — ${m.timestamp}`));
    });
  } else {
    console.log(chalk.dim('  （暂无）'));
  }
  return `记忆列表: ${memories.length} 条（project-memory）` +
    ` + Claude-Mem 全局 ${cmAll.length}（${formatCounts(cmCounts)}）` +
    ` + agentmemory 全局 ${amStats.count}（${formatCounts(amCounts)}）` +
    ` + NEXO 全局 ${nexoAll.length}（${formatCounts(nexoCounts)}）` +
    ` + codegraph ${cg.nodes} 节点`;
}

export function handleAutoRemember(_action, _params, targetPath, context) {
  if (context?._memorySaved) {
    return '自动记忆: 已跳过（显式保存已完成）';
  }

  const scope = projectScope(targetPath);
  const workflowType = context._sceneId || 'general';
  const data = {
    source: 'auto_remember',
    workflow: workflowType,
    timestamp: new Date().toISOString(),
    prompt: context.prompt || '',
    completedSteps: context.completedSteps || [],
    findings: {
      security: context.securityScanResult || {},
      testPassed: context.testPassed,
      fixApplied: context.fixApplied,
      codeMetricsFindings: context.codeMetricsFindings,
      antiPatternFindings: context.antiPatternFindings,
      consistencyScore: context.consistencyScore,
    },
  };

  let count = 0;

  try {
    saveProjectMemory(workflowType, data, {}, targetPath);
    // Count this one too: without it auto-remember reported "3 后端" while
    // explicit remember reported 4 (project-memory + claude-mem + agentmemory +
    // NEXO), even though both wrote the same four stores.
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 项目记忆写入失败: ${e.message}`));
  }

  try {
    // 显式 remember 会同时写 items 与 markdown，auto 只写 markdown 会让两个存储
    // 对不上（list 的条数漏掉 auto 记录）。两边写同一份。
    writeClaudeMemItem(workflowType, { type: workflowType, data_snippet: JSON.stringify(data).slice(0, 200) }, scope);
    writeClaudeMemMarkdown(workflowType, data, scope);
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ Claude-Mem 写入失败: ${e.message}`));
  }

  try {
    const amResult = writeAgentmemory(workflowType, data, [], scope.path);
    if (amResult.ok) {
      count++;
    }
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ agentmemory 写入失败: ${e.message}`));
  }

  try {
    writeNexoEvent(workflowType, data, scope);
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ NEXO 写入失败: ${e.message}`));
  }

  return `自动记忆已保存 (${count} 后端, 类型: ${workflowType})`;
}
