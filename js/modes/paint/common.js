// =========================================================
// LAND GRAB (paper.io style) — shared by the host and the phones.
// The field is a grid. Each cell is owned by a player (or empty);
// trails are a second grid. Both are sent to phones run-length encoded.
// =========================================================

export const GW = 160;            // grid width  (cells)
export const GH = 90;             // grid height (cells) — 16:9
export const START_R = 2;         // starting patch radius (5 × 5)
export const BASE_SPEED = 5;      // cells per second with no right answers
export const SPEED_PER = 1;       // + per right answer
export const MAX_SPEED = 14;
export const BATTLE_MS = 30000;
export const speedFor = (correct) => Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER * (correct || 0));

// 52 player slots (letters); '.' = empty
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const MAX_PLAYERS = ALPHA.length;

/** Uint8Array (0 = empty, n = player n) → "A12.40B3…" */
export function encode(arr) {
  let out = ''; let i = 0;
  while (i < arr.length) {
    const v = arr[i]; let n = 1;
    while (i + n < arr.length && arr[i + n] === v) n++;
    out += (v ? ALPHA[v - 1] : '.') + (n > 1 ? n : '');
    i += n;
  }
  return out;
}
export function decode(str, into = new Uint8Array(GW * GH)) {
  let i = 0; let k = 0;
  while (k < str.length && i < into.length) {
    const c = str[k++]; let num = '';
    while (k < str.length && str.charCodeAt(k) >= 48 && str.charCodeAt(k) <= 57) num += str[k++];
    const n = num ? +num : 1; const v = c === '.' ? 0 : ALPHA.indexOf(c) + 1;
    into.fill(v, i, Math.min(into.length, i + n)); i += n;
  }
  return into;
}

/** Each player gets their own shade: chickens = cool colours, turkeys = warm colours. */
const COOL = [210, 190, 250, 170, 230, 280, 200, 160, 240, 265, 180, 220];
const WARM = [5, 25, 340, 40, 15, 355, 30, 325, 10, 50, 0, 20];
export function colorFor(team, k) {
  const hues = team === 'turkey' ? WARM : COOL;
  const h = hues[k % hues.length]; const round = Math.floor(k / hues.length);
  const l = [58, 48, 66, 42][round % 4]; const s = team === 'turkey' ? 82 : 75;
  return { h, s, l };
}
export const hsl = (c, dl = 0, a = 1) => `hsla(${c.h}, ${c.s}%, ${Math.max(5, Math.min(95, c.l + dl))}%, ${a})`;
export function rgbOf(c, dl = 0) {
  const s = c.s / 100; const l = Math.max(0.05, Math.min(0.95, (c.l + dl) / 100));
  const k = (n) => (n + c.h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Paint the territory + trails into a small canvas (1 pixel per cell);
 * the caller scales it up with smoothing for soft, paper.io-like edges.
 */
export function paintGrid(ctx, own, trail, palette, { shade = 0 } = {}) {
  const img = ctx.createImageData(GW, GH); const d = img.data;
  for (let i = 0; i < own.length; i++) {
    const t = trail[i]; const o = own[i];
    const p = t ? palette[t] : o ? palette[o] : null;
    if (!p) continue;
    const rgb = t ? p.trailRgb : (shade ? p.darkRgb : p.rgb);
    const j = i * 4; d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = t ? 235 : 255;
  }
  ctx.putImageData(img, 0, 0);
}
export function makePalette(list) {
  // list: [{ i, team, k }]
  const pal = [];
  for (const p of list) {
    const c = colorFor(p.team, p.k);
    pal[p.i] = { c, rgb: rgbOf(c), darkRgb: rgbOf(c, -18), trailRgb: rgbOf(c, 14), css: hsl(c), dark: hsl(c, -22) };
  }
  return pal;
}
