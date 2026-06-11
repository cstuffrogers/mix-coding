# Notion Design System

Knowledge base / content collaboration aesthetic — clean, generous, document-first.

## Visual Theme
Document-first, generous whitespace, soft shadows, hand-drawn feel. Designed to make writing and reading feel natural. Warm grays, accent colors used sparingly. Large body text for readability.

## Color Palette
```css
:root {
  /* Backgrounds */
  --color-bg: oklch(100% 0 0);              /* #ffffff */
  --color-bg-elevated: oklch(98% 0 0);      /* #f7f6f3 — warm paper */
  --color-bg-hover: oklch(95% 0.01 80);     /* #f1f1ef */
  --color-bg-sidebar: oklch(96% 0.005 80);  /* #f7f6f3 */

  /* Text */
  --color-fg: oklch(20% 0.005 80);          /* #37352f — Notion ink */
  --color-fg-muted: oklch(50% 0.005 80);    /* #787774 */
  --color-fg-subtle: oklch(70% 0.005 80);   /* #9b9a97 */

  /* Accent — Notion's full palette */
  --color-blue: oklch(70% 0.10 240);        /* #2383e2 */
  --color-purple: oklch(60% 0.13 290);      /* #9065e0 */
  --color-pink: oklch(70% 0.13 0);          /* #d44c8f */
  --color-red: oklch(60% 0.18 25);          /* #e03e3e */
  --color-orange: oklch(70% 0.13 50);       /* #d9730d */
  --color-yellow: oklch(80% 0.13 90);       /* #dfab01 */
  --color-green: oklch(60% 0.13 145);       /* #0f7b6c */
  --color-gray: oklch(50% 0.005 80);        /* #787774 */

  /* Borders */
  --color-border: oklch(90% 0.005 80);      /* #e8e7e3 */
  --color-border-muted: oklch(94% 0.005 80);/* #f1f1ef */
}
```

## Typography
- **Display**: ui-sans-serif, -apple-system, sans-serif
- **Body**: ui-sans-serif, -apple-system, sans-serif
- **Mono**: ui-monospace, monospace
- **Hero**: 40px, weight 700, line-height 1.2
- **H1**: 30px, weight 700
- **H2**: 24px, weight 600
- **H3**: 20px, weight 500
- **Body**: 16px, weight 400, line-height 1.5
- **Caption**: 14px, weight 400

## Spacing
4px base. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 60, 80
Notion prefers 20-32px for content padding.

## Radius
- Buttons: 3px (small!)
- Cards: 4px
- Pills: 3px
- Modals: 8px

## Components

### Button (Subtle)
```html
<button class="bg-[#f1f1ef] text-[#37352f] px-3 py-1.5 rounded text-sm hover:bg-[#e8e7e3]">
  Click me
</button>
```

### Page Card
```html
<article class="bg-white border border-[#e8e7e3] rounded p-8 max-w-2xl">
  <h1 class="text-3xl font-bold mb-4">Page Title</h1>
  <p class="text-base leading-relaxed">Content goes here...</p>
</article>
```

## Do
- Use 16px+ body text for readability
- Use warm grays (not cool grays)
- Use the full accent palette selectively
- Generous line-height (1.5-1.7)

## Don't
- No drop shadows on cards (use borders)
- No tight padding (<16px) on content
- No cold grays (avoid #888)
- No small body text (<14px)
