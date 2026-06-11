---
description: 移动端性能优化 — 包体积/启动时间/FPS/内存/网络/电池 → 自动优化 → 前后对比
argument-hint: "[优化目标]"
---

# /mobile-optimize — 移动端性能优化

App 太慢、包太大、耗电太快？自动测量→定位瓶颈→自动修复→验证效果。

## 用法

```
/mobile-optimize
/mobile-optimize 启动速度
/mobile-optimize 包体积
```

## 优化维度

| 维度 | 测量指标 | 自动修复 |
|------|---------|---------|
| 📦 包体积 | 主包/分包/资源占比 | WebP转换 + 多分辨率 + dead import移除 |
| 🚀 启动 | 冷/温/热启动时间 | 懒初始化 + inline require + splash优化 |
| 🎮 流畅度 | 列表FPS + 动画帧率 | useNativeDriver + getItemLayout |
| 🧠 内存 | 峰值/后台/泄漏趋势 | Bitmap回收 + WeakReference |
| 🌐 网络 | 重复请求/批量合并/预加载/离线缓存 | 请求去重 + 批量合并 + 预加载策略 |
| 🔋 电池 | 后台定位/网络轮询/WakeLock | 轮询→推送 + 后台合并 |

## 触发词

"App太慢" / "App卡顿" / "优化App性能" / "包体积太大"
