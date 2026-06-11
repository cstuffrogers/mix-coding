# Linear Design System

Issue tracking / SaaS tool aesthetic — dark UI, purple accents, ultra-precise typography.

## Visual Theme
Dense, precise, dark-mode-first. Designed for power users. Heavy use of purples (#5e6ad2) on dark surfaces. Sharp 4-8px radius. Subtle elevation through background layers, not shadows.

## Color Palette
```css
:root {
  /* Backgrounds (dark first) */
  --color-bg: oklch(20% 0.01 270);          /* #08090a — near black */
  --color-bg-elevated: oklch(23% 0.01 270); /* #1c1c1f */
  --color-bg-muted: oklch(26% 0.01 270);    /* #26262a */
  --color-bg-hover: oklch(30% 0.01 270);    /* #323237 */

  /* Text */
  --color-fg: oklch(98% 0 0);               /* #fbfbfb */
  --color-fg-muted: oklch(70% 0.01 270);    /* #b3b3b8 */
  --color-fg-subtle: oklch(50% 0.01 270);   /* #626269 */

  /* Accent — Linear's signature purple */
  --color-accent: oklch(57% 0.18 270);      /* #5e6ad2 */
  --color-accent-hover: oklch(62% 0.18 270);/* #7170ff */
  --color-accent-muted: oklch(30% 0.05 270);/* #2c2c4a */

  /* Borders */
  --color-border: oklch(28% 0.01 270);      /* #2b2b30 */
  --color-border-muted: oklch(24% 0.01 270);/* #1f1f23 */

  /* Status */
  --color-success: oklch(70% 0.15 145);     /* #4cb782 */
  --color-error: oklch(60% 0.20 25);        /* #eb5757 */
  --color-warning: oklch(75% 0.15 80);      /* #f2c94c */
  --color-info: oklch(70% 0.15 230);        /* #56a8f5 */
}
```

## Typography
- **Display**: Inter, -apple-system, sans-serif
- **Body**: Inter, -apple-system, sans-serif
- **Mono**: Berkeley Mono, JetBrains Mono, monospace
- **H1**: 32px, weight 600, letter-spacing -0.02em
- **H2**: 24px, weight 600
- **H3**: 18px, weight 500
- **Body**: 13px, weight 400, line-height 1.5
- **Caption**: 11px, weight 500, uppercase, letter-spacing 0.04em

## Spacing
4px base. Scale: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 64
Note: Linear uses 6/20 — denser than typical.

## Radius
- Buttons: 6px
- Cards: 8px
- Pills: 4px (small)
- Status badges: 4px

## Components

### Button (Primary)
```html
<button class="bg-[#5e6ad2] text-white px-3 py-1.5 rounded-md text-[13px] font-medium hover:bg-[#7170ff]">
  New Issue
</button>
```

### Status Badge
```html
<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#2c2c4a] text-[#8a8aff]">
  In Progress
</span>
```

## Do
- Default to dark mode
- Use purple (#5e6ad2) sparingly for CTAs
- Tight line-heights (1.4-1.5)
- Use status colors from the palette

## Don't
- No drop shadows
- No bright/bold colors outside the palette
- No large cards (>300px wide)
- No light mode by default
