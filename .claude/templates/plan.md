# Plan: [Brief Description]
<!--
  WHAT: 会话级执行路线图，"磁盘上的工作内存"
  WHY: 50+ 工具调用后，原始目标可能被遗忘。此文件保持目标清晰。
  WHEN: 复杂任务 FIRST 创建，每阶段完成后更新。
  SOURCE: planning-with-files v3.1.3 + Spec-Kit 融合
-->

## Goal
<!--
  WHAT: 一句话描述要达成的终态
  WHY: 北极星指引。重读此保持专注。
  EXAMPLE: "创建 Python CLI todo 应用，支持 add/list/delete 功能"
-->
[一句话描述终态 — 来自 spec.md]

## Spec Reference
<!--
  链接到项目级需求规格，保持需求一致性
-->
- **Spec File:** `spec.md` (如有)
- **Key Requirements:** [列出 spec.md 中关键需求]

## Current Phase
<!--
  WHAT: 当前正在处理的阶段
  WHY: 快速定位任务进度
-->
Phase 1

## Phases
<!--
  WHAT: 分解为 3-7 个逻辑阶段，每个阶段可完成
  WHY: 防止被大任务淹没，进度可视化
  WHEN: 完成后更新状态: pending → in_progress → complete
-->

### Phase 1: Requirements & Discovery
- [ ] 理解用户意图
- [ ] 识别约束和需求
- [ ] 记录发现到 findings.md
- **Status:** in_progress

### Phase 2: Planning & Structure
- [ ] 定义技术方案
- [ ] 创建项目结构（如需要）
- [ ] 记录决策及理由
- **Status:** pending

### Phase 3: Implementation
- [ ] 按步骤执行计划
- [ ] 执行前先写代码到文件
- [ ] 增量测试
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] 验证所有需求满足
- [ ] 记录测试结果到 progress.md
- [ ] 修复发现的问题
- **Status:** pending

### Phase 5: Delivery
- [ ] 审查所有输出文件
- [ ] 确认交付物完整
- [ ] 交付给用户
- **Status:** pending

## Key Questions
<!--
  WHAT: 任务过程中需要回答的关键问题
  WHY: 指导研究和决策
  EXAMPLE:
    1. 任务是否需要跨会话持久？（Yes → 需文件存储）
    2. 用什么格式存储任务？（JSON 文件）
-->
1. [需要回答的问题]
2. [需要回答的问题]

## Decisions Made
<!--
  WHAT: 技术和设计决策，附带理由
  WHY: 记住为什么做出选择
  WHEN: 做出重大选择时更新
-->
| Decision | Rationale |
|----------|-----------|
|          |           |

## Errors Encountered
<!--
  WHAT: 每个错误、尝试次数、解决方案
  WHY: 记录错误防止重复犯错
  WHEN: 错误发生时立即记录
-->
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Attestation
<!--
  SHA256 认证（可选，多 Agent 协作时启用）
  运行: .claude/scripts/attest-plan.sh
-->
- **SHA256:** (运行 attest-plan.sh 后自动填充)
- **Last Attested:** (时间戳)

## Notes
<!--
  提醒:
  - 更新阶段状态: pending → in_progress → complete
  - 重大决策前重读此计划（注意力操控）
  - 记录所有错误 — 避免重复
  - 永不重复失败操作 — 改变策略
-->