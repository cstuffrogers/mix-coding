---
description: System resource update: scan MCP/Skill/CLI/npm → detect conflicts → auto-update safe patch/minor → major pending → write daily log. 10-step workflow.
---

# /update — 系统资源更新

10 步工作流:**Pre-flight 审查清单 → 冲突检测(硬阻断)→ 全量扫描 → 自动更新无冲突项 → 测试验证 → 写日期日志 → 报告**

覆盖 4 类资源:MCP 服务器 · Claude Skill · 外部 CLI · npm 包

## Usage

```text
/update
```

## 执行流程

### Phase 0: Pre-flight 准备

1. **Skill("review-checklist")** (`step 0.3`) — 加载审查清单

### Phase 1: 上下文

2. **recall** (`step 1`) — 注入历史更新记忆与已知冲突

### Phase 2: 冲突检测(硬阻断)

3. **detectConflicts** (`step 2`) — 全维度扫描,硬冲突则 `on_error: abort`
   - Skill: 同名 / SKILL.md 缺失 / 禁用 frontmatter 字段(`paths`/`effort`/`when-to-use`)/ 缺 name
   - MCP: 命令路径不存在 / 配置解析失败
   - 跨类型: skill 与 command 同名
   - 软冲突: skill 触发词重叠 > 60%(仅警告)

### Phase 3: 全量扫描 + 自动更新

4. **scanUpdates** (`step 3`) — npm 过期包 + skill 版本 + CLI 工具版本,对比上游
5. **autoUpdateSafe** (`step 4`) — 自动更新 patch/minor,major 列入待确认
6. **runSuite** (`step 5`) — 更新后跑测试验证

### Phase 4: 沉淀

7. **writeUpdateLog** (`step 6`) — 写 `.claude/updates/YYYY-MM-DD.md`
8. **updateReport** (`step 7`) — 输出报告:已更新 / 待确认 / 阻断
9. **remember** (`step 8`) — 保存更新记录
10. **notify** (`step 9`) — 通知结果

## 更新分级

| 级别 | 处理 | 示例 |
|------|------|------|
| patch (0.0.X) | ✅ 自动更新 | mobsfscan 0.4.5 → 0.4.6 |
| minor (0.X.0) | ✅ 自动更新(跑测试) | ruff 0.5.0 → 0.6.0 |
| major (X.0.0) | ⏸ 待确认 | specify 0.11 → 1.3 |

## 日志格式

每次执行写 `.claude/updates/YYYY-MM-DD.md`,含:执行摘要 / 已自动更新表 / 待确认 major 表 / 冲突检测 / 验证结果。

## 冲突阻断

硬冲突 → `on_error: abort`,后续 step 跳过,等用户手动解决后重跑。对齐 `/deps` abort 语义。

## 与现有工作流的关系

- `/deps` — 只管项目依赖(npm/pip),不管系统工具/skill/MCP
- `/check` — 引擎自检,可复用 `conflict-scanner.js` 做 skill 冲突检测
- `/update` — **系统级**资源更新,4 类全覆盖
