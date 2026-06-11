# 方案二工具映射：GitHub 热门项目填充移动端工作流

> 每个工作流 = GitHub 热门项目组合。选择标准：高 Stars、MIT/Apache 许可证、与现有系统无冲突。
> 
> **核心约束**：全自动化 + 非专业人员可用。用户只需说一句话（如"检查App安全"），系统自动检测、自动安装工具、自动执行、自动输出通俗报告。

---

## 自动化设计原则

| 原则 | 实现方式 |
|------|---------|
| **零配置** | 自动检测项目类型（RN/Expo/Flutter/小程序/原生），无需用户指定 |
| **自动安装** | 检测到缺失工具→自动执行安装命令（`pip install`/`npm install`/`gem install`）|
| **自动执行** | 全部步骤 `auto_execute: true`，仅在关键决策点（如"是否发布到商店"）确认 |
| **容错降级** | 全部 `on_error: "continue"`，某个工具不可用跳过并告知，不阻断后续步骤 |
| **通俗输出** | emoji 指示器 + 自然语言报告，不输出 CVE 编号/堆栈 trace |
| **一键修复** | 可自动修复的问题（图片未压缩/硬编码密钥/权限声明缺失）直接修 |

---

## 映射总表

```
工作流            核心工具                            辅助工具                      Stars 合计
──────────────────────────────────────────────────────────────────────────────────────
mobile-audit      MobSF + mobsfscan + OWASP MASVS    Bearer CLI + DependencyCheck   ~43,000
mobile-review     ESLint(已有) + awesome_lints       Detox + mobsfscan              ~13,000
mobile-release    fastlane + GitHub Actions           Shorebird(OTA)                 ~41,000
mobile-optimize   bundle-visualizer + rn-perf         APK Analyzer + Caliper         ~3,000
mobile-e2e        Detox + Maestro                    miniprogram-automator          ~12,000
mobile-onboard    react-native-doctor + fastlane      cocoapods + bundletool         ~41,000
```

---

## 1. `/mobile-audit` — 移动端全维度审计

### 核心工具

| 工具 | Stars | 许可证 | 作用 | 接入方式 |
|------|-------|--------|------|---------|
| **MobSF** (`MobSF/Mobile-Security-Framework-MobSF`) | ~21,100 | GPL-3.0 | 全自动 Android/iOS 静态+动态安全分析，REST API | `curl -F "file=@app.apk" $MOBSF_URL/api/v1/upload` |
| **mobsfscan** (`MobSF/mobsfscan`) | ~761 | LGPL-3.0 | SAST CLI — 源码级扫描（Java/Kotlin/Swift/ObjC），CI 友好 | `pip install mobsfscan && mobsfscan .` |
| **OWASP MASVS** (`OWASP/owasp-masvs`) | ~2,200 | CC-BY-SA | 移动安全验证标准（L1/L2/R 三级对照），非自动化工具，作为审查规则集 | 静态 Markdown 规则集引用 |
| **OWASP MASTG** (`OWASP/mastg`) | ~12,500 | CC-BY-SA | 移动安全测试指南，安全审查步骤源 | 静态引用，生成检查清单 |

### 辅助工具

| 工具 | Stars | 作用 | 接入方式 |
|------|-------|------|---------|
| **Bearer CLI** (`Bearer/bearer`) | ~1,800 | PII/GDPR 隐私合规扫描，120+ 内置规则 | `bearer scan .` |
| **DependencyCheck** (`jeremylong/DependencyCheck`) | ~6,800 | 多语言 CVE 依赖扫描 | `dependency-check --scan .` |

### 与现有系统无冲突

- 现有 `/audit` 用 `sec-bug-hunt` 查 Web 安全，MobSF 查移动端安全 — 互补
- 现有 `/sbom` 查许可证，Bearer 查数据隐私 — 互补
- 现有 `/hunt` 查代码安全模式，mobsfscan 查源码中的移动特有漏洞 — 互补

### 工作流步骤（~22 steps）

