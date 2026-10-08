# COOP WARS — ChatGPT Image Prompts

✔ **Art received and wired in** (tw-coops, tw-troops, tw-specials, tw-map-farm, tw-obstacles, tw-ui → sliced into `assets/sprites/tw_*.webp`).

Still optional: **`tw-map-autumn.png`** and **`tw-map-winter.png`** (prompt 4). Upload them and Claude will add them to `MAP_THEMES` in `js/modes/towers/draw.js` so each game picks a random theme.

## How to use
- **One prompt = one image.** Each prompt is self-contained, so you only paste one block at a time.
- Attach your **concept sheet** to the ChatGPT chat as well.
- Sprite sheets use a **flat pure green (#00FF00) background**. Claude cuts it out.
- Ask for the **highest resolution** PNG. Upload the results here with the **Save as** name and Claude will slice and wire them in.
- They're listed **most important first**.

---

## 1. Coop towers — 5 levels × 3 colours
**Save as:** `tw-coops.png` · **Size:** landscape 1536×1024

```
Create a game sprite sheet of stackable farm "coop towers" for a comic-book style strategy game called "Chickens vs Turkeys: Coop Wars", in the style of the mobile game Tower War (chunky toy-like buildings seen from a high three-quarter top-down angle, about 50° down). Match the attached comic style reference.

STYLE: modern comic-book / arcade cartoon game art, toy-like and chunky. Thick black outlines with a thin white outer stroke, cel-shaded flat colour with 2–3 tone shading, subtle halftone dot shading, saturated punchy colours, family-friendly. Light from the top-left. Every building sits on its own small soft oval shadow and is drawn from exactly the same camera angle.

THE BUILDING: a round-cornered wooden chicken coop that gets TALLER as it levels up by stacking extra storeys, like a tower. Each level adds one storey with little round windows, a ramp, straw sticking out, and a flat-topped roof with a blank round badge plate on top for a number.

LAYOUT: 3 rows × 5 columns, evenly spaced with generous green space between items, nothing overlapping, no text or numbers anywhere:
ROW 1 — BLUE CHICKEN COOP (blue roof and trim, white chicken peeking out of the door, blue flag): level 1 (1 storey), level 2 (2 storeys), level 3 (3 storeys), level 4 (4 storeys), level 5 MAX (5 storeys, golden roof trim and a gold star flag).
ROW 2 — RED TURKEY BARN versions of the same five towers (red roof and trim, a turkey peeking out, red flag, autumn details like a small pumpkin).
ROW 3 — GREY NEUTRAL abandoned versions of the same five towers (grey weathered wood, grey roof, cobwebs, a few loose planks, no animals, no flag).

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork, crisp clean edges.
```

---

## 2. Marching troops (top-down)
**Save as:** `tw-troops.png` · **Size:** landscape 1536×1024

```
Create a sprite sheet of tiny marching "troop" characters for a comic-book style farm strategy game called "Chickens vs Turkeys: Coop Wars" (like the soldiers in Tower War, seen from a high three-quarter top-down angle). Match the attached comic style reference.

STYLE: chunky cute comic-book cartoon, thick black outlines with a thin white outer stroke, cel-shaded flat colour, saturated punchy colours, family-friendly, readable at very small sizes (they will be shown about 30 pixels tall). Light from the top-left.

LAYOUT (rows, evenly spaced with generous green space, nothing overlapping, no text):
ROW 1 — CHICKEN SOLDIER: a small white chicken wearing a blue bandana and a tiny blue helmet, carrying an egg like a ball; 4 walk-cycle frames facing RIGHT, then 1 "hit" frame (feathers flying, eyes squeezed shut).
ROW 2 — TURKEY SOLDIER: a small brown turkey with a fanned tail, red bandana and tiny red helmet, carrying a drumstick-shaped wooden club; 4 walk-cycle frames facing RIGHT, then 1 "hit" frame.
ROW 3 — VEHICLES (each worth 2 troops): a small blue farm tractor driven by a chicken, facing RIGHT; a small red farm tractor driven by a turkey, facing RIGHT; each with 2 frames (wheels in different positions).
ROW 4 — EFFECTS: a small white puff of dust, a little burst of white feathers, a little burst of brown feathers, a tiny egg splat, a small sparkle.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork, crisp clean edges.
```

---

## 3. Special buildings
**Save as:** `tw-specials.png` · **Size:** landscape 1536×1024

```
Create a sprite sheet of special farm buildings for a comic-book style strategy game called "Chickens vs Turkeys: Coop Wars", in the style of the mobile game Tower War (chunky toy-like buildings seen from a high three-quarter top-down angle). Match the attached comic style reference.

STYLE: modern comic-book / arcade cartoon game art, toy-like and chunky. Thick black outlines with a thin white outer stroke, cel-shaded flat colour, halftone dot shading, saturated punchy colours, family-friendly. Light from the top-left. Each object sits on a small soft oval shadow, all drawn from the same camera angle, each with a blank round badge plate on top for a number.

LAYOUT: 4 rows × 3 columns (BLUE chicken version, RED turkey version, GREY neutral version of each), evenly spaced with generous green space, nothing overlapping, no text:
ROW 1 — EGG SNIPER: a tall wooden lookout watchtower on stilts with a slingshot-style egg launcher on top and a little telescope.
ROW 2 — TRACTOR SHED: a wide garage-style farm shed with a big open door and a tractor nose poking out, smoke from a chimney.
ROW 3 — GRAND BARN (the big fort in the middle of the map, about twice as big as the others): a huge barn complex with a silo, a windmill and flags.
ROW 4 — GOLDEN EGG PILE (no colours, just three sizes): a big heap of shiny golden eggs in a straw nest, a medium heap, a small heap — with sparkles.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork, crisp clean edges.
```

---

## 4. Battle map backgrounds (3 themes)
**Save as:** `tw-map-farm.png`, `tw-map-autumn.png`, `tw-map-winter.png` (run the prompt 3 times, changing THEME) · **Size:** landscape 1536×864 (16:9)

```
Create an EMPTY top-down battle map background for a comic-book style farm strategy game called "Chickens vs Turkeys: Coop Wars", in the style of the mobile game Tower War (a flat open playing field seen from a high top-down angle, with scenery only around the edges). Match the attached comic style reference.

THEME: [FARM SUMMER — bright green grass, wildflowers, a duck pond, hay bales, a red barn in one corner]
(or) [AUTUMN — orange and gold grass, fallen leaves, pumpkins, a corn field edge]
(or) [WINTER — light snow on the grass, frozen pond, snowy pine trees, a snowman]

STYLE: modern comic-book / arcade cartoon game art, toy-like and chunky. Thick black outlines on objects, cel-shaded flat colour, subtle halftone shading, saturated colours, family-friendly. Light from the top-left.

LAYOUT: a wide 16:9 rectangle. The LEFT quarter of the field has a subtle blue tint with a few blue chicken-team flags along the edge; the RIGHT quarter has a subtle red tint with a few red turkey-team flags. The big middle area is completely OPEN, flat and uncluttered (buildings will be placed on top), with only very subtle grass texture and a few tiny flowers. Scenery (trees, fences, rocks, pond, crates, a tractor, a scarecrow) appears ONLY around the outer border. No buildings in the field, no characters, no paths, no text, no UI.
```

---

## 5. Obstacles
**Save as:** `tw-obstacles.png` · **Size:** landscape 1536×1024

```
Create a sprite sheet of obstacles for a comic-book style farm strategy game called "Chickens vs Turkeys: Coop Wars", seen from a high three-quarter top-down angle like the mobile game Tower War. Match the attached comic style reference.

STYLE: chunky toy-like comic-book cartoon, thick black outlines with a thin white outer stroke, cel-shaded flat colour, halftone shading, saturated colours, family-friendly. Light from the top-left. Each object sits on a soft oval shadow.

CONTENTS (evenly spaced with generous green space, nothing overlapping, no text):
ROW 1 — HAY BALE WALL PIECES: a single square hay bale, a round hay bale, a straight row of 3 hay bales, a corner of hay bales.
ROW 2 — WOODEN FENCE PIECES: a straight fence section, a corner section, a broken fence section, a gate.
ROW 3 — MUD & WATER: a muddy puddle patch, a small stream section with a little wooden bridge, a rock pile, a tree stump.
ROW 4 — GATES (for bonus mechanics): a glowing blue arch gate with a "×2" sign shape (blank, no text), a glowing red arch gate (blank), a land-mine style "rotten egg" trap, a crate of eggs.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork, crisp clean edges.
```

---

## 6. Coop Wars logo and banners
**Save as:** `tw-ui.png` · **Size:** landscape 1536×1024

```
Create UI art for a comic-book style classroom strategy game mode called "COOP WARS" (part of "Chickens vs Turkeys"). Match the attached comic style reference.

STYLE: bold comic-book lettering with thick black outlines, white outer stroke and drop shadow, halftone dots, speed lines, saturated punchy colours, family-friendly. Spelling must be exactly correct.

CONTENTS (separated with generous green space, nothing overlapping):
1. A wide logo: the words "COOP WARS" in huge slanted yellow-orange comic letters, with a blue chicken coop tower on the left and a red turkey barn tower on the right, crossed wooden spoons behind the text.
2. A starburst banner reading "CAPTURED!" in red and yellow.
3. A starburst banner reading "REINFORCEMENTS!" in blue and white.
4. A wide ribbon banner reading "CONQUER THE FARM!" in green and gold.
5. A round icon of a golden egg with a "+" sign, and a round icon of crossed scissors cutting a dotted line.

BACKGROUND: perfectly flat solid pure green (#00FF00), no gradient, no green in the artwork, crisp clean edges.
```

---

## After you generate
Upload the images and say **"Coop Wars art is ready"**. Claude will:
- slice the sheets into sprites;
- swap the tower art by level (1–5 storeys);
- use the new troops and tractors;
- add the map themes (chosen at random, or by the teacher);
- keep the current art as a backup if anything is missing.
