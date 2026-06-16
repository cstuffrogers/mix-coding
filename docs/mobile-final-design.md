# 移动端开发方案 — 最终设计文档（最优版）

> 版本：v3.0 | 日期：2026-06-10 | 基准：方案二全栈移动端 + 多轮工具调研优化

---

## 一、优化点总结（v2 → v3）

| # | 优化项 | 原方案 | 优化后 | 节省 |
|---|--------|--------|--------|------|
| 1 | Agent 数量 | 3 个（mobile-reviewer / mobile-security / mobile-perf） | 3 个（结构不变，内容精简） | — |
| 2 | Skill 数量 | 2 个（mobile-ui-review / mobile-sec-guide） | 1 个（mobile-ui-review），OWASP MASVS 改为 rules 文件 | -1 Skill |
| 3 | MCP 新增 | 7 个 | 5 个（砍 spectral + promptfoo） | -2 MCP |
| 4 | 新 Rules | 1 个（mobile-coding.md） | 2 个（+ mobile-security-rules.md，OWASP MASVS 对照） | +1 Rules |
| 5 | mobile-audit 步骤 | 22 步 | 17 步（合并相邻分析步骤 + 砍 ECC） | -5 |
| 6 | mobile-review 步骤 | 15 步 | 11 步（复用 5 层管线模式 + 砍 ECC） | -4 |
| 7 | mobile-optimize 步骤 | 14 步 | 13 步（追加网络分析、合并测量优化） | -1 |
| 8 | mobile-review a11y | 无 | L4 AI 审查追加 TalkBack/VoiceOver/焦点/对比度 | +1 维度 |
| 9 | 修改文件 | 4 个 | 3 个（不修改 ARCHITECTURE.md） | -1 |
| 10 | mobile-review a11y | 无 | L4 中追加 TalkBack/VoiceOver/焦点/对比度检查 | +1 维度 |
| 11 | mobile-optimize 网络分析 | 无 | 追加 analyzeNetwork 步骤 | +1 步骤 |

### 优化说明

**砍 spectral MCP**：API 契约检查已有 `api-contract-check` skill 覆盖，OpenAPI/Redocly 管线适用于移动端 BFF/网关层 API，不需要单独的 spectral MCP。

**砍 promptfoo MCP**：LLM 输出质量测试是 AI 工程通用问题，不是移动端专属。后续单独评估，不混入移动端方案。

**砍 mobile-sec-guide skill → mobile-security-rules.md**：OWASP MASVS/MSTG 本质是静态检查规则集，不是可调用的能力。放入 `.claude/rules/` 目录，Agent 自动加载，符合系统现有 `coding.md` / `karpathy-principles.md` 模式。

**追加移动端 a11y**：在 mobile-review L4 AI 审查中追加 TalkBack/VoiceOver 行为、焦点顺序、触控区域(≥44pt)、对比度检查。Web 端已有 WCAG + a11y MCP，移动端需独立维度。

**追加网络分析**：在 mobile-optimize 中追加 1 个步骤：检测重复请求、未批量合并、无预加载策略、无离线缓存，生成优化建议。

---

## 二、工具选择（最终版）

### 2.1 新增 GitHub 工具

| 工作流 | 核心工具 | Stars | 许可 | 用途 |
|--------|---------|-------|------|------|
| **mobile-audit** | MobSF | 21,000+ | GPL-3.0 | 全自动 Android/iOS 静态+动态安全分析 |
| | mobsfscan | 761 | LGPL-3.0 | SAST CLI，源码级安全扫描 |
| | Bearer CLI | 1,800 | MIT | PII/GDPR 隐私合规扫描 |
| | DependencyCheck | 6,800 | Apache-2.0 | 多语言 CVE 依赖扫描 |
| **mobile-review** | Detox | 11,700 | MIT | RN Gray box E2E（审查层截图对比） |
| | mobsfscan | 761 | LGPL-3.0 | 代码层安全规则 |
| **mobile-release** | fastlane | 40,500 | MIT | iOS/Android 全自动构建→签名→发布 |
| | Shorebird | 2,500 | MIT | Flutter/RN OTA 热更新 |
| **mobile-optimize** | react-native-bundle-visualizer | 1,500 | MIT | JS Bundle 树图分析 |
| | react-native-performance | 800 | MIT | W3C Performance API（启动/渲染时间） |
| | Perfetto | 2,700 | Apache-2.0 | Android 系统级 trace |
| **mobile-e2e** | Detox | 11,700 | MIT | RN E2E 首选 |
| | Maestro | 6,000 | MIT | 跨平台 UI 自动化 |
| | miniprogram-automator | 500 | MIT | 微信小程序自动化 |
| **mobile-onboard** | react-native-doctor | — | MIT | RN 环境完整性检查 |
| | fastlane | 40,500 | MIT | iOS 证书/签名初始化 |
| | CocoaPods | 14,600 | MIT | iOS 依赖管理 |

