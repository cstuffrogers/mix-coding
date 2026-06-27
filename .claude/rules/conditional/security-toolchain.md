# 外部安全工具链

以下工具已集成到对应工作流中，自动执行，零冲突。

## 工具列表

| 工具 | 类型 | 负责工作流 | 功能 |
|------|------|-----------|------|
| **noleak** | npm CLI | `/release`, `/audit`, `/cicd` | 构建产物泄露检测：Source Map / .env / 密钥 / .git |
| **seraphim-audit** | Python CLI | `/hunt`, `/audit` | 安全响应头扫描：CSP / HSTS / X-Frame-Options |
| **lychee** | Rust 二进制 | `/audit` | 死链接检测 |
| **pa11y-ci** | npm CLI | `/audit`, `/review` | WCAG 2.1 AA 无障碍扫描 |
| **recheck-cli** | npm CLI | `/hunt`, `/audit` | 正则 ReDoS 漏洞扫描 |
| **log-sanitizer** | 内置 grep | `/hunt`, `/audit`, `/review` | 日志脱敏：Token/密码/身份证号/手机号泄露 |
| **cors-checker** | 内置 grep | `/hunt`, `/audit`, `/review` | CORS 配置检测 |
| **env-var-leak** | 内置 grep | `/hunt`, `/audit`, `/review` | 前端环境变量泄露 |
| **prototype-pollution** | ESLint 规则 | `/audit`, `/hunt`, `/review` | no-prototype-builtins 原型链污染 |
| **sensitive-file-check** | 内置 git | `/hunt`, `/audit`, `/review` | .env/*.pem/*.key/credentials.json 暴露检查 |
| **deprecated-deps** | npm CLI | `/audit`, `/deps` | 废弃/未维护依赖检测 |
| **knip** | npx CLI | `/audit`, `/review` | AST 级死代码/依赖检测 |
| **skillspector** | Python CLI | `/hunt`, `/audit` | AI 技能安全扫描（64 种漏洞模式） |
| **aislop** | npx CLI | `/review`, `/audit` | AI 代码气味扫描（50+ 规则） |
| **dependency-cruiser** | npx CLI | `/audit` | 依赖架构验证：循环依赖/孤儿模块 |
| **Lighthouse CI** | npm CLI | `/release`, `/audit` | 性能门禁：LCP/CLS/TBT |
| **jscpd** | npx CLI | `/review`, `/audit` | 代码重复检测 |
| **size-limit** | npx CLI | `/review`, `/audit` | 包体积预算检查 |
| **Stryker** | npx CLI | `/review`, `/audit` | 变异测试 |
| **Spectral** | npx CLI | `/review`, `/audit` | API lint（OpenAPI/Swagger） |
| **markdownlint** | npx CLI | `/review`, `/audit` | Markdown 格式检查 |
| **codeguardian** | Python MCP | `/optimize`, `/refactor`, `/loop` | AI 代码优化守护者 |
| **critiq** | npm CLI | `/review`, `/audit`, `/hunt` | 确定性安全规则扫描：1,243 条规则 9 语言 (SQLi/SSRF/路径遍历/反序列化/硬编码密钥) |

## 工具安装

```bash
npm install -D noleak pa11y-ci recheck-cli knip jscpd size-limit markdownlint-cli
npm install -D @critiq/cli @critiq/rules
pip install git+https://github.com/seraphimhub/seraphim-audit.git
pip install git+https://github.com/NVIDIA/skillspector.git
# lychee: https://github.com/lycheeverse/lychee/releases
# aislop/dependency-cruiser/spectral/stryker: npx 零安装
```

## 设计原则

- 纯 CLI 调用，不占 MCP 端口
- devDependencies 隔离，不参与构建
- 只读扫描，不修改源码
