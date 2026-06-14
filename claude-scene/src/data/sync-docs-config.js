// Scene classification config for sync-docs.js
// Extracted to reduce sync-docs.js size (architectural deep audit: god_object fix)

export const PROMPT_SCENES = new Set([
  'feature', 'bugfix', 'refactor', 'new-project', 'design', 'analyze', 'prototype',
]);

export const THEME_SCENES = new Set(['ui-polish']);

export const SKIP_ENHANCEMENT = new Set([
  'bugfix', 'hunt', 'analyze', 'loop', 'simplify', 'optimize', 'design',
  'deps', 'monitor', 'cicd', 'backup', 'incident', 'e2e', 'docker',
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
  simplify: '代码简化',
  hunt: '安全扫描',
  analyze: '竞品分析',
  design: 'AI 设计',
  loop: '自动迭代',
  'new-project': '新项目创建',
  release: '发布部署',
  audit: '全面健康检查',
  prototype: '快速原型',
  deps: '依赖更新',
  rollback: '紧急回滚',
  onboard: '环境搭建',
  monitor: '网站监控配置',
  cicd: 'CI/CD 配置',
  backup: '备份配置',
  incident: '事故响应',
  e2e: 'E2E 测试配置',
  docker: 'Docker 容器化',
  changelog: '变更日志',
  sbom: 'SBOM 许可证合规',
  log: '日志聚合',
  migration: '数据库迁移审查',
  loadtest: '负载测试',
};
