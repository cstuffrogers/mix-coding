---
description: 移动端5层代码审查 — ESLint+RN规则 → mobsfscan安全 → Detox/Maestro截图 → AI语义+a11y → 聚合报告
argument-hint: "[PR编号]"
---

# /mobile-review — 移动端代码审查

5 层审查管线检查你的 RN/Flutter/原生代码质量和安全。

## 用法

```
/mobile-review
/mobile-review #42
```

## 5 层审查管线

| 层 | 工具 | 检查内容 |
|----|------|---------|
| L1 | ESLint + RN/Flutter规则 | 语法/样式/平台API误用/widget生命周期 |
| L2 | mobsfscan | 硬编码密钥/不安全存储/弱加密/SSL Pinning |
| L3 | Detox / Maestro | UI 截图对比（关键流程前后对比） |
| L4 | AI 语义 + a11y | 导航栈/Platform.OS/内存泄漏/TalkBack/触控区域 |
| L5 | 聚合报告 | 去重/排序/修复建议 |

## 触发词

"审查App代码" / "RN审查" / "Flutter审查" / "检查App代码质量"
