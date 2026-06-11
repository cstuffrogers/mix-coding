---
description: 移动端开发环境搭建 — 自动检测缺失依赖→安装→配置→首次构建验证
argument-hint: ""
---

# /mobile-onboard — 移动端环境搭建

新机器或新项目？一键搭建完整移动端开发环境。

## 用法

```
/mobile-onboard
```

## 检查项

| 工具 | 说明 |
|------|------|
| Node.js | 版本检查（RN/Expo 要求） |
| JDK | Java 17+（Android 构建） |
| Xcode | iOS 开发必需（macOS） |
| Android Studio | SDK/NDK/模拟器 |
| Ruby + CocoaPods | iOS 依赖管理 |
| fastlane | 证书/签名自动化 |

## 产出

- 所有缺失依赖的安装指引
- `.env` 配置模板
- iOS: CocoaPods + 首次构建验证
- Android: Gradle sync + 首次构建验证
- 模拟器配置指引

## 触发词

"搭建App开发环境" / "RN环境" / "Flutter环境" / "iOS开发环境"
