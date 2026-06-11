# Harness Engineering 12 核心原则

> 本文档基于 [Learn Harness Engineering](https://github.com/walkinglabs/learn-harness-engineering) 翻译整理，
> 结合本系统实践进行本土化适配。

---

## 原则 1：强模型 ≠ 可靠执行

**原文**: Strong Models ≠ Reliable Execution

**核心观点**: 世界上最强的模型，如果没有合适的 Harness（约束框架），在真实工程任务上依然会失败。

**证据**:
- Anthropic 实验：相同模型（Claude），相同提示（"构建 2D 复古游戏编辑器"）
  - 无 Harness：$9 / 20分钟，产出无法运行
  - 有 Harness：$200 / 6小时，产出可玩的游戏
  - **模型没变，Harness 变了**

**本系统实践**:
- ✅ 五层审查引擎确保输出质量
- ✅ 场景选择器控制执行范围
- ✅ 记忆系统维持跨会话连续性

---

## 原则 2：Harness 是 5 个子系统，不是更好的提示词

**原文**: A Harness Is 5 Subsystems, Not a Better Prompt

**5 个子系统**:

```
┌─────────────────────────────────────────┐
│           THE HARNESS                   │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │Instructions│ │  State   │ │Verification│
│  └──────────┘ └──────────┘ └─────────┘ │
│  ┌──────────┐ ┌──────────────────────┐ │
│  │  Scope   │ │   Session Lifecycle  │ │
│  └──────────┘ └──────────────────────┘ │
└─────────────────────────────────────────┘
```

| 子系统 | 职责 | 本系统对应 |
|--------|------|-----------|
| Instructions | 告诉 Agent 做什么、按什么顺序、先读什么 | `.claude/rules/`, `AGENTS.md` |
| State | 追踪已完成、进行中、待办 | `feature_list.json`, `progress.md` |
| Verification | 只有通过测试才算完成 | 5层审查引擎 + TestEngine |
| Scope | 一次一个功能，不越界 | 场景模板 + WIP=1 |
| Session Lifecycle | 开始时初始化，结束时清理 | `init.sh` + archon 工作流 |

---

## 原则 3：仓库即唯一真相源

**原文**: The Repo Is the Single Source of Truth

**核心观点**: 如果 Agent 看不到它，它就不存在。所有状态必须持久化到磁盘。

**本系统实践**:
- ✅ `.claude/` 目录保存记忆和配置
- ✅ `feature_list.json` 机器可读的状态
- ✅ `progress.md` 人类可读的会话历史
- ✅ `DECISIONS.md` 架构决策记录

---

## 原则 4：分文件指令，不搞大文件

**原文**: Split Instructions — Don't Use One Giant File

**核心观点**: 给 Agent 一张地图，而不是百科全书。按需披露，渐进加载。

**本系统实践**:
- ✅ `.claude/rules/coding.md` — 编码规范
- ✅ `.claude/rules/react-doctor.md` — React 专科规则
- ✅ `.claude/rules/visual-standards.md` — 视觉标准
- ✅ `.claude/scenes/*.json` — 场景模板
- ⚠️ 注意：`Claude_Code_全自动驾驶系统_融合版.md` 过大，建议拆分

---

## 原则 5：跨会话保持上下文

**原文**: Persist Context Across Sessions

**核心观点**: Agent 会话结束后，下一个会话必须能准确接上。不能依赖 Agent 的"记忆"。

**本系统实践**:
- ✅ `progress.md` — 每次会话后追加记录
- ✅ 四组件记忆系统（Claude-Mem + agentmemory + NEXO + CodeGraph）
- ✅ `feature_list.json` — 机器可读的状态快照

---

## 原则 6：每次会话前初始化

**原文**: Initialize Before Every Session

**核心观点**: 在 Agent 开始工作前，验证环境是健康的。

**本系统实践**:
- ✅ `init.sh` — 检查依赖、Git 状态、测试是否通过
- ✅ `zero-conflict-check.sh` — 架构合规检查

---

## 原则 7：一次一个功能 — 不越界（WIP=1）

**原文**: One Feature at a Time — No Overreach (WIP=1)

**核心观点**: Agent 同时做多个功能，结果是三个都做了一半。强制 WIP=1。

**本系统实践**:
- ✅ `feature_list.json` 中 `wip_limit: 1`
- ✅ 场景模板控制执行范围
- ✅ `AGENTS.md` 中明确 WIP=1 规则

---

## 原则 8：功能列表是 Harness 原语

**原文**: Feature Lists Are Harness Primitives

**核心观点**: 功能列表不是项目管理工具，而是机器可读的边界约束。Agent 不能忽略它。

**本系统实践**:
- ✅ `feature_list.json` — JSON Schema 约束
- ✅ 每个功能有明确的 `definition_of_done`
- ✅ 功能有 `assigned_scene` 指定执行路径

---

## 原则 9：不要让 Agent 提前宣布胜利

**原文**: Don't Let Agents Declare Victory Early

**核心观点**: Agent 说"完成了"不等于真的完成了。必须有可运行的证据。

**本系统实践**:
- ✅ 5层审查引擎（Layer 1-2 自动修复，Layer 3-5 人工确认）
- ✅ TestEngine 强制测试通过
- ✅ `AGENTS.md` 中明确"Do NOT declare victory until..."

---

## 原则 10：只有完整流水线验证才算数

**原文**: Only Full-Pipeline Verification Counts

**核心观点**: 单元测试通过 ≠ 功能可用。必须端到端验证。

**本系统实践**:
- ✅ Layer 1: ESLint（语法/风格）
- ✅ Layer 2: react-doctor（React 模式）
- ✅ Layer 3: Playwright（视觉回归）
- ✅ Layer 4: Claude Code Headless（语义逻辑）
- ✅ Layer 5: 聚合（去重/排序）

---

## 原则 11：让 Agent 的运行时可观测

**原文**: Make the Agent's Runtime Observable

**核心观点**: 如果你看不到 Agent 做了什么，你就无法修复它破坏的东西。

**本系统实践**:
- ✅ `progress.md` — 会话历史记录
- ✅ archon 工作流输出结构化 JSON 日志
- ✅ NotificationService — 关键事件推送
- ✅ 截图标注 + 手机推送（第四层远程控制）

---

## 原则 12：每次会话必须留下干净状态

**原文**: Every Session Must Leave a Clean State

**核心观点**: 会话结束时，仓库必须处于可恢复状态。下一个会话可以安全地继续。

**本系统实践**:
- ✅ archon 工作流 idempotent（幂等）
- ✅ `init.sh` 验证环境健康
- ✅ Git commit 要求测试通过后才提交
- ✅ `progress.md` Handoff Notes

---

## 参考

- **原文**: https://github.com/walkinglabs/learn-harness-engineering
- **OpenAI Harness Engineering**: https://openai.com/index/harness-engineering/
- **Anthropic Effective Harnesses**: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

---

## 附录：Karpathy 编码四诫

> 以下 4 条原则基于 Andrej Karpathy 对 LLM 编程行为的观察，与 Harness Engineering 互补。
> 完整文档见 `../../.claude/rules/karpathy-principles.md`
> 来源: https://github.com/multica-ai/andrej-karpathy-skills

| 原则 | 核心观点 | 本系统对应 |
|------|---------|-----------|
| **Think Before Coding** | 不假设，不隐藏困惑，主动呈现权衡 | Anti-Rationalization Table（反借口表） |
| **Simplicity First** | 最少代码解决问题，不添加推测性抽象 | `/simplify` 场景（范围确认→基线→简化→验证） |
| **Surgical Changes** | 只碰必须改的，不顺手重构 | WIP=1 规则 + `/simplify` scope 确认 |
| **Goal-Driven Execution** | 定义成功标准，循环直到验证通过 | `/feature` `/bugfix` 测试基线步骤 + 5 层审查 |
