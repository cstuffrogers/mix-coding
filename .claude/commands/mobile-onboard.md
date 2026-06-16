---
description: Mobile dev environment setup: auto-detect missing deps → install (Node/JDK/Xcode/Android Studio/CocoaPods) → configure → first build verification. 16-step workflow.
---

# /mobile-onboard — 移动端开发环境搭建

16 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 依赖检测 → 安装 → 配置 → 构建验证**

## Usage

```text
/mobile-onboard
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦环境配置/依赖管理项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取项目 README/环境要求文档
3. **Context7 MCP** (`step 2`) — 获取 RN/Flutter 环境搭建最新文档

### Phase 2: 依赖检测

- **checkNode** (`step 3`) — Node.js 版本检查（RN/Expo 要求）
- **checkJDK** (`step 4`) — Java 17+（Android 构建）
- **checkXcode** (`step 5`) — Xcode 检查（iOS 开发，macOS）
- **checkAndroidStudio** (`step 6`) — Android SDK/NDK/模拟器
- **checkCocoaPods** (`step 7`) — Ruby + CocoaPods（iOS 依赖管理）
### Phase 3: 环境搭建

- **installMissing** (`step 8`) — 安装所有缺失依赖
- **generateEnv** (`step 9`) — 生成 .env 配置模板
- **installProjectDeps** (`step 10`) — 安装项目依赖（iOS: CocoaPods / Android: Gradle sync）

### Phase 4: 验证

- **iosBuild** (`step 11`) — iOS 首次构建验证
- **androidBuild** (`step 12`) — Android 首次构建验证

### Phase 5: 沉淀

- **ce-compound** (`step 13`) — 环境搭建知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 构建 | Xcode / Gradle / CocoaPods | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。依赖检测、安装和构建验证步骤正常执行。
