import chalk from 'chalk';
import { readClaudeMemItems, writeClaudeMemItem, readClaudeMemMarkdown, writeClaudeMemMarkdown } from './memory/claude-mem.js';
import { readAgentmemory, writeAgentmemory, getAgentmemoryStats } from './memory/agentmemory.js';
import { readNexoData } from './memory/nexo.js';
import { queryCodeGraph } from './memory/codegraph.js';
import { loadProjectMemories, loadAllProjectMemories, saveProjectMemory, matchFilter, deduplicateProjectMemories } from './memory/project-memory.js';
import { recallFromSupermemory, saveToSupermemory, supermemoryStatus, shouldSkipSave } from './memory/supermemory.js';

// ── Public handlers ──────────────────────────────────────────────
export async function handleMemoryRecall(_action, params, _targetPath, context) {
  const mode = params?.mode;
  const category = params?.category;
  const limit = params?.limit ?? 10;
  const filters = params?.filters;

  const smStatus = supermemoryStatus();
  const backendCount = smStatus.available ? 6 : 5;
  console.log(chalk.blue(`\n📖 正在召回项目记忆（${backendCount} 后端）...`));

  const allMemories = [];

  let projectMemories;
  projectMemories = category ? loadProjectMemories(category) : loadAllProjectMemories();
  // Cap per-backend to avoid one source dominating the limit
  const perSourceLimit = Math.max(5, Math.ceil(limit / Math.max(backendCount, 1)));
  allMemories.push(...projectMemories.slice(0, perSourceLimit).map(m => ({ ...m, source: 'project-memory' })));
  console.log(chalk.dim(`  📁 项目记忆: ${projectMemories.length} 条`));

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
  console.log(chalk.dim(`  🧠 Claude-Mem: ${cmItems.length} items + ${cmMd.length} markdown`));

  const amMemories = readAgentmemory(perSourceLimit);
  allMemories.push(...amMemories);
  console.log(chalk.dim(`  🔌 agentmemory: ${amMemories.length} 条`));

  const nexo = readNexoData();
  allMemories.push(...nexo.slice(0, perSourceLimit));
  console.log(chalk.dim(`  🌐 NEXO Brain: ${nexo.length} 条`));

  const cg = queryCodeGraph(perSourceLimit);
  allMemories.push({ source: 'codegraph', summary: cg });
  console.log(chalk.dim(`  📊 CodeGraph: ${cg.nodes} 节点, ${cg.edges} 边, ${cg.files} 文件`));

  // 7th backend: Supermemory (cloud, optional)
  if (smStatus.available) {
    const smMemories = await recallFromSupermemory({
      type: category || 'general',
      query: filters?.query || params?.query || '',
      limit: perSourceLimit,
    });
    allMemories.push(...smMemories);
    console.log(chalk.dim(`  ☁️  Supermemory: ${smMemories.length} 条`));
  }

  const recalled = filters
    ? allMemories.filter(m => matchFilter(m, filters)).slice(0, limit)
    : allMemories.slice(0, limit);
  if (filters) console.log(chalk.dim(`  过滤后: ${recalled.length} 条`));

  if (context) context.recalled_memories = recalled;

  const total = recalled.length;
  const sources = ['项目', 'Claude-Mem', 'agentmemory', 'NEXO', 'CodeGraph'];
  if (smStatus.available) sources.push('Supermemory');
  console.log(chalk.green(`  ✅ 召回 ${total} 条（${backendCount} 后端聚合）`));
  return `项目记忆已召回（${total} 条，来源: ${sources.join('/')}）`;
}

