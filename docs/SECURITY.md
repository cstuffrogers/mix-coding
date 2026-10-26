# 安全说明（已知问题与处置）

> 本文件记录**已知的、历史性的**安全问题及其处置状态。不是事后总结，是给下一个接手的人看的风险清单。

## 1. 已泄露的 API key（`codewhale-config.toml`）

| 项 | 内容 |
|----|------|
| 文件 | `codewhale-config.toml` |
| 首次提交 | `013c00c`（initial release） |
| 泄露内容 | `api_key = "sk-SW1…"`（DeepSeek 兼容代理的明文密钥） |
| 当前状态 | 仓库内已替换为占位符 `${CODEWHALE_API_KEY}` |

### 1.0 处置决定（2026-10-27，用户明确授权）

| 动作 | 决定 | 理由 |
|------|------|------|
| 轮换密钥 | **不轮换** | 使用它的工具（codewhale / deepseek / cc-switch / Claude Code）全部已卸载，已无使用者；轮换要所有者登录 `api.supxh.xin` 后台 |
| 抹除本机明文副本 | **做，全部** | 用户：「副本也可以不要」。结果见 §1.1 |
| 删除清理备份 `E:/ai-tools-backup-20261027/` | **做，8.0 GB 已删** | 备份里 20+ 个文件含同一把明文 key，留着等于留副本 |
| 重写 git 历史（`filter-repo`） | **不做** | 破坏性：重写全部提交 ID、打断所有克隆与 PR；且仓库不公开、无协作者 |
| 后续新密钥怎么放 | 只写 `%USERPROFILE%\.codewhale\config.toml`（不入库）或环境变量 `CODEWHALE_API_KEY` | 仓库里永远是 `${CODEWHALE_API_KEY}` 占位符 |

**残留风险（知情接受）**：这把 key **从未被吊销**，所以历史 `013c00c` 里的明文**在技术上仍然可用**——它不是失效文本，而是活凭据。接受这一点的前提是「仓库不公开、只有所有者能读」。**一旦仓库要公开或加协作者，必须先轮换或先重写历史。**

### 1.1 这把 key 是配给谁的 · 副本清单与处置结果

它是**第三方 DeepSeek 兼容代理**（`base_url = https://api.supxh.xin/v1`，模型名 `deepseek-v4-pro`）的 key，被多个工具分别配置过。全盘扫描（**598 272 个文件**，跳过 >32 MB 与缓存目录，14m44s）命中 **12 个实际副本**，逐一处置：

| 位置 | 使用方 | 处置结果 |
|------|--------|----------|
| `~/.pi/agent/sessions/**`（1 个会话转录）+ `traces/**`（5 个） | pi / percho 会话转录 | **原地脱敏**：等长覆盖为 `sk-REDACTED---…`，**文件长度不变** |
| `~/Documents/xwechat_files/**/API.txt` | 微信收发文件 | **脱敏 2 处**。这个文件本身已经外流，抹本机副本只能止损 |
| `~/AppData/Roaming/Code/User/settings.json` + 2 份 `History/*.json` | VS Code 配置与本地历史 | **脱敏** |
| `~/AppData/Local/aardio/std/example/ai/agent4.table` | aardio 示例工程 | **脱敏 2 处** |
| `~/Desktop/新建文本文档 (7).txt` | 桌面便签 | **脱敏 1 处**（同文件另有 3 把别的服务商 key，不在本次范围） |
| `~/.cc-switch/cc-switch.db` + 11 份 `backups/*.db` | cc-switch provider 中转 | **已删**（随 CC Switch 卸载 + 备份目录删除） |
| `~/.claude/history.jsonl` | Claude Code 命令历史 | **已删**（`~/.claude` 只剩 `memory/`） |
| `~/AppData/Local/aardio/...` 之外的 `~/.codewhale` `~/.deepseek` `~/.ai_completion` | codewhale / deepseek / AI 补全 | **随备份目录已删**（见 §1.2） |
| `E:/ai-tools-backup-20261027/**` | 清理备份 | **整目录已删**（8.0 GB，20+ 个文件含该 key） |
| 仓库内 `codewhale-config.toml` | — | 已改 `${CODEWHALE_API_KEY}`（`cf3fadf`） |
| git 历史 `013c00c` | — | **保留**（见 §1.0 的决定与风险） |

**为什么用等长覆盖而不是重写整文件**：`sessions/**` 与 `traces/**` 正被 pi 以追加方式写入。读全文件 → 改 → 整文件写回，会把扫描期间新追加的轮次截掉。只在原偏移写入同样长度的字节，既抹掉密钥也不影响并发追加（脱敏期间会话文件还增长了 23 KB，事后校验 8 072 行 JSON **0 坏行**）。

**复核**：12 个文件逐一 `grep` 残留 = 0；探针脚本本身按前缀搜索会自命中，已从扫描范围排除。

### 1.2 工具清理（2026-10-27，备份已于 10-27 删除）

按「只保留工作流需要的工具」的要求，工作流未引用的 AI 编程工具整体移到 `E:/ai-tools-backup-20261027/`（移动 + `MANIFEST.md` 记录还原命令，当时**没有删除**）。

> **2026-10-27 更新**：该备份目录已按用户要求**整体删除（8.0 GB）**。删除前确认：仓库与脚本中没有任何引用（只有文档提到路径）；里面 20+ 个文件含同一把明文 key，留着就是留副本。**还原能力随之消失**——这些工具要回来只能重装。

**第一批（工作流零引用的工具）**

