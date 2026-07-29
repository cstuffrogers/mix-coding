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
| `mattpocock` | Matt Pocock | 未标 (29 子技能) | 2026-06-11 | 2026-07-25 | 未标 |
| `mobile-ui-review` | — (本地) | 未标 | 2026-06-11 | 2026-07-25 | — |
| `review-checklist` | — (本地) | 未标 | 2026-06-11 | 2026-07-25 | — |
| `sec-bug-hunt` | — (本地) | 未标 | 2026-06-11 | 2026-07-25 | — |
| `speckit-*` (11 个) | github/spec-kit | specify-cli 0.14.3.dev0 | 2026-06-11 | 2026-07-25 | MIT |
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
