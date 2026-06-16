---
description: One-click environment setup: detect missing dependencies → install → configure .env → verify build → start dev server. 16-step onboarding workflow.
---

# /onboard — 开发者入职/环境搭建

16 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 环境检测 → 依赖安装 → 配置 → 验证**

## Usage

```text
/onboard
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦项目配置/环境变量/依赖管理项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取项目 README/INSTALL 文档
3. **Context7 MCP** (`step 2`) — 获取语言生态环境搭建最佳实践

### Phase 2: 环境检测

- **detectEcosystem** (`step 3`) — 检测项目语言生态和所需工具链
- **checkTools** (`step 4`) — 检查系统是否安装了必需的运行时和工具

### Phase 3: 环境搭建

- **installDeps** (`step 5`) — 安装项目依赖（自动选择包管理器）
- **checkEnv** (`step 6`) — 检查 .env 配置，提示缺失的环境变量
- **fillEnv** (`step 7`) — 交互式填写缺失的环境变量
- **generateEnv** (`step 8`) — 生成 .env 文件

### Phase 4: 验证

- **devBuild** (`step 9`) — 开发构建验证
- **runSuite** (`step 10`) — 运行测试验证环境
- **startDevServer** (`step 11`) — 启动开发服务器（后台）
- **verifyDevServer** (`step 12`) — 验证开发服务器正常启动

### Phase 5: 沉淀

- **ce-compound** (`step 13`) — 环境配置知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 验证 | 构建 + 测试套件 + 开发服务器 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。环境检测、依赖安装和验证步骤正常执行。