- 家目录数据 20 个：`.codewhale` `.deepseek` `.claude-code-router` `.chelper` `.kimi` `.cline` `.roo` `.antigravity` `.openclaw` `.archon` `.claude-flow` `.zagent` `.costrict` `.stc` `.factory` `.qoder` `.ai_completion` `.gemini` `.cc-connect`
- npm 全局包 6 个：`codewhale` `deepseek-tui` `mythos-agent` `cc-connect` `@bearer/cli` `skills`

**第二批（四个非当前宿主，用户明确不要）**

- 卸：`@anthropic-ai/claude-code`、`@openai/codex`（npm）→ Codex 另有 MSIX 商店包 `OpenAI.Codex` + `CodexSandboxService.OpenAI.Codex` 服务，已卸包（服务随包移除）
- 卸：OpenCode（NSIS）、CC Switch（MSI）
- 移：`~/.claude/*`（除 `memory/`）→ `hosts/claude-home/`；`~/.codex` `~/.zcode` `~/.cc-switch` `~/.config/opencode` → `hosts/`

**`~/.claude/memory` 原地保留**——它是 claude-mem 记忆后端的数据目录（`src/lib/paths.js:85`），删了等于删用户记忆。

当前只剩 **pi + Percho** 一个宿主（`platform.js` 仍保留 claude / codex / opencode / zcode 的适配代码，重装即可恢复）。`scripts/install-global.sh` 与 `scripts/install-percho.bat` 已改成：检测不到 `claude` CLI 就不再创建 `~/.claude/commands`。

直接后果：这把 key 在仓库外的副本从 7 处降到 2 处（`~/.pi` 转录），其余在备份目录里。**随后这最后 2 处也被脱敏、备份目录被删除**，现在本机明文副本为 **0**（只剩 git 历史，见 §1.0）。

### 1.3 为什么之前扫不出来（已修）

`secret-scan.js` 的 `handleGitLeaks` 有三个叠加缺陷，导致这次泄露从头到尾报「未发现明文密钥」：

1. **没有 `sk-` 级别的规则** —— 只有 `ghp_` / `AKIA` / `api_key` 这类字面前缀，OpenAI/DeepSeek 风格的裸 key 完全不匹配。现在有内容级正则（`sk-` / `ghp_` / `github_pat_` / `AKIA` / `PRIVATE KEY` / JWT）。
2. **`SAFE_FILES` 白名单连历史一起豁免** —— `codewhale-config.toml` 在白名单里（本意是「模板文件」），于是历史里那次真 key 提交被静默跳过。现在白名单**只作用于 HEAD 树**，历史一律按内容判断。
3. **`git log -S` 只看最近 5 个提交** —— `-S` 把「删掉密钥」的提交也当命中，最新提交往往正是删掉的那次，引入点被挤出分页。现在改用 `git log --all -G <regex>`（匹配 diff 内容），再在命中提交的**整棵树**上 `git grep`（不再按文件列表截断，初始提交动辄上千文件）。

顺带修掉一个 Windows 专属静默失败：`escapeArg()` 原本一律用单引号，而 `execSync` 在 Windows 走 `cmd.exe`，单引号不是引号 —— `git log -S 'ghp_'` 实际搜的是**带引号的字面量**，永远搜不到；`git commit -m 'xxx'` 也会把单引号写进提交信息。现在按平台选引号。

接入方式：`review` 场景 step **4.551 `git-leaks`**（`security_deep` / `full_audit` 模式下执行）。输出分两档 —— 「当前仍有 N 个文件是明文」（要立刻处理）与「N 个文件仅在历史里」（改代码无效，只能轮换密钥），后者同样把 `gitLeaksPassed` 置 `false`。

## 2. `.codegraph/` 目录（约 130 MB）

本地符号图缓存，已被 `.gitignore` 忽略，不随仓库分发。它**可以随时重建**（删掉后下一次 CodeGraph 查询会重新生成，只是首次查询变慢）。保留原因为重建依赖外部 codegraph MCP 服务可用，当前环境网络受限。处置决定记录在 `DECISIONS.md`。

## 3. 安全扫描的已知盲区

| 盲区 | 状态 |
|------|------|
| 开放重定向（`res.redirect(req.query.next)`） | **已覆盖**：`threat-scan.js` 三条规则（直取 / 模板串 / Python），有单测 |
| `sk-` / `ghp_` / `AKIA` / 私钥 / JWT 明文密钥 | **已覆盖**：`secret-scan.js` `handleGitLeaks`（step 4.551），HEAD 树 + 历史双向扫，有单测 |
| 「密钥已删但还在历史里」 | **已覆盖**：`git log --all -G` + 命中提交整棵树 `git grep`，单独报一档 |
| 只扫 git 追踪的文件 | `git grep` 限定追踪内容，工作区未提交/被 ignore 的文件不在范围内（那是 `sensitive-file-check` 的事） |
| 提交数量上限 | 最多回看 `HISTORY_SCAN_MAX_COMMITS = 40` 个命中提交；超长历史里的更早泄露会漏（大仓 `git log -G` 单次约 8s，全量不可行） |
| 服务端模板注入、反序列化 | 未覆盖：无确定性规则，依赖 semgrep 规则集（`src/rules/semgrep-logic-io.yml`） |
| 依赖漏洞 | 仅当目标项目有 `package-lock.json` 且 registry 支持 audit API 时才扫；否则输出「依赖审计未执行」，不谎报安全 |
| 语义级漏洞（越权、竞态、逻辑绕过） | 无静态工具可判，只能靠 `review` 场景的人工/模型审查 |

原则：**扫描工具的输出只代表它扫得到的东西**。`0 个源码文件` 一律按失败处理（`assertSources`），不允许输出"未发现问题"。
