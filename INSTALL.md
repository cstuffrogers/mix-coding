# 📋 Mix-Coding System — 完整安装配置指南

> **把所有工具都装上！**
> 为每一个核心组件都提供了详细的安装配置教程

---

## 🎯 开始之前：环境准备

### 1. Node.js (v20.x LTS) - 必装 ⭐⭐⭐⭐⭐
**作用：** JavaScript运行时，整个系统的基础环境

**下载：** [https://nodejs.org/](https://nodejs.org/) 
**安装：**
- Windows：双击安装，勾选 **"Add to PATH"**
- Mac/Linux：使用包管理器或下载对应版本

**验证：**
```bash
node --version  # 应显示 v20.x.x
npm --version   # 应显示 10.x.x
```

### 2. Git - 必装 ⭐⭐⭐⭐⭐
**作用：** 版本控制，代码管理和协作

**下载：** [https://git-scm.com/](https://git-scm.com/) 
**安装：**
- Windows：双击安装，勾选 **"Use Git from the Windows Command Prompt"**
- 设置用户：
```bash
git config --global user.name "你的名字"
git config --global user.email "your@email.com"
```
**验证：**
```bash
git --version
```

---

## 🏗️ 第一层：核心AI工具

### 3. Claude Code - 必装 ⭐⭐⭐⭐⭐
**作用：** 智能编程助手，核心AI引擎

**安装 CLI：**
```bash
npm install -g @anthropic-ai/claude-code
```
**验证：**
```bash
claude --version
```
\[!IMPORTANT\]
\**Windows用户注意：** 如果命令找不到，尝试：
\- 重启终端
\- 或者手动添加npm全局模块路径到系统PATH
\- 默认路径：`C:\Users\你的用户名\AppData\Roaming\npm`

**配置API Key（第一次使用时）：**
```bash
claude auth login
```
然后按照提示输入Anthropic API Key或使用 Claude Code 提供的认证方式。

### 主要功能：
- ✅ AI驱动的代码生成和修复
- ✅ 智能代码审查
- ✅ 自动化单元测试
- ✅ 自然语言问题解决方案

---

### 4. CodeGraph - 推荐安装 ⭐⭐⭐⭐
**作用：** 代码结构记忆和分析，让AI更了解您的代码库

**安装：**
```bash
# 安装CodeGraph全局CLI工具
npm install -g @codegraph/cli
```

**初始化和运行：**
```bash
# 初始化代码索引（推荐在项目根目录执行）
codegraph init -i

# 扫描并创建代码索引
codegraph index

# 查看帮助
codegraph --help

# 查看CodeGraph状态
codegraph status
```

**高级用法：**
```bash
# 在特定文件类型中搜索
codegraph search "function.*auth" --file="*.ts"

# 查看配置文件位置
notepad %APPDATA%\CodeGraph\config.json
```

---

## 🧩 第二层：扩展能力工具

### 5. Claude Skills（技能插件生态） - 必装 ⭐⭐⭐⭐⭐
**作用：** 增强Claude能力的插件系统，超过12个主流技能可选

**全局安装管理工具：**
```bash
npm install -g @anthropic-ai/claude-code-skills
```

**安装推荐技能：**
```bash
# 基础生产力技能组
npx skills install anthropics/skills
npx skills install obra/superpowers
npx skills install frontend-design

# 安全相关技能（重要！）
npx skills install security-guidance

# SEO和分析技能
npx skills install claude-seo
npx skills install plannotator

# 高级AI能力
npx skills install deep-trilogy
```

**验证安装的技能：**
```bash
npx skills list
```

\[!NOTE\]
每个技能都可以单独安装，根据需要选择适合你项目的技能。建议从`frontend-design`和`security-guidance`开始。

### 6. MCP服务器（AI上下文增强） - 必装 ⭐⭐⭐⭐
**作用：** 为Claude提供额外的上下文和工具支持（GitHub集成、数据库访问等）

**安装MCP管理工具：**
```bash
npm install -g @anthropic-ai/mcp-client
```

**安装核心MCP服务器：**
```bash
# GitHub集成（推荐）
claude mcp install github

# AI增强上下文
claude mcp install context7

# 后端服务支持
claude mcp install supabase      # 数据库
claude mcp install stripe       # 支付
claude mcp install sentry       # 错误监控

# 前端支持
claude mcp install playwright    # 自动化测试

# 前端UI框架支持（需要npm包）
claude mcp install file-system  # 文件系统
claude mcp install npm           # npm包管理
```

**查看已安装MCP：**
```bash
claude mcp list
```

**更新所有MCP：**
```bash
claude mcp update --all
```

---

### 6.5. GitHub Spec-Kit（规范驱动开发引擎） - 必装 ⭐⭐⭐⭐⭐
**作用：** jvn Spec-Driven 开发管线的底层引擎，提供 `/speckit-specify`、`/speckit-plan`、`/speckit-tasks`、`/speckit-implement` 等 12 个技能

**安装：**
```bash
# 安装 uv（Python 包管理器）
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 安装 spec-kit CLI
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# 在项目目录初始化为 Claude Code
cd E:\auto-coding
specify init --here --integration claude --force
```

**验证：**
```bash
specify version   # 应显示 0.11.x
specify check     # 列出可用集成
```

**安装后效果：**
- `.claude/skills/speckit-*` — 12 个 Claude Code 技能
- `.specify/` — 模板 + 脚本 + 工作流配置
- `/spec` 和 `/build` 命令完全激活（底层调用 speckit 技能）

---

## 🧠 第三层：记忆和知识管理

### 7. claude-mem（记忆组件） - 必装 ⭐⭐⭐⭐
**作用：** 项目记忆管理，让AI记住您的代码风格和项目细节

**安装：**
```bash
# 克隆到Claude技能目录
mkdir -p %USERPROFILE%\.claude\skills
cd %USERPROFILE%\.claude\skills
git clone https://github.com/your-repo/claude-mem.git claude-mem

# 安装依赖
cd claude-mem
npm install

# 构建
npm run build
```

**配置：**（可选）
编辑 `%USERPROFILE%\.claude\config.json`，添加记忆配置。

---

### 8. nexo-brain（大脑组件） - 推荐安装 ⭐⭐⭐
**作用：** 知识管理和问题解决，提供更强大的上下文理解

**安装：**
```bash
# 初始化安装（会在当前目录创建配置文件）
npx nexo-brain@latest init
```

**配置：**
安装完成后，会在当前目录生成配置文件，可根据提示进行进一步配置。

---

### 9. Supermemory（云端语义记忆） - 可选安装 ⭐⭐
**作用：** 云端语义搜索 + 用户画像 + 自动事实提取，增强跨会话记忆召回精度

**安装：**
```bash
cd e:\auto-coding\claude-scene
npm install supermemory
```

**配置：**
设置环境变量（不设置则不影响本地 6 后端）：
```bash
export SUPERMEMORY_API_KEY=sm_your_key_here
```
或写入 `claude-scene/.env.example` 并重命名为 `.env`。

> 注意：Supermemory 是云端 SaaS，数据存储在云端。不配置 Key 时零影响。

---

## 🚀 第四层：自动化工具链

### 9. claude-scene CLI工具 - 必装 ⭐⭐⭐⭐⭐
**作用：** 12个工作流的命令行入口，提供了/ui-polish、/bugfix、/feature等指令

**安装：**
```bash
# 克隆到项目目录
cd E:\auto-coding
git clone https://github.com/your-project/claude-scene.git
```

**.claude目录结构：**
```
.claude/
├── scenes/         # 12个工作流的JSON定义
│   ├── ui-polish.json
│   ├── bugfix.json
│   ├── feature.json
│   ├── review.json
│   ├── refactor.json
│   ├── optimize.json
│   ├── simplify.json
│   ├── hunt.json
│   ├── design.json
│   ├── analyze.json
│   ├── loop.json
│   └── new-project.json
├── rules/          # 代码规则
├── skills/         # Skill插件
└── plugins/        # 插件配置
```

**使用场景指令和对应文件关系：**

| 指令 | 场景文件 | 用途 |
|------|---------|------|
| `/ui-polish` | `ui-polish.json` | 前端美化 |
| `/bugfix` | `bugfix.json` | Bug修复 |
| `/feature` | `feature.json` | 功能开发 |
| `/review` | `review.json` | 代码审查 |
| `/refactor` | `refactor.json` | 代码重构 |
| `/optimize` | `optimize.json` | 性能优化 |
| `/simplify` | `simplify.json` | 代码简化 |
| `/hunt` | `hunt.json` | 安全漏洞审查 |
| `/design` | `design.json` | AI设计生成 |
| `/analyze` | `analyze.json` | 竞品分析 |
| `/loop` | `loop.json` | 自动迭代循环 |
| `/new-project` | `new-project.json` | 新项目从零开始 |

---

## 🛠️ 第五层：前端美化工具

### 11. Animal Island UI + DaisyUI 主题系统 - 推荐安装 ⭐⭐⭐⭐
**作用：** 可以快速美化前端项目的UI设计系统

**安装依赖：**
```bash
# 在您的前端项目中安装（推荐使用npm）
npm install animal-island-ui lucide-react animate.css
```

**Tailwind CSS配置示例：**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#19c8b9',     // 主色调
        background: '#FAF8F5',  // 背景色
        accent: '#FF6F61',      // 强调色
        text: '#5D4E37',       // 文字色
      },
    },
  },
  plugins: [require('daisyui')],
};
```

**可用主题（DaisyUI）：**
- ✅ light / dark / cupcake / valentine / retro / cyberpunk / ...（35+主题）
- ✅ Animal Island自然风格风格（翠绿色调）

---

## 🎯 Mix-Coding系统核心文件结构

### 核心文件和目录
```
mix-coding/
├── .claude/                    # Claude核心配置
│   ├── scenes/                 # 12个工作流的JSON定义
│   ├── skills/                 # Skill插件安装目录
│   ├── config/                 # 配置文件
│   └── plugins/                # 插件配置
│
├── claude-scene/              # 12个工作流的命令行CLI实现
│   ├── src/
│   │   └── commands/
│   │       └── start.js       # 33个action处理器
│   └── package.json
│
├── .codegraph/                # CodeGraph索引文件
│
├── upgrade.bat                # 安全升级工具（Windows）
├── upgrade.sh                 # 安全升级工具（macOS/Linux）
├── start-claude.bat           # 一键启动 Claude Code（Windows）
├── start-claude.sh            # 一键启动 Claude Code（macOS/Linux）
└── README.md                  # 本文档
```

---

## 📋 快速部署

### 启动方式

**Windows：** 双击 `start-claude.bat` 一键启动
**macOS/Linux：** 终端运行 `./start-claude.sh`

或直接使用 CLI：
```bash
cd claude-scene
node src/index.js list  # 查看所有场景
```

> **Windows 用户注意**：需要 Git Bash（Git for Windows 自带）。Python 工具会自动扫描已安装的 Python 版本目录。
> **macOS/Linux 用户**：所有脚本和命令直接可用。

### 手动安装步骤总结

**⏱️ 预计时间：15-30分钟**

1. **第1分钟**：安装Node.js和Git
2. **第2-5分钟**：安装Claude Code CLI
3. **第6分钟**：安装CodeGraph CLI
4. **第7-10分钟**：安装Skills（选择性安装）
5. **第11-15分钟**：安装MCP服务器（按需）
6. **第16-20分钟**：配置claude-mem和nexo-brain
7. **第21-25分钟**：测试所有工具是否正常工作

---

## ⚠️ 常见故障排除

### Q1: 命令找不到（node、claude等）
**解决方案：**
1. 确保Node.js安装时勾选了"Add to PATH"
2. 重启终端/命令提示符
3. 手动添加npm全局模块路径到系统PATH
   - 路径：`%APPDATA%\npm`（Windows）或 `~/.npm-global/bin`（Mac/Linux）
4. 管理员权限运行终端

### Q2: 安装Skills失败
**解决方案：**
1. **网络问题**：使用全局镜像或代理
   ```bash
   npm config set registry https://registry.npmjs.org/
   ```
2. **权限问题**：使用 `--force` 或管理员权限
   ```bash
   npx skills install frontend-design --force
   ```
3. **Claude运行时缺失**：确保已经安装 @anthropic-ai/claude-code
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

### Q3: MCP服务器无法连接
**解决方案：**
1. **升级Claude**：
   ```bash
   npm update -g @anthropic-ai/claude-code
   ```
2. **单独安装**：
   ```bash
   npm install -g @modelcontextprotocol/client
   ```
3. **防火墙/网络**：确保终端可以连接到互联网

### Q4: claude-mem无法克隆
**解决方案：**
1. **网络问题**：尝试代理或：
   ```bash
   git clone https://ghproxy.com/https://github.com/your-repo/claude-mem.git
   ```
2. **手动下载**：从GitHub页面下载zip压缩包，手动解压到正确位置

---

## 🔧 配置管理

### 配置文件位置
| 组件 | 配置文件位置 |
|------|-------------|
| npm全局CLI | `%APPDATA%\npm\` 或 `~/.npm-global` |
| CodeGraph | `%APPDATA%\CodeGraph\config.json` |
| Claude Skills | `%USERPROFILE%\.claude\skills\` |
| Git | `~/.gitconfig` |
| claude-mem | `%USERPROFILE%\.claude\skills\claude-mem\config\` |

---

## 📊 工具版本推荐

| 工具 | 推荐版本 | 最新版本查看命令 |
|------|----------|-------------------|
| Node.js | v20.x LTS | `node --version` |
| npm | 10.x.x | `npm --version` |
| Claude Code | 12.0.0+ | `claude --version` |
| CodeGraph | 2.8.0+ | `codegraph --version` |
| Git | 2.40.0+ | `git --version` |

---

## 🎉 验证安装完成

### 测试所有工具是否正常工作
```bash
# 测试Node.js环境
node --version && echo "✅ Node.js正常"

