---
name: scene-runner
description: 执行 Mix-Coding System 工作流场景。用户敲 /review、/feature、/bugfix、/refactor、/plan、/optimize、/ui-polish、/release、/deps、/check、/qa、/new-project、/onboard、/cicd、/setup、/rollback、/loop、/spec、/plan-ceo-review、/mobile-* 时用；用户没敲命令、只是用中文或英文说这类活时也用 —— 代码审查/安全审计→review，加功能→feature，修 bug→bugfix，重构/简化→refactor，性能优化→optimize，依赖升级→deps，发布部署→release，视觉设计/美化界面/UI 打磨/落地页设计→ui-polish，搭测试或监控设施→setup。
---

# Scene Runner

通过 Scene 引擎 CLI 执行项目工作流。适用于 pi CLI 与 percho 桌面端。

## 可用场景

| 命令 | 场景 | 说明 |
|---------|-------|-------------|
| /review | review | 5 层代码审查（含 audit/analyze 模式） |
| /feature | feature | 新功能开发 |
| /bugfix | bugfix | Bug 修复 |
| /refactor | refactor | 代码重构 + 简化 + 架构优化 |
| /plan | plan | Manus 持久规划（会话恢复+SHA256） |
| /optimize | optimize | 性能优化 |
| /ui-polish | ui-polish | 前端美化 |
| /release | release | 发布部署 |
| /deps | deps | 依赖更新 |
| /check | check | 引擎自检 + 自愈 |
| /qa | qa | 浏览器 QA 验证 |
| /new-project | new-project | 新项目创建 |
| /onboard | onboard | 环境搭建 |
| /cicd | cicd | CI/CD 流水线 |
| /rollback | rollback | 紧急回滚 |
| /setup | setup | 测试/监控/属性测试设施搭建（`--kind e2e\|monitor\|property`） |
| /loop | loop | 自动迭代循环 |
| /spec | spec | Spec-Driven 开发 |
| /plan-ceo-review | plan-ceo-review | 创始人策略审查 |
| /mobile-review | mobile-review | 移动端代码审查 |
| /mobile-audit | mobile-audit | 移动端审计 |
| /mobile-e2e | mobile-e2e | 移动端 E2E |
| /mobile-onboard | mobile-onboard | 移动端环境搭建 |
| /mobile-optimize | mobile-optimize | 移动端性能优化 |
| /mobile-release | mobile-release | 移动端发布 |

## 用户没敲命令时：先判断要不要走场景

用户说人话也要能落到场景上（「帮我做视觉设计」→ `ui-polish`），但**不是每个请求都值得
开一条几十步的工作流**。先分两类：

- **走场景**：改动能横跨多个阶段、有明确交付标准、要留证据（审查报告 / 门禁结果 / 计分卡），
  或者用户明确说「按流程跑一遍」。
- **直接做**：单点小改（改个颜色、一行文案、一个 typo）和只读问答。拿 74 步的 ui-polish 去回答
  「这个按钮用蓝色好不好看」，用户要的是答案，不是流水线。

决定要走之后，用表里第二列的场景名，先 `claude-scene show <场景>` 看清步数与可用模式，再
`claude-scene start <场景> --auto`（人话请求同样适用）。模式见下一节 —— 用户没提就别自己加。

## 已合并命令（旧命令 → 新命令）

用户输入旧命令时，映射到新命令执行：

| 旧命令 | 新命令 | 说明 |
|--------|--------|------|
| `/audit` | `/review` | 旧名，review 场景勾选"全量审计"模式 |
| `/analyze` | `/review` | 旧名，review 场景勾选"仅分析"模式 |
| `/hunt` | `/review` | 安全已并入 review 的 security_deep 模式（默认开启） |
| `/simplify` | `/refactor` | refactor 场景勾选"代码简化"模式 |
| `/design` | `/ui-polish` | 使用 ui-polish 场景 |
| `/polish` | `/ui-polish` | 使用 ui-polish 场景 |
| `/e2e` | `/setup` | 旧名，`claude-scene start setup --kind e2e`（默认） |
| `/monitor` | `/setup` | 旧名，`claude-scene start setup --kind monitor` |
| `/property` | `/setup` | `claude-scene start setup --kind property` |

## 用法

当用户调用场景命令（如 /review）时：

1. 按上表映射命令到场景名（旧命令走“已合并命令”映射）
2. 在**当前工作目录**直接执行：
   `claude-scene start <scene> --auto`
3. 可加 `--target <路径>` 审查其他目录；`--dry-run` 只看不执行
4. 向用户报告输出

## 交互闸门：exit 2 = 要你去问用户（所有场景通用）

场景里 `auto_execute: false` 的步骤（确认类 / 单选类 / 填空类）在**非 TTY** 环境下
（你在对话里代跑就是这种）**不会替你猜答案**。没人问也没表态时，引擎中止并 **exit 2**，屏幕上打出：

```
✖ Step X 需要人工回答，但当前是非交互环境（无 TTY），引擎不会替你猜：
   <问题原文>
   调用方（agent / 脚本）必须先把这个问题问用户，再按答案重跑：
     <可选 flag + 含义>
```

