# 外部安全工具链

「负责工作流」只写引擎里真有的东西：`step N` 是 `claude-scene/scenes/<场景>.json` 里 `flow` 条目的真实 `step` 值
（`scripts/check-tool-steps.cjs` 校验这一步，别手改数字）；标「未接入」的工具**没有任何场景步骤调用它**，
装它不会自动跑——不假装。

## 工具列表

| 工具 | 类型 | 负责工作流 | 功能 |
|------|------|-----------|------|
| **noleak** | npm CLI | `/release` (step 8.5), `/cicd` (step 2.5) | 构建产物泄露检测：Source Map / .env / 密钥 / .git |
| **seraphim-audit** | Python CLI | `/review` (step 4.56) | 安全响应头扫描：CSP / HSTS / X-Frame-Options |
| **lychee** | Rust 二进制 | 未接入场景：handler 已注册，无场景步骤调用 | 死链接检测 |
| **pa11y-ci** | npm CLI | `/review` (step 2.35) | WCAG 2.1 AA 无障碍扫描 |
| **recheck-cli** | npm CLI | `/review` (step 4.1) | 正则 ReDoS 漏洞扫描 |
| **log-sanitizer** | 内置 grep | `/review` (step 4.3) | 日志脱敏：Token/密码/身份证号/手机号泄露 |
| **cors-checker** | 内置 grep | `/review` (step 4.4) | CORS 配置检测 |
| **env-var-leak** | 内置 grep | `/review` (step 4.5) | 前端环境变量泄露 |
| **prototype-pollution** | ESLint 规则 | `/review` (step 2) | no-prototype-builtins 原型链污染 |
| **sensitive-file-check** | 内置 git | `/review` (step 4.55) | .env/*.pem/*.key/credentials.json 暴露检查 |
| **deprecated-deps** | npm CLI | `/deps` (step 3.5) | 废弃/未维护依赖检测 |
| **knip** | npx CLI | `/review` (step 2.6) | AST 级死代码/依赖检测 |
| **skillspector** | Python CLI | `/review` (step 4.57) | AI 技能安全扫描（64 种漏洞模式） |
| **aislop** | npx CLI | `/review` (step 2.9), `/release` (step 8.7) | AI 代码气味扫描（50+ 规则） |
| **dependency-cruiser** | npx CLI | `/review` (step 2.65) | 依赖架构验证：循环依赖/孤儿模块 |
| **Lighthouse CI** | npm CLI | `/release` (step 8.6) | 性能门禁：LCP/CLS/TBT |
| **jscpd** | npx CLI | `/review` (step 2.95) | 代码重复检测 |
| **size-limit** | npx CLI | `/review` (step 2.96) | 包体积预算检查 |
| **Stryker** | npx CLI | `/qa` (step 6.5) | 变异测试 |
| **Spectral** | npx CLI | 未接入场景：handler 已注册，无场景步骤调用 | API lint（OpenAPI/Swagger） |
| **markdownlint** | npx CLI | 未接入场景：handler 已注册，无场景步骤调用 | Markdown 格式检查 |
| **codeguardian** | Python MCP | `/loop` (step 4.2), `/optimize` (step 9.6), `/refactor` (step 13.5) | AI 代码优化守护者 |
| **critiq** | npm CLI | `/review` 增强项（`critiq_security_scan`，需装 `@critiq/cli` 并在增强菜单里勾选） | 确定性安全规则扫描：1,243 条规则 9 语言 (SQLi/SSRF/路径遍历/反序列化/硬编码密钥) |
| **trivy** | Go 二进制 | 未接入引擎：没有 handler，只有安装与版本检查 | 容器镜像/文件系统/IaC 全量扫描：CVE + 密钥 + 配置错误 (25k+ stars, Aqua Security) |
| **shellcheck** | Haskell 二进制 | 未接入引擎：没有 handler，只有安装与版本检查 | Shell 脚本静态分析 (37k+ stars) |
| **sqlfluff** | Python CLI | 未接入引擎：没有 handler，只有安装与版本检查 | SQL linter + formatter：200+ 规则，支持 8 种 SQL 方言 (MIT) |
| **bruno** | npm CLI | 未接入引擎：没有 handler，只有安装与版本检查 | API 交互测试：REST/GraphQL/WebSocket 集合运行，Git 友好纯文本 (31k+ stars, MIT) |
| **gitleaks** | Go 二进制 | `/review` (step 4.551) | Git 历史 + 实时密钥泄露检测：120+ 内置规则 (18k+ stars) |
| **semgrep** | Python CLI | `/review` (step 4.6) | 多语言 AST 级 SAST：2,500+ 社区规则 (11k+ stars) |
| **commitlint** | npm CLI | 未接入引擎：没有 handler，只有安装与版本检查 | Conventional Commits 格式校验 (18k+ stars) |
| **biome** | npm CLI | 未接入引擎：没有 handler，只有安装与版本检查 | Rust 编写 JS/TS linter + formatter，替代 ESLint+Prettier (50k+ stars) |
| **ruff** | Python CLI | 未接入引擎：没有 handler，只有安装与版本检查 | Rust 编写 Python linter + formatter，替代 Flake8+isort+black (35k+ stars) |
| **hurl** | Rust 二进制 | 未接入引擎：没有 handler，只有安装与版本检查 | 纯文本 API 测试 CLI，替代 bruno 做 CI 集成 (13k+ stars) |

## 工具安装

```bash
npm install -D noleak pa11y-ci recheck-cli knip jscpd size-limit markdownlint-cli
npm install -D @critiq/cli @critiq/rules
pip install git+https://github.com/seraphimhub/seraphim-audit.git
pip install git+https://github.com/NVIDIA/skillspector.git
pip install sqlfluff
pip install semgrep
npm install -D @commitlint/cli @commitlint/config-conventional
npm install -D @biomejs/biome
pip install ruff
# hurl: https://github.com/Orange-OpenSource/hurl/releases (winget install Orange-OpenSource.Hurl / brew install hurl)
# gitleaks: https://github.com/gitleaks/gitleaks/releases (winget install Gitleaks.Gitleaks / brew install gitleaks)
# lychee: https://github.com/lycheeverse/lychee/releases
# trivy: https://github.com/aquasecurity/trivy/releases (winget install AquaSecurity.Trivy / brew install trivy)
# shellcheck: https://github.com/koalaman/shellcheck/releases (winget install koalaman.shellcheck / brew install shellcheck)
# bruno: npm install -g @usebruno/cli
# aislop/dependency-cruiser/spectral/stryker: npx 零安装
```

## 设计原则

- 纯 CLI 调用，不占 MCP 端口
- devDependencies 隔离，不参与构建
- 只读扫描，不修改源码
