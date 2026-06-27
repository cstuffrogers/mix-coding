import chalk from 'chalk';
import { readClaudeMemItems, writeClaudeMemItem, readClaudeMemMarkdown, writeClaudeMemMarkdown } from './memory/claude-mem.js';
import { readAgentmemory, writeAgentmemory, getAgentmemoryStats } from './memory/agentmemory.js';
import { readNexoData, writeNexoEvent } from './memory/nexo.js';
import { queryCodeGraph } from './memory/codegraph.js';
import { loadProjectMemories, loadAllProjectMemories, saveProjectMemory, matchFilter, deduplicateProjectMemories } from './memory/project-memory.js';

// ── Public handlers ──────────────────────────────────────────────
export async function handleMemoryRecall(_action, params, _targetPath, context) {
  const mode = params?.mode;
  const category = params?.category;
  const limit = params?.limit ?? 10;
  const filters = params?.filters;

  const backendCount = 5;

  const allMemories = [];

  let projectMemories;
  projectMemories = category ? loadProjectMemories(category) : loadAllProjectMemories();
  // Cap per-backend to avoid one source dominating the limit
  const perSourceLimit = Math.max(5, Math.ceil(limit / Math.max(backendCount, 1)));
  allMemories.push(...projectMemories.slice(0, perSourceLimit).map(m => ({ ...m, source: 'project-memory' })));

  const cmItems = category ? readClaudeMemItems(category) : [];
  if (mode === 'full' || !category) {
    const allCat = ['general', 'architecture', 'decision', 'pattern'];
    for (const cat of allCat) {
      if (cat !== category) cmItems.push(...readClaudeMemItems(cat));
    }
  }
  allMemories.push(...cmItems.slice(0, perSourceLimit).map(m => ({ ...m, source: 'claude-mem' })));
  const cmMd = readClaudeMemMarkdown();
  allMemories.push(...cmMd.slice(0, perSourceLimit));

  const amMemories = readAgentmemory(perSourceLimit);
  allMemories.push(...amMemories);

  const nexo = readNexoData();
  allMemories.push(...nexo.slice(0, perSourceLimit));

  const cg = queryCodeGraph(perSourceLimit);
  allMemories.push({ source: 'codegraph', summary: cg });

  // 6 backends total (project-memory, claude-mem, agentmemory, NEXO, CodeGraph, MemPalace)

  const recalled = filters
    ? allMemories.filter(m => matchFilter(m, filters)).slice(0, limit)
    : allMemories.slice(0, limit);

  if (context) context.recalled_memories = recalled;

  const total = recalled.length;
  const sources = ['项目', 'Claude-Mem', 'agentmemory', 'NEXO', 'CodeGraph'];
  return `项目记忆已召回（${total} 条，来源: ${sources.join('/')}）`;
}

export async function handleMemoryRemember(_action, params, _targetPath, context) {
  const type = params?.type || 'general';
  const baseData = params?.data || params?.content || (context?.recalled_memories?.length ? context.recalled_memories : null) || {};

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

  try {
    entry = saveProjectMemory(type, data, {
      selection: context?.selectedOption,
      consistencyScore: context?.consistencyScore,
    });
    if (context) context.last_memory_id = entry.id;
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 项目记忆写入失败: ${e.message}`));
  }

  try {
    writeClaudeMemItem(type, { id: entry?.id, type, data_snippet: typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200) });
    writeClaudeMemMarkdown(type, data);
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ Claude-Mem 写入失败: ${e.message}`));
  }

  try {
    const amResult = writeAgentmemory(type, data, []);
    if (amResult.ok) {
      count++;
    }
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ agentmemory 写入失败: ${e.message}`));
  }

  try {
    writeNexoEvent(type, data);
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ NEXO 写入失败: ${e.message}`));
  }

  if (context) context._memorySaved = true;
  return `已保存到记忆（${count} 后端）`;
}

export function handleConsolidate(_action, _params, _targetPath) {

  const stats = {};

  const pmStats = deduplicateProjectMemories();
  stats.projectMemory = pmStats;

  const cmItems = ['general', 'architecture', 'decision', 'pattern'].flatMap(c => {
    const items = readClaudeMemItems(c);
    return items.map(i => ({ ...i, category: c }));
  });
  stats.claudeMem = { entries: cmItems.length, categories: [...new Set(cmItems.map(i => i.category))] };

  const amStats = getAgentmemoryStats();
  stats.agentmemory = amStats;

  const cg = queryCodeGraph();
  stats.codegraph = { nodes: cg.nodes, edges: cg.edges, files: cg.files };

  return `记忆整理完成（项目 ${stats.projectMemory.kept} / Claude-Mem ${stats.claudeMem.entries} / agentmemory ${amStats.count} / CodeGraph ${cg.nodes} 节点）`;
}

export function handleListMemories(_action, _params, _targetPath) {
  const memories = loadAllProjectMemories();
  const cmAll = ['general', 'architecture', 'decision', 'pattern'].flatMap(c => readClaudeMemItems(c));
  const amStats = getAgentmemoryStats();
  const cg = queryCodeGraph();

  if (memories.length) {
    memories.slice(0, 10).forEach((m, i) => {
      console.log(chalk.dim(`  ${i + 1}. [${m.type}] ${m.id} — ${m.timestamp}`));
    });
  } else {
    console.log(chalk.dim('  （暂无）'));
  }
  return `记忆列表: ${memories.length} 条（project-memory）+ ${cmAll.length}（claude-mem）+ ${amStats.count}（agentmemory）+ ${cg.nodes}（codegraph）`;
}

export function handleAutoRemember(_action, _params, _targetPath, context) {
  if (context?._memorySaved) {
    return '自动记忆: 已跳过（显式保存已完成）';
  }

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
    saveProjectMemory(workflowType, data, {});
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 项目记忆写入失败: ${e.message}`));
  }

  try {
    writeClaudeMemMarkdown(workflowType, data);
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ Claude-Mem 写入失败: ${e.message}`));
  }

  try {
    const amResult = writeAgentmemory(workflowType, data, []);
    if (amResult.ok) {
      count++;
    }
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ agentmemory 写入失败: ${e.message}`));
  }

  try {
    writeNexoEvent(workflowType, data);
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ NEXO 写入失败: ${e.message}`));
  }

  return `自动记忆已保存 (${count} 后端, 类型: ${workflowType})`;
}