此时你要做的只有一件事：**把问题转给用户，拿到答案后带对应 flag 重跑**。

| 情况 | flag |
|------|------|
| 确认类（提交/推送/发布/回滚/自动重构…） | `--yes` 或 `--decline` |
| 单选类（版本类型/更新策略/性能问题/回滚目标…） | `--choice <值>` |
| 填空类（缺失环境变量） | 让用户先补 `.env` / 环境变量，再重跑 |
| review 的 sweep（2.68） | `-S`（跑） / `--skip-sweep`（不跑），也可 `--choice 1` / `--choice 2` |
| setup 的设施类型（0） | `--kind e2e\|monitor\|property` |
| 品牌选择（`od-brand-pick`：new-project 3.551 / ui-polish 5.9） | `--brand <name>`（vercel/linear/stripe/notion/apple…）；new-project 的 3.5「是否用 Open Design」也一并有答 |
| 主题选择（ui-polish 6，问题是「请输入数字选择主题」） | `--theme daisyui\|animal-island\|custom\|huashu\|awm-brand\|liquid-glass`，或 `--choice <1-6>` |
| plan 7 的 SHA256 认证（默认不启用） | `--attest true`（启用，plan 8 会跑 attest-plan.sh） / `--attest false`（明确不启用） |

涉及场景：`feature`(9)、`release`(6)、`rollback`(3/5)、`deps`(5)、`optimize`(4/7/10)、
`refactor`(12)、`ui-polish`(5.9 品牌 / 6 主题)、`mobile-release`(4)、`bugfix`(8)、`onboard`(6)、
`new-project`(1.6 / 3.3 / 3.5 是否用 Open Design / 3.551 品牌)、`review`(2.68)、`plan`(7 认证)

**禁止**：
- 不加 flag 重跑（会再停在同一个问题）；
- 把 exit 2 当失败去重试或忽略；
- 自己替用户选一个值（比如默认 `major`/`--yes` 推送）再跑。

> 已声明安全默认值的步骤不会停：`deps` 的更新策略默认「安全更新」、`selectModes` 勾选
> 场景里 `default: true` 的模式（如 review 的 code_review + security_deep）、`setup` 默认 e2e。
> 引擎会把这些默认值**打印出来**（`⏭ ... 按场景声明的默认值`），不会静默。

## `--mode` 是替换语义，不是叠加

`--mode` 一传，场景里 `default: true` 的模式就被**整个丢掉**，只留列出的那些。
所以「加一个模式」必须把默认的也写全：

```bash
claude-scene start ui-polish --auto --mode ui_polish,impeccable,landing_page   # 默认两套 + 落地页
claude-scene start ui-polish --auto --mode landing_page                        # 只跑落地页方法论
```

- 可用模式：`claude-scene show <场景>` 里 `模式:` 那一行（带「(默认)」标记）。
- 写错 id：引擎会打印可用列表并回落到场景默认值，不会静默改计划。
- **模式属于用户的决策**：用户没提就别加 `--mode`（走场景默认）；不要自己替用户开一个模式，
  也不要把默认的弄丢后再解释为什么少了几个步骤。

## review 的 sweep 提问（必须转达，不能自己猜）

review 场景 Step 2.68 要问「是否现在现场跑一次探测器自检（detector-sweep）」。三种情形：

- 用户在**真终端**自己跑 → 引擎弹确认（带 `--auto` 也弹，该步骤标了 `ask_even_in_auto`）。
- **你在对话里代跑**（无 TTY）且没传决策 → 引擎在 2.68 **中止，exit code 2**，并打印那个问题。
  它不会替你取默认值。**此时你必须把这个问题原样问用户**，然后按答案重跑：
  - 用户答「跑」 → `claude-scene start review --auto -S`（现场自检，约 1~2 分钟，需工作区干净）
  - 用户答「不跑」 → `claude-scene start review --auto --skip-sweep`（Step 2.7 只读旧记录，过期会 warn）
- 已传 `-S` / `--skip-sweep` → 引擎不再问，直接执行。
- 引擎打印的是**带序号的选项**（1) 跑  2) 不跑）；用户回「1」/「2」/「跑」/「不跑」都行，agent 翻成 `-S` / `--skip-sweep`（或 `--choice 1` / `--choice 2`）重跑。

**禁止**：不要拿「不加参数重跑」当跳过（会又停在同一个问题上），也不要把 exit 2 当失败去重试或忽略。

## 示例

用户：/review

执行：
```
claude-scene start review --auto
```

用户：/audit（已合并）

执行：`claude-scene start review --auto`
并提示用户：/audit 已合并到 /review，请在交互菜单勾选"全量审计"模式。

## 引擎

`claude-scene` 是全局命令（npm link / npm i -g 安装）。
目标项目默认为当前目录，可用 `--target` 或 `MIX_CODING_PROJECT_DIR` 覆盖。

若提示 command not found，说明引擎未全局安装：
```
cd <引擎仓库>/claude-scene && npm link
```

场景数据随引擎包分发；项目若有 `.claude/scenes/<name>.json` 会覆盖同名的内置场景。
