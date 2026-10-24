// Scene classification config for sync-docs.js
// Extracted to reduce sync-docs.js size (architectural deep audit: god_object fix)

export const PROMPT_SCENES = new Set([
  'feature', 'bugfix', 'refactor', 'new-project', 'design', 'analyze', 'prototype',
]);

export const THEME_SCENES = new Set(['ui-polish']);

export const SKIP_ENHANCEMENT = new Set([
  'bugfix', 'loop', 'optimize',
  'deps', 'setup', 'cicd', 'backup', 'incident',
  'changelog', 'sbom', 'log', 'prototype', 'rollback', 'onboard',
  'migration', 'loadtest',
]);

// Scenes with natural-language trigger detail (maintained manually)
export const SCENE_LABELS = {
  'ui-polish': '前端美化',
  bugfix: 'Bug 修复',
  feature: '新增功能',
  review: '代码审查',
  refactor: '代码重构',
  optimize: '性能优化',
  setup: '测试/监控设施',
  deps: '依赖更新',
  rollback: '紧急回滚',
  onboard: '环境搭建',
  cicd: 'CI/CD 配置',
  backup: '备份配置',
  incident: '事故响应',
  docker: 'Docker 容器化',
  changelog: '变更日志',
  sbom: 'SBOM 许可证合规',
  log: '日志聚合',
  migration: '数据库迁移审查',
  loadtest: '负载测试',
};