export async function handleMemoryRemember(_action, params, _targetPath, context) {
  const smStatus = supermemoryStatus();
  const backendCount = smStatus.available ? 6 : 5;
  console.log(chalk.blue(`\n📝 正在保存到记忆（${backendCount} 后端）...`));
  const type = params?.type || 'general';
  const data = params?.data || params?.content || (context?.recalled_memories?.length ? context.recalled_memories : null) || {};
  let count = 0;
  let entry;

  try {
    entry = saveProjectMemory(type, data, {
      selection: context?.selectedOption,
      consistencyScore: context?.consistencyScore,
    });
    console.log(chalk.dim(`  📁 项目记忆: ${type}/${entry.id}`));
    if (context) context.last_memory_id = entry.id;
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 项目记忆写入失败: ${e.message}`));
  }

  try {
    writeClaudeMemItem(type, { id: entry?.id, type, data_snippet: typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200) });
    writeClaudeMemMarkdown(type, data);
    console.log(chalk.dim(`  🧠 Claude-Mem: items.json + markdown`));
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ Claude-Mem 写入失败: ${e.message}`));
  }

  try {
    const amResult = writeAgentmemory(type, data, []);
    if (amResult.ok) {
      console.log(chalk.dim(`  🔌 agentmemory: ${amResult.id}`));
      count++;
    }
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ agentmemory 写入失败: ${e.message}`));
  }

  console.log(chalk.dim('  🌐 NEXO/CodeGraph: 将在下次代码分析时自动索引'));

  // 7th backend: Supermemory (cloud, optional)
  if (smStatus.available && !shouldSkipSave(type, data)) {
    try {
      const smResult = await saveToSupermemory(type, data);
      if (smResult?.ok) {
        console.log(chalk.dim(`  ☁️  Supermemory: ${smResult.id}`));
        count++;
      }
    } catch (e) {
      console.log(chalk.yellow(`  ⚠ Supermemory 写入失败: ${e.message}`));
    }
  }

  console.log(chalk.green(`  ✅ 已保存到 ${count} 个后端`));
  if (context) context._memorySaved = true;
  return `已保存到记忆（${count} 后端）`;
}

export function handleConsolidate(_action, _params, _targetPath) {
  console.log(chalk.blue('\n🔗 正在整理跨组件记忆一致性...'));

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

  const smStatus = supermemoryStatus();
  stats.supermemory = smStatus;

  console.log(chalk.dim(`  📁 项目记忆: ${stats.projectMemory.kept} 条（去重 ${stats.projectMemory.removed}）`));
  console.log(chalk.dim(`  🧠 Claude-Mem: ${stats.claudeMem.entries} 条`));
  console.log(chalk.dim(`  🔌 agentmemory: ${amStats.count} 条`));
  console.log(chalk.dim(`  📊 CodeGraph: ${cg.nodes} 节点, ${cg.edges} 边`));
  if (smStatus.available) console.log(chalk.dim(`  ☁️  Supermemory: 已连接`));
  else if (smStatus.configured) console.log(chalk.yellow(`  ☁️  Supermemory: ${smStatus.error || '未连接'}`));

  console.log(chalk.green(`  ✅ 跨后端一致性整理完成`));
  const smPart = smStatus.available ? ' / Supermemory' : '';
  return `记忆整理完成（项目 ${stats.projectMemory.kept} / Claude-Mem ${stats.claudeMem.entries} / agentmemory ${amStats.count} / CodeGraph ${cg.nodes} 节点${smPart}）`;
}

export function handleListMemories(_action, _params, _targetPath) {
  console.log(chalk.blue('\n📚 已保存的记忆列表:'));
  const memories = loadAllProjectMemories();
  const cmAll = ['general', 'architecture', 'decision', 'pattern'].flatMap(c => readClaudeMemItems(c));
  const amStats = getAgentmemoryStats();
  const cg = queryCodeGraph();
  const smStatus = supermemoryStatus();

  if (memories.length) {
    memories.slice(0, 10).forEach((m, i) => {
      console.log(chalk.dim(`  ${i + 1}. [${m.type}] ${m.id} — ${m.timestamp}`));
    });
    if (memories.length > 10) console.log(chalk.dim(`  ... 还有 ${memories.length - 10} 条`));
  } else {
    console.log(chalk.dim('  （暂无）'));
  }
  const smInfo = smStatus.available ? ' / Supermemory' : '';
  console.log(chalk.dim(`  🧠 Claude-Mem: ${cmAll.length} 条 | 🔌 agentmemory: ${amStats.count} 条 | 📊 CodeGraph: ${cg.nodes} 节点${smInfo}`));
  return `记忆列表: ${memories.length} 条（project-memory）+ ${cmAll.length}（claude-mem）+ ${amStats.count}（agentmemory）+ ${cg.nodes}（codegraph）${smInfo}`;
}

export function handleAutoRemember(_action, _params, _targetPath, context) {
  if (context?._memorySaved) {
    console.log(chalk.dim('  📝 记忆已在工作流中显式保存，跳过自动保存'));
    return '自动记忆: 已跳过（显式保存已完成）';
  }

  console.log(chalk.blue('\n📝 自动保存工作流上下文到记忆...'));

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
    const entry = saveProjectMemory(workflowType, data, {});
    console.log(chalk.dim(`  📁 项目记忆: ${workflowType}/${entry.id}`));
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ 项目记忆写入失败: ${e.message}`));
  }

  try {
    writeClaudeMemMarkdown(workflowType, data);
    console.log(chalk.dim('  🧠 Claude-Mem: markdown'));
    count++;
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ Claude-Mem 写入失败: ${e.message}`));
  }

  try {
    const amResult = writeAgentmemory(workflowType, data, []);
    if (amResult.ok) {
      console.log(chalk.dim(`  🔌 agentmemory: ${amResult.id}`));
      count++;
    }
  } catch (e) {
    console.log(chalk.yellow(`  ⚠ agentmemory 写入失败: ${e.message}`));
  }

  console.log(chalk.green(`  ✅ 自动保存到 ${count} 个后端`));
  return `自动记忆已保存 (${count} 后端, 类型: ${workflowType})`;
}
