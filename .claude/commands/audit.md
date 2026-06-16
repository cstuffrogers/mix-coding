---
description: Full project health audit: security scan + 5-layer code review + dependency audit + performance baseline + coverage + quality gate summary. 41-step all-in-one health check.
---

# /audit — 全面项目健康检查

48 步混合工作流：**Pre-flight 审查清单（对话模式）→ 安全扫描 → 代码审查 → 依赖审计 → 性能基线 → 质量门禁**

## Usage

```text
/audit                            # 全量项目体检
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单（正确性/类型安全/安全/性能/测试/可维护性），建立审计基准
2. **recall** (`step 0.5`) — 注入历史审计上下文和已知问题模式

### Phase 1: 安全扫描

- **sec-bug-hunt** (`step 1`) — 5 向量安全扫描（ESLint 安全规则/依赖 CVE/XSS/SQL 注入/命令注入/硬编码密钥/路径遍历）
- **npm-audit** (`step 2`) — npm audit 依赖漏洞扫描
- **skillspector-scan** (`step 3.18`) — AI 技能安全扫描（64 种漏洞模式）

### Phase 2: 代码质量审查

- **runReview** (`step 3`) — ESLint + TypeScript 静态分析
- **i18n-audit** (`step 3.03`) — 硬编码字符串 + RTL 检查
- **aislop-scan** (`step 3.19`) — 50+ AI 代码气味规则
- **knip-check** (`step 3.195`) — AST 级死代码/未使用依赖检测

### Phase 3: 依赖 + 安全深度

- **open-redirect-scan** (`step 3.04`) — 开放重定向风险
- **security-headers** (`step 3.05`) — 安全响应头配置扫描
- **recheck-cli** (`step 3.06`) — 正则 ReDoS 漏洞扫描
- **log-sanitization** (`step 3.07`) — 日志脱敏检测
- **cors-check** (`step 3.08`) — CORS 配置安全
- **env-var-leak** (`step 3.09`) — 前端环境变量泄露
- **sensitive-file-check** (`step 3.12`) — 敏感文件暴露
- **deprecated-deps** (`step 3.16`) — 废弃依赖检测

### Phase 4: 性能 + 构建

- **performanceProfile** (`step 4`) — 性能静态分析
- **codeMetrics** (`step 5`) — 代码复杂度扫描
- **checkOutdated** (`step 6`) — 过期依赖检查
- **gitLeaks** (`step 6.5`) — Git 历史密钥扫描
- **dead-link-check** (`step 8.5`) — 死链接检测
- **build-leak-check** (`step 8.7`) — 构建产物泄露扫描
- **lighthouse-gate** (`step 8.8`) — Lighthouse CI 性能门禁

### Phase 5: 质量门禁 + 报告

- **checkGate** (`step 9`) — 15 项检查汇总，关键问题阻断
- **generateReport** (`step 10`) — 生成结构化审计报告（docs/audit-report.md）
- **autoFix** (`step 10.5`) — 自动修复可修复项
- **ce-compound** (`step 13.5`) — CE 知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 安全 | sec-bug-hunt + npm audit + recheck + log-sanitizer + cors + env-leak + sensitive-file + deprecated-deps + skillspector | CLI |
| 质量 | ESLint + TypeScript + i18n + aislop + knip + dependency-cruiser | CLI |
| 性能 | Lighthouse CI + 复杂度扫描 + 死链接 + 构建泄露 | CLI |
| 门禁 | 15 项质量门禁汇总 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 步骤因为 `conversation_mode` 条件不满足而自动跳过，CLI handler 展示 23 项清单参考内容。其余机械步骤正常执行。