```
Step 0.5:  MemoryService.recall        → 注入历史审计记忆
Step 1:    MobileService.detectProject  → 识别平台（RN/Expo/Flutter/原生/小程序）
Step 2:    MobSFMCP.upload              → 上传 APK/IPA 至 MobSF 服务
Step 3:    MobSFMCP.scan                → 执行静态+动态安全扫描
Step 4:    mobsfscan.scan               → 源码级 SAST（硬编码密钥/不安全存储/弱加密）
Step 5:    MobileService.masvsCheck     → OWASP MASVS L1/L2 对照
Step 6:    BearerCLI.scan               → PII/隐私合规扫描
Step 7:    DependencyCheck.scan         → 第三方依赖 CVE 扫描
Step 8:    MobileService.perfBaseline   → 包体积/启动时间/内存/FPS 基线
Step 9:    QualityService.checkGate     → 质量门禁（阻断 CRITICAL/HIGH）
Step 10-22: 合规清单 + 代码质量 + 聚合 + 记忆 + 通知
```

---

## 2. `/mobile-review` — 移动端代码审查

### 核心工具

| 工具 | Stars | 许可证 | 作用 | 接入方式 |
|------|-------|--------|------|---------|
| **ESLint** (已有) + **@react-native/eslint-config** | — | MIT | RN 基础语法规则（已有系统集成） | `eslint .` |
| **awesome_lints** (pub.dev) | ~100+ | MIT | Flutter/Dart 32 条自定义规则（widget 生命周期/性能/dispose） | `dart analyze` |
| **mobsfscan** (`MobSF/mobsfscan`) | ~761 | LGPL-3.0 | 源码安全层（硬编码/不安全存储） | `mobsfscan . --json` |
| **Detox** (`wix/Detox`) | ~11,700 | MIT | Gray box E2E 作为审查层的 UI 自动化（关键流程截图对比） | `detox test` |

### 辅助工具（审查规则集）

| 工具 | 作用 |
|------|------|
| **react-doctor** (已有) | React Hooks/effects 语义检查 — 对 RN 同样有效 |
| **SonarQube** (已有/可选) | 复杂度/重复代码/认知复杂度 |

### 与现有系统无冲突

- 现有 `/review` 的 5 层管线：ESLint → react-doctor → Playwright → AI 语义 → 聚合
- 移动端版本：ESLint + awesome_lints → mobsfscan → Detox 截图对比 → AI 语义 → 聚合
- 两条管线并行，不修改现有 `/review`

### 5 层移动端审查管线

```
L1: ESLint + @react-native/eslint-config + awesome_lints (Flutter)
    → 语法、样式、平台 API 误用、widget 生命周期

L2: mobsfscan
    → 代码层安全（硬编码密钥、不安全存储、弱加密、无 SSL Pinning）

L3: Detox (或 Maestro)
    → UI 自动化截图对比（关键流程：登录→主页→支付）

L4: AI 语义审查 (mobile-reviewer Agent)
    → 导航栈合理性、Platform.OS 散落、内存泄漏风险、状态管理

L5: 聚合报告
    → 去重、按严重度排序、修复建议
```

---

## 3. `/mobile-release` — 移动端发布流程

### 核心工具

| 工具 | Stars | 许可证 | 作用 | 接入方式 |
|------|-------|--------|------|---------|
| **fastlane** (`fastlane/fastlane`) | ~40,500 | MIT | iOS/Android 全自动构建→签名→上传商店。行业标准，无替代品 | `fastlane ios beta` / `fastlane android deploy` |
| **GitHub Actions** (已有) | — | — | CI/CD Runner（已有系统 `cicd.json` 集成） | `uses: actions/...` |

### 辅助工具

| 工具 | Stars | 作用 | 接入方式 |
|------|-------|------|---------|
| **Shorebird** (`shorebirdtech/shorebird`) | ~2,500 | Flutter/RN 代码推送（OTA 热更新），不违反 iOS 审核条款 | `shorebird release` |
| **commitlint** (已有) | — | Conventional Commits + 版本号自动推断 | `npx commitlint` |

### 与现有系统无冲突

- 现有 `/release` 流程针对 Web 部署（Vercel/CDN/GitHub Release）
- `/mobile-release` 流程针对移动端商店（TestFlight/Google Play），完全不重叠
- fastlane 是独立 CLI，不修改任何现有构建配置

### 工作流步骤（~19 steps）

