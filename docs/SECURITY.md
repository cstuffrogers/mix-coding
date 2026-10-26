# 安全说明（已知问题与处置）

> 本文件记录**已知的、历史性的**安全问题及其处置状态。不是事后总结，是给下一个接手的人看的风险清单。

## 1. 已泄露的 API key（`codewhale-config.toml`）

| 项 | 内容 |
|----|------|
| 文件 | `codewhale-config.toml` |
| 首次提交 | `013c00c`（initial release） |
| 泄露内容 | `api_key = "sk-SW1…"`（DeepSeek 兼容代理的明文密钥） |
| 当前状态 | 仓库内已替换为占位符 `${CODEWHALE_API_KEY}` |

**必须由密钥所有者完成（agent 做不到）**：

1. **轮换密钥** —— 到代理服务商后台吊销并重新签发。这是唯一真正有效的补救。
2. 新密钥只写进 `%USERPROFILE%\.codewhale\config.toml`（本地文件，不入库），或设成环境变量 `CODEWHALE_API_KEY`。

**关于 git 历史**：密钥仍然存在于 `013c00c` 之后的所有历史提交里。真正清除需要 `git filter-repo --invert-paths` + 强制推送到所有远端，这会重写全部提交 ID、打断所有已克隆仓库和 PR —— 属于破坏性操作，**未经明确授权不执行**。在密钥已轮换的前提下，历史里的旧字符串就只是失效文本，保留成本低于重写成本。

## 2. `.codegraph/` 目录（约 130 MB）

本地符号图缓存，已被 `.gitignore` 忽略，不随仓库分发。它**可以随时重建**（删掉后下一次 CodeGraph 查询会重新生成，只是首次查询变慢）。保留原因为重建依赖外部 codegraph MCP 服务可用，当前环境网络受限。处置决定记录在 `DECISIONS.md`。

## 3. 安全扫描的已知盲区

| 盲区 | 状态 |
|------|------|
| 开放重定向（`res.redirect(req.query.next)`） | **已覆盖**：`threat-scan.js` 三条规则（直取 / 模板串 / Python），有单测 |
| 服务端模板注入、反序列化 | 未覆盖：无确定性规则，依赖 semgrep 规则集（`src/rules/semgrep-logic-io.yml`） |
| 依赖漏洞 | 仅当目标项目有 `package-lock.json` 且 registry 支持 audit API 时才扫；否则输出「依赖审计未执行」，不谎报安全 |
| 语义级漏洞（越权、竞态、逻辑绕过） | 无静态工具可判，只能靠 `review` 场景的人工/模型审查 |

原则：**扫描工具的输出只代表它扫得到的东西**。`0 个源码文件` 一律按失败处理（`assertSources`），不允许输出"未发现问题"。
