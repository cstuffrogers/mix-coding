---
description: 移动端全维度安全审计 — MobSF安全扫描 + OWASP MASVS对照 + 隐私合规 + 依赖CVE + 性能基线 + 商店合规清单
argument-hint: "[项目路径]"
---

# /mobile-audit — 移动端全维度审计

一键检查你的 App 安全性、隐私合规、性能基线和应用商店合规状态。

## 用法

```
/mobile-audit
/mobile-audit E:\my-rn-app
```

无需参数：自动检测当前目录的移动端项目。

## 检查内容

| 维度 | 工具 | 说明 |
|------|------|------|
| 🔒 安全扫描 | MobSF + mobsfscan | APK/IPA 静态分析 + 源码级SAST |
| 📋 安全标准 | OWASP MASVS | L1/L2 安全等级对照 |
| 🛡️ 隐私合规 | Bearer CLI | PII泄露/GDPR合规 |
| 📦 依赖漏洞 | DependencyCheck | 第三方库 CVE 扫描 |
| ⚡ 性能基线 | 包体积/启动/FPS/内存 | 首次测量作为基线 |
| 🏪 商店合规 | Apple/Google/微信 | 隐私标签/权限/截图 |

## 触发词

"检查App安全" / "App审计" / "应用安全检查" / "App体检"
