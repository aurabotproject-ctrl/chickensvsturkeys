# CROSS THE ROAD — ChatGPT Image Prompts

✔ **Art received and wired in** (`assets/sprites/cr_*.webp` + `mode_cross.webp`). The prompts are kept below in case you want to remake any of them.

| # | Image | Replaces |
|---|---|---|
| 1 | `cross-road-1.png`: hay cart, quad bike, 3 river logs, lily pad | the hay cart and logs drawn in code |
| 2 | `cross-road-2.png`: flattened chicken, flattened turkey, water splash, "made it" chicken & turkey | the egg splat used for road splats |
| 3 | `mode-cross.png`: game card icon | the borrowed chicken on the Teacher HQ card |

## How to use
- **One prompt = one image.** Paste one block at a time into ChatGPT, with your concept sheet (or the mode-icons sheet for #3) attached.
- Ask for the **highest resolution**, landscape **1536×1024**.
- Upload them with their **Save as** names and say **"Cross the Road art is ready"**.

---

## 1. Road & river props
**Save as:** `cross-road-1.png`

```
Create a game sprite sheet of FARM ROAD AND RIVER PROPS for a comic-book style classroom game called "Chickens vs Turkeys: Cross the Road" (a Crossy Road style game). Match the attached comic style reference.

STYLE: chunky toy-like comic cartoon, thick black outlines with a thin white outer stroke, cel-shaded 2–3 tone shading, subtle halftone dots, saturated punchy colours, light from the top-left, family-friendly. Everything is seen from the SIDE with a slight three-quarter top-down angle (like the vehicles in Crossy Road), all facing RIGHT.

THE 6 PROPS (spread out, not touching):
1. HAY CART: a wooden farm cart piled high with golden hay bales, two big wooden wheels, a short pull bar at the front. About twice as long as it is tall.
2. QUAD BIKE: a chunky red farm quad bike with knobbly tyres and a little crate of eggs strapped on the back. About 1.5 times as long as it is tall.
3. SHORT LOG: a floating river log about 2 times as long as it is tall, round cut end facing the viewer on the right, a few knots and a little moss on top.
4. MEDIUM LOG: the same log style, about 3 times as long as it is tall.
5. LONG LOG: the same log style, about 4 times as long as it is tall, with one small branch stub.
6. LILY PAD: a big round green lily pad with a pink flower, seen from slightly above.

LAYOUT: spread evenly over 2 rows with a wide empty green gap (at least 60 px) around every prop. Nothing touching or cut off. NO text.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork except the lily pad (make the lily pad a DARKER olive/teal green with a thick black outline so it stays separate from the background), crisp clean edges.
```

---

## 2. Splats, splashes & celebrations
**Save as:** `cross-road-2.png`

```
Create a game sprite sheet of CARTOON REACTION SPRITES for a comic-book style classroom game called "Chickens vs Turkeys: Cross the Road". Match the attached comic style reference: chunky comic cartoon, thick black outlines with a thin white outer stroke, cel-shaded 2–3 tone shading, subtle halftone dots, saturated colours, family-friendly and SILLY — never gory, nobody is hurt.

The chicken is white with a red comb and a BLUE headband. The turkey is brown with a big colourful tail fan and a RED headband.

THE 6 SPRITES (spread out, not touching):
1. FLAT CHICKEN: the chicken squashed flat like a pancake on the road (seen from above), dizzy swirly eyes, tyre tread marks across it, a few feathers floating up, a little cartoon star. Funny, not hurt.
2. FLAT TURKEY: the turkey squashed flat the same way, tail fan spread out like a flattened fan, dizzy eyes, tread marks, feathers floating.
3. WATER SPLASH: a big cartoon water splash crown with droplets, blue and white.
4. SOGGY CHICKEN: the chicken popping up out of water with a surprised face, dripping wet, a little fish on its head.
5. HAPPY CHICKEN: the chicken jumping for joy with wings up and a star burst behind it ("I made it across!").
6. HAPPY TURKEY: the turkey jumping for joy with wings up, tail fan spread, star burst behind it.

LAYOUT: 2 rows × 3 columns, evenly spaced with a wide empty green gap (at least 60 px) around every sprite. Nothing touching or cut off. NO text.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork, crisp clean edges.
```

---

## 3. Game card icon
**Save as:** `mode-cross.png`

```
Create 1 game-mode ICON for a comic-book style classroom game called "Chickens vs Turkeys". Match the attached reference image exactly in style: one chunky cartoon scene, thick black outlines with a thin white outer stroke, cel-shaded flat colour with 2–3 tone shading, subtle halftone dots, saturated punchy colours, light from the top-left, family-friendly.

THE ICON: a small chunky slice of road seen at a three-quarter angle — grey road with white dashed lane lines, a strip of green grass on each side and a little blue river with a floating log behind it. A white CHICKEN with a blue headband is mid-hop across the road with a determined face, and a big red farm tractor zooms towards it from the side with motion lines. A cheeky brown TURKEY with a red headband peeks out from the grass on the far side, cheering. Fun, cartoon, nobody is hurt.

Centre the icon with a wide empty green gap (at least 100 px) around it. NO text, letters or numbers.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork except the small grass strips (make the grass a darker, yellowish green with thick black outlines so it stays separate from the background), crisp clean edges.
```

---

## After you generate
Claude will slice them into `cr_haycart`, `cr_quad`, `cr_log2`, `cr_log3`, `cr_log4`, `cr_lilypad`, `cr_flat_c`, `cr_flat_t`, `cr_splash`, `cr_soggy_c`, `cr_win_c`, `cr_win_t` and `mode_cross`, list them in `CR_ART` in `js/modes/cross/draw.js`, and the game switches over to them.
