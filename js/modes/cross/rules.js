// =========================================================
// CROSS THE ROAD — shared rules (big screen + phones + bots)
// "Why did the chicken cross the road?"
//   • every right answer = 4 hops (bank up to 12)
//   • hop your bird up the field: roads (don't get splatted!), rivers
//     (ride the logs — don't fall in!), grass strips are safe
//   • reach the far side = 1 point for your team, then start again
//   • splatted / splashed = back to the start
// The traffic runs on a shared clock (seed + start time), so every
// screen sees the same tractor in the same place at the same moment.
// Rows run 0 (start, bottom) … L-1 (finish, top). x is in squares.
// =========================================================

export const W = 15;              // columns
export const L = 15;              // rows (0 = start grass, L-1 = finish grass)
export const HOPS_PER = 4;        // hops for each right answer
export const MAX_HOPS = 12;       // most hops you can bank
export const PAD = 3;             // vehicles/logs drive this far off each edge before looping
export const LOOP = W + PAD * 2;  // length of one loop of a lane

/** Small seeded random generator so every screen builds the same field. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vehicles (art faces right; flipped for lanes driving left). len in squares. */
export const VEHICLES = [
  { k: 'tractor_c', len: 1.5, img: 'tw_tractor_c1' },
  { k: 'tractor_t', len: 1.5, img: 'tw_tractor_t1' },
  { k: 'van', len: 2, img: 'fm_van' },
  { k: 'truck', len: 2, img: 'fm_truck' },
  { k: 'cart', len: 2, img: 'cr_haycart' },
  { k: 'quad', len: 1.4, img: 'cr_quad' },
  { k: 'semi', len: 3, img: 'fm_semi' },
];
export const SCENERY = ['fm_tree', 'fm_tree2', 'tw_rocks', 'tw_stump', 'tw_hay_round'];

/** Build the whole field from a seed. */
export function makeField(seed) {
  const R = rng(seed);
  const lanes = new Array(L);
  lanes[0] = { type: 'start' };
  lanes[L - 1] = { type: 'finish' };
  let r = 1; let kind = R() < 0.5 ? 'road' : 'river'; let dir = R() < 0.5 ? 1 : -1;
  while (r < L - 1) {
    const n = Math.min(L - 1 - r, 2 + Math.floor(R() * 2));
    for (let i = 0; i < n; i++) {
      const depth = r / (L - 1); // lanes further up are a bit faster
      lanes[r] = kind === 'road' ? roadLane(R, dir, depth) : riverLane(R, dir, depth, !lanes[r - 1]?.lily);
      dir = -dir; r += 1;
    }
    if (r < L - 1) { lanes[r] = grassLane(R); r += 1; }
    kind = kind === 'road' ? 'river' : 'road';
  }
  return { seed, W, L, lanes };
}

function roadLane(R, dir, depth) {
  const v = dir * (0.95 + depth * 0.75 + R() * 0.8);
  const objs = [];
  let pos = R() * 3;
  const pick = () => VEHICLES[Math.floor(R() * VEHICLES.length)];
  for (let guard = 0; guard < 12; guard++) {
    const veh = pick();
    if (pos + veh.len > LOOP - 1.5) break;
    objs.push({ o: pos, len: veh.len, img: veh.img });
    pos += veh.len + 3 + R() * 3.5;
  }
  return { type: 'road', v, objs };
}

function riverLane(R, dir, depth, allowLily = true) {
  // sometimes a still pond lane with lily pads to hop across (they don't move)
  if (R() < 0.22 && allowLily) {
    const cols = new Set(); const n = 5 + Math.floor(R() * 3);
    while (cols.size < n) cols.add(Math.floor(R() * W));
    return { type: 'river', v: 0, lily: true, objs: [...cols].map((c) => ({ o: c + PAD, len: 1 })) };
  }
  const v = dir * (0.6 + depth * 0.45 + R() * 0.5);
  const objs = [];
  let pos = R() * 2;
  for (let guard = 0; guard < 12; guard++) {
    const len = 2 + Math.floor(R() * 3); // 2–4 squares long
    if (pos + len > LOOP - 0.8) break;
    objs.push({ o: pos, len });
    pos += len + 1.3 + R() * 2.1;
  }
  return { type: 'river', v, objs };
}

