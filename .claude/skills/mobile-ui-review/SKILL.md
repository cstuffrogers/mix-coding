---
name: mobile-ui-review
description: >
  Mobile UI review for AI agents — safe area, notch, keyboard avoidance, touch
  targets (≥44pt), gesture conflicts, loading states. Use when reviewing mobile
  UI code in RN/Flutter/native projects.
user-invocable: false
---

# Mobile UI Review

## Check Dimensions

### Safe Area / Notch
- Content not obscured by status bar, notch, or home indicator
- `SafeAreaView` (RN) / `SafeArea` (Flutter) wrapping top-level screen
- Bottom safe area respects home indicator (no fixed bottom: 0)
- Landscape notch handling verified (both left and right sides)

### Keyboard Avoidance
- `KeyboardAvoidingView` (RN) / `resizeToAvoidBottomInset` (Flutter) configured
- Focused input always visible above keyboard
- Keyboard dismiss on scroll or tap outside
- No layout jump on keyboard show/hide animation

### Touch Targets
- All interactive elements ≥ 44pt × 44pt (iOS HIG)
- Buttons, icons, links, checkboxes individually verifiable
- Touch target with padding, not stretched content
- Minimum spacing between touchable elements ≥ 8pt

### Gestures
- No conflicting gesture recognizers on same view
- Swipe-back (iOS) not overridden without clear affordance
- Double-tap zoom on images with sufficient resolution
- Pull-to-refresh present on scrollable lists
- Long-press actions have visual feedback (haptic + color)

### Loading States
- Skeleton screens or loading indicators during network requests
- Timeout UI after 10s without response
- Error state distinct from empty state (different message + action)
- Pull-to-refresh shows progress indicator

### Orientation
- Portrait and landscape layouts both functional (no crash)
- Orientation change preserves scroll position
- Keyboard state preserved across rotation
- Modal/popup correctly positioned after rotation

### Color & Contrast
- Text/background contrast ≥ 4.5:1 (normal), ≥ 3:1 (large text ≥ 18pt bold / 24pt)
- Non-text UI elements have ≥ 3:1 contrast against adjacent colors
- Information not conveyed by color alone (icons/labels alongside color)

## Report Format

```
📐 移动端 UI 审查

🔴 阻断
  - [安全区域] 首页底部按钮被 Home Indicator 遮挡 (HomeScreen.tsx:45)

🟡 建议
  - [触控] 关闭按钮实际触控区域 32×32pt，不满足 44pt 最小标准
  - [对比度] 灰色提示文字 #999 在白色背景上对比度 2.8:1，不达标

✅ 通过
  - 键盘避让 ✓
  - 加载态 ✓
  - 横竖屏 ✓
```
