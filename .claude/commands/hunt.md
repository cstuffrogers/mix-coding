---
description: Code security vulnerability scan and fix: security rules + dependency CVEs + secret scanning + security headers + auto-fix + notification.
---

# /hunt — 安全漏洞扫描

24 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 安全扫描 → 自动修复**

## Usage

```text
/hunt                             # 全量安全漏洞扫描
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦安全检查项
2. **recall** (`step 2`) — 注入历史安全漏洞和修复记录

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出安全相关 issues
4. **Tavily MCP** (`step 1.1`) — 搜索相关 CVE 和安全公告
5. **Context7 MCP** (`step 1.2`) — 获取最新安全补丁文档
6. **GitHub MCP** (`step 1.3`) — 列出安全相关 PRs

### Phase 2: 安全扫描

- **runReview** (`step 2`) — ESLint 安全规则扫描
- **npm-audit** (`step 3`) — 依赖 CVE 扫描
- **sec-bug-hunt** (`step 4`) — 5 向量静态安全扫描（ESLint 安全规则/依赖 CVE/XSS/SQL 注入/命令注入/硬编码密钥/路径遍历）
- **security-headers** (`step 4.05`) — 安全响应头配置扫描
- **recheck-cli** (`step 4.07`) — 正则 ReDoS 漏洞扫描
- **log-sanitization** (`step 4.08`) — 日志脱敏检测
- **cors-check** (`step 4.09`) — CORS 配置安全
- **env-var-leak** (`step 4.11`) — 前端环境变量泄露
- **sensitive-file-check** (`step 4.12`) — 敏感文件暴露检查
- **skillspector-scan** (`step 4.15`) — AI 技能安全扫描（64 种漏洞模式）

### Phase 3: 修复 + 沉淀

- **autoFix** (`step 5`) — 自动修复可修复的安全问题
- **ce-compound** (`step 6`) — 安全知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Tavily MCP + Context7 MCP | MCP |
| 扫描 | ESLint + npm audit + sec-bug-hunt + recheck + log-sanitizer + cors + env-leak + sensitive-file + skillspector | CLI |
| 门禁 | security-headers | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 上下文收集步骤自动跳过。其余机械步骤正常执行。
