---
name: ui-polish
description: Automatically polish frontend projects with DaisyUI, Animal Island UI themes, animations, and icons using Tailwind CSS and available npm packages.
---

# UI Polish Workflow

Automatically polish frontend projects with themes, animations, and icon systems.

## Purpose

Improve the visual quality of frontend projects by applying consistent design tokens, professional themes, and subtle animations.

## Workflow

### Step 1: Analyze Project

- Scan project structure
- Detect frontend files
- Check existing styling setup (Tailwind, CSS-in-JS, CSS modules, etc.)

### Step 2: Theme Selection

**Options:**
1. DaisyUI — 35+ professional themes
2. Animal Island UI — Natural, playful, rounded design
3. Custom — User-defined colors

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

### Step 5: Add Animations

- Import `animate.css`
- Add animation classes to components

## Configuration

**Animal Island UI Design Tokens:**
- Primary: #19c8b9 (清爽青绿色)
- Secondary: #F5F5DC (柔和米白)
- Accent: #FF6F61 (珊瑚色)
- Text: #5D4E37 (偏棕色)
- Background: #FAF8F5
- Border-radius: 16px-24px

## Usage

**Claude Code Command:**
```
/polish [target_path]
```

## Dependencies

- Tailwind CSS
- Lucide React
- Animate.css
- Animal Island UI (optional)
- DaisyUI (optional)
