---
description: 移动端E2E测试配置 — 自动检测框架→选择工具→生成配置+示例→CI集成
argument-hint: "[测试范围]"
---

# /mobile-e2e — 移动端 E2E 测试

自动为你的移动端项目配置端到端 UI 自动化测试。

## 用法

```
/mobile-e2e
/mobile-e2e 全部流程
```

## 框架自动选择

| 检测到 | 选择 | 说明 |
|--------|------|------|
| React Native / Expo | Detox | Gray box，最精确 |
| Flutter | Patrol | 原生交互+热重载 |
| 微信小程序 | miniprogram-automator | 小程序专属 |
| iOS/Android 原生 | Maestro | 跨平台，YAML零代码 |
| 不确定 | Maestro | 通用兜底 |

## 产出

- 测试框架配置文件
- 示例测试用例（登录/主页/核心流程）
- GitHub Actions CI 配置（自动运行 E2E）

## 触发词

"配置App测试" / "E2E测试" / "UI自动化测试" / "Detox"
