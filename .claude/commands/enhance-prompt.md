---
description: Transform vague UI ideas into polished, structured prompts. Enhances specificity, adds UI/UX keywords, injects design system context, and structures output for better design generation results.
argument-hint: "[模糊的 UI 描述]"
---

# Enhance Prompt

Transform rough or vague UI generation ideas into polished, optimized prompts that produce better results from design tools (Stitch, v0, Claude-generated UI, etc.).

## When to Use

Activate when a user wants to:
- Polish a UI prompt before sending to a design generation tool
- Improve a prompt that produced poor results
- Add design system consistency to a simple idea
- Structure a vague concept into an actionable prompt

## Enhancement Pipeline

### Step 1: Assess the Input

Evaluate what's missing from the user's prompt:

| Element | Check for | If missing... |
|---------|-----------|---------------|
| **Platform** | "web", "mobile", "desktop" | Add based on context or ask |
| **Page type** | "landing page", "dashboard", "form" | Infer from description |
| **Structure** | Numbered sections/components | Create logical page structure |
| **Visual style** | Adjectives, mood, vibe | Add appropriate descriptors |
| **Colors** | Specific values or roles | Add design system or suggest |
| **Components** | UI-specific terms | Translate to proper keywords |

### Step 2: Check for DESIGN.md

Look for `DESIGN.md` or `.stitch/DESIGN.md` in the current project:

**If DESIGN.md exists:**
1. Read the file to extract the design system block
2. Include the color palette, typography, and component styles
3. Format as a "DESIGN SYSTEM (REQUIRED)" section in the output

**If DESIGN.md does not exist:**
Add this note at the end:

```
💡 Tip: For consistent designs across multiple screens, create a DESIGN.md
file. This ensures all generated pages share the same visual language.
```

### Step 3: Apply Enhancements

#### A. Add UI/UX Keywords

Replace vague terms with specific component names:

| Vague | Enhanced |
|-------|----------|
| "menu at the top" | "navigation bar with logo and menu items" |
| "button" | "primary call-to-action button" |
| "list of items" | "card grid layout" or "vertical list with thumbnails" |
| "form" | "form with labeled input fields and submit button" |
| "picture area" | "hero section with full-width image" |

#### B. Amplify the Vibe

Add descriptive adjectives to set the mood:

| Basic | Enhanced |
|-------|----------|
| "modern" | "clean, minimal, with generous whitespace" |
| "professional" | "sophisticated, trustworthy, with subtle shadows" |
| "fun" | "vibrant, playful, with rounded corners and bold colors" |
| "dark mode" | "dark theme with high-contrast accents on deep backgrounds" |

#### C. Structure the Page

Organize content into numbered sections. Each section gets a header and a description of what goes there.

#### D. Format Colors Properly

When colors are mentioned, format as: `Descriptive Name (#hexcode) for functional role`

### Step 4: Format the Output

```markdown
[One-line description of the page purpose and vibe]

**DESIGN SYSTEM (REQUIRED):**
- Platform: [Web/Mobile], [Desktop/Mobile]-first
- Theme: [Light/Dark], [style descriptors]
- Background: [Color description] (#hex)
- Primary Accent: [Color description] (#hex) for [role]
- Text Primary: [Color description] (#hex)

**Page Structure:**
1. **[Section]:** [Description]
2. **[Section]:** [Description]
```

## UI/UX Keywords Reference

### Navigation
navigation bar, nav menu, header, breadcrumbs, tabs, sidebar, hamburger menu, dropdown menu

### Content Containers
hero section, card grid, modal, dialog, accordion, collapsible section, carousel, slider

### Forms
input field, text input, dropdown/select, checkbox, radio button, toggle switch, date picker, search bar, submit button

### Calls to Action
primary button, secondary button, ghost button, text link, floating action button (FAB), icon button

### Feedback
toast notification, snackbar, alert banner, warning message, loading spinner, skeleton loader, progress bar, step indicator

### Layout
grid layout, flexbox, sidebar layout, split view, sticky header, fixed footer, full-width, contained width, centered content, max-width container

## Adjective Palettes

### Minimal / Clean
minimal, clean, uncluttered, generous whitespace, subtle, understated, refined

### Professional / Corporate
sophisticated, polished, trustworthy, subtle shadows, clean lines, structured, organized

### Playful / Fun
vibrant, colorful, energetic, rounded corners, soft edges, bold, expressive, friendly, approachable

### Premium / Luxury
elegant, luxurious, high-end, dramatic, bold contrasts, sleek, modern, curated

### Dark Mode
dark theme, high-contrast accents, soft glows, subtle highlights, deep backgrounds, muted surfaces

### Organic / Natural
earthy tones, warm, inviting, cozy, textured, tactile, flowing, organic shapes

## Color Role Terminology

### Backgrounds
page background/canvas, surface color/card background, overlay/scrim

### Text
primary text/heading color, secondary text/body copy, muted text/placeholder, inverse text (on dark backgrounds)

### Accents
primary accent/brand color, secondary accent/highlight, success/error/warning colors, hover/active states

## Examples

### Vague Input → Structured Prompt

**Input:** "make me a login page"

**Enhanced:**
```
A clean, trustworthy login page with a centered form and subtle branding.

DESIGN SYSTEM (REQUIRED):
- Platform: Web, Desktop-first
- Theme: Light, minimal, professional
- Background: Clean White (#ffffff)
- Surface: Soft Gray (#f9fafb) for form card
- Primary Accent: Deep Blue (#2563eb) for submit button and links
- Text Primary: Near Black (#111827) for headings
- Text Secondary: Medium Gray (#6b7280) for labels
- Buttons: Subtly rounded (8px), full-width on form
- Cards: Gently rounded (12px), soft shadow for elevation

Page Structure:
1. Header: Minimal logo, centered
2. Login Card: Centered form with email, password fields, "Forgot password?" link
3. Submit Button: Primary blue "Sign In" button
4. Footer: "Don't have an account? Sign up" link
```

### Feature Request → Targeted Edit

**Input:** "add a search bar"

**Enhanced:**
```
Add a search bar to the header navigation.

Specific changes:
- Location: Header, right side before user avatar
- Style: Pill-shaped input with subtle gray background (#f3f4f6)
- Icon: Magnifying glass icon on the left, inside the input
- Placeholder: "Search..." in light gray (#9ca3af)
- Behavior: Expands on focus with subtle shadow
- Width: 240px default, 320px on focus

Context: This is a targeted edit. Make only this change while preserving all existing elements.
```

## Tips

1. Be specific early — vague inputs need more enhancement
2. Match the user's intent — don't over-design if they want simple
3. Keep it structured — numbered sections help tools understand hierarchy
4. Include the design system — consistency is key for multi-page projects
5. One change at a time for edits — don't bundle unrelated changes
