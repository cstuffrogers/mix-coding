---
description: 代码审查 + 安全审计（交互式模式选择）
argument-hint: "[模式: code_review/full_audit/analyze_only/security_deep/quality_tools/ai_design]"
---

# /review — 代码审查 + 安全审计

全面代码质量审查，**交互式勾选模式**，3 秒无操作使用默认。

## 模式选择菜单

启动时自动弹出：

```
选择审查模式（可多选，3秒无操作使用默认）：
☑ 代码审查 — ESLint + TypeScript + npm audit + PR 审查 + 多 Agent 审查
☐ 全量审计 — 安全扫描 + 依赖审计 + 性能基线 + 覆盖率 + 质量门禁汇总
☐ 仅分析 — 代码质量 + 性能瓶颈 + 可维护性分析，生成改进建议
☑ 安全深度扫描 — sec-bug-hunt + ReDoS + 开放重定向 + 日志脱敏 + CORS + 环境变量泄露
☐ 质量工具链 — Knip 死代码 + dependency-cruiser + jscpd 重复 + size-limit + Stryker 变异
☐ AI/设计审查 — aislop 代码气味 + Huashu 专家评审 + Impeccable 设计批判
```

## 已合并场景

| 原场景 | 现入口 |
|--------|--------|
| `/audit` | `/review` + 勾选"全量审计" |
| `/analyze` | `/review` + 勾选"仅分析" |

- **安全漏洞扫描** (`step 4`, `sec-bug-hunt`)：SQLi / XSS / 命令注入（BLOCK-MERGE 级别）
- **ReDoS 正则扫描** (`step 4.1`, `recheck-cli`)：灾难性回溯检测
- **开放重定向** (`step 4.2`)：URL 参数注入风险
- **日志脱敏** (`step 4.3`)：Token/密码泄露检测
- **CORS 检查** (`step 4.4`)：跨域配置安全
- **环境变量泄露** (`step 4.5`)：前端 env 暴露检测
- **敏感文件暴露** (`step 4.6`)：.env/*.pem/*.key 检查

### Phase 4: 质量门禁 + 报告

- **质量门禁** (`step 4.7`, `checkGate`)：15 项检查汇总，关键问题阻断合并（abort on fail）
- **审查报告** (`step 4.8`, `generateReviewReport`)：生成结构化 Markdown 报告 + Huashu 信息图

### 工具链覆盖

| Layer | 工具 | 类型 |
|-------|------|------|
| 静态分析 | ESLint + TypeScript + npm audit | CLI |
| 无障碍 | ai-friendly-review（5 项检查） | CLI |
| 死代码 | Knip（AST 级别） | CLI |
| 架构 | dependency-cruiser | CLI |
| 代码气味 | aislop（50+ 规则） | CLI |
| 代码重复 | jscpd（AST 级 copy-paste 检测） | CLI |
| 包体积 | size-limit（bundle 预算检查） | CLI |
| 变异测试 | Stryker（变异体杀死率 ≥80%） | CLI |
| API 规范 | Spectral（OpenAPI/Swagger lint） | CLI |
| Markdown | markdownlint（MD 规则格式检查） | CLI |
| 安全 | sec-bug-hunt + recheck + open-redirect + log-sanitization + cors + env-leak + sensitive-file（8 项扫描） | CLI |
| 设计 | Huashu 5 维度 + Impeccable 27 条反模式 | Skill / CLI |
| 语义 | Matt Pocock 双轴审查 + CE 9-Agent | Skill |
| 报告 | Markdown 报告 + Huashu 信息图 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，Skill 步骤(`review-checklist`、Matt Pocock `review`、`impeccable critique`)因为 `conversation_mode` 条件不满足而自动跳过，仅执行机械步骤。这是设计如此。