### 2.2 复用现有系统资产

| 资产 | 来源 | 在移动端工作流中的角色 |
|------|------|---------------------|
| Scene 引擎 CLI | `claude-scene` | 6 个工作流全部跑在 `node src/index.js start mobile-*` |
| Memory 体系（7后端） | 现有 | recall→remember→consolidate 生命周期，移动端记忆类型隔离 |
| react-doctor | 现有 | RN Hooks/Effects 语义检查 |
| github MCP | 现有 | PR/Release/Tag 管理 |
| sentry MCP | 现有 | 移动端崩溃监控（RN/Flutter/iOS/Android SDK） |
| codegraph MCP | 现有 | 代码符号索引 |
| QualityService | 现有 | 质量门禁（checkGate） |
| NotificationService | 现有 | 工作流完成通知 |
| vitest | 现有 | 单元测试运行器 |
| ESLint | 现有 | 工具链保留，规则集用 `@react-native/eslint-config` |

### 2.3 无冲突确认

```
新增工具          vs    现有系统
─────────────────────────────────────
MobSF                   REST API 独立服务，与任何现有 MCP 无交集
mobsfscan               pip install 独立 CLI，输出 JSON 不污染任何配置
fastlane                独立 CLI + Gemfile，不修改任何构建配置
Detox                   npm 独立工具，测试文件在 e2e/ 目录下
Maestro                 YAML 配置独立，已有 MCP Server
Shorebird               Flutter/RN 专属，现有系统无 Flutter 项目
Bearer CLI              CLI 工具，输出报告不修改代码
DependencyCheck         Java CLI，独立运行
Perfetto                Android 系统工具，通过 adb 采集
bundle-visualizer       npx 独立运行，生成 HTML 报告
CocoaPods               iOS 专属，现有系统无 iOS 项目
miniprogram-automator   微信小程序专属，不涉及 Web
```

---

## 三、最终文件清单

### 3.1 新建文件（18 个）

```
.claude/
├── rules/
│   ├── mobile-coding.md          # 移动端编码规范（平台抽象/导航/性能/安全）
│   └── mobile-security-rules.md  # OWASP MASVS/MSTG 规则对照（替代 mobile-sec-guide skill）
├── agents/
│   ├── mobile-reviewer.md        # RN/Flutter 代码审查 Agent
│   ├── mobile-security.md        # 移动端安全审计 Agent
│   └── mobile-perf.md            # 移动端性能分析 Agent
├── skills/
│   └── mobile-ui-review/
│       └── SKILL.md              # 移动端 UI 审查（安全区域/刘海/键盘/手势）
├── scenes/
│   ├── mobile-audit.json         # 移动端全维度审计（~17 steps）
│   ├── mobile-review.json        # 移动端代码审查（~11 steps，5 层管线）
│   ├── mobile-release.json       # 移动端发布流程（~15 steps）
│   ├── mobile-optimize.json      # 移动端性能优化（~12 steps）
│   ├── mobile-e2e.json           # 移动端 E2E 测试配置（~8 steps）
│   └── mobile-onboard.json       # 移动端环境搭建（~10 steps）
└── commands/
    ├── mobile-audit.md
    ├── mobile-review.md
    ├── mobile-release.md
    ├── mobile-optimize.md
    ├── mobile-e2e.md
    └── mobile-onboard.md
```

### 3.2 修改文件（3 个）