```
Step 0.5:  MemoryService.recall          → 注入历史发布记忆
Step 1:    QualityService.checkGate       → 前置门禁：安全扫描通过、基线达标
Step 2:    MobileService.releaseChecks    → 签名+证书+隐私标签+测试账号检查
Step 3:    fastlane.iosBeta/signed        → iOS: xcodebuild archive → TestFlight
Step 4:    fastlane.androidBeta/deploy    → Android: AAB 签名 → Play Internal Testing
Step 5:    Shorebird.patch                → OTA 热更新资源包（可选）
Step 6:    MobileService.versionCompat    → 版本兼容矩阵检查
Step 7:    NotificationService.notify     → 通知各平台审核状态
Step 8-19: 灰度配置 + 强制更新策略 + 监控验证 + 记忆 + 通知
```

---

## 4. `/mobile-optimize` — 移动端性能优化

### 核心工具

| 工具 | Stars | 许可证 | 作用 | 接入方式 |
|------|-------|--------|------|---------|
| **react-native-bundle-visualizer** (`callstack/react-native-bundle-visualizer`) | ~1,500 | MIT | JS Bundle 树图可视化，识别大模块 | `npx react-native-bundle-visualizer` |
| **react-native-performance** (`oblador/react-native-performance`) | ~800 | MIT | W3C Performance API 实现，启动时间/渲染时间 | `npm install react-native-performance` |
| **Re.Pack** (`callstack/repack`) | ~1,680 | MIT | Webpack/Rspack 替代 Metro，代码分割 + Module Federation | `npx @callstack/repack-init` |

### 平台专属工具

| 工具 | Stars | 平台 | 作用 |
|------|-------|------|------|
| **APK Size Analyzer** (`Krishnasony/ApkSizeAnalyzer`) | ~200+ | Android | IDE 插件，APK 大小分解 + 并排对比 |
| **analyze-aab** (`GallopingDino/analyze-aab`) | ~100+ | Android | AAB 大小分析，版本间差异追踪 |
| **Caliper** (`kibotu/caliper`) | ~50+ | iOS | LinkMap 解析，模块级大小归属，HTML 报告 |
| **app-sizer** (`grab/app-sizer`) | ~300+ | Android | Grab 开源，下载大小优化分析 |

### 运行时监控

| 工具 | 作用 |
|------|------|
| **Firebase Performance Monitoring** | 真实用户 RUM：启动时间/FPS/网络延迟 |
| **Perfetto** (`google/perfetto`) | Android 系统级 trace，分析主线程/GPU/WakeLock |

### 与现有系统无冲突

- 现有 `/optimize` 用 Lighthouse + Web Vitals（LCP/CLS/INP）— Web 性能
- `/mobile-optimize` 用 bundle analyzer + 启动时间 + FPS — 移动端性能
- 两个工作流测量不同指标，不重叠

### 工作流步骤（~14 steps）

```
Step 1:   MemoryService.recall            → 注入历史性能记忆
Step 2:   MobileService.measureBaseline   → 冷启动/温启动/包体积/FPS/内存基线
Step 3:   bundle-visualizer.analyze       → JS Bundle 分析（大模块定位）
Step 4:   MobileService.analyzeAssets     → 图片未压缩/未 WebP/未多分辨率
Step 5:   MobileService.detectAntipatterns → 离屏渲染/过度绘制/主线程长任务
Step 6:   MobileService.optimizeTargets   → 生成优化方案（图片→WebP/代码分割/懒加载）
Step 7:   QualityService.checkGate        → 性能预算门禁
Step 8-14: 执行优化 + 重新测量 + 低端设备验证 + 记忆 + 通知
```

---

## 5. `/mobile-e2e` — 移动端 E2E 测试配置

### 核心工具

| 工具 | Stars | 许可证 | 适用平台 | 接入方式 |
|------|-------|--------|---------|---------|
| **Detox** (`wix/Detox`) | ~11,700 | MIT | React Native（首选） | `npx detox init -r jest` |
| **Maestro** (`mobile-dev-inc/maestro`) | ~6,000+ | MIT | 通用跨平台（RN/Flutter/原生），已有 MCP Server | YAML 编写 + `maestro test` |
| **Appium** (`appium/appium`) | ~19,000 | Apache-2.0 | 通用（WebDriver 协议），备选 | `appium --base-path /wd/hub` |

### 平台专属

