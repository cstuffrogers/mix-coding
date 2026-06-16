---
description: Mobile E2E test setup: auto-detect framework → select best tool (Detox/Patrol) → generate config + examples → CI integration. 12-step workflow.
argument-hint: "[测试范围]"
---

# /mobile-e2e — 移动端 E2E 测试配置

13 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 框架检测 → 工具选择 → 配置生成 → CI 集成**

## Usage

```text
/mobile-e2e                        # 自动检测并配置 E2E 测试
/mobile-e2e 全部流程                # 指定测试范围
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦测试覆盖率/CI 配置项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 列出测试相关 issues
3. **Context7 MCP** (`step 2`) — 获取 Detox/Patrol 最新文档

### Phase 2: 框架检测 + 工具选择

- **detectFramework** (`step 3`) — 识别平台（RN/Expo/Flutter/原生）→ 选择测试工具：
  - React Native / Expo → **Detox**（Gray box，最精确）
  - Flutter → **Patrol**（原生交互+热重载）
  - 微信小程序 → **miniprogram-automator**
  - iOS/Android 原生 → **Detox**（通用跨平台）
  - 不确定 → **Detox**（通用兜底）

### Phase 3: 配置生成

- **generateConfig** (`step 4`) — 生成测试框架配置文件
- **generateExamples** (`step 5`) — 生成示例测试用例（登录/主页/核心流程）
- **generateCI** (`step 6`) — 生成 GitHub Actions CI 配置（自动运行 E2E）

### Phase 4: 沉淀

- **ce-compound** (`step 7`) — E2E 测试配置知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 测试框架 | Detox / Patrol / miniprogram-automator | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。框架检测、配置生成和示例生成步骤正常执行。
