---
description: Safe dependency update: check outdated → update one-by-one → test → verify breaking changes → update lockfile. 16-step workflow.
---

# /deps — 依赖更新

16 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 策略选择 → 逐项更新 → 验证**

## Usage

```text
/deps
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦依赖安全/废弃包/许可证项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 列出依赖更新相关 issues
3. **Context7 MCP** (`step 2`) — 获取包管理器最佳实践文档

### Phase 2: 依赖扫描

- **scanOutdated** (`step 3`) — 扫描过期依赖（自动检测 npm/pip/cargo/go mod）
- **auditDeps** (`step 4`) — 安全审计当前依赖
- **selectStrategy** (`step 5`) — 选择更新策略（安全更新/补丁更新/小版本更新/全量更新）

### Phase 3: 更新执行

- **baselineTest** (`step 6`) — 更新前运行测试建立基线
- **updateOneByOne** (`step 7`) — 逐项更新依赖（每次更新后运行测试）
- **fullRegression** (`step 8`) — 全量回归测试
- **checkBreaking** (`step 9`) — 检查 breaking changes
- **smokeTest** (`step 10`) — 冒烟测试
- **commitLockfile** (`step 11`) — 提交更新的 lockfile

### Phase 4: 沉淀

- **ce-compound** (`step 12`) — 依赖更新知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 验证 | 测试套件 + 冒烟测试 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。依赖扫描和更新步骤正常执行。
