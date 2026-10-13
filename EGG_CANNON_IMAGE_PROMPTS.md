# Egg Cannon — image prompts (free-turning cannon)

On each student's iPad the cannon now turns smoothly to any angle, so it has to be a **separate picture** from the bird. The bird uses the plain `chicken_idle` / `turkey_idle` art; the cannon is drawn on top of its back and rotated in code.

Make **one image per team**. Attach your Egg Cannon comic style reference (e.g. `c_chicken_aim.webp`) so the brass cannon matches.

---

## 1. Chicken team cannon barrel → `cn_barrel_chicken`

```
Create a single game sprite of a CANNON BARREL ONLY (no bird, no wheels, no stand) for a comic-book style classroom game called "Chickens vs Turkeys: Egg Cannon". Match the attached comic style reference exactly — it is the same brass cannon the chicken wears on its back.

STYLE: chunky toy-like comic cartoon, thick black outlines with a thin white outer stroke, cel-shaded 2–3 tone shading, subtle halftone dots, saturated colours, light from the top-left, family-friendly.

THE CANNON: a short, fat brass/gold cannon barrel with a wide flared muzzle ring at the front and a dark round opening, a rounded metal breech knob at the back, one thick BLUE painted band around the middle, and a brown leather strap with a buckle wrapped around the barrel near the back (as if it straps onto a bird's back). Slightly worn and scratched, comic and fun.

ORIENTATION (very important): the barrel lies perfectly HORIZONTAL, pointing straight to the RIGHT, seen exactly from the side (no perspective tilt). Muzzle opening at the far right edge. The barrel's centre line runs straight across the middle of the image.

CANVAS: 1200 × 400 px, the barrel fills the width with only a small margin, on a plain flat bright green (#00FF00) background for easy cut-out — no shadow, no ground, no text.
```

## 2. Turkey team cannon barrel → `cn_barrel_turkey`

```
Same as the chicken team cannon barrel above (same size, same horizontal pointing-RIGHT orientation, same brass cannon, flared muzzle, breech knob and leather strap), but the painted band around the middle is RED instead of blue. 1200 × 400 px, plain flat bright green (#00FF00) background, no shadow, no text.
```

---

### When the images are ready
Send them to Claude: they get cut out, saved as `assets/sprites/cn_barrel_chicken.webp` and `cn_barrel_turkey.webp`, and `BARREL_ART` is switched on in `js/modes/cannon/arena.js`. Until then the game draws a simple cannon in code, which turns the same way.
