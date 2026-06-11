# Vercel Design System

Modern SaaS dashboard aesthetic — black/white, sharp typography, subtle gradients.

## Visual Theme
Airy, minimal, premium. Designed to let content breathe. Heavy use of monochrome with strategic accent moments. Sharp 6-12px border radius. Subtle borders (1px) preferred over shadows.

## Color Palette
```css
:root {
  /* Backgrounds */
  --color-bg: oklch(100% 0 0);              /* #ffffff */
  --color-bg-elevated: oklch(98.5% 0 0);    /* #fafafa */
  --color-bg-muted: oklch(96% 0 0);         /* #f4f4f5 */
  --color-bg-inverse: oklch(15% 0 0);       /* #18181b */

  /* Text */
  --color-fg: oklch(15% 0 0);               /* #18181b */
  --color-fg-muted: oklch(45% 0 0);         /* #71717a */
  --color-fg-subtle: oklch(60% 0 0);        /* #a1a1aa */
  --color-fg-inverse: oklch(100% 0 0);      /* #ffffff */

  /* Accent */
  --color-accent: oklch(0% 0 0);            /* #000000 — Vercel black */
  --color-accent-hover: oklch(20% 0 0);     /* #333333 */

  /* Borders */
  --color-border: oklch(92% 0 0);           /* #e4e4e7 */
  --color-border-muted: oklch(95% 0 0);     /* #f4f4f5 */

  /* States */
  --color-success: oklch(65% 0.18 145);     /* #00aa55 */
  --color-error: oklch(60% 0.22 25);        /* #e11d48 */
  --color-warning: oklch(75% 0.15 80);      /* #f59e0b */
}
```

## Typography
- **Display**: Geist Sans, -apple-system, sans-serif
- **Body**: Geist Sans, -apple-system, sans-serif
- **Mono**: Geist Mono, ui-monospace, monospace
- **Hero**: 60px / 64px, font-weight 600, letter-spacing -0.02em
- **H1**: 36px, weight 600
- **H2**: 24px, weight 600
- **H3**: 18px, weight 500
- **Body**: 14px, weight 400, line-height 1.6
- **Caption**: 12px, weight 400

## Spacing
4px base. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96

## Radius
- Buttons: 6px
- Cards: 8px
- Modals: 12px
- Pills: 9999px (full)

## Components

### Buttons
```html
<button class="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-900">
  Deploy
</button>
```

### Cards
```html
<div class="border border-gray-200 rounded-lg p-6 bg-white">
  <h3>Card Title</h3>
  <p class="text-gray-600">Description</p>
</div>
```

## Do
- Use 1px borders instead of shadows
- Keep accent moments monochrome
- Use Geist Sans / Geist Mono

## Don't
- No purple/pink gradients
- No colorful buttons except pure black
- No emoji as icons
- No fabricated stats
