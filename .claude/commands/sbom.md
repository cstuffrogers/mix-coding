---
description: Generate Software Bill of Materials (SBOM) and license compliance report. Detect restrictive licenses (GPL/AGPL/SSPL). 9-step workflow.
---

# /sbom — SBOM 许可证合规

9 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → SBOM 生成 → 许可证扫描 → 合规报告**

## Usage

```text
/sbom
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦依赖安全/许可证合规/供应链安全项

### Phase 1: 上下文收集（对话模式）

2. **GitHub MCP** (`step 1`) — 获取依赖和许可证相关 issues

### Phase 2: SBOM 生成

- **generateSBOM** (`step 2`) — 生成软件物料清单（SPDX/CycloneDX 格式）
- **scanLicenses** (`step 3`) — 许可证合规扫描
- **detectRestrictive** (`step 4`) — 检测限制性许可证（GPL/AGPL/SSPL）
- **generateReport** (`step 5`) — 生成许可证合规报告

### Phase 3: 沉淀

- **ce-compound** (`step 6`) — 供应链安全知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP | MCP |
| SBOM | SPDX / CycloneDX | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 GitHub MCP 步骤自动跳过。SBOM 生成和许可证扫描步骤正常执行。
