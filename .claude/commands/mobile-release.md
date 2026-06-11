---
description: 移动端发布流程 — 质量门禁→fastlane构建签名→TestFlight/Google Play→OTA热更新→崩溃监控
argument-hint: "[patch|minor|major]"
---

# /mobile-release — 移动端发布

一键发布 App 到 TestFlight / Google Play，含质量门禁、自动构建签名、OTA 热更新。

## 用法

```
/mobile-release
/mobile-release patch
```

版本号可选，不指定则交互式选择。

## 发布流程

| 阶段 | 操作 | 说明 |
|------|------|------|
| 门禁 | 安全检查+性能基线+测试通过 | 任一项不达标阻断发布 |
| 准备 | 证书/签名/隐私标签校验 | iOS Profile + Android Keystore |
| 构建 | fastlane gym/gradle | iOS archive → TestFlight / Android AAB → Play |
| OTA | Shorebird patch | Flutter/RN 资源热更新（可选） |
| 监控 | Sentry crash-free rate | 新版本崩溃率对比基线 |

## 触发词

"发布App" / "App上线" / "帮我发布" / "TestFlight"
