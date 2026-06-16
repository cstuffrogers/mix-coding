---
description: Create a new project: Pre-flight design baseline → shape design brief (taste direction) → context gathering → Skill planning → scaffold → Open Design → Impeccable full-suite polish（critique detect → polish+layout+colorize+bolder+typeset+animate+delight+harden+distill+clarify+adapt+optimize → critique verify, dual-pass QC）+ AI-Friendly a11y → implement → review → CE compound.
argument-hint: "[项目描述]"
---

# /new-project — 新项目创建

65 步混合工作流：**Pre-flight 设计基准（对话模式）→ shape 设计简报确立品味方向 → 上下文收集 → Skill 规划 → 脚手架 → Git guardrails → Open Design → Impeccable 全维度打磨（Huashu 基线 → critique 检测 → polish+layout+colorize+bolder+typeset+animate+delight+harden+distill+clarify+adapt+optimize → critique 验证 → 3 项精准残留修复 → Huashu 验证，双轮品控+残留修复）+ AI-Friendly 可访问性审查（对话模式，⚠️ 前端项目必须执行）→ 实现 → 审查 → CE 沉淀**

## Usage

```text
/new-project React+TS 后台管理系统，需要用户管理、角色权限、数据看板
/new-project "Vue3 + Express full-stack blog with auth"
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("web-design-engineer")** (`step 0.3`) — 声明设计系统基准（Palette/Typography/Spacing/Motion/Radius/Shadows），加载 150 品牌系统（前端项目）
2. **Skill("review-checklist")** (`step 0.5`) — 加载 23 项审查清单，建立项目初始化分析框架
3. **recall** (`step 0.7`) — 全量记忆注入
4. **Impeccable shape** (`step 0.71`) — 🆕 设计发现访谈 → 10 节设计简报（mood/references/color strategy/design direction/bold move），在生成前确立品味方向约束（on_error: abort）

### Phase 1: 上下文收集

- **GitHub MCP** (`step 1`) — 搜索最佳实践仓库
- **Tavily MCP** (`step 1.1`) — 搜索项目类型最佳实践
- **Context7 MCP** (`step 1.2`) — 获取技术栈文档
- **Supabase MCP** (`step 1.3`) — 获取数据库模板（条件触发）
- **Stripe MCP** (`step 1.4`) — 获取支付流程模板（条件触发）
- **Resend MCP** (`step 1.5`) — 获取邮件模板（条件触发）
- **OpenDigger** (`step 1.6`) — 竞品分析（条件触发，交互式）

### Phase 2: 规划

11. **ce-plan** (`step 2`) — CE Plugin 生成详细项目规划：技术选型、架构设计、任务拆解
12. **Skill("review")** (`step 2.5`) — PRD 合成并发布到 Issue Tracker（对话模式）
13. **Skill("review")** (`step 2.6`) — PRD 拆解为垂直切片 Issue（对话模式）

### Phase 3: 脚手架 + 实现

14. **applyTemplate** (`step 3`) — 项目脚手架：创建目录结构、初始化配置文件
15. **Git guardrails** (`step 3.1`) — 配置 PreToolUse Hook 拦截危险 git 命令（force push/reset --hard/checkout .），保护开发全过程
16. **askUser** (`step 3.5`) — 询问是否使用 Open Design（交互式）
17. **Skill("awesome-design-md")** (`step 3.67`) — 加载品牌 DESIGN.md 导入品牌 token（对话模式，前端项目）
18. **generateDesign** (`step 3.7`) — Open Design AI 生成设计（条件触发）
19. **implementLogic** (`step 3.8`) — 实现核心业务逻辑

### Phase 3.5: Impeccable 设计打磨（对话模式，前端+Open Design 时触发）⚠️ 必须执行

**CRITICAL**: 当前端项目使用了 Open Design 生成 UI 后，必须逐一调用以下 Skill 子命令进行设计打磨。每个子命令都需要实际修改代码文件。

21. **Huashu 5 维度评审（第一轮）** (`step 3.778`) — 🆕 打磨前设计基线测量：philosophy/hierarchy/craft/functionality/originality 评分，为后续打磨效果对比建立基准
22. **Impeccable critique（第一轮）** (`step 3.779`) — 🆕 Skill 深度设计批判：27 条反 AI 模式规则 + 12 条 LLM 批判规则，在修复前检测 AI 塑料感，建立问题清单供后续打磨步骤针对性修复（on_error: abort）
23. **Impeccable polish** (`step 3.78`) — 🆕 全维度质量打磨（配色/间距/字体/圆角/阴影）
24. **Impeccable layout** (`step 3.781`) — 🆕 间距节奏 + 视觉层级 + 空间重构
25. **Impeccable colorize** (`step 3.782`) — 🆕 策略性色彩注入
26. **Impeccable bolder** (`step 3.783`) — 🆕 安全→大胆，打破 AI 默认审美
27. **Impeccable typeset** (`step 3.784`) — 🆕 排版层次优化
28. **Impeccable animate** (`step 3.785`) — 🆕 purposeful motion
29. **Impeccable delight** (`step 3.786`) — 🆕 个性化记忆点
30. **Impeccable harden** (`step 3.788`) — 🆕 生产就绪：加载/空/错误/边缘状态 + i18n + 表单验证 + 键盘可操作性
31. **Impeccable distill** (`step 3.789`) — 🆕 精简提纯：去除冗余元素/装饰/过度层次
32. **Impeccable clarify** (`step 3.79`) — 🆕 UX 文案优化：标签/按钮/错误提示/空状态，消除 AI 默认措辞
33. **Impeccable adapt** (`step 3.791`) — 🆕 响应式设计验证：断点审查 + 触摸目标 + 视口溢出修复
34. **Impeccable optimize** (`step 3.7911`) — 🆕 CSS/渲染性能：CLS 布局偏移/未使用 CSS/合成层/Font Load 策略
35. **Impeccable critique（第二轮）** (`step 3.7912`) — 🆕 Skill 深度设计批判验证：复检所有修复步骤的实际效果，确认品味提升可感知，发现残留问题（on_error: abort）
36. **Impeccable polish（第三轮）** (`step 3.7913`) — 🆕 针对 critique 第二轮发现的残留 AI 塑料感，精准修复：微交互/阴影层级/字体配对/留白节奏
37. **Impeccable bolder（第三轮）** (`step 3.7914`) — 🆕 针对 critique 第二轮发现的安全默认审美，放大设计决策影响力
38. **Impeccable delight（第三轮）** (`step 3.7915`) — 🆕 针对 critique 第二轮发现的记忆点缺失，注入个性化微交互/细节/惊喜
39. **Huashu 5 维度评审（第二轮）** (`step 3.7916`) — 🆕 修复后专家评审验证：philosophy/hierarchy/craft/functionality/originality 复评，与第一轮对比确认设计质量提升可量化
40. **AI-Friendly Web Design** (`step 3.792`) — 🆕 可访问性审查：语义HTML/ARIA/对比度/键盘导航

### Phase 4: 实现 + 审查 + 验证

41. **checkAPIConsistency** (`step 4`) — API 契约一致性检查
42. **runReview** (`step 4.5`) — ESLint + TypeScript 静态分析
43. **aislop-scan** (`step 4.6`) — AI 代码气味扫描（50+ 规则）
44. **Skill("sec-bug-hunt")** (`step 4.7`) — 安全漏洞扫描，建立安全基线（对话模式）
45. **runSuite** (`step 4.8`) — 完整测试套件

### Phase 5: 沉淀

46. **ce-compound** (`step 5.5`) — CE 知识沉淀到 CLAUDE.md
47. **remember** (`step 6`) — 保存项目架构决策、技术选型、执行清单到记忆系统
48. **consolidate** (`step 6.5`) — 整理跨后端记忆一致性
49. **notify** (`step 7`) — 通知项目创建完成

### 关键改进

| 改进项 | 原来 | 现在 |
|--------|------|------|
| Pre-flight 设计 | 无设计基准声明 | Skill("web-design-engineer") + awesome-design-md |
| Pre-flight 审查 | 无审查清单 | Skill("review-checklist") 23 项分析框架 |
| MP to-prd | mp-to-prd 占位消息 | Skill("review") PRD 生成 |
| MP to-issues | mp-to-issues 占位消息 | Skill("review") Issues 拆解 |
| MP git-guardrails | mp-git-guardrails 占位消息 | Skill("review") Git 规范 |
| 脚手架 | 无 applyTemplate/implementLogic | 实际项目创建 + 业务逻辑实现 |
| 代码质量 | 无 aislop 扫描 | aislop-scan 50+ 规则 |
| 安全基线 | 无 | Skill("sec-bug-hunt") 初始安全扫描 |
| 品牌集成 | 无 awesome-design-md | 品牌 token 自动导入 |

### CLI 模式回退

在 CLI 模式（非对话）下，Skill 步骤（`web-design-engineer`、`review-checklist`、`review`、`awesome-design-md`、`sec-bug-hunt`）因为 `conversation_mode` 条件不满足而自动跳过。MP to-prd/to-issues/git-guardrails 的占位消息已移除，功能由实际 Skill 调用替代。
