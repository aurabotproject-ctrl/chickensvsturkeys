# GATES — ChatGPT Image Prompts

✔ **All 4 images received and wired in** (`mode_gates`, `gt_gate_closed`, `gt_gate_open`, `gt_pad`); the field is the Capture the Flag one (`cf_field`). The prompts are kept below in case you want to remake anything.

| # | Save as | What it becomes | Replaces |
|---|---|---|---|
| 1 | `mode-gates.png` | the Gates card in Teacher HQ | the borrowed running chicken |
| 2 | `gate-closed.png` | `gt_gate_closed`, a closed gate (a fence you must run round) | the drawn wooden rails |
| 3 | `gate-open.png` | `gt_gate_open`, the gate that's open for your team | the drawn swung-open halves |
| 4 | `gate-pad.png` | `gt_pad`, the four corner circles (the number is added by the game) | the dashed circles |

## How to use
- **One prompt = one image.** Paste one block at a time into ChatGPT.
- Attach your **mode-icons sheet** for #1, and the **Capture the Flag field** (`flag-field.png`) for #2–#4 so the style and top-down angle match.
- Ask for the **highest resolution**.
- Upload them with their **Save as** names and say **"Gates art is ready"**.

---

## 1. Game card icon
**Save as:** `mode-gates.png`

```
Create 1 game-mode ICON for a comic-book style classroom game called "Chickens vs Turkeys". Match the attached reference image exactly in style: one chunky cartoon scene, thick black outlines with a thin white outer stroke, cel-shaded flat colour with 2–3 tone shading, subtle halftone dots, saturated punchy colours, light from the top-left, family-friendly.

THE ICON: a chunky wooden farm gate standing wide open (both halves swung outwards), with three excited white CHICKENS wearing blue headbands running through the opening in a line, one behind the other, wings flapping, with motion lines and little dust puffs. Behind them on the ground, a small glowing circle with a big white number "2" painted inside it, and two more chickens standing proudly in that circle cheering them on. Fun teamwork energy.

Centre the icon with a wide empty green gap (at least 100 px) around it. NO other text, letters or numbers except the "2" in the circle.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green anywhere in the artwork (make any grass a dark yellow-green with thick black outlines so it stays separate), crisp clean edges.
```

---

## 2. Closed gate (top-down)
**Save as:** `gate-closed.png`

```
Create a single TOP-DOWN (looking straight down from above) game sprite of a CLOSED wooden farm gate, for a comic-book style classroom game called "Chickens vs Turkeys: Gates". Match the style and the straight-down camera angle of the attached grass field: chunky cartoon, thick dark outlines, cel-shaded, saturated colours.

THE GATE: seen from directly above, so it looks like a long, thin, horizontal shape: two chunky round wooden POSTS (seen from the top, like circles with a ring pattern) at the far left and far right ends, and between them the top of a closed wooden farm gate made of two parallel wooden rails with a diagonal brace, plus a small metal latch in the middle. A little shadow falls down-right onto the ground.

ORIENTATION: perfectly horizontal, the posts exactly at the left and right edges, centred vertically.

CANVAS: wide 1600 × 400, on a plain flat bright green (#00FF00) background for easy cut-out (no grass, no ground). No text.
```

## 3. Open gate (top-down)
**Save as:** `gate-open.png`

```
Exactly the same gate, posts and top-down view as the closed gate (same size, same canvas, same two round posts at the far left and far right edges), but now the gate is OPEN: the two halves of the gate have swung outwards from the posts (each half angled about 60° away from the gap, one swung up and one swung down), leaving a wide clear gap in the middle. Add a soft glowing bright-green shine in the gap and two small white arrows pointing through it (one up, one down). Wide 1600 × 400, plain flat bright green (#00FF00) background, no text.
```

---

## 4. Corner circle (top-down)
**Save as:** `gate-pad.png`

```
Create a TOP-DOWN (looking straight down) game sprite of a round "meeting circle" for a comic-book style classroom game called "Chickens vs Turkeys: Gates". Match the style and straight-down angle of the attached grass field: chunky cartoon, thick dark outlines, cel-shaded, saturated colours.

THE CIRCLE: a perfect CIRCLE of short, light, worn-down grass and a little sand, with a thick WHITE painted ring around its edge (like a line on a sports field, a bit chipped), a ring of small white wooden pegs just inside the line, and a few tiny daisies. The middle is EMPTY and plain (the game writes a big number there). Neutral colours only — no blue or red — because it's used by both teams.

VIEW: perfectly top-down, a perfect circle filling the whole square canvas edge to edge.

CANVAS: square 1024 × 1024, plain flat bright green (#00FF00) background outside the circle. No shadow, no text, no numbers.
```

---

### When the images are ready
Upload them with their **Save as** names. They get cut out, saved as `assets/sprites/gt_*.webp` (and `mode_gates.webp`), and switched on in `js/modes/gates/draw.js` (`GT_ART`) and the Teacher HQ game list.
