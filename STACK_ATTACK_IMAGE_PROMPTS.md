# STACK ATTACK — ChatGPT Image Prompts

✔ **Icon and background received and wired in** (`mode_stack`, `sa_bg`). The background already has both cliffs painted in, and they're used as the real platforms, so **image #2 (the separate cliffs) isn't needed**. The prompts are kept below in case you want to remake anything.

| # | Save as | What it becomes | Replaces |
|---|---|---|---|
| 1 | `mode-stack.png` | the Stack Attack card in Teacher HQ | the borrowed blue crate |
| 2 | `stack-cliffs.png` | `sa_cliff_c` + `sa_cliff_t`, the two team cliffs the towers stand on | the plain brown boxes |
| 3 | `stack-bg.png` | `sa_bg`, the sky and farm panorama behind everything | the plain sky gradient |

## How to use
- **One prompt = one image.** Paste one block at a time into ChatGPT. Attach your mode-icons sheet for #1, and your concept sheet for #2 and #3.
- Ask for the **highest resolution**, landscape **1536×1024**.
- Upload them with their **Save as** names and say **"Stack Attack art is ready"**.

---

## 1. Game card icon
**Save as:** `mode-stack.png`

```
Create 1 game-mode ICON for a comic-book style classroom game called "Chickens vs Turkeys". Match the attached reference image exactly in style: one chunky cartoon scene, thick black outlines with a thin white outer stroke, cel-shaded flat colour with 2–3 tone shading, subtle halftone dots, saturated punchy colours, light from the top-left, family-friendly.

THE ICON: a tall, wobbly, slightly leaning tower of chunky building blocks (blue wooden crates, a long blue plank, a hay bale, a red-roofed little triangle on top) standing on a small grassy cliff top. A white CHICKEN with a blue headband balances proudly on the very top with its wings out. From the side, a cheeky brown TURKEY with a red headband has just thrown an egg, which is flying in an arc with motion lines towards the tower. A few motion "wobble" lines on the tower show it is swaying. Fun, nobody is hurt.

Centre the icon with a wide empty green gap (at least 100 px) around it. NO text, letters or numbers.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork except the small grass top (make it a darker yellowish green with a thick black outline so it stays separate from the background), crisp clean edges.
```

---

## 2. The two team cliffs
**Save as:** `stack-cliffs.png`

```
Create a game sprite sheet of 2 CLIFF PILLARS for a comic-book style classroom game called "Chickens vs Turkeys: Stack Attack", where each team builds a tower on top of its own cliff. Match the attached comic style reference.

STYLE: chunky comic cartoon, thick black outlines with a thin white outer stroke, cel-shaded 2–3 tone shading, subtle halftone dots, saturated colours, family-friendly. Flat side-on view (like a side-scrolling game).

THE 2 CLIFFS (side by side, the same size and shape):
1. CHICKEN CLIFF (left): a tall rocky cliff pillar, about 1.3 times as tall as it is wide, with a perfectly FLAT, LEVEL grassy top edge running the full width (towers are built on it, so the top must be a straight horizontal line). Brown and tan rock layers, a few roots and pebbles, a small blue-and-white bunting string and a little BLUE flag with a chicken-head badge planted at the far LEFT edge of the top. A tiny wooden sign-less fence post at the left corner.
2. TURKEY CLIFF (right): the same cliff shape and size, but with RED bunting and a little RED flag with a turkey-head badge planted at the far RIGHT edge of the top.

IMPORTANT: the flat grassy top must be the very top of each picture (only the flag and bunting poke above it, at the outer edge), the sides go straight down, and the bottom can fade into dark rock. Leave the middle of the top completely clear (no rocks, plants or objects on the middle of the grass).

LAYOUT: the two cliffs side by side with a wide empty green gap (at least 80 px) between and around them. Nothing touching or cut off. NO text.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork except the grass tops (make the grass a darker yellowish green with thick black outlines so it stays separate from the background), crisp clean edges.
```

---

## 3. Background panorama
**Save as:** `stack-bg.png`

```
Create a wide BACKGROUND PANORAMA for a comic-book style classroom game called "Chickens vs Turkeys: Stack Attack" (two teams build towers on two cliffs with a river ravine between them). Match the attached comic style reference: comic-book cartoon, thick outlines, cel shading, subtle halftone dots, bright cheerful colours.

THE SCENE: a big bright blue sky with fluffy comic clouds and a couple of tiny birds, filling the top two-thirds of the picture (lots of empty sky — the towers will grow up into it). In the bottom third, soft rolling green farm hills in the distance with a small blue barn and silo on the far left hill and a small red barn and silo on the far right hill, a few tiny trees, and a winding river glinting in the valley at the very bottom centre. Keep everything in the lower third quite small and faded (distant), with no large objects in the middle, because the two cliffs and towers are drawn on top.

NO characters, NO text, NO borders. Fill the whole image edge to edge (this is a background, not a sticker — no green screen).
```

---

## After you generate
Claude will cut them out to `mode_stack`, `sa_cliff_c`, `sa_cliff_t` and `sa_bg` (in `assets/sprites/`) and list them in `SA_ART` in `js/modes/stack/arena.js`. The game then switches to them automatically.
