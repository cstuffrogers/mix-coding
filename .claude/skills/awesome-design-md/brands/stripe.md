# Stripe Design System

Fintech / payment dashboard aesthetic — gradients, indigo accents, professional.

## Visual Theme
Professional, trustworthy, slightly playful. Heavy use of indigo/purple gradients on hero sections. Crisp typography. Generous whitespace. Rounded corners (8-12px). High-contrast CTAs.

## Color Palette
```css
:root {
  /* Backgrounds */
  --color-bg: oklch(100% 0 0);              /* #ffffff */
  --color-bg-elevated: oklch(99% 0 0);      /* #f6f9fc */
  --color-bg-muted: oklch(96% 0.01 250);    /* #ebeef1 */

  /* Text */
  --color-fg: oklch(20% 0.04 280);          /* #1a1f36 — Stripe indigo-black */
  --color-fg-muted: oklch(45% 0.04 280);    /* #525f7f */
  --color-fg-subtle: oklch(60% 0.04 280);   /* #8492a6 */

  /* Accent — Stripe indigo */
  --color-accent: oklch(50% 0.20 270);      /* #635bff */
  --color-accent-hover: oklch(45% 0.22 270);/* #5247db */
  --color-accent-muted: oklch(95% 0.04 270);/* #ebe9ff */

  /* Borders */
  --color-border: oklch(92% 0.01 250);      /* #e3e8ee */
  --color-border-muted: oklch(95% 0.01 250);/* #f0f2f5 */

  /* Status */
  --color-success: oklch(60% 0.18 145);     /* #1aab7a */
  --color-error: oklch(60% 0.22 25);        /* #e25950 */
  --color-warning: oklch(80% 0.15 80);      /* #f5b14c */
  --color-info: oklch(70% 0.15 220);        /* #3aa6ff */
}
```

## Typography
- **Display**: Camphor, -apple-system, sans-serif (fallback: Inter)
- **Body**: Camphor, -apple-system, sans-serif
- **Mono**: Source Code Pro, monospace
- **Hero**: 56px / 64px, weight 500, letter-spacing -0.02em
- **H1**: 40px, weight 500
- **H2**: 28px, weight 500
- **H3**: 20px, weight 500
- **Body**: 16px, weight 400, line-height 1.6
- **Caption**: 14px, weight 400

## Spacing
4px base. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128

## Radius
- Buttons: 6px
- Cards: 8px
- Modals: 12px
- Pills: 9999px

## Components

### Button (Primary)
```html
<button class="bg-[#635bff] text-white px-5 py-3 rounded-md font-medium hover:bg-[#5247db]">
  Start now
</button>
```

### Gradient Hero
```html
<div class="bg-gradient-to-br from-[#635bff] to-[#a594f9] text-white py-24">
  Hero Content
</div>
```

## Do
- Use indigo (#635bff) as primary CTA
- Generous padding (24-32px on cards)
- Subtle shadows OK (0 1px 3px rgba(0,0,0,0.06))
- 16px+ body text for readability

## Don't
- No purple-pink gradient on every hero
- No emoji as icons
- No fabricated customer logos
- No card-based layout for every section