| 文件 | 修改内容 | 行数估计 |
|------|---------|---------|
| `.claude/mcp-enable.json` | 新增 5 个 server_definitions + 6 个 scene mappings | +60 行 |
| `constitution.md` | 追加 Mobile Development Principles 章节 | +20 行 |
| `.claude/rules/workflows.md` | 追加 6 个移动端工作流速查 + 自然语言触发词 | +80 行 |

### 3.3 不修改的文件（明确排除）

| 文件 | 原因 |
|------|------|
| `CLAUDE.md` | 工作流速查表已超 200 行，移动端内容放在 workflows.md 更合理 |
| `ARCHITECTURE.md` | MobileService 是概念层逻辑，不需要改架构文档 |
| 现有 27 个工作流 JSON | 独立新增，零修改 |

---

## 四、6 个工作流设计（最终版）

### 4.1 `/mobile-audit` — 移动端全维度审计（17 步）

```
Step 0.5   MemoryService.recall           → 注入历史审计记忆
Step 1     MobileService.detectProject     → 识别平台（RN/Expo/Flutter/原生/小程序）
Step 2     MobileService.checkTools        → 自动检测工具可用性（MobSF/mobsfscan/Bearer/DependencyCheck）
Step 3     MobileService.autoInstall       → 缺失工具自动安装
Step 4     MobSFMCP.upload                 → 上传 APK/IPA 至 MobSF
Step 5     MobSFMCP.scan                   → 执行静态+动态安全扫描
Step 6     mobsfscan.scan                  → 源码级 SAST（硬编码密钥/不安全存储/弱加密）
Step 7     BearerMCP.scan                  → PII/隐私合规扫描
Step 8     DependencyCheckMCP.scan         → 第三方依赖 CVE 扫描
Step 9     MobileService.securityChecklist → OWASP MASVS L1/L2 对照
Step 10    MobileService.perfBaseline      → 包体积/启动时间/内存/FPS 基线
Step 11    MobileService.storeCompliance   → 应用商店合规清单（Apple/Google/微信）
Step 12    QualityService.checkGate        → 质量门禁（阻断 CRITICAL/HIGH）
Step 13    MobileService.generateReport    → 生成通俗审计报告
Step 14    MemoryService.remember          → 保存审计结果
Step 15    MemoryService.consolidate       → 整理跨后端记忆
Step 16    CostService.report              → 成本报告
Step 17    NotificationService.notify      → 通知审计完成
```

**步骤优化**：原 22 步 → 17 步。合并了"合规清单 + 代码质量 → storeCompliance"，工具检测+安装从 3 步合并为 2 步。

### 4.2 `/mobile-review` — 移动端代码审查（11 步）

```
Step 0.5   MemoryService.recall           → 注入历史审查记忆
Step 1     MobileService.detectProject     → 识别平台 → 选择规则集
Step 2     GitHubMCP.listPullRequests      → 列出待审查 PR
Step 3     L1: ESLint + RN/Flutter rules   → 语法/样式/平台 API 误用
Step 4     L2: mobsfscan                   → 代码层安全（硬编码密钥/不安全存储/弱加密）
Step 5     L3: Detox/Maestro screenshots   → UI 截图对比（关键流程）
Step 6     L4: mobile-reviewer Agent       → AI 语义审查（导航栈/Platform.OS/内存泄漏/移动端a11y）
Step 7     L5: 聚合报告                     → 去重/排序/修复建议
Step 8     QualityService.checkGate        → 门禁（CRITICAL 阻断）
Step 9     MemoryService.remember          → 保存审查结果
Step 10    MemoryService.consolidate       → 整理记忆
Step 11    NotificationService.notify      → 通知审查完成
```

**步骤优化**：原 15 步 → 11 步。5 层审查管线合并为 5 个连续步骤，去掉 Context7 查阅（移动端审查不需要查文档）。

### 4.3 `/mobile-release` — 移动端发布流程（15 步）

