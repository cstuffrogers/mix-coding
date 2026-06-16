---
description: Auto-detect project language, generate multi-stage Dockerfile, .dockerignore, and docker-compose.yml. Validate Docker build syntax. 9-step workflow.
---

# /docker — Docker 容器化

9 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 语言检测 → Dockerfile 生成 → compose 配置**

## Usage

```text
/docker
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦容器安全/多阶段构建/敏感文件保护项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取项目依赖和构建脚本信息

### Phase 2: Docker 配置

- **detectLanguage** (`step 2`) — 自动检测项目语言和框架
- **generateDockerfile** (`step 3`) — 生成多阶段 Dockerfile
- **generateDockerignore** (`step 4`) — 生成 .dockerignore
- **generateCompose** (`step 5`) — 生成 docker-compose.yml
- **validateBuild** (`step 6`) — 验证 Docker 构建语法

### Phase 3: 沉淀

- **ce-compound** (`step 7`) — 容器化配置知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| 容器 | Docker + docker-compose | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。语言检测和配置文件生成步骤正常执行。
