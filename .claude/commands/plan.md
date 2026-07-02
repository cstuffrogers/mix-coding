---
description: Manus 风格持久化任务规划
argument-hint: "[任务描述]"
---

# /plan — File-Based Planning

创建持久化规划文件，支持会话恢复、SHA256 认证、多阶段追踪。

## User Input

```text
$ARGUMENTS
```

## Step 0: Session Catchup

检测上一会话未同步上下文（/clear 后恢复）：

```bash
python .claude/scripts/session-catchup.py "$(pwd)"
```

如果检测到未同步上下文：
1. 运行 `git diff --stat` 查看实际代码变更
2. 读取现有规划文件
3. 更新规划文件后继续

## Step 1: Read Rules

Read `.claude/rules/conditional/planning-with-files.md` 获取完整规则。

## Step 2: Check Existing Files

检查是否已存在规划文件：
- `spec.md` — 项目级需求规格
- `plan.md` — 阶段规划
- `findings.md` — 研究发现
- `progress.md` — 会话日志

## Step 3: Initialize Planning Files

如不存在，从模板创建：

```bash
# 初始化所有规划文件
.claude/scripts/init-session.sh
```

或手动复制模板：
- `.claude/templates/plan.md` → `plan.md`
- `.claude/templates/findings.md` → `findings.md`
- `.claude/templates/progress.md` → `progress.md`

## Step 4: Populate Plan

如果提供了任务描述（$ARGUMENTS）：

1. **提取目标**：一句话描述终态
2. **分解阶段**：3-7 个逻辑阶段
3. **识别关键问题**：需要回答的问题
4. **写入 plan.md**

如果存在 `spec.md`：
- 链接到 spec.md 作为需求来源
- 提取关键需求到 plan.md

## Step 5: Ask About Attestation

询问用户是否启用 SHA256 认证：

```
是否启用 SHA256 认证？（多 Agent 协作时推荐）
- Yes: 运行 .claude/scripts/attest-plan.sh
- No: 跳过认证
```

## Step 6: Display Summary

显示规划摘要：

```
📋 规划文件已创建：
- plan.md (阶段规划 + 进度追踪)
- findings.md (研究发现)
- progress.md (会话日志)

📌 核心规则：
- 2-Action Rule: 每 2 次视图/搜索操作后保存发现到 findings.md
- 3-Strike Protocol: 同一错误失败 3 次后上报用户
- 决策前重读: 重大决策前重读 plan.md 保持目标清晰
- 行动后更新: 完成阶段后更新 plan.md 状态
- 记录所有错误: 写入 plan.md 的 Errors Encountered 表

🚀 下一步：
- 按 plan.md 阶段执行任务
- 使用 /build 开始实现
```

## Trigger Conditions

自动触发规划规则的条件：
- 任务描述 ≥ 3 步
- 用户说"规划"、"分解"、"计划"
- 调用 `/plan` 命令

## Hook Integration

| Hook | Action |
|------|--------|
| PreToolUse | 注入当前规划上下文 |
| PostToolUse (Write/Edit) | 提醒更新 progress.md |
| Stop | 运行 check-complete.sh 验证完成 |
| PreCompact | 保存状态到规划文件 |
