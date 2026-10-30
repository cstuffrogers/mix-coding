# 自动记忆规则（精简版）

## 核心原则
**自动记忆**：发现重要信息时**自动保存**，无需用户调用。**不重复保存**：跨后端去重。

## 五个记忆后端：作用域不同

| 后端 | 范围 | 数据类型 |
|------|------|----------|
| **project-memory**（`<项目>/.claude/memory/`） | 项目级 | 技术发现/代码模式/安全 |
| **codegraph**（`<项目>/.codegraph/`） | 项目级，只读 | 符号/依赖图 |
| **claude-mem**（`~/.claude/memory/`） | 全局库 | 用户画像/偏好/项目事实 |
| **agentmemory**（`~/.agentmemory/memory.db`） | 全局库 | 通用记忆 |
| **NEXO**（`~/.nexo/runtime/`） | 全局库 | 事件流 |

全局库里的每条记录都带**项目绝对路径**（归一化：分隔符统一、Windows 转小写、
realpath 展开短名与符号链接）。召回默认只取本项目 + 标记出的历史无归属记录；
别的项目需要 `cross_project: true` 才会召回。细节见 `docs/memory-scope.md`。

**回写纪律**：`remember` 只写当轮结果，**不再**把召回行回写（场景里 `remember`
只传 `{type}`，回写等于把上一轮的记忆存成本轮成果，一层套一层）。召回结果会
打到 stdout 供上游读，跨后端去重后一条记忆只算一条。

## 触发条件（自动）

| 场景 | 后端 |
|------|------|
| 错误关键词（"报错"/"bug"/"失败"） | auto-memory |
| 追忆引用（"上次"/"之前"） | auto-memory |
| `/bugfix` `/refactor` 等工作流 | auto-memory |
| 安全漏洞发现 | CLI + auto-memory |
| Bug 根因定位（>5 行改动） | CLI + auto-memory |
| 架构决策 | CLI + auto-memory |
| 关键性能数据 | CLI + auto-memory |

## 不触发的情况
- 单字符回复（"是"/"否"/"1"）
- 纯文件路径

## 详细规则按需读取
命令模板与数据去重逻辑看实现，不在规则文件里：
- 各后端 CLI 调用：`claude-scene/src/handlers/memory/`（`agentmemory.js` / `claude-mem.js` / `nexo.js` / `codegraph.js`）
- 写入去重（内容指纹）：`claude-scene/src/handlers/memory/agentmemory.js`

> 第三十三轮删掉了这里原来的 `.claude/rules/memory-auto-save.md.bak` 指针 ——
> 那份备份早就没了，也没有任何东西能重新生成它。「按需读取」指向一个不存在的文件，
> 等于让人以为自己读到了完整规则。
