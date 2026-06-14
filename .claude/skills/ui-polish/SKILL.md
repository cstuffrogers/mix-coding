---
name: ui-polish
description: Automatically polish frontend projects with DaisyUI/Animal Island UI themes, animate.css animations, lucide-react icons, micro-interactions, and design critique. 25-step workflow with icon upgrade, animation injection, hover/active effects, and impeccable anti-pattern fixing.
---

# UI Polish Workflow

Automatically polish frontend projects with themes, animations, icon upgrades, micro-interactions, and design critique.

## Purpose

Improve the visual quality of frontend projects by applying consistent design tokens, professional themes, animations, lucide-react icons, hover/active micro-interactions, and anti-pattern fixes.

## Workflow

### Step 1: Analyze Project
- Scan project structure
- Detect frontend files
- Check existing styling setup (Tailwind, CSS-in-JS, CSS modules, etc.)

### Step 2: Theme Selection
**Options:**
1. DaisyUI — 35+ professional themes (applied to tailwind.config.js)
2. Animal Island UI — Natural, playful, rounded design (replaces HTML elements with AIUI components)
3. Custom — Keep existing style, apply animations + icons + micro-interactions only

### Step 3: Install Dependencies
```bash
npm install lucide-react animate.css
npm install animal-island-ui  # if selected
npm install daisyui  # if selected
```

### Step 4: Apply Theme
- Update `tailwind.config.js`
- Update `src/index.css`
- Apply theme-specific styles

### Step 5: Icon Upgrade (ALL themes)
- Scan JSX/TSX files for `<span className="material-symbols-outlined">icon_name</span>`
- Replace with `<LucideIcon size={N} />` components (60+ icon mappings)
- Preserve positioning/layout classes (absolute, flex, etc.)
- Auto-add `import { ... } from 'lucide-react'`

### Step 6: Add Animations (ALL themes)
- Inject `import 'animate.css'` into entry point
- Add `animate__fadeIn` to page root elements
- Add `animate__fadeInDown` to headers
- Add `animate__fadeInUp` to main content areas
- Skip files that already have animate.css classes

### Step 7: Micro-Interactions (ALL themes)
- Add `hover:-translate-y-0.5 hover:shadow-lg` to clickable cards/buttons
- Add `active:scale-[0.98]` for press feedback
- Add `transition-all duration-200` to interactive elements
- Skip elements that already have hover/transition classes

### Step 8: Impeccable Design Critique (ALL themes)
- Scan and auto-fix pure black (#000) → neutral-900
- Scan and auto-fix pure white backgrounds → neutral-50
- Warn on purple/indigo gradients (AI plastic look)
- Warn on missing transitions for interactive elements
- Warn on hardcoded colors (suggest CSS variables)

### Step 9: Review & Test
- Web Design verification (CSS variables, inline styles, layout checks)
- Huashu 5-dimension expert review
- AI-Friendly accessibility review
- Functional test suite
- Playwright visual regression (Desktop/Tablet/Mobile)

## Configuration

**Animal Island UI Design Tokens:**
- Primary: #19c8b9
- Secondary: #F5F5DC
- Accent: #FF6F61
- Text: #5D4E37
- Background: #FAF8F5
- Border-radius: 16px-24px

## Usage

**Claude Code Command:**
```
/ui-polish [target_path]
```

**CLI Command:**
```bash
node src/index.js start ui-polish --auto --theme <daisyui|animal-island|custom> --target <path>
```

## Dependencies
- Tailwind CSS
- Lucide React
- Animate.css
- Animal Island UI (optional)
- DaisyUI (optional)
- Playwright (optional, for visual regression)
