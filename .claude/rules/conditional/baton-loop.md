# Baton 接力模式 — 多页网站自动生成

> 从 Google Stitch stitch-loop 技能提炼。去掉 Stitch MCP/Chrome MCP 依赖，抽象为通用模式。

## 核心思想

用一个 `next-prompt.md` 文件作为"接力棒"，每轮迭代：
1. 读取当前任务
2. 生成一个页面
3. 集成到站点
4. 写下一个任务到接力棒
5. 重复直到完成

## 文件结构

```
project/
├── .site/
│   ├── DESIGN.md       # 设计系统（视觉一致性）
│   ├── SITE.md         # 站点愿景 + 站点地图 + 路线图
│   └── next-prompt.md  # 接力棒 — 当前页面的生成任务
├── src/
│   └── pages/          # 已生成的页面
│       ├── index.tsx
│       └── about.tsx
```

## 接力棒格式

```markdown
---
page: about
---
A page describing how the product works.

DESIGN SYSTEM:
[从 .site/DESIGN.md 复制设计系统块]

Page Structure:
1. Header with navigation
2. Content area
3. Footer
```

**关键规则：**
- `page` 字段决定输出文件名
- 必须包含设计系统块保持一致性
- **完成后必须更新接力棒**，否则循环断掉

## 执行协议

### Step 1: 读接力棒
解析 `.site/next-prompt.md`：
- **页面名称** — 来自 `page` frontmatter
- **生成内容** — 来自 markdown 正文

### Step 2: 读上下文文件
| 文件 | 用途 |
|------|------|
| `.site/SITE.md` | 站点愿景、已有页面（站点地图）、路线图 |
| `.site/DESIGN.md` | 视觉设计系统 |

**重要检查：**
- 站点地图 — 不要重复创建已存在的页面
- 路线图 — 如果有待办项，从路线图取
- 创意池 — 如果路线图空了，从这里取新页面想法

### Step 3: 生成页面
根据项目技术栈生成页面代码。保持与现有页面一致的 header/footer/导航。

### Step 4: 集成到站点
1. 将生成的页面写入 `src/pages/{page}.tsx`
2. 修复所有内部链接（如 `href="#"` → `href="/about"`）
3. 更新全局导航
4. 确保跨页面 header/footer 一致

### Step 5: 更新站点文档
修改 `.site/SITE.md`：
- 在站点地图中标记新页面 `[x]`
- 从路线图中移除已完成项
- 从创意池中移除已使用的想法

### Step 6: 写下一个接力棒（关键）
**必须在完成前更新 `.site/next-prompt.md`：**

1. **决定下一页：**
   - 检查 `.site/SITE.md` 路线图有待办项
   - 如果空了，从创意池取
   - 或者根据站点愿景发明新页面
2. **写接力棒：**

```markdown
---
page: pricing
---
A pricing page with three tiers and a FAQ section.

DESIGN SYSTEM:
[复制完整设计系统块]

Page Structure:
1. Header
2. Pricing tiers comparison
3. FAQ accordion
4. CTA section
5. Footer
```

## SITE.md 模板

```markdown
# Site: [Name]

## 1. Vision
[一句话站点愿景]

## 2. Design System
See: .site/DESIGN.md

## 3. Tech Stack
- Framework: [Next.js / Remix / etc.]
- Styling: [Tailwind / CSS Modules / etc.]

## 4. Sitemap
- [x] Home (index)
- [x] About
- [ ] Pricing
- [ ] Blog
- [ ] Contact

## 5. Roadmap
- [ ] Pricing page — 3 tiers + FAQ
- [ ] Blog — list + detail + RSS

## 6. Creative Pool
[未分配的新页面想法]
- Portfolio grid with filter
- Testimonials carousel
```

## 编排方式

| 模式 | 说明 |
|------|------|
| **手动** | 用户每轮手动触发 agent |
| **人机协同** | 每轮生成后用户审查，确认后继续 |
| **自主循环** | 结合 `/loop` 自动跑完整站点 |
| **CI/CD** | GitHub Actions 监听 `next-prompt.md` 变化触发 |

## 常见错误

- ❌ 忘记更新接力棒（循环断掉）
- ❌ 重复创建站点地图已有的页面
- ❌ 不复制设计系统块导致视觉不一致
- ❌ 留下占位链接 (`href="#"`) 不修复
- ❌ 导航跨页不一致

## 使用方式

在 `/feature` 或 `/new-project` 中开启多页站点开发时，配合 `/loop`：

```
/loop 3m "读取 .site/next-prompt.md，生成对应页面，更新接力棒"
```

或手动逐页推进：
```
"生成 .site/next-prompt.md 中指定的页面，然后写下一个接力棒"
```
