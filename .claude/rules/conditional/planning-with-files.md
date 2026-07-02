# Planning-with-Files 集成规则

> Manus 风格持久化文件规划，与 Spec-Kit 深度融合。v3.1.3

## 核心理念

```
Context Window = RAM (易失，有限)
Filesystem = Disk (持久，无限)

→ 任何重要信息写入磁盘
```

## 融合文件结构

| 文件 | 来源 | 用途 | 更新时机 |
|------|------|------|----------|
| `spec.md` | Spec-Kit | 需求规格 | 需求变更时 |
| `plan.md` | planning-with-files | 阶段规划 + 进度 | 每阶段完成后 |
| `tasks.md` | Spec-Kit | 任务分解 | 任务状态变更时 |
| `findings.md` | planning-with-files | 研究/发现 | 任何发现后 |
| `progress.md` | planning-with-files | 会话日志 | 贯计更新 |

## 六大强制规则

### 1. 先建计划
复杂任务**必须**先创建 `plan.md`。不可协商。

### 2. 2-Action 规则
> 每 2 次视图/浏览器/搜索操作后，**立即**保存关键发现到文本文件。

防止视觉/多模态信息丢失。

### 3. 决策前重读
重大决策前，重读 `plan.md`。保持目标在注意力窗口内。

### 4. 行动后更新
完成任何阶段后：
- 标记阶段状态：`in_progress` → `complete`
- 记录遇到的错误
- 记录创建/修改的文件

### 5. 记录所有错误
每个错误都写入 `plan.md`。构建知识，避免重复。

```markdown
## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| FileNotFoundError | 1 | Created default config |
| API timeout | 2 | Added retry logic |
```

### 6. 永不重复失败
```
if action_failed:
    next_action != same_action
```
记录尝试过的方案。改变策略。

## 3-Strike 错误协议

```
ATTEMPT 1: 诊断 & 修复
  → 仔细阅读错误
  → 识别根因
  → 针对性修复

ATTEMPT 2: 替代方案
  → 同样错误？换方法
  → 换工具？换库？
  → 永不重复完全相同的失败操作

ATTEMPT 3: 更广反思
  → 质疑假设
  → 搜索解决方案
  → 考虑更新计划

AFTER 3 FAILURES: 上报用户
  → 解释尝试过的方案
  → 分享具体错误
  → 请求指导
```

## 5-Question 重启测试

能回答这 5 个问题，说明上下文管理稳固：

| 问题 | 答案来源 |
|------|----------|
| 我在哪？ | `plan.md` 当前阶段 |
| 我要去哪？ | 剩余阶段 |
| 目标是什么？ | `spec.md` 目标声明 |
| 我学到了什么？ | `findings.md` |
| 我做了什么？ | `progress.md` |

## SHA256 认证防注入

`plan.md` 可选启用 SHA256 认证：

```bash
# 认证当前计划
.claude/scripts/attest-plan.sh

# 认证存储在 .planning/<plan-id>/.attestation
# 每次读取时校验，篡改则阻断
```

**用途**：多 Agent 协作时防止计划文件被意外或恶意修改。

## 会话恢复

`/clear` 或上下文丢失后：

```bash
# 自动检测未同步上下文
python .claude/scripts/session-catchup.py "$(pwd)"
```

如果检测到未同步上下文：
1. 运行 `git diff --stat` 查看实际代码变更
2. 读取当前规划文件
3. 根据上下文 + git diff 更新规划文件
4. 继续任务

## 读写决策矩阵

| 情况 | 动作 | 原因 |
|------|------|------|
| 刚写了文件 | 不读 | 内容仍在上下文 |
| 查看了图片/PDF | 立即写发现 | 多模态 → 文本，防丢失 |
| 浏览器返回数据 | 写入文件 | 截图不持久 |
| 开始新阶段 | 读 plan/findings | 上下文过期时重新定位 |
| 发生错误 | 读相关文件 | 需要当前状态来修复 |
| 中断后恢复 | 读所有规划文件 | 恢复状态 |

## 触发条件

| 条件 | 触发 |
|------|------|
| 任务 ≥ 3 步 | 创建 plan.md |
| 视觉/搜索操作 × 2 | 写 findings.md |
| 阶段完成 | 更新 plan.md 状态 |
| 错误发生 | 记录到 plan.md |
| `/clear` 后 | 运行 session-catchup |

## 与 Spec-Kit 协作

```
/spec "需求"     → 生成 spec.md
/plan            → 基于 spec.md 生成 plan.md + findings.md + progress.md
/build           → 按 plan.md 执行，更新 progress.md
/check           → 运行 5-Question 测试 + SHA256 校验
```

**分层关系**：
- `spec.md` — 项目级需求（稳定）
- `plan.md` — 会话级规划（动态）
- `tasks.md` — 原子任务（可追踪）

## 脚本说明

| 脚本 | 用途 |
|------|------|
| `init-session.sh` | 初始化所有规划文件 |
| `check-complete.sh` | 验证所有阶段完成 |
| `session-catchup.py` | 从上一会话恢复上下文 |
| `attest-plan.sh` | SHA256 认证计划文件 |
| `set-active-plan.sh` | 设置活动计划（多计划场景） |
| `resolve-plan-dir.sh` | 解析计划目录路径 |

## 反模式

| 不要 | 应该 |
|------|------|
| 用 TodoWrite 持久化 | 创建 plan.md 文件 |
| 说一次目标就忘 | 决策前重读计划 |
| 隐藏错误静默重试 | 记录错误到计划文件 |
| 把所有东西塞进上下文 | 大内容存文件 |
| 立即开始执行 | 先创建计划文件 |
| 重复失败操作 | 记录尝试，改变策略 |
| 在 skill 目录创建文件 | 在项目目录创建文件 |
