---
description: Browser-based QA verification — read git diff, test affected routes, find bugs
argument-hint: "[options]"
---

# /qa — 浏览器 QA 验证

混合工作流：**变更分析 → 浏览器测试 → Bug 报告**

## Usage

```text
/qa                        # QA test uncommitted changes
/qa --base main            # QA test changes against base branch
/qa --route /dashboard     # QA test specific route only
```

## 执行流程

### Phase 0: 变更分析

1. **git diff** (`step 1`) — 获取变更文件列表，识别前端文件（.tsx/.jsx/.vue/.html/.css）
2. **路由映射** (`step 2`) — 从变更文件反推受影响的路由/页面，若无前端变更则跳过后续步骤
3. **recall** (`step 0.5`) — 注入历史 QA 发现和已知脆弱点

### Phase 1: 浏览器测试

4. **页面加载** (`step 3`) — 打开受影响页面，检查：白屏/报错/加载超时、控制台 error/warning、网络请求失败 (4xx/5xx)
5. **交互验证** (`step 4`) — 核心流程：表单提交、导航跳转、弹窗/Modal 开关、按钮点击响应
6. **视觉回归** (`step 5`) — 截图对比：布局错乱、样式丢失、响应式断点、暗色模式
7. **无障碍快速扫描** (`step 6`) — img-alt / input-label / contrast-risk / clickable-div

### Phase 2: Bug 报告

8. **严重度分类** (`step 7`)：🔴 BLOCKER / 🟡 MAJOR / 🔵 MINOR
9. **生成报告** (`step 8`) — 结构化 QA 报告，含截图路径和复现步骤
10. **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 变更分析 | git diff + 路由解析 | CLI |
| 浏览器测试 | Playwright / MCP browser / WebFetch | 按可用性选择 |
| 视觉回归 | 截图对比 + 无障碍扫描 | CLI |
| 报告 | 结构化 Markdown + 记忆沉淀 | CLI |

### 无前端变更时

若 git diff 无 .tsx/.jsx/.vue/.html/.css 文件，自动跳过浏览器测试，仅输出"无前端变更，跳过 QA"。