```
Step 0.5   MemoryService.recall           → 注入历史发布记忆
Step 1     MobileService.detectProject     → 识别平台
Step 2     QualityService.checkGate        → 前置门禁：安全扫描/基线/测试
Step 3     MobileService.releaseChecks     → 签名+证书+隐私标签+测试账号
Step 4     fastlane.iosBeta                → iOS: archive → TestFlight（条件：iOS项目）
Step 5     fastlane.androidBeta            → Android: AAB签名 → Play Internal（条件：Android项目）
Step 6     ShorebirdMCP.patch              → OTA 热更新（可选，条件：Flutter/RN）
Step 7     GitHubMCP.createRelease         → GitHub Release + CHANGELOG
Step 8     MobileService.versionCompat     → 版本兼容矩阵检查
Step 9     MobileService.grayRelease       → 灰度比例配置
Step 10    SentryMCP.checkCrashRate        → 发布后崩溃率监控
Step 11    CostService.report              → 成本报告
Step 12    MemoryService.remember          → 保存发布记录
Step 13    MemoryService.consolidate       → 整理记忆
Step 14    NotificationService.notify      → 通知发布状态
```

**步骤优化**：原 19 步 → 15 步。合并构建+签名为一个 fastlane action，去掉 Huashu release-deck/animation（移动端不需要 PPT 动画）。

### 4.4 `/mobile-optimize` — 移动端性能优化（13 步）

```
Step 0.5   MemoryService.recall           → 注入历史性能记忆
Step 1     MobileService.detectProject     → 识别平台
Step 2     MobileService.measureBaseline   → 冷启动/温启动/包体积/FPS/内存基线
Step 3     bundle-visualizer.analyze       → JS Bundle 大模块定位
Step 4     MobileService.analyzeAssets     → 图片未压缩/未 WebP/未多分辨率
Step 5     MobileService.analyzeNetwork    → API 重复请求/未批量合并/无预加载/无离线缓存
Step 6     MobileService.detectAntipatterns → 离屏渲染/过度绘制/主线程长任务
Step 7     MobileService.generateOptimizePlan → 生成优化方案
Step 8     MobileService.executeOptimize   → 执行可自动修复的优化
Step 9     MobileService.remeasure         → 优化后重新测量+对比
Step 10    QualityService.checkGate        → 性能预算门禁
Step 11    MemoryService.remember          → 保存性能基线+优化结果
Step 12    MemoryService.consolidate       → 整理记忆
Step 13    NotificationService.notify      → 通知优化结果
```

**步骤优化**：原 14 步 → 13 步。合并"执行优化 + 重新测量 + 低端设备验证"为 2 步，追加网络请求分析步骤。

### 4.5 `/mobile-e2e` — 移动端 E2E 测试配置（8 步）

```
Step 0.5   MemoryService.recall           → 注入测试配置记忆
Step 1     MobileService.detectProject     → 识别框架→选择测试工具
Step 2     MobileService.setupE2EConfig    → 生成配置+示例用例
Step 3     MobileService.verifySetup       → 验证测试环境可用
Step 4     QualityService.checkGate        → E2E 配置质量门禁
Step 5     MobileService.generateCIConfig  → CI 集成（GitHub Actions）
Step 6     MemoryService.remember          → 保存测试配置
Step 7     MemoryService.consolidate       → 整理记忆
Step 8     NotificationService.notify      → 通知配置完成
```

**无变化**：8 步已是最简，E2E 配置工作流不复杂。

### 4.6 `/mobile-onboard` — 移动端环境搭建（10 步）

```
Step 0.5   MemoryService.recall           → 注入环境配置记忆
Step 1     MobileService.checkPrerequisites → Xcode/Android Studio/Node/JDK 版本检查
Step 2     react-native-doctor.check       → RN 环境完整性检查
Step 3     fastlane.matchInit              → iOS 证书/Profile 初始化（条件：iOS）
Step 4     MobileService.checkAndroidSDK   → Android SDK/NDK 路径+版本（条件：Android）
Step 5     MobileService.setupEnv          → 生成 .env 模板
Step 6     MobileService.verifyBuild       → iOS/Android 首次构建验证
Step 7     MobileService.setupEmulator     → 模拟器/真机调试配置指引
Step 8     MemoryService.remember          → 保存环境配置
Step 9     MemoryService.consolidate       → 整理记忆
Step 10    NotificationService.notify      → 通知环境搭建完成
```

