# Apple Design System

Marketing / product showcase aesthetic — minimal, premium, hero-driven.

## Visual Theme
Hero-driven, ultra-minimal, premium feel. Heavy use of large product photography, generous whitespace, sharp typography. Limited color palette, mostly black/white/gray with one accent per product. Hairline 1px borders.

## Color Palette
```css
:root {
  /* Backgrounds */
  --color-bg: oklch(100% 0 0);              /* #ffffff */
  --color-bg-elevated: oklch(99% 0 0);      /* #fbfbfd */
  --color-bg-dark: oklch(15% 0 0);          /* #1d1d1f — Apple dark gray */

  /* Text */
  --color-fg: oklch(15% 0 0);               /* #1d1d1f */
  --color-fg-muted: oklch(45% 0 0);         /* #6e6e73 */
  --color-fg-on-dark: oklch(95% 0 0);       /* #f5f5f7 */

  /* Accent — Apple's blue */
  --color-accent: oklch(58% 0.18 240);      /* #0071e3 */
  --color-accent-hover: oklch(53% 0.20 240);/* #0077ed */

  /* Borders */
  --color-border: oklch(88% 0 0);           /* #d2d2d7 */
  --color-border-muted: oklch(94% 0 0);     /* #f0f0f0 */

  /* Status */
  --color-success: oklch(60% 0.15 145);     /* #28a745 */
  --color-error: oklch(60% 0.20 25);        /* #d70015 */
}
```

## Typography
- **Display**: SF Pro Display, -apple-system, sans-serif
- **Body**: SF Pro Text, -apple-system, sans-serif
- **Mono**: SF Mono, monospace
- **Hero**: 96px, weight 600, letter-spacing -0.015em
- **H1**: 56px, weight 600
- **H2**: 40px, weight 500
- **H3**: 24px, weight 500
- **Body**: 17px, weight 400, line-height 1.47
- **Caption**: 14px, weight 400

## Spacing
8px base. Scale: 8, 16, 24, 32, 48, 64, 96, 128, 160, 200
Apple uses very generous spacing.

## Radius
- Buttons: 980px (pill-shaped!)
- Cards: 18px
- Image containers: 12px
- Modals: 14px

## Components

### Link (Apple-style)
```html
<a class="text-[#0071e3] hover:underline">Learn more ></a>
```

### Hero Section
```html
<section class="bg-white py-32 text-center">
  <h1 class="text-7xl font-semibold tracking-tight">iPhone 16 Pro</h1>
  <p class="text-2xl text-[#6e6e73] mt-3">Built for Apple Intelligence.</p>
  <div class="mt-8 flex gap-6 justify-center">
    <a class="text-[#0071e3] hover:underline">Learn more</a>
    <a class="text-[#0071e3] hover:underline">Buy ></a>
  </div>
</section>
```

## Do
- Use pill-shaped buttons (radius: 980px)
- Use very large hero text (56-96px)
- Use lots of whitespace
- Use SF Pro when possible, system-ui as fallback
- 1px hairline borders

## Don't
- No drop shadows on cards
- No small body text (<17px)
- No tight letter-spacing
- No more than 1 accent color
- No card-based layouts
