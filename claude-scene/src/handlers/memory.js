import chalk from 'chalk';
import { readClaudeMemItems, writeClaudeMemItem, readClaudeMemMarkdown, writeClaudeMemMarkdown } from './memory/claude-mem.js';
import { readAgentmemory, writeAgentmemory, getAgentmemoryStats } from './memory/agentmemory.js';
import { readNexoData, writeNexoEvent } from './memory/nexo.js';
import { queryCodeGraph } from './memory/codegraph.js';
import { loadProjectMemories, loadAllProjectMemories, saveProjectMemory, matchFilter, deduplicateProjectMemories } from './memory/project-memory.js';
import { projectScope, classifyScope, includeInRecall } from './memory/project-scope.js';

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

// ── Public handlers ──────────────────────────────────────────────
export async function handleMemoryRecall(_action, params, targetPath, context) {
  const mode = params?.mode;
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

  const cmItems = category ? readClaudeMemItems(category) : [];
  if (mode === 'full' || !category) {
    const allCat = ['general', 'architecture', 'decision', 'pattern'];
    for (const cat of allCat) {
      if (cat !== category) cmItems.push(...readClaudeMemItems(cat));
    }
  }
  const cmScoped = annotateScope(cmItems, scope, crossProject, perSourceLimit);
  allMemories.push(...cmScoped.kept.map(m => ({ ...m, source: 'claude-mem', projectPath: m.project?.path || '' })));
  // markdown 归档也是全局的，同样要过归属过滤
  const cmMdScoped = annotateScope(readClaudeMemMarkdown(), scope, crossProject, perSourceLimit);
  allMemories.push(...cmMdScoped.kept);

  // agentmemory 在 SQL 层就过滤掉别的项目（cross_project 时才放开全库）
  const amRaw = crossProject
    ? readAgentmemory(perSourceLimit)
    : readAgentmemory(perSourceLimit, null, scope.path);
  const amScoped = annotateScope(amRaw, scope, crossProject, perSourceLimit);
  allMemories.push(...amScoped.kept);

  const nexoScoped = annotateScope(readNexoData(perSourceLimit), scope, crossProject, perSourceLimit);
  allMemories.push(...nexoScoped.kept);

  // codegraph 也必须按 targetPath 定位：它是外部工具在图项目里生成的，
  // 用 import 时冻结的 PROJECT_ROOT 就会把引擎自己的符号图当目标项目的。
  const cg = queryCodeGraph(perSourceLimit, targetPath);
  if (cg.nodes > 0) allMemories.push({ source: 'codegraph', summary: cg });

  // 5 backends total (project-memory, claude-mem, agentmemory, NEXO, CodeGraph)

  const recalled = filters
    ? allMemories.filter(m => matchFilter(m, filters)).slice(0, limit)
    : allMemories.slice(0, limit);

  if (context) context.recalled_memories = recalled;

  const total = recalled.length;
  const sources = ['项目', 'Claude-Mem', 'agentmemory', 'NEXO', 'CodeGraph'];
  const unscoped = cmScoped.unscoped + cmMdScoped.unscoped + amScoped.unscoped + nexoScoped.unscoped;
  const excluded = cmScoped.excluded + cmMdScoped.excluded + amScoped.excluded + nexoScoped.excluded;
  return `项目记忆已召回（${total} 条，来源: ${sources.join('/')}${scopeSuffix(unscoped, excluded)}）`;
}

export async function handleMemoryRemember(_action, params, targetPath, context) {
  const type = params?.type || 'general';
  const scope = projectScope(targetPath);
  // Recall truncates long rows for prompt size; re-saving those would persist a
  // lossy copy into all four backends, then the truncation compounds on the next
  // round. Only reuse recall rows that came back whole.
  // 另外只回写「本项目」的行：把别的项目 / 无归属的历史行写回去，等于给它们
  // 盖上本项目的章，下一轮就再也分不清来源了。
  const wholeRecalled = (context?.recalled_memories || [])
    .filter(m => m.truncated !== true && m.scope !== 'cross-project' && m.scope !== 'unscoped');
  const baseData = params?.data || params?.content || (wholeRecalled.length ? wholeRecalled : null) || {};

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

  const cmItems = ['general', 'architecture', 'decision', 'pattern'].flatMap(c => {
    const items = readClaudeMemItems(c);
    return items.map(i => ({ ...i, category: c }));
  });
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
  const cmAll = ['general', 'architecture', 'decision', 'pattern'].flatMap(c => readClaudeMemItems(c));
  const cmCounts = scopeCounts(cmAll, scope, i => i.project?.path);
  const amAll = readAgentmemory(10000);
  const amCounts = scopeCounts(amAll, scope);
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
