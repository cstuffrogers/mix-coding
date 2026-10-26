# 工具版本与更新记录

> 记录每个外部工具/Skill 的版本、接入时间、上游来源。**更新工具前先查此表**,对比上游最新版本判断是否需要更新。

**生成日期**: 2026-07-24
**最后核查**: 2026-07-25

---

## 如何使用本文件

### 判断要不要更新的流程

1. 查下表找到工具的 **上游来源** 链接
2. 对比表中 **当前版本** 与上游最新 release
3. 若上游有新版:
   - **Major 升级** (X.0.0) — 大概率有破坏性变更,先看 CHANGELOG/migration guide,再决定
   - **Minor 升级** (0.X.0) — 通常向后兼容,可更新但需跑测试
   - **Patch 升级** (0.0.X) — bug 修复,低风险,直接更新
4. 更新后:**改本表版本 + 在"更新日志"加一行 + 跑 `/check` 验证**

### 更新触发时机

| 场景 | 动作 |
|------|------|
| `/deps` 工作流 | 比对本表 vs `npm outdated` / 上游 release |
| 安全漏洞告警 | 优先更新有 CVE 的工具,记入日志 |
| 手动升级某 skill | 更新版本 + 日期 + commit hash |

---

## 1. Claude Skills (`.claude/skills/`)

| Skill | 上游来源 | 当前版本 | 接入日期 | 最后核查 | License |
|-------|---------|---------|---------|---------|---------|
| `ai-friendly-web-design` | ianho7 | 未标 | 2026-06-11 | 2026-07-25 | 未标 |
| `awesome-design-md` | VoltAgent | 未标 | 2026-06-11 | 2026-07-25 | 未标 |
| `code-review-graph` | tirth8205 | v2.3.7 (已最新) | 2026-07-23 | 2026-07-25 | 未标 |
| `constitution-reference` | — (本地) | 未标 | 2026-06-11 | 2026-07-25 | — |
| `hallmark` | Nutlope/hallmark | 1.1.0 | 2026-07-14 | 2026-07-25 | 未标 |
| `i-have-adhd` | ayghri/i-have-adhd | 未标 (上游无 version 字段) | 2026-07-24 | 2026-07-25 | MIT |
| `impeccable` | — | 3.5.0 | 2026-06-11 | 2026-07-25 | Apache 2.0 |
| `mattpocock` | Matt Pocock | v1.2.x (本地定制) → v1.3.1 已核查 | 2026-10-24 | — |
| `mobile-ui-review` | — (本地) | 未标 | 2026-06-11 | 2026-07-25 | — |
| `review-checklist` | — (本地) | 未标 | 2026-06-11 | 2026-07-25 | — |
| `sec-bug-hunt` | — (本地) | 未标 | 2026-06-11 | 2026-07-25 | — |
| `speckit-*` (11 个) | github/spec-kit | specify-cli 0.14.3.dev0 → 1.2.3 | 2026-10-24 | MIT |
| `stack-knowledge` | — (本地) | 未标 | 2026-06-11 | 2026-07-25 | — |
| `web-design-engineer` | ConardLi | 未标 (上游 repo not found) | 2026-06-11 | 2026-07-25 | 未标 |

> **核查方式**: 对每个上游 repo `git ls-remote --tags` 或查 GitHub releases 页。无 version 字段的 skill 以 commit hash 追踪(见下方更新日志)。

---

## 2. npm 包 (`claude-scene/package.json`)

| 包 | 当前版本 | 类型 | 最后核查 |
|----|---------|------|---------|
| chalk | ^5.3.0 | dep | 2026-07-24 |
| commander | ^15.0.0 | dep | 2026-07-24 |
| inquirer | ^14.0.2 | dep | 2026-07-24 |
| ora | ^9.4.0 | dep | 2026-07-24 |
| @cyclonedx/cyclonedx-npm | ^6.0.0 | dev | 2026-07-25 |
| @eslint/js | ^10.0.1 | dev | 2026-07-24 |
| @lhci/cli | ^0.15.1 | dev | 2026-07-24 |
| @redocly/cli | ^2.34.0 | dev | 2026-07-24 |
| @vitest/coverage-v8 | ^4.1.9 | dev | 2026-07-24 |
| artillery | ^2.0.33 | dev | 2026-07-24 |
| eslint | ^10.8.0 | dev | 2026-07-25 |
| eslint-plugin-import-x | ^4.17.1 | dev | 2026-07-25 |
| eslint-plugin-sonarjs | ^4.1.0 | dev | 2026-07-24 |
| eslint-plugin-unicorn | ^72.0.0 | dev | 2026-07-25 |
| knip | ^6.17.1 | dev | 2026-07-24 |
| license-checker | ^25.0.1 | dev | 2026-07-24 |
| noleak | ^0.1.2 | dev | 2026-07-24 |
| openapi-typescript | ^7.13.0 | dev | 2026-07-24 |
| pa11y-ci | ^4.1.1 | dev | 2026-07-24 |
| playwright | ^1.62.0 | dev | 2026-07-25 |
| recheck-cli | ^0.3.1 | dev | 2026-07-24 |
| runme | ^3.15.0 | dev | 2026-07-24 |
| vitest | ^4.1.9 | dev | 2026-07-24 |

