// =========================================================
// STACK ATTACK — shared rules (big screen + phones)
// Each team builds a wobbly tower on its own cliff top.
//   • every right answer = 1 action: DROP a block on your tower, or
//     THROW an egg at the other team's tower
//   • blocks follow real physics — sloppy stacking wobbles and topples
//   • anything that falls off the cliff is gone
//   • tower height (in metres: 1 crate = 1 m) is the score; the heights
//     at the end of each round are added up
// World units are pixels; y goes DOWN, the cliff tops are at y = 0.
// =========================================================

export const U = 44;                     // one metre (a crate is 1 × 1)
export const PLAT_W = 10 * U;            // width of each cliff top
export const PLATS = { chicken: { x: -9.5 * U, w: PLAT_W }, turkey: { x: 9.5 * U, w: PLAT_W } };
export const MAX_ACTIONS = 5;            // most actions a student can save up
export const FALL_Y = 14 * U;            // below this a piece has fallen off the cliff
export const SPAWN_GAP = 3.2 * U;        // new blocks appear this far above the tower top

/**
 * The blocks. w × h in metres. weight = how often it comes up.
 * art(team) gives the Egg Cannon fort texture (blue = chickens, red = turkeys).
 */
export const SHAPES = {
  crate: { name: 'Crate', w: 1, h: 1, weight: 5, art: (c) => `f_${c}_crate` },
  block: { name: 'Block', w: 1, h: 1, weight: 4, art: (c) => `f_${c}_block` },
  window: { name: 'Window box', w: 1, h: 1, weight: 2, art: (c) => `f_${c}_window` },
  hay: { name: 'Hay bale', w: 1.4, h: 1.1, weight: 3, art: () => 'f_hay', light: true },
  short: { name: 'Short plank', w: 2.2, h: 0.5, weight: 4, art: (c) => `f_${c}_short` },
  plank: { name: 'Long plank', w: 4, h: 0.5, weight: 3, art: (c) => `f_${c}_plank` },
  pillar: { name: 'Pillar', w: 0.5, h: 2.2, weight: 3, art: (c) => `f_${c}_plank`, rotArt: true },
  door: { name: 'Door', w: 1, h: 1.4, weight: 2, art: (c) => `f_${c}_door` },
  arch: { name: 'Arch', w: 2.4, h: 1.4, weight: 2, art: (c) => `f_${c}_arch` },
  tri: { name: 'Wedge', w: 2, h: 1, weight: 2, art: (c) => `f_${c}_tri`, poly: 'tri' },
  roof: { name: 'Roof', w: 2.6, h: 1.3, weight: 1, art: (c) => `f_${c}_roof`, poly: 'roof' },
};
export const SHAPE_KEYS = Object.keys(SHAPES);
export const colourOf = (team) => (team === 'turkey' ? 'red' : 'blue');

/** A random next block (weighted). */
export function randomShape(rand = Math.random) {
  const total = SHAPE_KEYS.reduce((a, k) => a + SHAPES[k].weight, 0);
  let r = rand() * total;
  for (const k of SHAPE_KEYS) { r -= SHAPES[k].weight; if (r <= 0) return k; }
  return 'crate';
}
export const other = (team) => (team === 'turkey' ? 'chicken' : 'turkey');

/** Polygon outline (local coords, pixels) for drawing / physics of a shape. */
export function outline(k) {
  const s = SHAPES[k]; const w = s.w * U; const h = s.h * U;
  if (s.poly === 'tri') return [{ x: -w / 2, y: h / 2 }, { x: 0, y: -h / 2 }, { x: w / 2, y: h / 2 }];
  if (s.poly === 'roof') return [{ x: -w / 2, y: h / 2 }, { x: -w * 0.2, y: -h / 2 }, { x: w * 0.2, y: -h / 2 }, { x: w / 2, y: h / 2 }];
  return [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }];
}

/** Egg throw: launch point for a team, and the velocity (px per step) to reach a target in `steps` physics steps. */
export const LAUNCH = { chicken: { x: -4.2 * U, y: -1.8 * U }, turkey: { x: 4.2 * U, y: -1.8 * U } }; // the thrower stands at the inner edge of each cliff
/** Collision groups: an egg only hits the OTHER team's blocks (and the cliffs). */
export const CAT = { cliff: 1, cblock: 2, tblock: 4, cegg: 8, tegg: 16 };
export const FILTER = {
  cliff: { category: CAT.cliff, mask: 0xffff },
  block: (team) => (team === 'turkey' ? { category: CAT.tblock, mask: CAT.cliff | CAT.cblock | CAT.tblock | CAT.cegg } : { category: CAT.cblock, mask: CAT.cliff | CAT.cblock | CAT.tblock | CAT.tegg }),
  egg: (team) => (team === 'turkey' ? { category: CAT.tegg, mask: CAT.cliff | CAT.cblock } : { category: CAT.cegg, mask: CAT.cliff | CAT.tblock }),
};
export const G_STEP = 0.001 * (1000 / 60) ** 2; // Matter's gravity per step² at gravity.y = 1
export function throwVelocity(from, to, steps = 80) {
  // Matter moves a body by its velocity each step and adds gravity every step (no air drag on eggs),
  // so after N steps: y = y0 + N·vy + g·N(N+1)/2
  return { x: (to.x - from.x) / steps, y: (to.y - from.y) / steps - (G_STEP * (steps + 1)) / 2 };
}

/** Egg splat: blocks within BLAST_R of the impact get shoved outwards (stronger when closer). */
export const BLAST = 10;
export const BLAST_R = 2.3 * U;
export const EGG_STEPS = 80;             // flight time of an egg (physics steps, 60 per second)