# 测试Git
Git --version && echo "✅ Git正常"

# 测试Claude Code
claude --version && echo "✅ Claude Code正常"

# 测试CodeGraph
codegraph --version 2>/dev/null && echo "✅ CodeGraph正常" || echo "⚠️ CodeGraph未安装"

# 测试Skills管理
npx skills list 2>/dev/null && echo "✅ Skills管理器正常" || echo "⚠️ Skills管理器安装建议"

# 测试MCP服务器
claude mcp list 2>/dev/null && echo "✅ MCP服务器正常" || echo "⚠️ MCP服务器未安装"

echo "安装完成！可以开始使用Mix-Coding系统了！"
```

---

## 📚 进一步学习

### Claude Code官方文档
- [Claude Code文档](https://docs.anthropic.com/en/docs/claude-code-sdk/claude-code-headless)
- [Claude Skills文档](https://github.com/anthropics/skills)
- [MCP官方仓库](https://github.com/modelcontextprotocol)

### Mix-Coding系统进阶
- [ARCHITECTURE.md](ARCHITECTURE.md) - 系统架构深度解析

### 社区支持
- [Claude社区Discord](https://discord.gg/anthropic)
- [GitHub Issues](https://github.com/your-project/issues) - 报告问题

---

## 💡 小贴士

### 1. 如何优化安装速度？
使用cnpm（淘宝镜像）：
```bash
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install -g @codegraph/cli @anthropic-ai/claude-code
```

### 2. 如何管理多版本Node.js？
使用nvm（Node Version Manager）：
```bash
# Mac/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
nvm install 20
nvm use 20

