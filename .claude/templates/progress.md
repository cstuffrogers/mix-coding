# Progress: [Task Name]
<!--
  WHAT: 会话级操作日志，追踪所有执行动作
  WHY: 恢复上下文时快速了解"做了什么"
  WHEN: 贯计更新，每次重要操作后添加
  SOURCE: planning-with-files v3.1.3
-->

## Session Info
- **Started:** [ISO Timestamp]
- **Plan File:** `plan.md`
- **Spec File:** `spec.md` (如有)

## Progress Log
<!--
  时间戳日志格式，每次操作后追加
-->

### [ISO Timestamp] — Session Start
- Initialized planning files (plan.md, findings.md, progress.md)
- Read spec.md for requirements context
- Phase 1 status: in_progress

### [ISO Timestamp] — [Action Type]
- **Action:** [What was done]
- **Result:** [Outcome - success/failure/partial]
- **Files Changed:** [List of files created/modified]
- **Next:** [What comes next]

### [ISO Timestamp] — [Action Type]
- **Action:**
- **Result:**
- **Files Changed:**
- **Next:**

## Test Results
<!--
  测试执行结果记录
-->

| Test | Status | Notes |
|------|--------|-------|
|      |        |       |

## Phase Completion Log
<!--
  阶段完成记录，用于 session-catchup 快速定位
-->

| Phase | Completed At | Key Deliverables |
|-------|--------------|------------------|
| 1 | [Timestamp] | [What was delivered] |
| 2 | | |

## Errors Summary
<!--
  错误摘要，详细记录在 plan.md
-->

| Error | Timestamp | Resolution Status |
|-------|-----------|-------------------|
|       |           | |

## Session End
<!--
  会话结束时的状态快照
-->
- **Ended:** [ISO Timestamp]
- **Current Phase:** [Phase number]
- **Incomplete Tasks:** [List]
- **Context for Next Session:** [What needs to be picked up]

---
<!--
  REMINDER:
  - 每次 Write/Edit/Bash 操作后更新此文件
  - 记录失败和成功同样重要
  - 时间戳用 ISO 格式便于解析
-->