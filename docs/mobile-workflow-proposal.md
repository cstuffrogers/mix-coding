# 移动端开发方案工作流 — 双方案对比

> 基于「AI辅助Web与移动端开发完整问题清单.md」缺口分析，移动端是系统最大盲区（覆盖度仅 5%）。
> 本文档提出两种方案：**最小改动方案**（低成本渐进式）和**全栈移动端方案**（效果最佳最全）。

---

## 目录

1. [现状回顾](#现状回顾)
2. [方案一：渐进式集成（最小改动）](#方案一渐进式集成最小改动)
3. [方案二：全栈移动端方案（效果最佳）](#方案二全栈移动端方案效果最佳)
4. [对比矩阵](#对比矩阵)
5. [推荐路径](#推荐路径)

---

## 现状回顾

### 已有能力（不可破坏）

| 层级 | 组件 | 移动端相关度 |
|------|------|------------|
| 交互层 | 27 个 Scene 工作流 + CLI 脚本 | 0% — 全部 Web 优先 |
| 能力层 | Memory / Design / Review / Test Engine / Notification | 0% — 无移动端 Service |
| 运行时层 | MCP Servers（12 个）、Hooks、Child Process | Playwright 移动端 Web 模拟可用，其他无 |
| 审查管线 | ESLint → react-doctor → Playwright → AI 语义 → 聚合 | 仅 React Web |
| Agent | PM / Architect / UX / Code-Reviewer / Constitutional-Validator | 全部 Web 视角 |
| Skill | Impeccable / Huashu / a11y / sec-bug-hunt / api-contract-check | 仅 sec-bug-hunt 部分相关 |
| MCP | a11y / playwright / schemaforge / codegraph / github / sentry | 无移动端 MCP |

### 缺口总量（按之前分析）

```
第4章  移动端开发      28项 iOS + 14项 Android + 10项 跨平台 + 24项 通用 = 76项  → 覆盖 5%
第7.2  移动端安全      15项                                                    → 覆盖 0%
第8.3  移动端性能      12项                                                    → 覆盖 0%
第9.1  移动端测试      专项                                                    → 覆盖 0%
第10.2 移动端发布      9项                                                     → 覆盖 0%
```

---

## 方案一：渐进式集成（最小改动）

### 设计原则

**不改现有工作流结构，在现有流程中插入条件性的移动端检测步骤。**

核心思路：把"移动端"当作类似 a11y、i18n 的**可选增强项**，检测到移动端项目时自动启用相关步骤，Web 项目完全不受影响。

### 架构变更：仅 3 处新增

```
                         现有系统                          │    新增（3 处）
  ────────────────────────────────────────────────────────┼───────────────────
  交互层  27 个 Scene                                   │  +1 个 Scene
  能力层  Memory / Design / Review / Test / Notify       │  +1 个 Service
  运行时  MCP × 12                                       │  +3 个 MCP
```

### 具体改动

#### 1. 新增 1 个 Scene：`mobile-check.json`

一个**聚合型检查工作流**，不替代现有工作流，而是作为 `/review`、`/audit`、`/release` 的**可选增强**被调用。

```
/mobile-check
├── 步骤1: 项目检测（RN / Expo / Flutter / 小程序 / 原生？）
├── 步骤2: 移动端安全扫描 → MobSF REST API
├── 步骤3: 移动端性能基线 → 包体积 / 启动时间 / 内存
├── 步骤4: 跨平台 API 契约检查 → Spectral ruleset (mobile)
├── 步骤5: 应用商店合规检查清单 → OWASP MASVS 对照
└── 步骤6: 报告汇总 → 注入到调用方的工作流结果中
```

**CLI 调用**：`/mobile-check`（独立）或被其他工作流 `step` 引用。

#### 2. 新增 3 个 MCP Server 定义

在 `.claude/mcp-enable.json` 的 `server_definitions` 中添加：

| MCP Server | 来源 | 用途 | Token 估算 |
|-----------|------|------|-----------|
| `mobsf` | MobSF REST API 封装 | 移动端静态+动态安全分析 | 600 |
| `maestro` | `mobile-dev-inc/maestro-mcp`（已有 MCP） | 跨平台移动 UI 自动化 | 500 |
| `spectral` | Stoplight Spectral CLI | OpenAPI + 移动端 API 规范校验 | 300 |

> 三个 MCP 均按 `"enabled_by_default": false` 配置，仅 `mobile-check` 场景启用。

#### 3. 新增 1 个能力层 Service：`MobileService`

```typescript
interface MobileService {
  detectProjectType(): Promise<'rn' | 'expo' | 'flutter' | 'miniapp' | 'native-ios' | 'native-android' | null>;
  checkSecurity(params: { apkPath?: string; ipaPath?: string; sourcePath: string }): Promise<SecurityReport>;
  measurePerformance(params: { platform: string }): Promise<PerfBaseline>;
  checkStoreCompliance(params: { platform: string; store: 'apple' | 'google' | 'wechat' }): Promise<ComplianceReport>;
}
```

#### 4. 修改 4 个现有 Scene（各加 1 个条件步骤）

在每个现有场景的 `flow` 数组末尾（remember 步骤之前）插入一个条件步骤：

**`/audit`（audit.json）**：

```json
{
  "step": "1.5",
  "layer": "capability",
  "service": "MobileService",
  "action": "auditMobile",
  "params": {},
  "description": "检测移动端项目→执行安全+性能+合规检查",
  "auto_execute": true,
  "condition": "mobileProjectDetected",
  "on_error": "continue"
}
```

**`/review`（review.json）**：

```json
{
  "step": "4.2",
  "layer": "capability",
  "service": "MobileService",
  "action": "reviewMobile",
  "params": { "scope": "current_diffs" },
  "description": "移动端代码审查：RN组件/Hook/Navigation/原生模块兼容性",
  "auto_execute": true,
  "condition": "mobileProjectDetected",
  "on_error": "continue"
}
```

**`/hunt`（hunt.json）**：

```json
{
  "step": "3.5",
  "layer": "capability",
  "service": "MobileService",
  "action": "scanMobileSecurity",
  "params": { "mobsf_endpoint": "$MOBSF_URL" },
  "description": "MobSF 移动端安全扫描（硬编码密钥/SSL Pinning/代码混淆/Root检测）",
  "auto_execute": true,
  "condition": "mobileProjectDetected && mobsf_available",
  "on_error": "continue",
  "timeout": 600
}
```

**`/release`（release.json）**：

```json
{
  "step": "2.5",
  "layer": "capability",
  "service": "MobileService",
  "action": "checkStoreReadiness",
  "params": {},
  "description": "应用商店发布前检查：签名/证书/隐私标签/测试账号/截图",
  "auto_execute": true,
  "condition": "mobileProjectDetected",
  "on_error": "abort"
}
```

#### 5. 更新 `mcp-enable.json` 映射

```json
{
  "mobile-check": {
    "enabled_servers": ["mobsf", "maestro", "spectral", "github"],
    "token_estimate": 1600,
    "rationale": "移动端全维度检查：安全+性能+UI自动化+API规范"
  }
}
```

同时更新 `audit`/`review`/`hunt`/`release` 的 `enabled_servers` 数组，追加条件项（运行时按 `mobileProjectDetected` 判断是否实际启用）。

### 改动汇总

| 改动类型 | 数量 | 文件 |
|---------|------|------|
| 新增 Scene | 1 个 | `.claude/scenes/mobile-check.json` |
| 新增 Command | 1 个 | `.claude/commands/mobile-check.md` |
| 新增 MCP 定义 | 3 个 | `.claude/mcp-enable.json`（server_definitions） |
| 新增 Service | 1 个 | `ARCHITECTURE.md` 中 MobileService 接口定义 |
| 修改 Scene | 4 个 | `audit.json` / `review.json` / `hunt.json` / `release.json`（各 +1 step） |
| 修改 MCP 映射 | 5 条 | `.claude/mcp-enable.json`（新增 mobile-check + 更新 4 个） |
| **现有 27 个工作流影响** | **0 个** | 条件步骤仅在检测到移动端项目时执行 |

### 覆盖提升预估

```
第4章  移动端开发      5% → 25%  （通用安全+性能+API 规范，不含平台细节）
第7.2  移动端安全       0% → 45%  （MobSF 覆盖静态分析，不含动态/反调试）
第8.3  移动端性能       0% → 30%  （包体积+启动时间基线，不含发热/电池）
第10.2 移动端发布       0% → 35%  （应用商店检查清单，不含热修复/签名管理）
```

---

## 方案二：全栈移动端方案（效果最佳）

### 设计原则

**移动端作为一等公民，拥有完整的独立工作流体系，与 Web 工作流对等。**

核心思路：构建 **6 个专项工作流 + 3 个新 Agent + 1 套宪法规则 + 7 个新 MCP**，实现与 Web 端对等的移动端开发全生命周期支撑。

### 架构变更：完整移动端子系统

```
                         现有系统                          │    新增移动端子系统
  ────────────────────────────────────────────────────────┼─────────────────────────────
  交互层  27 个 Scene                                   │  +6 个 Scene
          27 个 Command                                │  +6 个 Command
  能力层  Memory / Design / Review / Test / Notify       │  +1 个 MobileService
                                                         │  MobileService 含 6 个 action
  Agent   PM / Architect / UX / Code-Reviewer / Const.   │  +3 个 Agent（移动端审查/安全/性能）
  运行时  MCP × 12                                       │  +7 个 MCP
  Skill   Impeccable / Huashu / a11y / sec-bug-hunt ...  │  +2 个 Skill（移动端UI/移动端安全）
  宪法    constitution.md                                │  +1 节移动端规则
  Rules   coding.md / karpathy-principles.md ...        │  +1 个 mobile-coding.md
```

### 新增 6 个 Scene 工作流

#### 1. `/mobile-audit` — 移动端全维度审计

22 步，对标 `/audit`。

```
阶段1: 项目识别
  → 检测平台（RN/Expo/Flutter/小程序/原生）
  → 检测导航库、状态管理库、原生模块依赖

阶段2: 安全扫描
  → MobSF 静态分析（APK/IPA）
  → mobsfscan 源码规则扫描（硬编码密钥/不安全存储/弱加密）
  → OWASP MASVS 对照检查（L1/L2/R 三级）

阶段3: 性能基线
  → 包体积分析（主包/分包/资源占比）
  → 冷启动时间基线
  → 内存占用基线
  → 帧率/FPS 基线

阶段4: 代码质量
  → ESLint/TS 基础检查
  → RN/Flutter 专项规则（组件粒度/导航栈/Platform.OS 散落）
  → 原生模块兼容性检查（iOS/Android 行为一致性）

阶段5: 合规审查
  → 应用商店审核清单（Apple/Google/微信）
  → 隐私标签对照
  → 权限申请理由审查（最小必要原则）

阶段6: 质量门禁
  → 阻断级：CRITICAL/HIGH 安全问题
  → 警告级：性能基线超标
  → 建议级：代码组织优化
```

#### 2. `/mobile-review` — 移动端代码审查

对标 `/review`，5 层审查管线：

| 层 | 工具 | 检查内容 |
|----|------|---------|
| L1 | ESLint + RN/Flutter rules | 语法、样式、平台 API 误用 |
| L2 | mobsfscan | 代码层安全（硬编码、不安全存储、弱加密） |
| L3 | Maestro | UI 自动化测试（关键流程截图对比） |
| L4 | AI 语义审查 | 导航栈合理性、状态管理、内存泄漏风险 |
| L5 | 聚合报告 | 去重、按严重度排序、修复建议 |

#### 3. `/mobile-release` — 移动端发布流程

对标 `/release`，19 步。

```
阶段1: 质量门禁
  → 安全扫描通过（无 CRITICAL/HIGH）
  → 性能基线达标（包体积 < 限值、启动时间 < 3s）
  → 测试通过（单元+E2E）

阶段2: 平台准备
  iOS:
    → 证书/Profile 有效性检查
    → 隐私标签更新
    → Info.plist 权限描述审查
    → TestFlight 测试账号准备
  Android:
    → 签名密钥检查
    → AAB 构建验证
    → 多渠道配置检查
    → 通知渠道分类审查

阶段3: 构建 & 签名
  → iOS: xcodebuild archive → IPA
  → Android: ./gradlew bundleRelease → AAB
  → 小程序: 上传代码 → 体验版

阶段4: 发布
  → TestFlight / Google Play Internal Testing
  → 灰度比例配置
  → 强制更新策略审查（版本兼容矩阵）
  → 热更新合规验证（iOS 无原生逻辑热更）

阶段5: 监控
  → Firebase Crashlytics / Bugly 崩溃上报验证
  → 推送到达率测试
  → 应用商店审核状态追踪
```

#### 4. `/mobile-optimize` — 移动端性能优化

对标 `/optimize`，14 步。

```
阶段1: 测量基线
  → 包体积：主包/分包/资源占比
  → 启动：冷/温/热启动时间
  → 内存：前台/后台内存占用
  → 帧率：滑动列表/动画场景 FPS
  → 网络：API 响应时间 + 流量消耗

阶段2: 瓶颈定位
  → 图片：未压缩/未 WebP/未按分辨率采样
  → 依赖：重复依赖/未 tree-shake
  → 渲染：离屏渲染/过度绘制/图层爆炸
  → 主线程：长任务/ANR 风险
  → 电池：后台定位/网络轮询/WakeLock

阶段3: 优化执行
  → 图片 → WebP + 多分辨率
  → 依赖 → 按需加载 + 动态功能模块
  → 渲染 → FlatList/VirtualScroll + 图层合并
  → 主线程 → Worker/异步化
  → 电池 → 后台任务合并 + 低电量模式适配

阶段4: 验证
  → 优化后基线对比
  → 回归测试
  → 低端设备验证
```

#### 5. `/mobile-e2e` — 移动端 E2E 测试配置

对标 `/e2e`，8 步。

```
→ 检测项目类型 → 选择测试框架
  RN: Detox
  Flutter: Patrol / integration_test
  小程序: miniprogram-automator
  通用: Maestro（跨平台 UI 自动化）
→ 生成测试配置 + 示例用例
→ CI 集成（GitHub Actions Maestro/Detox runner）
```

#### 6. `/mobile-onboard` — 移动端开发环境搭建

对标 `/onboard`，14 步。

```
→ Xcode / Android Studio 检测 & 安装指引
→ Node.js / Ruby / CocoaPods / JDK 版本检查
→ 模拟器/真机调试配置
→ 签名证书生成（开发环境）
→ .env 配置（API地址/推送证书/地图Key）
→ 首次构建验证
```

### 新增 3 个 Agent

| Agent | 职责 | 调用时机 |
|-------|------|---------|
| **mobile-reviewer** | RN/Flutter 代码质量、导航栈、Platform.OS 散落、原生模块兼容性 | `/mobile-review` |
| **mobile-security** | OWASP MASVS 对照、MobSF 结果解读、应用商店审核要求 | `/mobile-audit`、`/mobile-release` |
| **mobile-perf** | 包体积、启动时间、帧率、内存、电池基线评估 | `/mobile-optimize` |

### 新增 7 个 MCP Server

| # | MCP Server | 来源 | 用途 | Token |
|---|-----------|------|------|-------|
| 1 | `mobsf` | `MobSF/Mobile-Security-Framework-MobSF` (21k★) | 移动端安全扫描 | 600 |
| 2 | `maestro` | `mobile-dev-inc/maestro-mcp` (已适配) | 跨平台 UI 自动化 | 500 |
| 3 | `spectral` | `stoplightio/spectral` (2.5k★) | API 规范校验 | 300 |
| 4 | `detox` | `wix/Detox` (11.7k★) | RN E2E 测试 CLI | 400 |
| 5 | `bearer` | `Bearer/bearer` (1.8k★) | 隐私合规扫描（PII/GDPR） | 400 |
| 6 | `promptfoo` | `promptfoo/promptfoo` (21.9k★) | LLM 输出质量测试 | 500 |
| 7 | `toxiproxy` | `Shopify/toxiproxy` (10.8k★) | 网络故障注入（弱网测试） | 300 |

### 新增 2 个 Skill

| Skill | 内容 | 来源 |
|-------|------|------|
| `mobile-ui-review` | 移动端 UI 审查：安全区域/刘海/键盘遮挡/触控区域/手势 | Impeccable 扩展 |
| `mobile-sec-guide` | OWASP MASVS/MSTG 规则集 + 应用商店审核最新要求 | 新编写 |

### 宪法补充（constitution.md）

```markdown
## Mobile Development Principles

- **Platform parity** — iOS and Android behavior must be consistent. Platform-specific
  code isolated behind a shared interface. No scattered `Platform.OS` checks.
- **Security by default** — SSL Pinning on, code obfuscation enabled, no hardcoded keys.
  All network requests use HTTPS. Sensitive data in Keychain/Keystore, never AsyncStorage.
- **Performance budget** — Cold start < 3s, main bundle < 2MB (RN) / 5MB (Flutter),
  list rendering at 60fps. Every image optimized (WebP, multiple resolutions).
- **Store compliance** — Privacy manifest (iOS), notification channels (Android),
  permission rationale strings. No unnecessary permissions.
- **Offline resilience** — Core flows work offline or degrade gracefully.
  Network state changes handled without data loss.
```

### 新增 mobile-coding.md 规范

```markdown
# 移动端编码规范

## 平台抽象
- Platform.OS 判断仅在平台适配层使用
- iOS 和 Android 行为差异必须文档化

## 导航
- 不使用 any 类型导航参数
- 深层链接必须验证参数

## 性能
- 列表必须使用虚拟化（FlatList/RecyclerView）
- 图片必须指定尺寸，避免布局偏移
- 动画使用原生驱动（useNativeDriver: true）

## 安全
- 敏感数据禁止存储在 AsyncStorage/SharedPreferences
- API Key 禁止硬编码在客户端
- 生产构建必须启用代码混淆
```

### 改动汇总

| 改动类型 | 数量 | 详情 |
|---------|------|------|
| 新增 Scene | 6 个 | mobile-audit / mobile-review / mobile-release / mobile-optimize / mobile-e2e / mobile-onboard |
| 新增 Command | 6 个 | 对应 6 个 `/mobile-*` 命令 |
| 新增 MCP 定义 | 7 个 | mobsf / maestro / spectral / detox / bearer / promptfoo / toxiproxy |
| 新增 Service | 1 个 | MobileService（含 detect / audit / review / release / optimize / e2e / onboard 7 个 action） |
| 新增 Agent | 3 个 | mobile-reviewer / mobile-security / mobile-perf |
| 新增 Skill | 2 个 | mobile-ui-review / mobile-sec-guide |
| 新增 Rules | 1 个 | mobile-coding.md |
| 修改 constitution.md | 1 处 | 新增 Mobile Development Principles 章节 |
| 更新 mcp-enable.json | 6 条 | 新增 6 个场景的 MCP 映射 |
| 更新 CLAUDE.md | 1 处 | 速查表新增 6 个指令 |
| 更新 workflows.md | 1 处 | 触发词+自然语言映射 |
| **现有 27 个工作流影响** | **0 个** | 独立新增，不修改现有文件 |

### 覆盖提升预估

```
第4章  移动端开发       5% → 75%  （iOS 14项/Android 14项/跨平台 10项/通用 24项 大部分覆盖）
第7.2  移动端安全        0% → 80%  （MobSF static + mobsfscan + OWASP MASVS 对照）
第8.3  移动端性能        0% → 70%  （包体积/启动/内存/FPS/电池/流量 全基线）
第9.1  移动端测试专项    0% → 65%  （E2E + 安全 + 性能 + UI 自动化）
第10.2 移动端发布        0% → 75%  （iOS/Android/小程序 全平台发布流程）
第7.3  合规与隐私        0% → 50%  （Bearer CLI 扫描 PII + 应用商店合规检查清单）
第12.1 AI工具链特有风险 35% → 55%  （promptfoo 集成，LLM 输出质量可测）
```

---

## 对比矩阵

| 维度 | 方案一（渐进式） | 方案二（全栈） |
|------|----------------|---------------|
| **覆盖度提升** | 5% → 25-45% | 5% → 65-80% |
| **新增 Scene** | 1 个 | 6 个 |
| **新增 Command** | 1 个 | 6 个 |
| **新增 MCP** | 3 个 | 7 个 |
| **新增 Agent** | 0 个 | 3 个 |
| **新增 Skill** | 0 个 | 2 个 |
| **新增 Rules** | 0 个 | 1 个 |
| **修改现有 Scene** | 4 个（各 +1 step） | 0 个 |
| **修改现有文件** | 6 个 | 3 个（CLAUDE.md / constitution.md / workflows.md） |
| **现有工作流受影响** | 0（条件步骤，Web 项目不变） | 0（完全独立新增） |
| **总改动量** | ~12 文件 / ~300 行 | ~28 文件 / ~2000 行 |
| **新增 Token 预算** | +1,600 per workflow | +每场景 1,400-2,000 |
| **iOS 原生支持** | ❌ | ⚠️ 基础（商店检查+安全扫描） |
| **Android 原生支持** | ❌ | ⚠️ 基础（商店检查+安全扫描） |
| **RN/Expo 支持** | ⚠️ 检测+基础审查 | ✅ 深度（审查+发布+性能+E2E） |
| **Flutter 支持** | ❌ | ⚠️ 基础（审查+优化） |
| **小程序支持** | ❌ | ⚠️ 基础（E2E+发布流程） |
| **独立审查管线** | ❌（复用 Web 管线） | ✅ 5 层移动端管线 |
| **独立发布流程** | ❌（复用 Web 流程） | ✅ 3 平台完整发布 |
| **独立性能基线** | ❌ | ✅ 包体积/启动/帧率/电池 |
| **隐私合规** | ❌ | ✅ Bearer CLI 扫描 |
| **混沌工程** | ❌ | ✅ Toxiproxy 弱网测试 |
| **LLM 质量测试** | ❌ | ✅ promptfoo 集成 |
| **实现周期** | 1-2 天 | 1-2 周 |
| **维护成本** | 低（条件步骤，不过期即无效） | 中（6 个独立工作流需持续更新） |
| **扩展风险** | 低（渐进式，可随时停止） | 中（全栈方案，部分平台可能用不上） |

---

## 推荐路径

### 建议：先方案一，验证后升级到方案二

```
阶段1（立即）→ 方案一，约 1-2 天
  目标：让现有 /audit /review /hunt /release 能识别移动端项目并给出基本检查
  产出：mobile-check.json + MobileService + 3 MCP + 4 个条件步骤

阶段2（1 周后）→ 方案二中 RN/Expo 专项
  选择最成熟的 2 个工作流：/mobile-review + /mobile-release
  原因：RN/Expo 与现有 Web 技术栈重叠最大，复用度最高

阶段3（2 周后）→ 根据实际使用反馈决定
  高需求 → 补齐 mobile-optimize / mobile-e2e / mobile-onboard
  低需求 → 保持阶段2，不再追加

阶段4（按需）→ Flutter / 小程序专项
  只有实际项目需要时才建设，避免过度投资
```

### 第一个里程碑

**先实现方案一的 `mobile-check.json` + 4 个条件步骤**，跑通以下最小闭环：

> 用户对 RN 项目运行 `/audit` → 自动检测到移动端 → 执行 MobSF 安全扫描 → 输出移动端安全+性能基线报告 → 合并到审计总报告中

如果这个闭环验证有效，再逐步扩展到方案二的独立工作流体系。
