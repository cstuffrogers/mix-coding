# 视觉回归差异阈值标准

## Playwright toHaveScreenshot 配置
- maxDiffPixels: 50
- threshold: 0.2
- animations: disabled
- 基线目录：.visual-baselines/playwright/

## 视口标准
- desktop: 1440×900
- tablet: 768×1024
- mobile: 375×812

## 动态内容屏蔽
- 时间戳
- 随机头像
- 广告位
使用 mask 参数屏蔽这些区域。