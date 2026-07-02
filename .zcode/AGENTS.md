# Auto-Coding System — ZCode 接入指南

> ZCode 平台专属入口。通用规则见根目录 [AGENTS.md](../AGENTS.md),核心规则见 [CLAUDE.md](../CLAUDE.md)。
> 本文件仅描述 ZCode 与本系统的协作方式,不重复通用内容。

---

## 工作原理

本系统由**三层**构成,ZCode 在其中承担「交互层宿主」角色:

```
交互层  →  ZCode(你)读指令、调用引擎、处理语义步骤(MCP/Skill/代码推理)
能力层  →  Scene 引擎(claude-scene/)执行确定性工作流:lint/test/security/a11y/...
运行时层 →  标准 CLI 工具(eslint/vitest/playwright/gitleaks/...)
```

ZCode 与 Claude Code **平等共享**同一套引擎和资源。引擎通过 `claude-scene/src/lib/platform.js`
自动识别当前宿主——ZCode 会话由 `ZCODE_APP_VERSION` 环境变量标记,无需手动设置。

---

## 如何调用引擎

### 启动工作流

```bash
node claude-scene/src/index.js start <场景ID> --auto
```

常用参数:
- `--auto` 非交互自动执行(默认当前目录为目标项目)
- `--target <路径>` 指定目标项目目录
- `--dry-run` 仅预览步骤,不执行
- `--prompt "需求描述"` 带需求启动(触发数据库/支付/邮件等特征检测)

### 查看可用场景

```bash
node claude-scene/src/index.js list
node claude-scene/src/index.js show <场景ID>    # 查看某场景完整步骤
```

### 记忆工具

```bash
node claude-scene/src/index.js memory recall     # 回溯历史上下文
node claude-scene/src/index.js memory remember   # 保存当前会话要点
```

---

## 工作流清单(26 个)

| 场景 | 用途 | 场景 | 用途 |
|------|------|------|------|
| `/feature` | 新功能开发 | `/bugfix` | Bug 修复 |
| `/review` | 代码审查 + 安全审计(含 audit/analyze 模式) | `/refactor` | 代码重构 + 简化 + 架构优化 |
| `/optimize` | 性能优化 | `/ui-polish` | 前端美化(DaisyUI) |
| `/new-project` | 从零新建项目 | `/release` | 发布部署 |
| `/rollback` | 快速回滚 | `/deps` | 依赖更新 |
| `/check` | 引擎自检 + 自愈 | `/hunt` | 安全漏洞审查 |
| `/qa` | 浏览器 QA 验证 | `/loop` | 自动迭代循环 |
| `/onboard` | 开发环境搭建 | `/e2e` | E2E 测试配置 |
| `/cicd` | CI/CD 流水线 | `/monitor` | 监控配置 |
| `/plan` | Manus 持久规划(会话恢复+SHA256) | `/plan-ceo-review` | 创始人策略审查 |
| `/mobile-*` | 移动端系列(audit/e2e/onboard/optimize/release/review) | | |

完整定义见 `.claude/scenes/*.json`,命令说明见 `.claude/commands/*.md`。

---

## ZCode 与 Claude Code 的协作约定

### 共享资源(单一数据源,两平台读写同一份)

| 资源 | 位置 | 说明 |
|------|------|------|
| 场景定义 | `.claude/scenes/` | 26 个工作流 JSON,引擎核心 |
| Skills | `.claude/skills/` | review-checklist / sec-bug-hunt / huashu 等 |
| 规则 | `.claude/rules/` | 条件规则(核心/移动端/React/设计) |
| 记忆 | `.claude/memory/` | 项目记忆(JSON,按类型分目录) |
| 运行产物 | `.claude/{logs,reviews,designs,reports}/` | 各工作流输出 |

> 这些资源**不按平台隔离**——ZCode 和 Claude Code 读写同一份,避免漂移。

### 各自专属(本目录 `.zcode/` 仅放 ZCode 专属内容)

| 文件 | 用途 |
|------|------|
| `.zcode/AGENTS.md` | 本文件——ZCode 进入项目时的专属指令 |
| `.mcp.json` | MCP 服务器配置(ZCode 与 Claude 共用,stdio schema) |

Claude Code 的专属配置在 `.claude/`(commands/agents/settings/mcp.json),ZCode 不读取,互不干扰。

### 能力差异

- **ZCode 能做的**:读代码、写代码、调用 MCP 工具、运行 Bash、推理决策——承担工作流里的语义步骤
- **引擎能做的**:跑 lint/test/security 扫描、生成报告、git 操作、依赖分析——确定性能力
- **ZCode 不需要的**:不需要任何 Claude 专属机制。引擎的 `isConversationMode()` 已识别 ZCode,
  MCP/Skill 步骤会正确进入「由宿主处理」分支

---

## 首次接入

```bash
bash scripts/zcode-setup.sh
```

该脚本完成:依赖检查 → 引擎验证 → 平台识别确认 → 自检场景冒烟。详见脚本注释。

---

## 约定(沿用根 AGENTS.md)

- 一次只做一个功能(`wip_limit: 1`)
- 手术式修改:只碰必须改的(±50 行 · 0 新依赖 · 复杂度 ≤130%)
- 改后必验证:`npm test` + `npm run lint`
- 不做破坏性 git 操作除非明确要求