> **核查命令**: `cd claude-scene && npm outdated` 列出过期包。

---

## 3. 外部 CLI 工具

> 这些工具通过 `uv`/`brew`/`winget`/`npx` 按需拉取,版本由本地包管理器决定,不固定在本仓库。核查方式见各工具安装说明 (`conditional/security-toolchain.md`)。

| 工具 | 类型 | 安装方式 | 最后核查 |
|------|------|---------|---------|
| specify-cli (spec-kit) | uv/Python | `uv tool install` | 2026-07-25 |
| seraphim-audit | uv/Python | `pip install git+...` | 2026-07-24 |
| skillspector | uv/Python | `pip install git+...` | 2026-07-24 |
| sqlfluff | uv/Python | `pip install` | 2026-07-24 |
| semgrep | uv/Python | `pip install` | 2026-07-24 |
| ruff | uv/Python | `pip install` | 2026-07-25 |
| lychee | Rust 二进制 | brew/cargo/winget | 2026-07-24 |
| hurl | Rust 二进制 | brew/winget | 2026-07-24 |
| act | Go 二进制 | winget/brew | 2026-07-24 |
| restic | Go 二进制 | winget/brew | 2026-07-25 |
| trivy | Go 二进制 | winget/brew | 2026-07-24 |
| gitleaks | Go 二进制 | winget/brew | 2026-07-24 |
| shellcheck | Haskell 二进制 | winget/brew | 2026-07-24 |
| bruno | npm 全局 | `npm install -g` | 2026-07-24 |
| biome | npx | 零安装 | 2026-07-24 |
| aislop | npx | 零安装 | 2026-07-24 |
| dependency-cruiser | npx | 零安装 | 2026-07-24 |
| jscpd | npx | 零安装 | 2026-07-24 |
| size-limit | npx | 零安装 | 2026-07-24 |
| Stryker | npx | 零安装 | 2026-07-24 |
| Spectral | npx | 零安装 | 2026-07-24 |
| markdownlint | npx | 零安装 | 2026-07-24 |
| commitlint | npx | 零安装 | 2026-07-24 |
| critiq | npm | `npm install -D` | 2026-07-24 |

> **核查命令**:
> - Python: `uv tool list --updates` 或 `pip list --outdated`
> - Go/Rust 二进制: `trivy --version` / `gitleaks version` 等,对比 GitHub releases
> - npx 零安装工具: 每次跑都拉最新,无需手动更新

### 3.1 缺陷检测的三个维度（互不替代）

| 维度 | 工具/步骤 | 抓得到 | 抓不到 |
|------|----------|--------|--------|
| **静态分析** | `review` 4.6 `semgrep` | 外部输入流向危险汇点（SQL/命令注入、路径穿越、反序列化、开放重定向） | 逻辑错：语法合法、无可疑模式，只是算错 |
| **运行时 · 属性测试** | `setup` 2.3 `propertyTestScout`（fast-check / hypothesis） | 逻辑错：off-by-one、不变量违反、边界条件 | 没装库或没写用例就跑不了 |
| **运行时 · 变异测试** | `qa` 6.5 `stryker` | 测试本身有没有效力（存活变异体 = 测试没覆盖的路径） | 耗时；需 stryker 配置 |
| **LLM 语义审查** | `sec-bug-hunt` / `mp-review` / `review-checklist` / vendored `sharp-edges`、`variant-analysis` | 跨文件意图、设计缺陷、易误用 API 形态 | 不确定、不可复现，会漏也会编 |
| **确定性语料扫描** | `review` 4.61 `insecure-defaults-scan` | 不安全默认值 6 类（兜底密钥/默认凭据/fail-open/弱加密/过度放行/调试泄漏）：规则集是机读种子，跑得出来就能复现 | 只出候选：种子命中 ≠ 漏洞，仍需 4.64 逐条证伪 |

vendored 技能的来源、许可与更新方式见 [vendored-skills.md](./vendored-skills.md)。

关键认知：**semgrep 只能做上表第一行**。实测量化 —— 一份 11 行、含 8 类漏洞的样本，现有正则类安全步骤只抓到 2 类，
semgrep 抓到 9 处；而一段「分页少返回一个元素」的代码，semgrep/CodeQL **零命中**，
fast-check 跑 69 次后自动收缩出最小反例 `[[0,0],0,1]`。所以"加工具"不等于"能力提升"，维度才是。

