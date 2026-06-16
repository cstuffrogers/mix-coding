---
description: Five-layer code review with 8-tool chain: ESLint, TypeScript, a11y, knip, dependency-cruiser, aislop, Huashu, security scans. 28-step hybrid workflow.
argument-hint: "[--mode pr|full|commit] [--base main] [--layers static,react,visual,ai]"
---

# /review — 代码审查 + 安全审计

33 步混合工作流：**Pre-flight Skill 设计智能（对话模式）→ CLI 机械步骤（lint/扫描/测试）→ Post-flight Skill 深度审查（对话模式）**

## Usage

```text
/review                          # Review uncommitted changes
/review --mode pr                # Review current PR branch
/review --mode full              # Full project review
/review --mode commit            # Review HEAD commit
/review --base main              # Review against base branch
/review --layers static,ai       # Run only selected layers
```

## 执行流程

### Phase 0: Pre-flight 审查准备（对话模式，Skill() 调用）

在代码分析前建立审查基准：

1. **review-checklist Skill** (`step 0.3`) — 加载 23 项审查清单（正确性/类型安全/安全/性能/测试/可维护性），为后续分析提供结构化审查框架
2. **Memory recall** (`step 0.5`) — 注入历史审查上下文和已知代码质量问题

### Phase 1: CLI 静态分析 + 工具链

CLI 执行具体扫描（通过 `node src/index.js start review --auto`）：

- **Layer 1 — 静态分析** (`step 2`, `runReview`)：ESLint + TypeScript + npm audit
- **无障碍扫描** (`step 2.3`, `ai-friendly-review`)：img-alt / input-label / html-lang / contrast-risk / clickable-div
- **Huashu 专家评审** (`step 2.5`)：5 维度 UI 设计质量评分（可选增强）
- **死代码检测** (`step 2.6`, `knip-check`)：未使用文件 / 未使用导出 / 未使用依赖
- **架构验证** (`step 2.65`, `depcruise-architecture`)：循环依赖 / 孤儿模块 / 分层合规
- **状态审计** (`step 2.7`)：Context 过度使用、组件耦合度
- **Handler 验证** (`step 2.8`)：检测空转桩（MCP/MP/CE/伪桩）
- **AI 代码气味扫描** (`step 2.9`, `aislop`)：50+ 规则 — 叙事注释、吞异常、as any 滥用等

### Phase 2: Post-flight 深度审查（对话模式，Skill() 调用）

CLI 机械步骤完成后，Skill 深度审查：

3. **Matt Pocock 双轴审查** (`step 3.2`, `Skill("review")`) — 标准轴（编码规范）+ 规范轴（原始 issue/PRD 对照）
4. **Impeccable 设计批判** (`step 3.5`, `Skill("impeccable", "critique")`) — 27 条反 AI 模式规则 + 12 条 LLM 批判规则

### Phase 3: 安全深度扫描

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
