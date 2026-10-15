// =========================================================
// GATES — rules shared by the host and the devices.
// Each team plays on its OWN copy of the same field (same gate layout):
//   1. One of the 4 corner circles lights up with a number N (1 … team size − 1).
//   2. Exactly N teammates must stand in that circle for 3 seconds
//      (too few or too many = the 3-second timer starts again).
//   3. Then one of the 5 gates opens — only for that team. Everyone who was
//      NOT in the circle must run through the open gate.
//   4. All through = 1 point. The gate closes and another corner lights up.
// Closed gates are solid fences: go round them. Speed comes from the question round.
// =========================================================

export const FW = 160; export const FH = 90;
export const PR = 2.6;                 // runner radius
export const CR = 11;                  // corner circle radius
export const HOLD = 3;                 // seconds the right number must stay in the circle
export const GL = 16;                  // gate length
export const NGATES = 5;
export const CORNERS = [{ x: 15, y: 15 }, { x: FW - 15, y: 15 }, { x: FW - 15, y: FH - 15 }, { x: 15, y: FH - 15 }];
export const BASE_SPEED = 9; export const SPEED_PER = 1.2; export const MAX_SPEED = 22;
export const speedFor = (rc) => Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER * (rc || 0));
export const inCircle = (p, c) => Math.hypot(p.x - CORNERS[c].x, p.y - CORNERS[c].y) < CR - PR * 0.3;

/** Seeded random so every screen builds the same field. */
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** 5 gates spread over the middle of the field: [{ x, y, o: 'v' (pass left↔right) | 'h' (pass up↕down) }] */
export function makeGates(seed) {
  const r = rng(seed);
  for (let tries = 0; tries < 400; tries++) {
    const gates = [];
    for (let k = 0; k < 400 && gates.length < NGATES; k++) {
      const g = { x: Math.round(34 + r() * (FW - 68)), y: Math.round(22 + r() * (FH - 44)), o: r() < 0.5 ? 'v' : 'h' };
      if (gates.every((q) => Math.hypot(q.x - g.x, q.y - g.y) > 30) && CORNERS.every((c) => Math.hypot(c.x - g.x, c.y - g.y) > CR + GL)) gates.push(g);
    }
    if (gates.length === NGATES) return gates;
  }
  return [{ x: 50, y: 30, o: 'v' }, { x: 110, y: 30, o: 'h' }, { x: 80, y: 45, o: 'v' }, { x: 50, y: 62, o: 'h' }, { x: 110, y: 62, o: 'v' }];
}
/** Ends of a gate's bar. */
export const gateEnds = (g) => (g.o === 'v' ? [{ x: g.x, y: g.y - GL / 2 }, { x: g.x, y: g.y + GL / 2 }] : [{ x: g.x - GL / 2, y: g.y }, { x: g.x + GL / 2, y: g.y }]);

/** Did a move from (ax,ay) to (bx,by) cross the gate's bar? */
export function crosses(g, ax, ay, bx, by, pad = 0) {
  if (g.o === 'v') {
    if ((ax - g.x) * (bx - g.x) > 0 || ax === bx) return false;
    const t = (g.x - ax) / (bx - ax); const y = ay + (by - ay) * t;
    return Math.abs(y - g.y) <= GL / 2 + pad;
  }
  if ((ay - g.y) * (by - g.y) > 0 || ay === by) return false;
  const t = (g.y - ay) / (by - ay); const x = ax + (bx - ax) * t;
  return Math.abs(x - g.x) <= GL / 2 + pad;
}

// ---------- packed runners: 9 characters each ----------
// id(2) x·10(3) y·10(3) flag(1): 0 normal · 1 in the circle when it counted · 2 must go through the gate · 3 went through ✓
const B36 = (n, w) => Math.max(0, Math.min(36 ** w - 1, Math.round(n))).toString(36).padStart(w, '0');
export const packRunner = (p, flag) => B36(p.i, 2) + B36(p.x * 10, 3) + B36(p.y * 10, 3) + flag;
export function unpackRunners(str) {
  const out = [];
  for (let k = 0; k + 9 <= str.length; k += 9) out.push({ i: parseInt(str.slice(k, k + 2), 36), x: parseInt(str.slice(k + 2, k + 5), 36) / 10, y: parseInt(str.slice(k + 5, k + 8), 36) / 10, f: +str[k + 8] });
  return out;
}