| 工具 | 平台 |
|------|------|
| **Patrol** (`leancodepl/patrol`) | Flutter 集成测试增强（~800★），热重载 + 原生交互 |
| **miniprogram-automator** (`wechat-miniprogram/miniprogram-automator`) | 微信小程序自动化（~500★） |

### 选择逻辑（内置到 `MobileService.detectProject`）

```
检测到 RN/Expo        → Detox（Gray box，最精确）
检测到 Flutter         → Patrol（原生交互）
检测到小程序           → miniprogram-automator
检测到 iOS/Android 原生 → Maestro 或 Appium
无明确框架             → Maestro（通用跨平台，YAML 配置零代码）
```

### 与现有系统无冲突

- 现有 `/e2e` 用 MSW + Supertest + Schemathesis — Web API 测试
- `/mobile-e2e` 用 Detox + Maestro — 移动端 UI 测试
- 完全不同的测试层，不冲突

### 工作流步骤（~8 steps）

```
Step 1:   MemoryService.recall            → 注入测试配置记忆
Step 2:   MobileService.detectProject     → 识别框架→选择测试工具
Step 3:   MobileService.setupE2EConfig    → 生成测试配置 + 示例用例
Step 4:   MobileService.verifySetup       → 验证测试环境可用
Step 5:   QualityService.checkGate        → E2E 配置质量门禁
Step 6-8: CI 集成（GitHub Actions）+ 记忆 + 通知
```

---

## 6. `/mobile-onboard` — 移动端开发环境搭建

### 核心工具

| 工具 | Stars | 许可证 | 作用 | 接入方式 |
|------|-------|--------|------|---------|
| **react-native-doctor** (`react-native-community/cli`) | — | MIT | RN 环境完整性检查（Node/JDK/Xcode/Android SDK/CocoaPods） | `npx react-native doctor` |
| **fastlane** (`fastlane/fastlane`) | ~40,500 | MIT | 证书/签名初始化 | `fastlane match init` |
| **CocoaPods** (`CocoaPods/CocoaPods`) | ~14,600 | MIT | iOS 包管理（RN 必需） | `pod install` |

### 辅助工具

| 工具 | 作用 |
|------|------|
| **bundletool** (`google/bundletool`) | Android AAB 构建/安装/签名验证 |
| **Expo CLI** (`expo/expo`) | Expo 项目环境检查 + EAS 配置 |
| **Flipper** (`facebook/flipper`) | RN 调试工具（Network/Logs/Layout/DB） |

### 与现有系统无冲突

- 现有 `/onboard` 查 Web/Node.js 环境（Node/npm/git）
- `/mobile-onboard` 查移动端环境（Xcode/Android Studio/JDK/CocoaPods）
- 互补，不冲突

### 工作流步骤（~14 steps）

```
Step 1:   MemoryService.recall              → 注入环境配置记忆
Step 2:   MobileService.checkPrerequisites  → Xcode/Android Studio/Node/JDK 版本检查
Step 3:   react-native-doctor.check         → RN 环境完整性检查
Step 4:   fastlane.matchInit                → iOS 证书/Profile 初始化
Step 5:   MobileService.checkAndroidSDK     → Android SDK/NDK 路径+版本
Step 6:   MobileService.setupEnv            → 生成 .env 模板（API地址/推送证书/MapKey）
Step 7:   MobileService.verifyBuild         → iOS: pod install → build; Android: gradle sync → build
Step 8-14: 模拟器配置 + 真机调试 + 热更新配置 + 记忆 + 通知
```

---

## 工具选择原则总结

1. **MIT/Apache 优先** — fastlane、Detox、Maestro、bundle-visualizer 均为 MIT；MobSF 是唯一的 GPL-3.0，但作为独立 HTTP 服务接入（非源码嵌入），不受 copyleft 约束
2. **CI/CD 友好** — 所有工具均支持 CLI 模式，无需 GUI
3. **MCP 适配** — Maestro 已有 MCP Server；MobSF 有 REST API 可包装 MCP；fastlane/Detox 可 CLI 调用
4. **与现有系统零冲突** — 全部是移动端专属工具，不修改现有 27 个工作流的任何逻辑
5. **Stars 合计 ~120,000+** — 均为各自领域的头号开源项目
