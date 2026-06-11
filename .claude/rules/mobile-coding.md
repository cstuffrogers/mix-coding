# 移动端编码规范

## 平台抽象

- Platform.OS 判断仅在平台适配层使用，不在业务逻辑中散落
- iOS 和 Android 行为差异必须文档化，接口层保持一致签名
- 平台差异通过共享接口隔离：`interface PlatformBridge { ... }`
- 条件文件（`.ios.ts` / `.android.ts`）优先于代码内 `Platform.OS` 判断

## 导航

- 不使用 `any` 类型导航参数，每个路由声明显式参数类型
- 深层链接必须验证参数完整性，不可信任外部传入的路由参数
- 返回栈始终保持可预测：不绕过导航器直接操作原生栈
- Tab 切换不丢失滚动位置和输入状态

## 性能

- 列表必须使用虚拟化组件（FlatList / FlashList / RecyclerView / ListView.builder）
- 图片必须指定尺寸（width/height），避免布局偏移和重排
- 动画使用原生驱动（useNativeDriver: true），避免 JS 线程阻塞
- 长列表渲染：getItemLayout 预定义高度，避免动态测量
- 大图列表使用懒加载和缩略图预加载

## 安全

- 🔴 敏感数据禁止存储在 AsyncStorage / SharedPreferences / UserDefaults 明文
- 🔴 API Key / Token 禁止硬编码在客户端代码中
- 🔴 生产构建必须启用代码混淆（ProGuard / R8 / Hermes）
- 🟡 SSL Pinning 必须在网络层启用，阻断中间人攻击
- 🟡 WebView JavaScript 桥接必须对注入内容做白名单校验
- 🟡 生物识别结果仅用于本地解锁，不可传输生物特征数据
- 🟡 Root/Jailbreak 检测：检测到设备越狱时降级功能但不拒绝服务

## 资源管理

- 图片必须提供多分辨率（1x/2x/3x），使用 WebP 格式优先
- 图标使用矢量格式（SVG/VectorDrawable），不按分辨率分别打包
- 字体文件不超过 2 个变体，按需子集化（仅包含使用到的字符）
- Bundle 大小：主包 < 2MB (RN) / 5MB (Flutter)，大资源走动态下发

## 兼容性

- 最低 iOS 版本：跟随 App Store 当前要求（通常最新-1 个大版本）
- 最低 Android API：24 (Android 7.0)，目标 API 为 Google Play 当前要求
- 屏幕尺寸适配：使用 flex/percentage 布局，不硬编码像素尺寸
- 权限申请遵循最小必要原则，权限用途说明对用户有实际价值

## 商店合规

- iOS：PrivacyInfo.xcprivacy 清单声明所有数据收集用途
- Android：通知渠道分类完整，前台服务类型声明准确
- 不使用非公开 API（iOS private API / Android @hide API）
- 应用内购买统一使用 StoreKit / Google Play Billing，不走第三方支付

---

> 标识说明：🔴 阻断级 | 🟡 警告级 | 🔧 可自动修复
