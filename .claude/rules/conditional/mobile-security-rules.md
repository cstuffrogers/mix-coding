# OWASP MASVS 移动端安全规则对照

> OWASP Mobile Application Security Verification Standard v2.0
> Agent 自动加载，用于 mobsfscan/MobSF 结果对照和安全审查

---

## MASVS-STORAGE — 数据存储（🔴 Critical）

| # | 规则 | 验证方法 | 自动修复 |
|---|------|---------|---------|
| 1.1 | 敏感数据不入 SharedPreferences/AsyncStorage/UserDefaults 明文 | mobsfscan 扫描 `AsyncStorage.setItem` / `SharedPreferences.putString` | 🔧 标注 Keychain/EncryptedSharedPreferences 替代 |
| 1.2 | Keychain(iOS) / Keystore(Android) 存储令牌和密钥 | 检查 Keychain 使用 `kSecAttrAccessible` 参数 | — |
| 1.3 | 数据库使用 SQLCipher 或系统加密 | 检查 SQLite 创建时的加密标志 | — |
| 1.4 | 日志不输出敏感数据（NSLog/Logcat 不打印 token） | mobsfscan 扫描 `NSLog` / `Log.d` 含变量名(token/key/secret) | 🔧 自动替换为条件编译日志 |

## MASVS-CRYPTO — 加密（🔴 Critical）

| # | 规则 | 验证方法 | 自动修复 |
|---|------|---------|---------|
| 2.1 | 不使用自研加密算法 | 检查是否存在自定义 AES/CBC 实现 | 🔧 标注使用系统 KeyStore 替代 |
| 2.2 | 加密使用平台原生 API（CryptoKit / Android Keystore） | 检查 crypto 依赖库白名单 | — |
| 2.3 | 密钥不硬编码在代码中 | mobsfscan 检测 Base64 长字符串变量 | 🔧 自动标记并生成 .env 模板 |

## MASVS-NETWORK — 网络安全（🔴 Critical）

| # | 规则 | 验证方法 | 自动修复 |
|---|------|---------|---------|
| 3.1 | 所有网络请求使用 HTTPS | 检查 AndroidManifest cleartextTrafficPermitted / ATS 配置 | 🔧 自动修改配置 |
| 3.2 | SSL Pinning 已启用 | 检查 network_security_config.xml / Info.plist NSAppTransportSecurity | 🔧 生成 SSL Pinning 配置模板 |
| 3.3 | WebView 不信任用户安装的 CA 证书 | 检查 WebView onReceivedSslError 实现 | — |

## MASVS-AUTH — 认证（🟡 High）

| # | 规则 | 验证方法 | 自动修复 |
|---|------|---------|---------|
| 4.1 | Token 刷新机制完整：access token 过期 → refresh token 续期 | 检查 HTTP 拦截器 401 处理逻辑 | — |
| 4.2 | 生物识别仅本地验证，结果不上传服务器 | 检查 BiometricPrompt / LAContext 回调数据流向 | — |
| 4.3 | 会话超时后清除内存中的敏感数据 | 检查 onTimeout 回调是否调用 wipe() | — |

## MASVS-CODE — 代码质量（🟡 High）

| # | 规则 | 验证方法 | 自动修复 |
|---|------|---------|---------|
| 5.1 | Release build 启用代码混淆（ProGuard/R8/Hermes） | 检查 build.gradle minifyEnabled / proguard-rules.pro | 🔧 自动启用 minifyEnabled |
| 5.2 | WebView JavaScript 默认禁用，按需开启 | 检查 WebView.setJavaScriptEnabled 调用点 | 🔧 若无条件开启则标记 |
| 5.3 | 不使用动态代码加载（DexClassLoader/excuteJavaScript） | mobsfscan 扫描 ClassLoader/JS 动态执行 | — |

## MASVS-RESILIENCE — 防篡改（🟡 Medium）

| # | 规则 | 验证方法 | 自动修复 |
|---|------|---------|---------|
| 6.1 | Root/Jailbreak 检测 | 检查是否存在 RootBeer / DTTJailbreakDetection 调用 | — |
| 6.2 | 模拟器检测（发布版本） | 检查 Build.TAGS / isSimulator 检测逻辑 | — |
| 6.3 | 签名校验（防二次打包） | 检查 APK 签名校验实现 | — |

---

## 安全等级定义

| 等级 | 适用场景 | 覆盖规则 |
|------|---------|---------|
| **L1** | 标准安全需求（非敏感 App） | STORAGE-1.1~1.2, NETWORK-3.1, CODE-5.1~5.2 |
| **L2** | 高安全需求（金融/医疗/政务） | 全部 18 条规则 + 附加运行时完整性 |
| **R** | 防篡改需求（DRM/版权保护） | L2 + RESILIENCE 全量 |

---

> 标识说明：🔴 阻断级 | 🟡 警告级 | 🔧 可自动修复