**步骤优化**：原 14 步 → 10 步。合并了 CocoaPods install + pod install 到 verifyBuild，去掉 Flipper（已停止维护），去掉热更新配置（移到 release 工作流）。

---

## 五、MCP 设计（5 个新增）

### 5.1 定义

```json
{
  "mobsf": {
    "type": "mobsf-mcp",
    "install_command": "pip install mobsf",
    "required_env_vars": ["MOBSF_URL", "MOBSF_API_KEY"],
    "description": "移动端安全框架：静态+动态分析 APK/IPA",
    "rate_limit": "100/day"
  },
  "maestro": {
    "type": "maestro-mcp",
    "install_command": "curl -Ls \"https://get.maestro.mobile.dev\" | bash",
    "description": "跨平台移动 UI 自动化（RN/Flutter/原生），YAML 配置零代码"
  },
  "detox": {
    "type": "detox-mcp",
    "install_command": "npm install -g detox-cli",
    "description": "React Native Gray box E2E 测试框架"
  },
  "bearer": {
    "type": "bearer-mcp",
    "install_command": "npm install -g @bearer/cli",
    "description": "PII/GDPR 隐私合规扫描，120+ 内置规则"
  },
  "toxiproxy": {
    "type": "toxiproxy-mcp",
    "install_command": "brew install toxiproxy || go install github.com/Shopify/toxiproxy/v2/cmd/toxiproxy@latest",
    "description": "网络故障注入：弱网/超时/丢包测试"
  }
}
```

### 5.2 per-workflow 映射

```json
{
  "mobile-audit": {
    "enabled_servers": ["mobsf", "bearer", "github", "codegraph", "memory"],
    "token_estimate": 1800
  },
  "mobile-review": {
    "enabled_servers": ["github", "maestro", "detox", "codegraph", "memory"],
    "token_estimate": 1500
  },
  "mobile-release": {
    "enabled_servers": ["github", "sentry", "memory"],
    "token_estimate": 1200
  },
  "mobile-optimize": {
    "enabled_servers": ["github", "codegraph", "memory"],
    "token_estimate": 800
  },
  "mobile-e2e": {
    "enabled_servers": ["maestro", "detox", "github", "memory"],
    "token_estimate": 1000
  },
  "mobile-onboard": {
    "enabled_servers": ["github", "memory"],
    "token_estimate": 400
  }
}
```

---

## 六、Agent 设计（3 个）

### 6.1 mobile-reviewer

```yaml
name: mobile-reviewer
description: RN/Flutter code quality review — navigation stacks, Platform.OS isolation, native module compatibility, memory leak patterns
model: sonnet
color: green
skills:
  - mobile-ui-review
```

审查维度：
- **导航栈** — 类型安全参数、深层链接验证、返回栈正确性
- **平台隔离** — Platform.OS 仅在适配层使用，iOS/Android 行为差异文档化
- **原生模块** — 桥接层错误处理、线程安全、Turbo Modules 规范
- **内存** — useEffect cleanup、FlatList key、图片缓存释放
- **状态管理** — Store 粒度、不必要的重渲染
- **移动端 a11y** — TalkBack/VoiceOver 标签、焦点顺序、触控区域 ≥44pt、对比度

### 6.2 mobile-security

```yaml
name: mobile-security
description: Mobile security audit — OWASP MASVS/MSTG mapping, MobSF results interpretation, app store compliance requirements
model: sonnet
color: red
```

审查维度：
- **数据存储** — Keychain/Keystore vs AsyncStorage，敏感数据加密
- **网络** — SSL Pinning，证书校验，明文流量阻断
- **代码保护** — 混淆启用，Root/Jailbreak 检测
- **认证** — 生物识别安全等级，Token 刷新策略
- **商店合规** — 隐私标签，权限声明理由，App Tracking Transparency

### 6.3 mobile-perf

```yaml
name: mobile-perf
description: Mobile performance baseline — bundle size, startup time, FPS, memory, battery. Evaluates against budgets.
model: sonnet
color: blue
```

审查维度：
- **包体积** — 主包/分包/资源占比，按模块归属
- **启动** — 冷启动 < 3s，温启动 < 1s，热启动 < 500ms
- **渲染** — 列表 60fps，动画原生驱动，过度绘制检测
- **内存** — 前台/后台占用，内存泄漏趋势
- **电池** — WakeLock，后台定位，网络轮询频率