function grassLane(R) {
  const n = 1 + Math.floor(R() * 4);
  const cols = new Set();
  while (cols.size < n) cols.add(Math.floor(R() * W));
  return { type: 'grass', obs: [...cols].map((c) => ({ c, img: SCENERY[Math.floor(R() * SCENERY.length)] })) };
}

/** Left edge (in squares) of a vehicle/log at time t (seconds). */
export function objX(lane, obj, t) {
  return ((((obj.o + lane.v * t) % LOOP) + LOOP) % LOOP) - PAD;
}
/** Is a bird at x on this road lane being hit right now? */
export function roadHit(lane, x, t) {
  if (!lane || lane.type !== 'road') return false;
  for (const o of lane.objs) { const ox = objX(lane, o, t); if (ox < x + 0.8 && ox + o.len > x + 0.2) return true; }
  return false;
}
/** The log under a bird at x on a river lane (or null = in the water!). */
export function logUnder(lane, x, t) {
  if (!lane || lane.type !== 'river') return null;
  const c = x + 0.5;
  for (const o of lane.objs) { const ox = objX(lane, o, t); if (ox - 0.1 <= c && ox + o.len + 0.1 >= c) return o; }
  return null;
}
export const blocked = (lane, col) => !!lane && lane.type === 'grass' && lane.obs.some((o) => o.c === col);

/**
 * Try a hop. dir = 'u' | 'd' | 'l' | 'r'.
 * Returns null if the hop isn't allowed (edge, tree in the way), otherwise
 * { r, x, dead?: 'road'|'river', cross?: true }.
 */
export function tryHop(field, b, dir, t) {
  let r = b.r + (dir === 'u' ? 1 : dir === 'd' ? -1 : 0);
  let x = b.x + (dir === 'l' ? -1 : dir === 'r' ? 1 : 0);
  if (r < 0 || r > L - 1) return null;
  const lane = field.lanes[r];
  if (lane.type === 'river') {
    if (x < -0.45 || x > W - 0.55) return null;
  } else {
    x = Math.round(x);
    if (x < 0 || x > W - 1) return null;
    if (blocked(lane, x)) return null;
  }
  if (lane.type === 'river' && !logUnder(lane, x, t)) return { r, x, dead: 'river' };
  if (lane.type === 'road' && roadHit(lane, x, t)) return { r, x, dead: 'road' };
  if (r === L - 1) return { r, x, cross: true };
  return { r, x };
}

/**
 * Move a bird along with time: ride logs, and check for traffic.
 * Returns 'road' | 'river' if the bird just got splatted/splashed, else null.
 */
export function stepBird(field, b, dt, t) {
  const lane = field.lanes[b.r];
  if (!lane) return null;
  if (lane.type === 'river') {
    if (!logUnder(lane, b.x, t)) return 'river';
    b.x += lane.v * dt;
    if (b.x < -0.5 || b.x > W - 0.5) return 'river'; // carried off the edge
    return null;
  }
  if (lane.type === 'road' && roadHit(lane, b.x, t)) return 'road';
  return null;
}

/** A random start square on the bottom row. */
export const startCol = () => Math.floor(Math.random() * W);

/** Is this square dangerous right now or in the next `ahead` seconds? (used by bots) */
export function danger(field, r, x, t, ahead = 0.6) {
  const lane = field.lanes[r];
  if (!lane) return true;
  if (lane.type === 'road') { for (let k = 0; k <= 4; k++) if (roadHit(lane, x, t + (ahead * k) / 4)) return true; return false; }
  if (lane.type === 'river') return !logUnder(lane, x, t) || !logUnder(lane, x + lane.v * 0.5, t + 0.5);
  return blocked(lane, Math.round(x));
}

/** How many dangerous rows (road/river) are straight ahead before the next safe grass strip. */
export function dangerAhead(field, r) {
  let k = 0;
  for (let rr = r + 1; rr < L - 1; rr++) { const ty = field.lanes[rr].type; if (ty === 'road' || ty === 'river') k += 1; else break; }
  return k;
}
