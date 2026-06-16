---
description: End-to-end release deployment: quality gate → version → build → leak check → Lighthouse CI → deploy → health check → GitHub Release. 24-step workflow with 3 BLOCK-RELEASE gates.
---

# /release — 发布部署

24 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 质量门禁 → 构建验证 → 部署 → 健康检查**

## Usage

```text
/release
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦安全/性能/测试覆盖率项
2. **recall** (`step 1`) — 注入历史发布记录和已知部署风险

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出待处理的 release-blocker issues
4. **Context7 MCP** (`step 2`) — 获取部署最佳实践文档

### Phase 2: 质量门禁

- **runReview** (`step 3`) — lint + typecheck + test + coverage + security 五项门禁
- **checkCoverage** (`step 4`) — 测试覆盖率门禁（>=85%）
- **generateChangelog** (`step 5`) — 从 Conventional Commits 生成 CHANGELOG
- **selectVersion** (`step 6`) — 选择版本升级类型（major/minor/patch）
- **bumpVersion** (`step 7`) — 自动更新版本号

### Phase 3: 构建 + 泄露检测

- **productionBuild** (`step 8`) — 生产构建
- **noleak** (`step 9`) — 构建产物泄露检测（Source Map/.env/密钥，BLOCK-RELEASE 阻断）
- **lighthouseCI** (`step 10`) — 性能门禁（LCP/CLS/TBT 断言，BLOCK-RELEASE 阻断）
- **aislop-scan** (`step 11`) — AI 代码气味扫描（50+ 规则）

### Phase 4: 部署 + 验证

- **smokeTest** (`step 12`) — 冒烟测试验证构建产物
- **createTag** (`step 13`) — 创建 Git 版本标签
- **deploy** (`step 14`) — 执行部署（滚动更新策略）
- **healthCheck** (`step 15`) — 部署后健康检查（3次重试）
- **createGitHubRelease** (`step 16`) — 创建 GitHub Release（附 CHANGELOG）

### Phase 5: 沉淀

- **huashu-release-deck** (`step 13.4`) — HTML deck → PPTX
- **huashu-release-animation** (`step 13.6`) — MP4/GIF 动画
- **costReport** (`step 14`) — 成本报告
- **ce-compound** (`step 16.5`) — 发布知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 泄露检测 | noleak（Source Map/.env/密钥） | CLI |
| 性能门禁 | Lighthouse CI（LCP/CLS/TBT） | CLI |
| 代码气味 | aislop（50+ 规则） | CLI |
| 验证 | 测试套件 + 覆盖率 + 冒烟测试 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。质量门禁、构建、泄露检测和部署步骤正常执行。
