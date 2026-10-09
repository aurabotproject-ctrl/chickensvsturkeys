// =========================================================
// COOP WARS — map generation + rules shared by host and phones.
// Map space: 1600 × 900. Chickens start on the left, turkeys on
// the right. The map is point-symmetric so both sides are fair.
// =========================================================
export const MAP_W = 1600;
export const MAP_H = 900;

// Building kinds
//   coop  – makes troops (chicken coop / turkey barn depending on owner)
//   shed  – tractor shed: sends tractors worth 2
//   fort  – the Grand Barn in the middle: big, grows 3× faster, max 150
//   sniper – Egg Sniper watchtower: no troops, shoots enemy troops in range
//   gold  – golden egg pile: march troops to it to collect bonus troops
export const KINDS = {
  coop: { max: 63, gen: true, r: 40 },
  shed: { max: 63, gen: true, r: 40 },
  fort: { max: 150, gen: true, r: 62 },
  sniper: { max: 63, gen: false, r: 38 },
  gold: { max: 99, gen: false, r: 34 },
};

export const PATH_LEVELS = [10, 20]; // level needed for the 2nd and 3rd path
export function maxPaths(b) {
  if (!KINDS[b.k]?.gen) return 0;
  const n = 1 + (b.lv >= PATH_LEVELS[0] ? 1 : 0) + (b.lv >= PATH_LEVELS[1] ? 1 : 0);
  return b.k === 'fort' ? n + 1 : n;
}

// ---------- seeded random so host + phones can rebuild the same decorations ----------
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Builds a map for `starts` start coops per team.
 * Returns { b: [{x,y,k,team,lv}], walls: [[x1,y1,x2,y2]], seed, startIdx: { chicken:[i], turkey:[i] } }
 */
export function generateMap(starts, seed = Math.floor(Math.random() * 1e9)) {
  const R = rng(seed);
  const n = Math.max(1, starts);
  const half = []; // points for the LEFT half (chicken side); mirrored later
  const neutrals = Math.max(4, Math.min(14, Math.round(n * 1.1) + 3));
  const area = 720 * 760;
  let minD = Math.max(66, Math.min(130, Math.sqrt(area / ((n + neutrals + 3) * 1.25))));
  const ok = (x, y, d) => half.every((p) => Math.hypot(p.x - x, p.y - y) >= d) && Math.hypot(x - MAP_W / 2, y - MAP_H / 2) > 140;
  const place = (k, x0, x1, extra = {}) => {
    for (let d = minD, tries = 0; tries < 4000; tries++) {
      if (tries && tries % 400 === 0) d *= 0.9;
      const x = x0 + R() * (x1 - x0); const y = 80 + R() * (MAP_H - 160);
      // also keep away from the mirrored copies of existing points
      const mx = MAP_W - x; const my = MAP_H - y;
      if (ok(x, y, d) && Math.hypot(mx - x, my - y) >= d && half.every((p) => Math.hypot(MAP_W - p.x - x, MAP_H - p.y - y) >= d)) {
        half.push({ x, y, k, ...extra }); return true;
      }
    }
    return false;
  };
  for (let i = 0; i < n; i++) place('coop', 70, 360, { start: true });
  place('sniper', 330, 640);
  if (n >= 2) place('shed', 300, 620);
  place('gold', 420, 720);
  for (let i = 0; i < neutrals; i++) place('coop', 330, 760);

  const b = [];
  const startIdx = { chicken: [], turkey: [] };
  for (const p of half) {
    const dist = Math.hypot(p.x - MAP_W / 2, p.y - MAP_H / 2);
    const lvN = p.k === 'gold' ? 12 + Math.floor(R() * 10) : Math.round(4 + (1 - Math.min(1, dist / 800)) * 12 + R() * 4);
    const left = { x: Math.round(p.x), y: Math.round(p.y), k: p.k, team: null, lv: p.start ? 10 : lvN };
    const right = { ...left, x: MAP_W - left.x, y: MAP_H - left.y };
    if (p.start) { left.team = 'chicken'; right.team = 'turkey'; startIdx.chicken.push(b.length); startIdx.turkey.push(b.length + 1); }
    b.push(left, right);
  }
  if (n >= 2) b.push({ x: MAP_W / 2, y: MAP_H / 2, k: 'fort', team: null, lv: 30 + n * 2 });

  // a few hay-bale walls between the halves (mirrored), never touching buildings
  const walls = [];
  const wallCount = n >= 3 ? 2 : 1;
  for (let w = 0, tries = 0; w < wallCount && tries < 300; tries++) {
    const cx = 480 + R() * 260; const cy = 120 + R() * (MAP_H - 240);
    const ang = (R() - 0.5) * 1.4 + Math.PI / 2; const len = 110 + R() * 70;
    const x1 = cx + Math.cos(ang) * len / 2; const y1 = cy + Math.sin(ang) * len / 2;
    const x2 = cx - Math.cos(ang) * len / 2; const y2 = cy - Math.sin(ang) * len / 2;
    const seg = [x1, y1, x2, y2].map(Math.round);
    if (b.some((q) => distToSeg(q.x, q.y, seg) < (KINDS[q.k].r + 26))) continue;
    walls.push(seg, [MAP_W - seg[0], MAP_H - seg[1], MAP_W - seg[2], MAP_H - seg[3]]);
    w += 1;
  }
  return { b, walls, seed, startIdx };
}

// ---------- geometry ----------
export function distToSeg(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1; const dy = y2 - y1; const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
export function segmentsCross(a, b) {
  const [x1, y1, x2, y2] = a; const [x3, y3, x4, y4] = b;
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
}
/** Can troops walk in a straight line from building a to b? */
export function pathClear(a, b, walls) {
  const seg = [a.x, a.y, b.x, b.y];
  return !walls.some((w) => segmentsCross(seg, w) || distToSeg(w[0], w[1], seg) < 14 || distToSeg(w[2], w[3], seg) < 14);
}

/** Why a path can't be drawn (or '' if it can). `team` = team of the player trying (any team building can be used). */
export function pathProblem(map, from, to, team) {
  const a = map.b[from]; const b = map.b[to];
  if (!a || !b || from === to) return 'Pick a different building.';
  if (!a.team || a.team !== team) return 'Start from one of YOUR TEAM\'s buildings.';
  if (!KINDS[a.k].gen) return a.k === 'sniper' ? 'Egg Snipers guard — they don\'t send troops.' : 'That building can\'t send troops.';
  if ((a.paths || []).includes(to)) return '';
  if ((a.paths || []).length >= maxPaths(a)) {
    const need = (a.paths || []).length === 1 ? PATH_LEVELS[0] : PATH_LEVELS[1];
    return a.paths.length >= 3 || (a.k === 'fort' && a.paths.length >= 4) ? 'Maximum paths reached — cut one first.' : `Level ${need} needed for another path. Answer questions to grow!`;
  }
  if (!pathClear(a, b, map.walls || [])) return 'Hay bales are blocking that path!';
  return '';
}

export const tier = (lv) => (lv < 10 ? 1 : lv < 20 ? 2 : lv < 35 ? 3 : lv < 55 ? 4 : 5);