---

## 七、Skill 设计（1 个）

### 7.1 mobile-ui-review

替代原 mobile-sec-guide skill。OWASP MASVS/MSTG 规则集放入 `mobile-security-rules.md` 作为 Agent 自动加载的 reference 规则文件。

```yaml
name: mobile-ui-review
description: Mobile UI review — safe area / notch / keyboard avoidance / touch targets (>=44pt) / gesture conflicts / loading states
user-invocable: false
```

检查项：
- **安全区域** — 刘海/底部横条不遮挡内容
- **键盘** — 键盘弹起时输入框可见，KeyboardAvoidingView 正确使用
- **触控** — 交互元素 >= 44pt 触控热区，手势不冲突
- **加载态** — 骨架屏/loading indicator，网络错误提示
- **方向** — 横竖屏切换无布局崩溃

---

## 八、Rules 设计（2 个）

### 8.1 mobile-coding.md

移动端编码规范，遵循 `coding.md` 同模式：

```
平台抽象 / 导航 / 性能 / 安全 / 资源管理 / 兼容性 / 商店合规
```

### 8.2 mobile-security-rules.md

OWASP MASVS v2.0 规则对照表，Agent 自动加载：

```
MASVS-STORAGE / MASVS-CRYPTO / MASVS-NETWORK / MASVS-AUTH / MASVS-CODE / MASVS-RESILIENCE
```

每个规则标注严重度（🔴/🟡）和可自动修复（🔧）标识。

---

## 九、constitution.md 追加

```markdown
## Mobile Development Principles

- **Platform parity** — iOS and Android behavior must be consistent.
  Platform-specific code isolated behind a shared interface.
  No scattered `Platform.OS` checks.
- **Security by default** — SSL Pinning on, code obfuscation enabled,
  no hardcoded keys. Sensitive data in Keychain/Keystore, never
  AsyncStorage/SharedPreferences.
- **Performance budget** — Cold start < 3s, main bundle < 2MB (RN) /
  5MB (Flutter), list rendering at 60fps. Every image optimized.
- **Store compliance** — Privacy manifest (iOS), notification channels
  (Android), permission rationale strings. No unnecessary permissions.
- **Offline resilience** — Core flows work offline or degrade gracefully.
  Network state changes handled without data loss.
```

---

## 十、实现阶段

```
Phase 1: Foundation (6 files)
  → mobile-coding.md + mobile-security-rules.md
  → constitution.md 追加
  → mcp-enable.json 新增 5 定义 + 6 映射

Phase 2: Agents & Skill (4 files)
  → 3 Agent 文件
  → 1 Skill 文件

Phase 3: Scene Workflows (6 files)
  → mobile-onboard.json (10 steps, 最简单)
  → mobile-e2e.json (8 steps)
  → mobile-review.json (11 steps)
  → mobile-optimize.json (12 steps)
  → mobile-audit.json (17 steps)
  → mobile-release.json (15 steps)

Phase 4: Commands (6 files)
  → 6 个 command .md 文件

Phase 5: Documentation (1 file)
  → workflows.md 追加 6 个移动端工作流
```

### 总文件数

| 类型 | 数量 |
|------|------|
| 新建 | **18 个** |
| 修改 | **3 个** |
| **合计** | **21 个** |

---

## 十一、验证清单

- [ ] 6 个 Scene JSON 语法有效（`node -e "JSON.parse(require('fs').readFileSync('x.json','utf8'))"`）
- [ ] 6 个 Command YAML frontmatter 有效
- [ ] 3 个 Agent YAML frontmatter 有效
- [ ] 1 个 Skill YAML frontmatter 有效
- [ ] mcp-enable.json scene_ids 与 JSON 文件名一致
- [ ] Command 文件名与 Scene scene_id 一致
- [ ] 无 `mobile-*` 命名与现有 30 个 Scene / 29 个 Command 冲突
- [ ] Token 预算：每个工作流 400-1800，5 个合计不超 5000 hard limit
- [ ] constitution.md Mobile Development Principles 不覆盖现有原则
