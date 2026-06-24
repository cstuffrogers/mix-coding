# 自动记忆规则（精简版）

## 核心原则
**自动记忆**：发现重要信息时**自动保存**，无需用户调用。**不重复保存**：跨后端去重。

## 三个记忆后端

| 后端 | 触发方式 | 数据类型 |
|------|----------|----------|
| **MemPalace** | MCP 工具调用 | 对话原文 + 智能检索 |
| **Claude Code auto-memory** | 内置 | 用户画像/偏好/项目事实 |
| **项目 CLI 记忆** | 显式 | 技术发现/代码模式/安全 |

## 触发条件（自动）

| 场景 | 后端 |
|------|------|
| 错误关键词（"报错"/"bug"/"失败"） | MemPalace MCP |
| 追忆引用（"上次"/"之前"） | MemPalace MCP |
| `/bugfix` `/refactor` 等工作流 | MemPalace MCP |
| 安全漏洞发现 | CLI + auto-memory |
| Bug 根因定位（>5 行改动） | CLI + auto-memory |
| 架构决策 | CLI + auto-memory |
| 关键性能数据 | CLI + auto-memory |

## 不触发的情况
- 单字符回复（"是"/"否"/"1"）
- 纯文件路径
- 已有 `/recall` 指令

## 详细规则按需读取
7 后端完整规则、CLI 命令模板、数据去重逻辑见原文件：
`.claude/rules/memory-auto-save.md.bak`（如不存在可重新生成）
