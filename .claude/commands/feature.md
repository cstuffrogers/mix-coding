---
description: Launch feature development: Pre-flight checklist → context gathering → Skill planning → implement → test → security scan → review → deliver → CE compound.
argument-hint: "[功能描述]"
---

# /feature — 新功能开发

30 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → Skill 规划 + 宪法校验 → 实现 → 测试 → 安全扫描 → 审查 → 交付 → CE 沉淀**

## Usage

```text
/feature                         # 交互式开发流程
/feature 添加用户管理功能         # 带功能描述
```

## 执行流程

### Phase 0: Pre-flight 准备

1. **autoUpdate** (`step 0`) — 拉取最新代码，避免合并冲突
2. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，建立功能开发分析框架（对话模式）
3. **recall** (`step 0.5`) — 回溯最近 5 条有效 issue/PR 作为开发上下文

### Phase 1: 上下文收集

- **GitHub MCP** (`step 1`) — 列出最近的 issues
- **Context7 MCP** (`step 1.1`) — 获取技术文档
- **Supabase MCP** (`step 1.2`) — 获取数据库结构

### Phase 2: 规划

7. **Skill("review")** (`step 2`) — Matt Pocock /grill-me 替代：双轴审查规划 — 标准轴（编码规范）+ 规范轴（需求/PRD 对照）（对话模式）
8. **Skill("constitution-reference")** (`step 2.3`) — jvn 宪法校验：检查功能设计是否符合项目宪法原则（对话模式）
9. **detectLanguage** (`step 2.5`) — 检测项目语言生态
10. **languageBuild** (`step 2.6`) — 非 JS 项目构建验证
11. **languageTest** (`step 2.7`) — 非 JS 项目测试基线

### Phase 3: 实现

12. **createBranch** (`step 3`) — 创建 feature 分支
13. **checkAPIConsistency** (`step 3.5`) — API 契约一致性检查
14. **Skill("sec-bug-hunt")** (`step 3.6`) — 安全漏洞预扫描（对话模式）

### Phase 4: 测试

15. **generateTest** (`step 4`) — 生成单元测试（覆盖率 90%+）
16. **runSuite** (`step 4.5`) — 运行测试套件
17. **checkCoverage** (`step 4.6`) — 覆盖率门禁（85% 阈值）
18. **Skill("webapp-testing")** (`step 4.7`) — Playwright E2E 验证（对话模式，Web 项目）
19. **verify** (`step 4.8`) — 功能验证

### Phase 5: 审查

20. **runReview** (`step 5`) — ESLint + TypeScript 静态分析
21. **aislop-scan** (`step 5.3`) — AI 代码气味扫描（50+ 规则）
22. **checkGate** (`step 5.5`) — 质量门禁（6 项检查）

### Phase 6: 交付

23. **confirm** (`step 6`) — 人工确认（交互式）
24. **commitPush** (`step 7`) — Conventional Commits 提交 + 推送
25. **Skill("review")** (`step 7.5`) — Matt Pocock /handoff 替代：生成功能交接文档（对话模式）

### Phase 7: 沉淀

26. **ce-compound** (`step 8`) — CE 知识沉淀到 CLAUDE.md
27. **remember** (`step 8.5`) — 保存开发上下文到记忆
28. **consolidate** (`step 8.6`) — 整理跨后端记忆一致性
29. **notify** (`step 9`) — 通知开发完成

### 关键改进

| 改进项 | 原来 | 现在 |
|--------|------|------|
| Pre-flight | 无审查清单 | Skill("review-checklist") 23 项分析框架 |
| MP grill-me | mp-grill-me 占位消息 | Skill("review") 双轴审查规划 |
| MP tdd | mp-tdd 交互占位 | 移除（功能已覆盖在测试阶段） |
| MP handoff | mp-handoff 占位消息 | Skill("review") 交接文档生成 |
| jvn 校验 | 无 | Skill("constitution-reference") 宪法校验 |
| 安全预扫描 | 无 | Skill("sec-bug-hunt") 实现前安全扫描 |
| 代码气味 | 无 | aislop-scan 50+ 规则 |
| CE 沉淀 | 无 | ce-compound 自动沉淀 |
| Web 测试层 | invokeSkill capability 层 | 统一 Skill 层 conversation_mode |

### CLI 模式回退

在 CLI 模式（非对话）下，Skill 步骤（`review-checklist`、`review`、`constitution-reference`、`sec-bug-hunt`、`webapp-testing`）因为 `conversation_mode` 条件不满足而自动跳过。MP grill-me/tdd/handoff 的占位消息已移除，功能由实际 Skill 调用替代。