#### semgrep（`review` 4.6）

自带规则包 `claude-scene/src/rules/semgrep-logic-io.yml`（10 条），项目根 `.semgrep.yml` 优先覆盖。
覆盖：SQL 字符串拼接、动态代码执行（eval/Function）、不安全反序列化、请求体直入 JSON.parse、
innerHTML 汇点、请求参数派生文件路径（穿越）、服务端开放重定向、请求参数拼 shell 命令、
try 块内浮空 Promise、未关闭的文件句柄。

缺失时行为：报「跳过」→ 计为 noop，绝不假通过。

#### insecure-defaults 候选扫描（`review` 4.61）

`src/handlers/security/insecure-defaults.js` **运行时读** `.claude/skills/insecure-defaults/references/*.json`
（6 类共 37 条 seed，不在 `src/` 复制正则），编译成 JS `RegExp` 后扫源码 + 配置清单
（`.yml/.yaml/.toml/.json/.tf/.env/Dockerfile/…`），先过一层可判定证伪再输出候选。

与 4.64 的分工：4.61 确定性给候选，4.64 由技能逐条证伪判定。措辞纪律：有候选 →
`N 处候选（… 需逐条证伪）` → warn；0 文件 → `未找到可扫描的源文件` → fail；
无规则集 → `未找到 … 规则集` → noop。细节（大小写敏感、POSIX 类嵌套、证伪规则表）
见 [vendored-skills.md](./vendored-skills.md#insecure-defaults-from-prompt-to-deterministic-detector)。

**Windows 注意事项**：pip 装的 `semgrep.exe` 是 shim，会按名 exec `pysemgrep`，
所以光解析绝对路径不够，必须把 `%APPDATA%\Python\Python3xx\Scripts` 注入 PATH；
Python 默认 GBK 会让含非 ASCII 的规则文件解析失败，调用时须设 `PYTHONUTF8=1`。
两点都由 `src/handlers/deep-review-tools.js` 的 `_probeEnv()` / `_runSemgrep()` 处理。

**扫描范围**必须与源码清单对齐（`buildSemgrepTargets()`）：直接扫 `.` 会把 `coverage/` 生成物、
vendored UMD bundle、嵌套仓库（自带 `.git`）一起扫进来。本仓库曾因此报 12 处，
全是这类文件，真实代码 0 处。

#### 属性测试（`setup` 2.3）

`setup --auto` 默认走 e2e 分支，显式选 `property` 才跑：

```bash
node claude-scene/src/index.js start setup --auto   # 走 e2e
# 交互选择「属性测试设施」→ 跑 propertyTestScout
```

检测 `fast-check`（JS）/ `hypothesis`（Python）→ 找引用该库的测试文件 → 用项目自己的 runner 跑。
**从不擅自安装依赖、不写目标项目文件**。三条 SKIP 路径都区分清楚：
库没装 / 装了但没有用例（runner 报 "No test files"）/ 没有 runner。

### 3.2 有意**不**接入工作流的工具

以下三个工具无法在本地 CLI 真跑,留在工作流里只会每次贡献一个永久 noop、稀释信噪比
（而 noop 在本引擎里代表"未验证",会干扰验收判断）。接入方式记在这里,需要时手工加：

| 工具 | 为何不接入 | 想用时怎么做 |
|------|-----------|-------------|
| SonarQube / sonar-scanner | 需自建服务器或 SonarCloud 令牌 + `sonar-project.properties` | 装 `sonar-scanner`,写好 properties 后手动跑 |
| CodeQL | 需 GitHub 下载 ~1GB bundle；query pack 对私有仓库要 GitHub Advanced Security 许可 | 网络可达时手工建库分析 |
| Bearer SAST | Go 二进制，需 Go proxy / GitHub releases / Docker Hub —— 三者本机均不可达（`pip bearer` 是另一个 python helper 库） | 网络恢复后 `brew install bearer/tap/bearer` |
| Joern | CPG 代码属性图，需 GitHub release zip（含 JVM），无 pip/npm 包 | 网络恢复后下载 release 手动装 |
| Infer (facebook) | 无 Windows 支持，需 GitHub release / opam（`npm infer` 是「从邮箱猜名字」的假包） | 在 Linux/macOS 或 WSL 下装 |
| Alibaba open-code-review | npm/pip 均无包,无本地 CLI | 部署其 Review Agent 服务,或对话模式调用 |
| ai-codereviewer | 仅 GitHub Action 形态 | 加 `.github/workflows/ai-review.yml`,交给 CI |

---

## 4. MCP 服务器 (`.mcp.json`)

| 服务器 | 最后核查 |
|--------|---------|
| codegraph, github, context7, tavily-search, playwright, filesystem, sequential-thinking, memory, stripe, supabase, resend, sentry, bearer, detox, mobsfscan | 2026-07-24 |

> **核查**: MCP 服务器通过 `npx` 拉取,版本随上游 npm 包。`/check` 会检测 MCP 配置健康度。

---

## 更新日志

> 按时间倒序。每次工具/Skill 更新记一行。格式: `日期 | 工具 | 旧版本 → 新版本 | commit | 备注`

| 日期 | 工具 | 变更 | Commit | 备注 |
|------|------|------|--------|------|
| 2026-07-25 | `fast-check` 4.10.2 / `Stryker` 10.1.1 | 新增集成 | — | setup 2.3 属性测试 / qa 6.5 变异测试; 抓静态分析抓不到的逻辑错 |
| 2026-07-25 | `CodeQL` | **移除** | — | 需 ~1GB bundle + 私有仓库要 GHAS 许可; 网络到不了 GitHub = 永久 noop |
| 2026-07-25 | `semgrep` | 新增集成 | — | review 4.6; 自带离线规则包 10 条; Windows 需 PATH+PYTHONUTF8 |
| 2026-07-25 | SonarQube / open-code-review / ai-codereviewer | **不接入** | — | 无法本地 CLI 真跑, 接入方式见 3.2 |
| 2026-10-24 | `speckit-*` (11 个) | specify-cli 0.14.3.dev0 → **1.2.3** | — | 新增 scripts/handoffs/tools 字段, hook 处理细节优化 |
| 2026-10-24 | `speckit-*` (6 个) | 集成到场景 | — | analyze→review, checklist→feature, constitution→new-project, converge→feature, taskstoissues→feature, clarify→spec 命令 |
| 2026-10-24 | `mattpocock` | 核查: v1.2.x 本地定制 → v1.3.1 | — | 上游有 37 个技能,本地保留 29 个定制版 |
| 2026-10-24 | `pa11y-ci` | 4.1.1 → **5.0.0** | — | major,配置格式变化,需迁移 |
| 2026-10-24 | `@biomejs/biome` | 2.5.3 → **2.6.2** | — | minor,配置 schema 自动升级 |
| 2026-07-25 | `restic` | 0.19.0 → 0.19.1 | — | winget,patch |
| 2026-07-25 | `ruff` | 0.15.15 → 0.16.0 | — | pip,minor |
| 2026-07-25 | `specify-cli` | 0.11.2.dev0 → 0.14.3.dev0 | — | uv tool,从 spec-kit git HEAD,speckit-* skill 不受影响 |
| 2026-07-25 | `eslint-plugin-unicorn` | 67.0.0 → 72.0.0 | — | npm,换 import-x 解锁 peer,35 条新规则批量关闭 |
| 2026-07-25 | `@cyclonedx/cyclonedx-npm` | 4.2.1 → 6.0.0 | — | npm,major,SBOM 输出正常 (CycloneDX 1.6) |
| 2026-07-25 | `eslint-plugin-import-x` | 首次接入 4.17.1 | — | 替代 eslint-plugin-import (eslint 10 peer 解锁) |
| 2026-07-25 | `eslint` | 10.7.0 → 10.8.0 | — | npm,minor |
| 2026-07-25 | `playwright` | 1.61.1 → 1.62.0 | — | npm,minor |
| 2026-07-25 | `code-review-graph` | 核查: 已最新 v2.3.7 | — | 内容一致,仅 CRLF 差异 |
| 2026-07-24 | `i-have-adhd` | 首次接入 (上游无 version) | 8c712ab | ayghri/i-have-adhd,纯按需 /i-have-adhd,frontmatter 精简 |
| 2026-07-23 | `code-review-graph` | 首次接入 | 96c4a0d | tirth8205,7 子 skill,Tree-sitter 知识图谱 |
| 2026-07-14 | `hallmark` | v1.1.0 首次接入 | 73d0644 | Nutlope/hallmark,20 主题 + 57 slop-test |
| 2026-06-11 | 初始工具集 | 首次接入 | 013c00c | 14 skill + npm 包 + 外部工具 初始 release |

---

## 待办

- [ ] Task #1: 四平台验证 `i-have-adhd` 加载 (opencode/Codex/ZCode)
- [ ] 清理孤儿 submodule `.claude/tools/agent-egress-bench` (`.gitmodules` 无 mapping)
- [ ] scanUpdates 盲区:`scanSkills` 不对比上游 release,`scanCliTools` 不对比 pypi 最新版
- [ ] `hallmark` 上游无 tags,需 commit hash 追踪机制
- [ ] `web-design-engineer` 上游 repo not found,待确认是否换源或弃用
- [ ] 下次 `/deps` 工作流时,用 `npm outdated` + 上游 release 对比本表,更新过期项
