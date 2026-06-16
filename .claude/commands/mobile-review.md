---
description: Mobile 5-layer code review + mobile-ui-review Skill + pre-flight checklist + aislop code smell scan. 17-step hybrid workflow for RN/Flutter/native code quality and security.
argument-hint: "[PR编号]"
---

# /mobile-review — 移动端代码审查

17 步混合工作流：**Pre-flight 审查清单（对话模式）→ 5 层审查管线 → mobile-ui-review UI 专项 → 代码气味扫描 → 质量门禁**

## Usage

```text
/mobile-review                     # 审查未提交改动
/mobile-review #42                  # 审查指定 PR
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，建立结构化审查基准
2. **recall** (`step 0.5`) — 注入历史审查上下文和已知代码质量问题

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出待审查 PR 和相关 issues

### Phase 2: 平台检测

4. **detectPlatform** (`step 2`) — 识别平台（RN/Flutter/原生）→ 选择规则集

### Phase 3: 5 层审查管线

5. **L1 — 静态分析** (`step 3`)：ESLint + RN/Flutter 规则 — 语法/样式/平台 API 误用/widget 生命周期
6. **L2 — 安全扫描** (`step 4`)：mobsfscan — 硬编码密钥/不安全存储/弱加密/SSL Pinning
7. **L3 — UI 截图对比** (`step 5`)：Detox — 关键流程前后对比
8. **L3.5 — UI 专项审查**：**Skill("mobile-ui-review")** (`step 6`) — 安全区域/键盘避让/触控目标≥44pt/手势冲突/加载态/横竖屏/对比度
9. **L4 — AI 语义审查** (`step 7`)：mobile-reviewer Agent — 导航栈/Platform.OS/内存泄漏/状态管理/移动端 a11y
10. **aislop-scan** (`step 8`) — AI 代码气味：叙事注释/吞异常/dead code/as any 滥用/重复 helper

### Phase 4: 聚合 + 门禁

11. **L5 — 聚合报告** (`step 9`)：去重/排序/修复建议/emoji 指标
12. **质量门禁** (`step 10`)：CRITICAL 阻断合并

### Phase 5: 沉淀

13. **ce-compound** (`step 11`) — 移动端审查知识沉淀
14. **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| UI 审查 | mobile-ui-review Skill | Skill |
| 上下文 | GitHub MCP | MCP |
| 静态分析 | ESLint + RN/Flutter 规则 | CLI |
| 安全 | mobsfscan | CLI |
| UI 截图 | Detox | CLI |
| 语义 | mobile-reviewer Agent | Agent |
| 代码气味 | aislop（50+ 规则） | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")`、`Skill("mobile-ui-review")` 和 GitHub MCP 步骤自动跳过。5 层审查管线和安全扫描正常执行。
