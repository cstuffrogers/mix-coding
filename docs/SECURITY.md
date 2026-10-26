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

### 1.1 这把 key 是配给谁的 · 完整副本清单

它是**第三方 DeepSeek 兼容代理**（`base_url = https://api.supxh.xin/v1`，模型名 `deepseek-v4-pro`）的 key，被三个工具分别配置过：

| 位置 | 使用方 | 说明 |
|------|--------|------|
| `~/.cc-switch/cc-switch.db` | **cc-switch**（Claude Code / Codex 的 provider 中转） | `providers` 表 `codex / supxh` 一行；另有 11 份 `backups/*.db` 备份同样含明文。**唯一仍在用的副本** |
| `~/.claude/history.jsonl` | Claude Code 命令历史 | 调试 curl 时打印过 `Authorization: Bearer sk-…` |
| `~/.pi/agent/sessions/**` `traces/**` | pi / percho 会话转录 | 文件内容进过上下文，被原样写入转录 |
| `~/Documents/xwechat_files/**/API.txt` | 微信收发文件 | **已外流**，属于最高优先级泄露 |
| ~~`~/.codewhale/config.toml`~~ | codewhale CLI | **已随工具清理移出**（见 §1.3） |
| ~~`~/.deepseek/config.json`~~ | deepseek CLI | **已移出**（该包无 bin，属死安装） |
| ~~`~/.ai_completion/.code_contribution/_code_commit.db`~~ | AI 补全插件 | **已移出** |

处置原则：家目录下这些是**用户数据**，agent 不擅自删除或改写（最多先备份再脱敏）。真正有效的动作只有一个 —— 在服务商后台轮换。

### 1.3 工具清理（2026-10-27）

按「只保留工作流需要的工具」的要求，工作流未引用的 AI 编程工具已整体移到 `E:/ai-tools-backup-20261027/`（移动 + `MANIFEST.md` 记录还原命令，**没有删除**）。

- 家目录数据 20 个：`.codewhale` `.deepseek` `.claude-code-router` `.chelper` `.kimi` `.cline` `.roo` `.antigravity` `.openclaw` `.archon` `.claude-flow` `.zagent` `.costrict` `.stc` `.factory` `.qoder` `.ai_completion` `.gemini` `.cc-connect`
- npm 全局包 6 个：`codewhale` `deepseek-tui` `mythos-agent` `cc-connect` `@bearer/cli` `skills`
- 保留的宿主：Claude Code / Codex / opencode / ZCode / pi / Percho（`platform.js` 的 `PLATFORM_MARKERS` 就是这五个），以及 `~/.cc-switch`（上面两家的密钥中转）。

直接后果：这把 key 在仓库外从 7 处降到 **5 处**，其中 `~/.cc-switch` 是唯一还在被工具读取的。

### 1.2 为什么之前扫不出来（已修）

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