# Windows
https://github.com/coreybutler/nvm-windows/releases
```

### 3. 如何备份配置？
备份 `%USERPROFILE%\.claude\` 和 `%APPDATA%\npm\` 目录，可以在重装系统后快速恢复。

### 4. 定期更新
建议每月运行一次更新脚本：
```bash
npm update -g @anthropic-ai/claude-code @codegraph/cli
claude mcp update --all
```

---

## 🚨 安全提醒

### API Key安全
- **不要**将API Key提交到版本控制
- 请使用环境变量或Claude认证系统
- 对于Claude，使用：
  ```bash
  claude auth set-api-key
  ```

### 工具权限
- 只为项目文件授予必要的访问权限
- 避免使用root/管理员权限运行开发工具
- 定期检查 `.claude/` 目录下是否有可疑文件

---

## ❤️ 致谢

感谢所有开源贡献者：
- [Anthropic](https://anthropic.com/) - Claude AI模型
- [CodeGraph团队](https://github.com/codegraphai) - 代码结构分析
- [Compound Engineering](https://github.com/anthropics) - AI能力增强
- 所有Claude Skills和MCP贡献者

---

**✨ 安装完成！您现在可以开始使用Mix-Coding系统的12个智能工作流了：**
- `/ui-polish` - 前端美化
- `/bugfix` - Bug修复
- `/feature` - 新功能开发
- `/review` - 代码审查
- `/hunt` - 安全漏洞扫描
- ...还有8个更多功能