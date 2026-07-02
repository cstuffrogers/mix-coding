# Auto-Coding System — Agent Operating Manual

> 多平台共享入口。`CLAUDE.md` 是所有平台的源文档。
> 本文件包含 Harness Engineering 操作指南，确保 AI Agent 行为一致。

**平台**: Claude Code | opencode | Codex | ZCode
**入口链**: `CLAUDE.md` ← `AGENTS.md` (跨平台别名)

---

## 1. Before You Start

### 1.1 Read Project State (in order)

1. `feature_list.json` — 确认当前 WIP
2. `progress.md` — 上次会话上下文
3. `DECISIONS.md` — 架构决策记录
4. `CLAUDE.md` — 核心规则 + 工作流速查

### 1.2 Run Initialization

```bash
bash init.sh
```

验证：Node.js、Git、依赖、Git 状态、测试通过、Harness 文件完整。

### 1.3 Confirm Scope

`feature_list.json` 中的 `wip_limit: 1` — **一次只做一个功能**。

---

## 2. While You Work

### Code Standards
- **Naming**: camelCase (var/fn), PascalCase (class/interface), UPPER_SNAKE_CASE (const), kebab-case (file)
- **File**: 单文件单导出, 测试同目录 `*.test.js`
- **Rules**: YAGNI → stdlib → native → deps → one-liner → minimal code. 改后边界: ±50行·0新依赖·复杂度≤130%

### Architecture Rules
- **三层**: Scene 引擎(交互) → Service(能力) → MCP+Tool(运行时)
- **Simplicity first** — 不写推测性抽象
- **Surgical changes** — 只碰必须改的
- **Zero-conflict** — 工具名前缀强制 (memory-*, review-*, etc.)

### When to Declare Done
1. ✅ `npm test` passes
2. ✅ `npm run lint` clean
3. ✅ Feature works as described in `feature_list.json`
4. ✅ init.sh 验证通过

---

## 3. After You Finish

1. Mark feature done in `feature_list.json`
2. Append session to `progress.md`
3. Update `DECISIONS.md` if architecture decision was made
4. Run `node scripts/clean-session.cjs`

---

## 4. Emergency Procedures

| Problem | Action |
|---------|--------|
| Agent looping | Ctrl+C → `git status` → `git reset --hard HEAD` |
| Tests broken | `git diff` → identify → fix or revert |
| WIP overreach | Revert extra changes → re-confirm `feature_list.json` |

---

## 5. Scene Commands

| Command | Purpose |
|---------|---------|
| `/audit` | 全量健康检查 |
| `/review` | 5 层代码审查 |
| `/feature` | 新功能开发 |
| `/bugfix` | Bug 修复 |
| `/design` | AI 辅助 UI 设计 |
| `/polish` | 前端美化 (DaisyUI) |
| `/simplify` | 代码简化 |
| `/optimize` | 性能优化 |
| `/refactor` | 重构 |
| `/hunt` | 安全漏洞扫描 |
| `/release` | 发布部署 |
| `/deps` | 依赖更新 |
| `/check` | 引擎自检+自愈 |
| `/spec "需求"` | Spec-Driven 开发 |

---

## Reference
- **CLAUDE.md**: [./CLAUDE.md](./CLAUDE.md) — 完整规则
- **Harness Engineering**: [Learn Harness Engineering](https://github.com/walkinglabs/learn-harness-engineering)
