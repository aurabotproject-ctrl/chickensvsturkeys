// =========================================================
// EGG TOSS — shared rules (host + phones)
// A fairground egg-toss stall with 4 rows of rails.
// One team FLINGS eggs, the other team DODGES (slides its chess-piece
// target left and right along its rail). Teams swap every round.
//   • 30 s of questions first:
//       flingers: every right answer = more eggs for this round
//       dodgers:  every right answer = a SMALLER target
//   • then 30 s of egg flinging. Hit the target (not just the piece!)
//     and that piece is knocked down for the rest of the round.
//   • unused eggs are lost at the end of the round.
//   • the team with the most targets hit at the end wins.
// All positions are in a fixed 1600 × 900 "stall" space.
// =========================================================

export const GW = 1600;
export const GH = 900;
/** The part of the stall phones show (no awning or curtains, so the targets are bigger). */
export const PHONE_VIEW = { x0: 74, y0: 150, w: 1452, h: 750 };
export const LANES = 4;
/** Rail (base line) of each row, back row first, and how big pieces look on it. */
export const LANE_Y = [335, 510, 685, 856];
export const LANE_S = [0.7, 0.8, 0.9, 1];
export const PIECE_H = 228;                 // a king on the front rail
export const X_MIN = 120;
export const X_MAX = 1480;
export const SPEED = 470;                   // how fast a dodger slides (stall units per second)
export const FLIGHT = 0.85;                 // seconds an egg is in the air — time to dodge!
export const FLING_MS = 30000;              // the egg-flinging part of each round
export const EGGS_PER_CORRECT = 2;
export const COOLDOWN = 0.4;                // seconds between flings
export const R0 = 54;                       // target radius on the front rail with no right answers
export const MIN_SCALE = 0.3;

/** Dodgers: each right answer shrinks the target by 10%, down to 30%. */
export const targetScale = (rc) => Math.max(MIN_SCALE, 1 - 0.1 * (rc || 0));
/** Round 1: turkeys fling at the chickens. Round 2: chickens fling. And so on. */
export const attackerFor = (round) => (round % 2 === 1 ? 'turkey' : 'chicken');
export const other = (team) => (team === 'turkey' ? 'chicken' : 'turkey');

/** Where the bullseye sits on a piece (its chest) and how big it is. */
export const targetCentre = (p) => ({ x: p.x, y: LANE_Y[p.lane] - PIECE_H * LANE_S[p.lane] * 0.46 });
export const targetR = (p) => R0 * LANE_S[p.lane] * (p.ts ?? 1);

/** How big things look at a height in the stall (for eggs and splats). */
export function scaleAtY(y) {
  if (y <= LANE_Y[0]) return LANE_S[0];
  for (let i = 1; i < LANES; i++) {
    if (y <= LANE_Y[i]) { const k = (y - LANE_Y[i - 1]) / (LANE_Y[i] - LANE_Y[i - 1]); return LANE_S[i - 1] + (LANE_S[i] - LANE_S[i - 1]) * k; }
  }
  return 1;
}

/** Where the k-th of n flingers throws from (just below the counter). */
export const launchX = (k, n) => (n <= 1 ? GW / 2 : 220 + ((GW - 440) * k) / (n - 1));
export const LAUNCH_Y = GH + 80;

/** Egg position part-way through its flight (k = 0 … 1). */
export function eggAt(e, k) {
  const x = e.x0 + (e.x1 - e.x0) * k;
  const lift = 230 + (LAUNCH_Y - e.y1) * 0.35;
  const y = LAUNCH_Y + (e.y1 - LAUNCH_Y) * k - Math.sin(Math.PI * k) * lift;
  const s = 1.5 + (scaleAtY(e.y1) * 0.8 - 1.5) * k;
  return { x, y, s };
}

/** Which standing target (front rows first) an egg landing at x, y hits. */
export function findHit(defenders, x, y) {
  let best = null;
  for (const p of defenders) {
    if (p.out) continue;
    const c = targetCentre(p);
    if (Math.hypot(c.x - x, c.y - y) <= targetR(p) && (!best || p.lane > best.lane)) best = p;
  }
  return best;
}
