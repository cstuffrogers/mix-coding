# React Doctor 去重规则

## 核心原则
react-doctor 专注 React 语义级错误，不与 ESLint 重复。

## 去重配置
- adoptExistingLintConfig: false
- 忽略规则：react-doctor/no-missing-use-effect-deps、react-doctor/no-rules-of-hooks
- ESLint 不启用 React Hooks 规则（由 react-doctor 负责）

## 负责
- React effects 依赖分析
- RSC（React Server Components）错误
- React 性能问题

## 不负责
- 语法检查（ESLint）
- 纯样式问题
