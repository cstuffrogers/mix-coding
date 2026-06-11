# Claude Code 工作流配置

## 场景加载

Claude Code 会自动加载 `.claude/scenes/` 目录中的场景配置。

## 工作流执行

### 1. UI 美化工作流 (ui-polish)

**触发词**: "美化", "UI优化", "界面优化", "样式", "polish", "/polish"

**命令**: `/polish [目标路径]`

**执行流程**:

#### 步骤 1：确定目标路径
- 如果用户在命令中提供了路径，使用该路径
- 如果用户没有提供路径，询问用户："请输入目标项目路径（或拖拽文件夹到此处）："

#### 步骤 2：弹出风格选择菜单
在应用任何样式之前，必须先弹出风格选择菜单让用户选择：

```
🎨 请选择前端美化风格：

1️⃣  DaisyUI（35+专业主题）
    ├─ corporate  - 企业商务风格
    ├─ garden    - 清新花园风格
    ├─ light     - 明亮简约风格
    ├─ dark      - 深色科技风格
    └─ cupcake   - 甜美可爱风格

2️⃣  Animal Island UI（自然、圆润风格）
    ├─ 主色调：#19c8b9（清爽青绿色）
    ├─ 背景色：#FAF8F5（柔和米白）
    ├─ 强调色：#FF6F61（珊瑚色）
    └─ 圆角：16px-24px（大圆角设计）

3️⃣  Custom（自定义颜色）
    ├─ 请输入主色调（hex）
    ├─ 请输入背景色（hex）
    └─ 请输入强调色（hex）

请输入数字选择风格（1/2/3）：
```

#### 步骤 3：确认选择
显示用户的选择并确认：
```
✅ 已选择风格：{用户选择的风格}

确认开始美化吗？
- 输入 "y" 继续
- 输入 "n" 取消
- 输入数字更换风格
> 
```

#### 步骤 4：执行美化流程
根据用户选择执行相应操作：

**对于 DaisyUI**：
1. 安装依赖：`npm install daisyui`
2. 配置主题：修改 `tailwind.config.js`
3. 应用基础组件样式

**对于 Animal Island UI**：
1. 安装依赖：`npm install animal-island-ui`
2. 配置主题：修改 `tailwind.config.js` 添加 Animal Island UI 设计令牌
3. 应用样式到 `src/index.css`

**对于 Custom**：
1. 使用用户提供的颜色配置
2. 生成自定义主题配置
3. 应用样式

**通用步骤**：
- 安装并集成 Animate.css：`npm install animate.css`
- 安装 Lucide React：`npm install lucide-react`
- 运行测试验证

#### 步骤 5：完成报告
显示美化结果和后续建议。

---

### 2. 其他工作流

| 工作流 | 触发词 | 说明 |
|--------|--------|------|
| new-project | "新建项目" | 从零开始创建项目 |
| feature | "添加功能" | 新增功能开发 |
| bugfix | "修复bug" | Bug修复 |
| refactor | "重构" | 代码重构 |
| design | "设计" | AI驱动设计 |
| review | "审查" | 代码审查 |
| hunt | "安全" | 安全扫描 |
| analyze | "分析" | 竞品分析 |
| loop | "迭代" | 自动迭代循环 |
| simplify | "简化" | 代码简化 |
| optimize | "优化" | 性能优化 |
| release | "发布" | 发布部署：门禁→构建→Tag→发布 |
| audit | "审计" | 全面项目健康检查 |
| prototype | "原型" | 快速原型验证 |
| deps | "更新依赖" | 安全依赖更新 |
| rollback | "回滚" | 紧急回滚恢复 |
| onboard | "环境搭建" | 开发者入职环境配置 |
| monitor | "监控" | Upptime 网站监控（.upptimerc.yml + GitHub Actions） |
| cicd | "CI/CD" | Act + Task CI/CD 流水线（本地验证 + Taskfile.yml） |
| backup | "备份" | Restic 加密备份（脚本 + 排除规则 + 环境变量） |
| incident | "事故" | Runme 事故响应 Runbook（健康检查/常见问题/升级路径） |
| e2e | "E2E测试" | E2E 测试基础设施（MSW Mock + Supertest + Schemathesis Fuzz） |

## 执行原则

1. **先理解需求**: 确认用户想要什么效果
2. **收集必要信息**: 项目路径、主题选择等
3. **执行工作流**: 按照场景配置执行
4. **验证结果**: 确保达到预期效果
5. **报告完成**: 告知用户工作流已完成

## 注意事项

- 工作流需要在目标项目目录下执行
- 某些操作需要用户确认（如删除文件、覆盖代码）
- 遇到错误时，及时报告并提供解决方案
