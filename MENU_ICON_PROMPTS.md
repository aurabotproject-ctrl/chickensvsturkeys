# MENU ICONS — ChatGPT Image Prompt

✔ **Icons received and wired in** (`assets/sprites/ui_*.webp`). The prompt is kept below in case you want to remake them.

This replaces the emojis in the Teacher HQ menu, the dashboard buttons and the home page buttons with icons that match the game's comic style.

| Where | Emoji now | New icon |
|---|---|---|
| Menu: **Dashboard** | 🏠 | `ui_home` |
| Menu + dashboard: **Create Game** | 🎮 | `ui_create` |
| Menu + dashboard: **Question Banks** | 📚 | `ui_banks` |
| Menu + dashboard: **Results** | 📊 | `ui_results` |
| Create Game page: **Launch Game** | 🚀 | `ui_launch` |
| Home page: **Join a Game** | 🎮 | `ui_join` |
| Home page: **I'm a Teacher** | 🍎 | `ui_teacher` |
| Sign-in button | (none) | `ui_signin` |

## How to use
- Paste the prompt into ChatGPT with your **mode-icons reference image** attached (the sheet with the Coop Wars / Coop Siege / Advance icons), so the style matches.
- Ask for the **highest resolution**, landscape **1536×1024**.
- Upload it with its **Save as** name and say **"Menu icons are ready"**.
- Claude will cut them out, and each menu spot switches from its emoji to the picture automatically.

---

## Menu icon sheet (8 icons)
**Save as:** `ui-icons.png`

```
Create a sprite sheet of 8 small APP MENU ICONS for a comic-book style classroom quiz game called "Chickens vs Turkeys". Match the attached reference image exactly in style: chunky cartoon objects, thick black outlines with a thin white outer stroke, cel-shaded flat colour with 2–3 tone shading, subtle halftone dots, saturated punchy colours, light from the top-left, family-friendly. The game's colours are chicken BLUE (#1e6fe0), turkey RED (#e0402a), egg-yolk YELLOW (#ffc72c) and grass GREEN (#7ed321).

Icons must stay readable when shown very small (about 32 pixels), so: ONE bold simple object per icon, chunky shapes, very little fine detail, square-ish overall shape, same visual size for all 8. Slight three-quarter view.

THE 8 ICONS (left to right, top row then bottom row):
1. HOME / DASHBOARD: a small red farm barn with a white X door and a little blue flag on the roof.
2. CREATE GAME: a chunky game controller, one half blue and one half red, with a small white feather tucked behind it.
3. QUESTION BANKS: a stack of three chunky books (blue, red, yellow) with a big yellow question mark popping out of the top.
4. RESULTS: a gold trophy cup with a small bar chart (blue and red bars) on its front.
5. LAUNCH GAME: a white egg-shaped rocket with red fins and a yellow flame blasting out underneath.
6. JOIN A GAME: a phone/tablet whose screen shows a tiny chicken face and a tiny turkey face side by side.
7. I'M A TEACHER: a shiny red apple with a green leaf and a small yellow pencil leaning on it.
8. SIGN IN: a chunky golden key with an egg-shaped head.

LAYOUT: 2 rows × 4 columns, evenly spaced, each icon centred in its cell, with a wide empty green gap (at least 80 px) around every icon. Nothing touching or cut off. NO text, letters or numbers anywhere (the question mark on icon 3 is the only symbol allowed).

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no shadow on the background, no green in the artwork, crisp clean edges.
```

---

## After you generate
Claude will slice the sheet into `ui_home`, `ui_create`, `ui_banks`, `ui_results`, `ui_launch`, `ui_join`, `ui_teacher` and `ui_signin` (in `assets/sprites/`) and list them in `UI_ICONS` in `js/core/assets.js`. Every menu item and button then switches from its emoji to the matching icon.
