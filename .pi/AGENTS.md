# Auto-Coding System (pi)

> pi 是独立 CLI agent harness（`@earendil-works/pi-coding-agent`）。percho 是其桌面端 GUI，
> 引擎与配置（`~/.pi/agent/` + 项目级 `.pi/`）完全共享，识别上合并归入 pi 平台。

## 入口链

- pi 启动时扫描工作目录及祖先目录的 `AGENTS.md` / `CLAUDE.md`（含 `AGENTS.override.md`）。
  本项目根目录已有完整入口：`CLAUDE.md` ← `AGENTS.md`。
- 本目录（`.pi/`）是 pi 的官方配置目录（`CONFIG_DIR_NAME`），放 extensions/skills/prompts 等扩展资源，
  不含入口指令。

## 工作流执行

pi 无 Claude Code 式 `/command` 文件机制，工作流通过 Scene 引擎 CLI 执行：

```bash
node claude-scene/src/index.js start <scene> --auto
```

场景 ID 见 `CLAUDE.md` 工作流速查表。

## 平台识别

引擎用两种环境变量识别 pi 平台，都映射到 `pi` 平台、`.pi/` 配置目录：

| 场景 | 变量 | 来源 |
|------|------|------|
| pi CLI | `AI_AGENT=pi` | pi 启动时无条件设置（源码 `cli/setup.ts` 已核验） |
| percho GUI | `PI_PACKAGE_DIR=<路径>` | percho 主进程设置，指向内置 pi SDK（`resources/pi-package`），pi CLI 从不设置该变量 |

## 验证

在 percho（或 pi CLI 会话）里，于 `E:\auto-coding` 项目根目录运行：

```bash
# 1. 确认宿主识别（期望打印 pi + .pi；无宿主时打印 cli + .claude）
node --input-type=module -e "import('./claude-scene/src/lib/platform.js').then(m => console.log(m.getHostPlatform(), m.getPlatformDir()))"

# 2. 确认 percho 标记真实注入（pi CLI 会话会打印 undefined，属正常）
node -e "console.log(process.env.PI_PACKAGE_DIR)"

# 3. 跑引擎自检（/check 场景），确认工作流在 pi/percho 下可用
node claude-scene/src/index.js start check --auto
```

> 判断标准：
> - 第 1 条输出 `pi .pi` → 平台识别成功，本目录配置生效
> - 第 3 条 scene 正常执行 → 工作流链路完整
---

## pi / percho 资源

- Skills：`.pi/skills/scene-runner/SKILL.md` — 场景映射与用法
- Prompt Templates：`.pi/prompts/*.md` — `/review`、`/feature` 等斜杠命令（含 `/audit`、`/simplify` 等已合并别名）
- 接入检查：`bash scripts/pi-setup.sh`（`--check` 仅检查）

### 全局安装（任意项目目录都能用 / 命令）

项目级 `.pi/prompts/` 只在 `cd` 到本仓库时生效。要在**任意项目**都用 `/review`：

```bash
cd claude-scene && npm link    # 引擎进 PATH
cd .. && bash scripts/install-global.sh
```

装到（均自动加载，无需 settings.json）：

| 目标 | 内容 |
|------|------|
| `~/.pi/agent/prompts/` | 32 个斜杠命令模板 |
| `~/.pi/agent/skills/` | `scene-runner` skill |
| `~/.claude/commands/` | 33 个 Claude Code 命令 |

脚本支持 `--dry-run` / `--check` / `--uninstall` / `--force`（默认不覆盖用户已有同名文件）。
装完在 pi/percho 执行 `/reload` 生效。

## 工作流清单（25 个场景）

| 命令 | 场景 | 说明 |
|------|------|------|
| /review | review | 5 层代码审查 + 安全审计（含 full_audit/analyze_only/security_deep/quality_tools/ai_design 模式） |
| /feature | feature | 新功能开发 |
| /bugfix | bugfix | Bug 修复 |
| /refactor | refactor | 代码重构 + 简化 + 架构优化 |
| /plan | plan | Manus 持久规划（会话恢复+SHA256） |
| /optimize | optimize | 性能优化 |
| /ui-polish | ui-polish | 前端美化 + AI 设计 |
| /release | release | 发布部署 |
| /deps | deps | 依赖更新 |
| /check | check | 引擎自检 + 自愈 |
| /qa | qa | 浏览器 QA 验证 |
| /new-project | new-project | 新项目创建 |
| /onboard | onboard | 环境搭建 |
| /cicd | cicd | CI/CD 流水线 |
| /setup | setup | 测试/监控设施搭建（e2e / monitor 二选一） |
| /rollback | rollback | 紧急回滚 |
| /loop | loop | 自动迭代循环 |
| /spec | analyze | Spec-Driven 开发 |
| /plan-ceo-review | plan-ceo-review | 创始人策略审查 |
| /mobile-* | mobile-* | 移动端系列 |

> 已合并：`hunt` → `/review`（security_deep 模式，默认启用）；`e2e` `monitor` → `/setup`；
> `audit` `/analyze` → `/review`；`simplify` `/design` `/polish` → `/refactor` `/ui-polish`。

## 共享资源

与 Claude Code / ZCode 共享 `.claude/` 下的 scenes/skills/rules/memory，单一数据源，避免漂移。
