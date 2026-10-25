import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * CEO review handlers — 10x leverage analysis.
 * In CLI mode these are gated on conversation_mode (skipped) because they
 * require LLM reasoning. In conversation mode the agent reads the prompt
 * and produces the analysis.
 */

export function handleAnalyze10x(_action, params, _targetPath, context) {
  const prompt = params?.prompt || '';
  if (context) context.ceo10xPrompt = prompt;
  return `10x 杠杆分析框架已加载（对话模式下由 agent 完成）:\n${prompt}`;
}

export function handleDetectScopeCreep(_action, params, _targetPath, context) {
  const prompt = params?.prompt || '';
  if (context) context.ceoScopeCreepPrompt = prompt;
  return `范围蔓延检测框架已加载（对话模式下由 agent 完成）:\n${prompt}`;
}

export function handleUserImpactMatrix(_action, params, _targetPath, context) {
  const prompt = params?.prompt || '';
  if (context) context.ceoUserImpactPrompt = prompt;
  return `用户价值矩阵框架已加载（对话模式下由 agent 完成）:\n${prompt}`;
}

export function handleCategorize(_action, params, _targetPath, context) {
  const buckets = params?.buckets || {};
  if (context) context.ceoBuckets = buckets;
  const summary = Object.entries(buckets).map(([k, v]) => `${k}: ${v}`).join(' | ');
  return `三桶分类框架已加载: ${summary}`;
}

export function handleGenerateCEOReport(_action, params, targetPath, context) {
  const output = (params?.output || '.claude/ceo-review-{timestamp}.md').replace('{timestamp}', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  const outPath = join(targetPath, output);
  try {
    mkdirSync(join(targetPath, '.claude'), { recursive: true });
    const md = [
      '# CEO Review Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## 10x Leverage Analysis',
      context?.ceo10xPrompt ? `> ${context.ceo10xPrompt}` : '(pending agent analysis)',
      '',
      '## Scope Creep Detection',
      context?.ceoScopeCreepPrompt ? `> ${context.ceoScopeCreepPrompt}` : '(pending agent analysis)',
      '',
      '## User Impact Matrix',
      context?.ceoUserImpactPrompt ? `> ${context.ceoUserImpactPrompt}` : '(pending agent analysis)',
      '',
      '## Three-Bucket Classification',
      context?.ceoBuckets ? JSON.stringify(context.ceoBuckets, null, 2) : '(pending agent analysis)',
      '',
      '> Full analysis requires conversation mode (agent reasoning).',
    ];
    writeFileSync(outPath, md.join('\n'), 'utf8');
    if (context) context.ceoReportPath = outPath;
    return `CEO 精简策略报告已生成: ${outPath}`;
  } catch (e) {
    return `CEO 报告生成失败: ${e.message}`;
  }
}
