---
description: Mobile release: quality gate → cert check → version bump → CHANGELOG → TestFlight/Google Play. 17-step workflow.
argument-hint: "[patch|minor|major]"
---

# /mobile-release — 移动端发布

18 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 质量门禁 → 构建签名 → 商店发布**

## Usage

```text
/mobile-release                    # 交互式选择版本号
/mobile-release patch              # 修订版本（1.0.0 → 1.0.1）
/mobile-release minor              # 次版本（1.0.0 → 1.1.0）
/mobile-release major              # 主版本（1.0.0 → 2.0.0）
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦移动端安全/签名/隐私合规/商店合规项
2. **recall** (`step 0.5`) — 注入历史发布记录和已知商店审核问题

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出 release-blocker issues
4. **Context7 MCP** (`step 2`) — 获取 App Store/Google Play 最新审核指南

### Phase 2: 质量门禁

- **securityGate** (`step 3`) — 安全检查（OWASP MASVS 对照）
- **performanceGate** (`step 4`) — 性能基线（包体积/启动/FPS）
- **testGate** (`step 5`) — 测试全量通过
- **certCheck** (`step 6`) — iOS Profile + Android Keystore 校验
- **privacyCheck** (`step 7`) — 隐私标签/权限声明校验

### Phase 3: 构建 + 发布

- **bumpVersion** (`step 8`) — 版本号更新
- **generateChangelog** (`step 9`) — 生成 CHANGELOG
- **uploadTestFlight** (`step 10`) — iOS → TestFlight
- **uploadPlay** (`step 11`) — Android AAB → Google Play

### Phase 4: 沉淀

- **ce-compound** (`step 12`) — 移动端发布知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 商店 | App Store Connect + Google Play Console | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。质量门禁、构建和发布步骤正常执行。
