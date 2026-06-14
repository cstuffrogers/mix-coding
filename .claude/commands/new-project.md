---
description: Create a new project — understand requirements, scaffold structure, initialize config, setup dev environment. Conversation-mode for frontend design via open-design Skill.
argument-hint: "[项目描述]"
---

# /new-project — 新项目创建

用法：

```text
/new-project React+TS 后台管理系统，需要用户管理、角色权限、数据看板
/new-project "Vue3 + Express full-stack blog with auth"
```

## 执行流程

### Phase 1: 需求澄清

确认以下信息（缺失则询问）：
- 技术栈（React/Vue/Next.js/Nuxt/Express/Fastify 等）
- 项目类型（Web 前端 / 全栈 / API 后端 / 移动端）
- 是否需要前端设计（有 UI 界面则 = yes）
- 数据库偏好（PostgreSQL / MySQL / SQLite / MongoDB）

### Phase 2: 前端设计基准（条件触发）

**如果涉及前端界面**，先调用 open-design Skill 声明设计系统基准：

```
Skill({ skill: "web-design-engineer", args: "Declare a complete design system for: <项目描述>. Output: Palette (oklch), Typography (heading + body fonts from anti-cliché blocklist), Spacing scale (4px base), Motion tokens, Radius scale, Shadows. Use the anti-cliché blocklist — no Inter/Roboto/system-ui, no purple-blue gradients, no blue primary buttons." })
```

将产出写入目标项目的 `.claude/designs/design-system.md`，后续 CLI 步骤的 `reconcileDesignTokens` 会将其作为已有 Token 保护。

如果用户提到了具体品牌（Stripe/Linear/Vercel/Notion/Apple），加载 awesome-design-md Skill 导入品牌 token：

```
Skill({ skill: "awesome-design-md", args: "Load <品牌> DESIGN.md brand tokens" })
```

### Phase 3: CLI 项目脚手架

基线声明完成后，运行 CLI 执行项目创建：

```bash
node src/index.js start new-project --auto --prompt "<完整项目描述>"
```

CLI 步骤包括：
- 项目目录结构创建
- 依赖初始化（package.json / tsconfig / vite.config 等）
- 数据库 Schema 初始化（如有）
- 环境变量模板生成
- 开发服务器验证

### Phase 4: 后置审查

项目创建完成后，运行审查：

```bash
node src/index.js start review --auto
```

## 示例

```
/new-project React+TS 电商后台，商品管理+订单系统+数据看板，需要漂亮的 UI
```

执行路径：
1. 需求确认（技术栈、数据库、前端设计 = yes）
2. open-design Skill 声明设计系统 → `.claude/designs/design-system.md`
3. CLI 脚手架 `node src/index.js start new-project --auto --prompt "..."`
4. reconcileDesignTokens 识别 Skill 输出为已有 Token，不覆盖
5. 审查 `node src/index.js start review --auto`
