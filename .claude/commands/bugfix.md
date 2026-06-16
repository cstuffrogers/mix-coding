---
description: Launch bug fix scenario: reproduce, locate root cause, create fix plan, verify with tests.
argument-hint: "[问题描述]"
---

# /bugfix — Bug 修复

32 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → Skill 诊断 → 定位修复 → 安全扫描 → 验证 → 交付**

## Usage

```text
/bugfix                          # 交互式修复流程
/bugfix 登录页面表单验证不生效     # 带问题描述
```

## 执行流程

### Phase 0: Pre-flight 准备

1. **autoUpdate** (`step 0`) — 拉取最新代码，避免合并冲突
2. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，建立 Bug 分析框架（对话模式）
3. **recall** (`step 0.5`) — 注入历史 bug 修复上下文和已知问题模式

### Phase 1: 上下文收集

- **GitHub MCP** (`step 1`) — 列出最近的 bug issues
- **Sentry MCP** (`step 1.1`) — 查询最近 7 天错误事件
- **Tavily MCP** (`step 1.2`) — 搜索同类 bug 解决方案
- **Context7 MCP** (`step 1.3`) — 获取技术文档
- **CodeGraph MCP** (`step 1.4`) — 分析依赖关系
- **Skill("sec-bug-hunt")** (`step 1.5`) — 安全漏洞扫描，确定修复边界（对话模式）
- **issueQuery** (`step 1.6`) — 查询目标 bug issue

### Phase 2: 诊断

8. **Skill("review")** (`step 2`) — Matt Pocock 双轴审查：标准轴（编码规范）+ 规范轴（issue/PRD 对照）（对话模式）
9. **detectLanguage** (`step 2.5`) — 检测项目语言生态
10. **languageBuild** (`step 2.6`) — 非 JS 项目构建验证

### Phase 3: 修复

11. **createBranch** (`step 3`) — 创建 fix 分支
12. **locate** (`step 3.5`) — 定位受影响文件
13. **checkAPIConsistency** (`step 3.6`) — API 契约一致性检查
14. **fix** (`step 4`) — 语义修复

### Phase 4: 验证

15. **aislop-scan** (`step 4.3`) — AI 代码气味扫描，检查修复是否引入反模式
16. **runSuite** (`step 4.5`) — 回归测试全量跑通
17. **checkCoverage** (`step 4.6`) — 测试覆盖率检查
18. **Skill("webapp-testing")** (`step 4.7`) — Playwright 浏览器验证（对话模式，Web 项目）
19. **verify** (`step 5`) — 验证修复

### Phase 5: 交付

20. **verifyFix** (`step 5.5`) — 人工确认（交互式）
21. **commitPush** (`step 6`) — Conventional Commits 提交 + 推送
22. **createPR** (`step 7`) — 自动生成 PR
23. **regression** (`step 8`) — PR 回归测试
24. **closeTicket** (`step 9`) — 自动关闭 issue

### Phase 6: 沉淀

25. **ce-compound** (`step 9.5`) — CE 知识沉淀到 CLAUDE.md
26. **remember** (`step 9.6`) — 保存修复过程和根因到记忆
27. **consolidate** (`step 9.7`) — 整理跨后端记忆一致性
28. **notify** (`step 10`) — 通知修复完成

### 关键改进

| 改进项 | 原来 | 现在 |
|--------|------|------|
| Pre-flight | 无审查清单 | Skill("review-checklist") 23 项分析框架 |
| MP triage | mp-triage 占位消息 | Skill("sec-bug-hunt") 安全扫描 |
| MP diagnose | mp-diagnose 占位消息 | Skill("review") 双轴审查 |
| 修复质量 | 无代码气味检查 | aislop-scan 50+ 规则 |
| Web 验证 | invokeSkill capability 层 | 统一 Skill 层 conversation_mode |
| 知识沉淀 | 无 CE compound | ce-compound 自动沉淀 |

### CLI 模式回退

在 CLI 模式（非对话）下，Skill 步骤（`review-checklist`、`sec-bug-hunt`、`review`、`webapp-testing`）因为 `conversation_mode` 条件不满足而自动跳过。MP triage/diagnose 的占位消息已移除，功能由实际 Skill 调用替代。
