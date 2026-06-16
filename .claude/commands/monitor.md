---
description: Configure GitHub Actions native website monitoring with Upptime: auto-generate config files, workflow, and deploy status page. 9-step workflow.
---

# /monitor — 网站监控

9 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 监控配置 → 状态页面部署**

## Usage

```text
/monitor
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦监控/告警/健康检查项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取项目 URL 和端口配置

### Phase 2: 监控配置

- **generateUpptimeConfig** (`step 2`) — 生成 Upptime 配置文件
- **generateWorkflow** (`step 3`) — 生成 GitHub Actions 监控工作流
- **deployStatusPage** (`step 4`) — 部署状态页面（GitHub Pages）

### Phase 3: 沉淀

- **ce-compound** (`step 5`) — 监控配置知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| 监控 | Upptime + GitHub Actions | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。监控配置生成步骤正常执行。
