---
name: web-design-engineer
description: Web design system specification — oklch colors, anti-cliché blocklist, v0 draft workflow. Use when building or polishing web UI, landing pages, dashboards, or design systems.
user-invocable: true
---

# Web Design Engineer

Give your AI-generated web pages real design taste. Stop producing the same generic landing page.

## Anti-Cliché Blocklist

NEVER use these patterns. They scream "AI-generated":

- Purple-pink-blue gradient backgrounds
- Cards with a colored left-border accent
- Inter / Roboto / Arial / system-ui fonts as primary
- Emoji as icon substitutes
- Fabricated stats, fake logo walls, dummy testimonials
- Hero + 3 feature cards + testimonials wall + "trusted by" logos
- Large-radius cards ( > 16px ) everywhere
- Blue primary buttons as the only CTA style

## Design System Declaration (MANDATORY)

Before writing any code, declare the design system in markdown:

```markdown
## Design System
- **Palette**: warm paper (oklch 97% 0.01 80) / ink (oklch 18% 0.02 80) / accent caramel (oklch 65% 0.15 60)
- **Typography**: Instrument Serif (display) + Space Grotesk (UI) + JetBrains Mono (code)
- **Spacing**: 4px base, 8/16/24/40/64 scale
- **Motion**: 200ms ease-out for micro, 600ms ease-in-out for page transitions
- **Radius**: 4px for buttons, 8px for cards, 16px for modals
- **Shadows**: subtle, never heavy drop shadows
```

## oklch Color System

Use oklch for all color tokens. It's perceptually uniform.

```css
:root {
  --color-bg: oklch(98% 0.01 80);
  --color-fg: oklch(20% 0.02 80);
  --color-accent: oklch(65% 0.18 30);
  --color-muted: oklch(60% 0.05 80);
  --color-border: oklch(85% 0.02 80);
}
```

Rules:
- Lock chroma and hue, vary lightness for ramps
- Same L value = same perceived brightness
- Avoid pure black (oklch(0% 0 0)) and pure white (oklch(100% 0 0))

## v0 Draft First

Always show a v0 draft before full build:

1. Layout skeleton (boxes, no styling)
2. Design tokens declared
3. Placeholders for images/media
4. User confirms direction

Then proceed to full build.

## Placeholder Philosophy

Use honest text placeholders, never fake SVG illustrations:

```html
<!-- GOOD -->
<div class="placeholder">[hero image: photographer portrait, 3:4]</div>

<!-- BAD — AI-generated fake illustration -->
<svg>...</svg>
```

## Six-Step Workflow

1. **Understand requirements** — only ask if information is insufficient
2. **Gather design context** — code > screenshots, never start from nothing
3. **Declare the design system** — tokens in markdown
4. **Show v0 draft** — layout + placeholders
5. **Full build** — components, states, motion; pause at decision points
6. **Verify** — pre-delivery checklist: no console errors, no broken layouts

## Typography Rules

- Maximum 2 font families per page
- Line height 1.5-1.7 for body text
- Limit to 3-4 font sizes per page
- Use font-weight for hierarchy, not just size

## Spacing System

- 4px base unit
- Scale: 4, 8, 16, 24, 40, 64, 104
- More whitespace = more premium feel
- Consistent spacing > perfect spacing

## Component Patterns

### Buttons
- Primary: solid background, high contrast
- Secondary: subtle background
- Ghost: visible border, transparent bg
- NEVER: transparent bg + no border

### Cards
- Subtle shadow or no shadow
- Border is preferred over shadow
- Padding: 16px–24px
- Radius: 8px max (avoid 16px+ everywhere)

### Forms
- Native form controls over div simulations
- Visible labels (not placeholder-only)
- Error messages: plain text, below field
- Focus states: visible ring or border change

## Motion & Animation

- Micro-interactions: 150–200ms ease-out
- Page transitions: 300–600ms ease-in-out
- NEVER: auto-playing carousels
- Respect `prefers-reduced-motion`

## Responsive Rules

- Mobile-first
- Breakpoints: 640px, 768px, 1024px, 1280px
- Touch targets: minimum 44×44px
- Test on real devices, not just DevTools

## Pre-Delivery Checklist

- [ ] No console errors
- [ ] No broken layouts at any breakpoint
- [ ] Color contrast ≥ 4.5:1 for text
- [ ] All images have alt text
- [ ] Focus states visible
- [ ] `prefers-reduced-motion` respected
- [ ] No AI-cliché patterns remaining
