---
description: Mobile performance optimization: measure baseline → locate bottlenecks → AI analyze → auto-fix → re-verify. Bundle/size/startup/FPS/memory/network/battery. 19-step workflow.
argument-hint: "[优化目标]"
---

# /mobile-optimize — 移动端性能优化

19 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 基线测量 → 瓶颈定位 → 自动优化 → 重新验证**

## Usage

```text
/mobile-optimize                   # 全维度性能优化
/mobile-optimize 启动速度           # 聚焦启动速度
/mobile-optimize 包体积             # 聚焦包体积优化
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦移动端性能/资源管理/内存泄漏项
2. **recall** (`step 0.5`) — 注入历史性能数据和优化记录

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出性能相关 issues
4. **Context7 MCP** (`step 2`) — 获取 RN/Flutter 性能优化最佳实践

### Phase 2: 性能分析

- **measureBaseline** (`step 3`) — 测量性能基线（包体积/启动/FPS/内存/网络/电池）
- **profileBottlenecks** (`step 4`) — 定位性能瓶颈
- **analyzeReport** (`step 5`) — AI 分析优化方案

### Phase 3: 优化执行

- **bundleOptimize** (`step 6`) — 包体积：WebP 转换 + 多分辨率 + dead import 移除
- **startupOptimize** (`step 7`) — 启动：懒初始化 + inline require + splash 优化
- **fpsOptimize** (`step 8`) — 流畅度：useNativeDriver + getItemLayout
- **memoryOptimize** (`step 9`) — 内存：Bitmap 回收 + WeakReference
- **networkOptimize** (`step 10`) — 网络：请求去重 + 批量合并 + 预加载策略
- **batteryOptimize** (`step 11`) — 电池：轮询→推送 + 后台合并

### Phase 4: 验证

- **reMeasure** (`step 12`) — 重新测量，对比优化前后数据
- **runSuite** (`step 13`) — 回归测试

### Phase 5: 沉淀

- **ce-compound** (`step 14`) — 移动端性能优化知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 分析 | mobilePerf（包体积/启动/FPS/内存/网络/电池） | CLI |
| 验证 | 测试套件 + 前后对比 | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。性能测量、优化和验证步骤正常执行。
