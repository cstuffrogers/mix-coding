# Token 优化 + 假死排查 完整方案

> **本文件记录项目从"严重假死"到"零假死"的完整排查过程。**

## 📊 优化前后对比

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| **rules 加载量** | ~80KB / 2000 行 | **~18KB / 502 行** | **-78%** |
| **od-craft 加载** | 103KB / 2000 行 | 0（按需）| **-100%** |
| **.backup 索引** | 2.18MB / 214 文件 | 已删除 | **-100%** |
| **每次会话 token** | ~25K tokens | **~3K tokens** | **-88%** |
| **Claude Code 假死** | 30s+ 每次发消息 | **0 假死** | ✅ |
| **Python hook 调用** | 5 个被调（失败 49）| 0（全部 .disabled）| ✅ |

### 2026-06-27 追加优化

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| **Scene JSON（3 大文件）** | 76,087 字节 | **70,987 字节** | **-6.7%** |
| **enhancements.md** | 123 行 / 4,217 字符 | **51 行 / 1,549 字符** | **-59%** |
| **每工作流 Read** | 146 行（workflows + enhancements）| **74 行**（workflows + summary）| **-49%** |

**Scene JSON 精简**：step 描述字段截断到 ~80 字符（仅 dry-run/skip 使用，spinner 用 action 字段）。
**enhancements-summary**：检测规则 + 菜单映射压缩为紧凑单行格式，完整版见 `enhancements.md`。

---

## 🔴 假死的 5 大根因（全部已修复）

### 1. **Python hook 不存在 Python**（最严重）

```
hooks 目录扫描：6 个文件
  ├─ mempalace_userprompt_hook.py    → Python 不存在 → exit 49
  ├─ memory_extractor.py             → 同上
  ├─ memory_loader.py                → 同上
  ├─ pre_compact.py                  → 同上
  └─ session_state.py                → 同上
  └─ mempalace_userprompt.cmd        → .bat 正常

每次发消息：Claude Code 调 5 次 Python → 5 次失败 → 假死 30s
```

**修复**：所有 5 个 .py 文件重命名为 `.py.disabled`
```powershell
cd "C:\Users\Administrator\.claude\hooks\"
Rename-Item "memory_extractor.py" "memory_extractor.py.disabled"
Rename-Item "memory_loader.py" "memory_loader.py.disabled"
Rename-Item "pre_compact.py" "pre_compact.py.disabled"
Rename-Item "session_state.py" "session_state.py.disabled"
Rename-Item "mempalace_userprompt_hook.py" "mempalace_userprompt_hook.py.disabled"
```

### 2. **settings.local.json 显式允许 python3**

`permissions.allow` 含 `"Bash(python3 *)"` → Claude Code 继续调 python3

**修复**：移到 `permissions.deny`
```json
{
  "permissions": {
    "allow": [...],
    "deny": [
      "Bash(python3 *)",
      "Bash(pip3 *)",
      "Bash(apt *)",
      "Bash(apt-get *)"
    ]
  }
}
```

### 3. **od-craft 11 个文件全量加载**

CLAUDE.md 引用 od-craft/ 全部 11 个文件，103KB 每次会话加载

**修复**：`claudeMdExcludes` 排除
```json
"claudeMdExcludes": ["**/.claude/rules/od-craft/**"]
```

Claude 需要时手动 Read 单个文件。

### 4. **.backup/ 2.18MB 目录索引**

`.claude/.backup/` 存了 10 skills + 43 commands 副本，每次启动扫描

**修复**：删除 + 加入 `.gitignore`
```bash
rm -rf .claude/.backup/
echo ".claude/.backup/" >> .gitignore
```

### 5. **workflows.md 689 行 + memory-auto-save.md 249 行重复**

CLAUDE.md 引用了两个大文件，导致规则链冗余

**修复**：精简到 ~40 行
- `workflows.md`: 689 → 36 行
- `memory-auto-save.md`: 249 → 30 行

---

## 🧠 MemPalace 替代方案

### 旧架构（已废弃）

```
Trae IDE → hook 脚本 → 假死 ❌
```

### 新架构（当前）

```
Trae/Claude Code ─┬─→ [禁用 hook] .py.disabled ✅
                  └─→ MCP 工具调 mempalace ✅
```

### MemPalace 工具调用

| 工具 | 作用 |
|------|------|
| `mcp__mempalace__search` | 检索历史记忆 |
| `mempalace__remember` | 保存记忆 |
| `mempalace__list` | 列出所有记忆 |
| `mempalace__store` | 知识沉淀 |

### 配置位置

- **CLI 路径**：`C:\Users\Administrator\.local\bin\mempalace.exe`
- **MCP server**：`C:\Users\Administrator\.local\bin\mempalace-mcp.exe`
- **MCP 配置**：`.mcp.json`（用全路径避免 Windows 路径问题）
- **一键脚本**：`npm run setup:mempalace`

---

## 🚀 一键命令

```bash
npm run setup:mempalace     # 配置 mempalace MCP
npm run scan:memory         # 记忆系统状态
npm run scan:deadcode       # 死代码扫描
npm run scan:all            # 综合扫描
node scripts/scan-scenes.cjs  # 真实步骤数
```

---

## 📁 项目级加载策略

| 文件 | 加载策略 |
|------|----------|
| CLAUDE.md | 启动时全量加载（~65 行）|
| conditional/ | **按需** Read（9 个条件规则文件）|
| od-craft/*.md | **按需** Read 单个文件 |
| scripts/*.cjs | **按需** 手动执行 |

---

## 🛡️ 防止再次假死

### 1. 永远不要恢复 Python hooks

如果未来装了 Python 3，**不要**把 `.py.disabled` 改回 `.py`：
- 这些 hook 在 Windows 上**路径转义**会再次假死
- MemPalace 已通过 MCP 工具替代

### 2. 永远不要添加 `Bash(python3 *)` 到 allow

`.claude/settings.local.json` 只能 deny，不能 allow python3。

### 3. 项目级 .gitignore

```gitignore
.claude/.backup/
.claude/settings.local.json
.claude/rules/od-craft/
```

---

## 📋 已删除的"假"省 token 工具

之前误判这些是"省 token"，实际不是：

| 工具 | 实际功能 |
|------|----------|
| HoneyTools | **安全蜜罐**（防 prompt injection），**不省 token** |
| lobstertrap | **DLP 代理**（防数据泄露），**不省 token** |

**真正省 token 的**：MCP 工具调用、记忆压缩、claudeMdExcludes、rules 精简

---

## 🔄 重新启用完整功能的条件

| 功能 | 启用条件 |
|------|----------|
| MemPalace hook | Trae IDE 修复 Windows 路径转义 bug |
| Claude-Mem 3 层记忆 | 安装 Python 3 + 修复 hook 路径 |
| od-craft 自动加载 | 用户主动要求 |

**当前状态**：**所有假死根因已修复**，记忆功能通过 MCP 工具调用正常工作。
