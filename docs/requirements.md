# Mix-Coding 外部工具依赖清单

> 生成日期: 2026-06-12

---

## 核心运行时

| 工具 | 版本要求 | 安装 | 用途 |
|------|---------|------|------|
| **Node.js** | >= 18 LTS | [nodejs.org](https://nodejs.org/) | 运行 claude-scene CLI 和执行 npm 工具 |
| **Python** | >= 3.10 | [python.org](https://www.python.org/) | seraphim-audit 安全响应头扫描 |
| **Git** | >= 2.40 | [git-scm.com](https://git-scm.com/) | 版本控制和 Git 工作流 |
| **Bash / Git Bash** | — | Git 自带 (Windows) | safeExec shell 命令执行 |

---

## npm 工具（package.json devDependencies）

| 工具 | 版本 | npm 包名 | 负责工作流 | 功能 |
|------|------|---------|-----------|------|
| **Lighthouse CI** | ^0.15.1 | `@lhci/cli` | audit, release | Web 性能门禁：LCP/CLS/TBT 断言 + 缓存策略 + PWA |
| **Clearible** | ^0.1.1 | `clearible` | review, audit | React 组件架构分析：耦合度/循环依赖/状态库混用 |
| **Knip** | ^6.16.1 | `knip` | audit, analyze | 死代码/未使用依赖检测 |

---

## npm 工具（推荐额外安装）

| 工具 | npm 包名 | 负责工作流 | 功能 |
|------|---------|-----------|------|
| **noleak** | `noleak` | audit, release | 构建产物泄露检测：Source Map / .env / 密钥 |
| **pa11y-ci** | `pa11y-ci` | review (a11y 增强) | WCAG 2.1 AA 深度无障碍扫描 |
| **recheck-cli** | `recheck-cli` | hunt (可选) | 正则 ReDoS 灾难性回溯检测 |

---

## Python 工具

| 工具 | 安装源 | 负责工作流 | 功能 |
|------|--------|-----------|------|
| **seraphim-audit** | `git+https://github.com/seraphimhub/seraphim-audit.git` | hunt, audit | 安全响应头扫描：CSP/HSTS/X-Frame-Options 等 6 项 |

---

## 二进制工具

| 工具 | 安装方式 | 负责工作流 | 功能 |
|------|---------|-----------|------|
| **lychee** | [GitHub Releases](https://github.com/lycheeverse/lychee/releases) (Windows `.exe`) / `cargo install lychee` / `brew install lychee` | audit | 死链接检测：扫描 Markdown/HTML 中的失效链接 |

---

## 工具 ↔ 工作流映射矩阵

| 工具 | hunt | audit | review | release |
|------|:----:|:-----:|:------:|:-------:|
| Lighthouse CI (@lhci/cli) | — | ✅ 8.8 | — | ✅ 8.6 |
| Clearible | — | ✅ 6.6 | ✅ 2.7 | — |
| Knip | — | ✅ | ✅ | — |
| noleak | — | ✅ 8.7 | — | ✅ 8.5 |
| seraphim-audit | ✅ 4.3 | ✅ 3.1 | — | — |
| lychee | — | ✅ 8.5 | — | — |
| pa11y-ci | — | — | ✅ (a11y) | — |
| recheck-cli | ✅ (opt) | — | — | — |

> ✅ 数字 = 场景配置中的步骤编号。✅ (opt) = 可选。— = 不使用。

---

## 一键安装

```bash
# Windows: 运行 install-tools.bat
# Linux/Mac: 运行 ./install-tools.sh
```

详见项目根目录下的 `install-tools.bat` 和 `install-tools.sh`。
