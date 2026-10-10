// EGG TOSS — the stall drawing shared by the big screen and the phones (Canvas 2D).
import { img } from '../advance/draw.js?v=20261010182602';
import { pieceSprite, pieceOf, colourOf, ADV_ART, ADV_REF_H } from '../advance/rules.js?v=20261010182602';
import { GW, GH, LANES, LANE_Y, LANE_S, PIECE_H, targetCentre, targetR, eggAt, scaleAtY } from './rules.js?v=20261010182602';

const ready = (im) => im && im.complete && im.naturalWidth > 0;
const TEAM = { chicken: '#1e6fe0', turkey: '#e0402a' };
const FALL = 450; // ms for a hit piece to topple

/** Fit the 1600×900 stall into a rectangle. */
export function fit(x, y, w, h, V = { x0: 0, y0: 0, w: GW, h: GH }) {
  const s = Math.min(w / V.w, h / V.h);
  return { ox: x + (w - V.w * s) / 2 - V.x0 * s, oy: y + (h - V.h * s) / 2 - V.y0 * s, s, V };
}

/**
 * G = { defenders: [{uid, team, pc, name, lane, x, out, ts, outAt}], eggs: [{x0, x1, y1, k}], splats: [{x, y, kind, t0}] }
 * opts: me (uid), reticle {x, y, team} (stall units), labels (names under pieces), now (performance.now())
 */
export function drawGallery(ctx, G, x, y, w, h, opts = {}) {
  const L = fit(x, y, w, h, opts.view); const now = opts.now ?? performance.now();
  ctx.save();
  ctx.translate(L.ox, L.oy); ctx.scale(L.s, L.s);
  ctx.beginPath(); ctx.rect(L.V.x0, L.V.y0, L.V.w, L.V.h); ctx.clip();
  backdrop(ctx);
  // egg splats on the back wall (misses fade away, hits stay for the round)
  const splat = img('splat'); const big = img('splat_big');
  for (const sp of G.splats || []) {
    const age = (now - sp.t0) / 1000;
    if (sp.kind === 'miss' && age > 5) continue;
    const sc = scaleAtY(sp.y);
    ctx.globalAlpha = sp.kind === 'miss' ? Math.max(0, Math.min(1, 5 - age)) * 0.9 : 1;
    const im = sp.kind === 'hit' ? big : splat;
    if (ready(im)) {
      const grow = Math.min(1, 0.4 + age * 3);
      const dw = (sp.kind === 'hit' ? 150 : 110) * sc * grow; const dh = dw * (im.naturalHeight / im.naturalWidth);
      ctx.drawImage(im, sp.x - dw / 2, sp.y - dh / 2, dw, dh);
    } else { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 30 * sc, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // rails, back row first, each with its pieces
  for (let lane = 0; lane < LANES; lane++) {
    const S = LANE_S[lane]; const by = LANE_Y[lane];
    const list = (G.defenders || []).filter((p) => p.lane === lane);
    for (const p of list) if (p.out) drawFallen(ctx, p, now);
    rail(ctx, by, S);
    for (const p of list) if (!p.out) drawStanding(ctx, p, p.uid === opts.me, opts.labels);
  }
  // eggs in the air
  const egg = img('egg');
  for (const e of G.eggs || []) {
    const k = Math.max(0, Math.min(1, e.k)); const { x: ex, y: ey, s } = eggAt(e, k);
    const dh = 58 * s; const dw = dh * 0.8;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(k * 9);
    if (ready(egg)) ctx.drawImage(egg, -dw / 2, -dh / 2, dw, dh);
    else { ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.ellipse(0, 0, dw / 2, dh / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  if (opts.reticle) reticle(ctx, opts.reticle);
  ctx.restore();
  return L;
}

function backdrop(ctx) {
  // back wall: wooden planks
  ctx.fillStyle = '#6b3f1f'; ctx.fillRect(0, 0, GW, GH);
  for (let x = 0; x < GW; x += 80) {
    ctx.fillStyle = (x / 80) % 2 ? '#7d4a25' : '#734421'; ctx.fillRect(x, 0, 80, GH);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, 0, 3, GH);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(x + 40, 260, 4, 0, Math.PI * 2); ctx.arc(x + 40, 620, 4, 0, Math.PI * 2); ctx.fill();
  }
  // fairy lights
  for (let i = 0; i < 22; i++) {
    const lx = 90 + i * 68; const ly = 168 + Math.sin(i * 0.9) * 6;
    ctx.fillStyle = ['#ffc72c', '#7ed321', '#29b6f6', '#ff5aa5'][i % 4]; ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
  }
  // striped awning
  for (let x = 0, i = 0; x < GW; x += 100, i++) {
    ctx.fillStyle = i % 2 ? '#fff4e0' : '#e0402a'; ctx.fillRect(x, 0, 100, 112);
    ctx.beginPath(); ctx.arc(x + 50, 112, 50, 0, Math.PI); ctx.fill();
  }
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 112); for (let x = 0; x < GW; x += 100) ctx.arc(x + 50, 112, 50, Math.PI, 0, true); ctx.stroke();
  // side curtains
  for (const side of [0, 1]) {
    const x0 = side ? GW - 74 : 0;
    ctx.fillStyle = '#b8251a'; ctx.fillRect(x0, 0, 74, GH);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; for (let k = 0; k < 3; k++) ctx.fillRect(x0 + 14 + k * 22, 0, 6, GH);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.strokeRect(x0, -5, 74, GH + 10);
  }
}

function rail(ctx, by, S) {
  const h = 26 * S;
  ctx.fillStyle = '#c8894d'; ctx.fillRect(74, by - 4, GW - 148, h * 0.45);
  ctx.fillStyle = '#9a5f2c'; ctx.fillRect(74, by - 4 + h * 0.45, GW - 148, h * 0.75);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(74, by - 4, GW - 148, h * 1.2);
}

function pieceImg(p) {
  const art = pieceSprite(p.team, p.pc);
  const im = ADV_ART.has(art) ? img(art) : null;
  return ready(im) ? im : null;
}

function drawPiece(ctx, p, by) {
  const S = LANE_S[p.lane]; const im = pieceImg(p);
  if (im) {
    const k = (PIECE_H * S) / ADV_REF_H; const dw = im.naturalWidth * k; const dh = im.naturalHeight * k;
    ctx.drawImage(im, p.x - dw / 2, by - dh, dw, dh);
  } else { // stand-in token
    const r = PIECE_H * S * 0.32; const col = colourOf(p.team, p.pc);
    ctx.fillStyle = col.fill; ctx.strokeStyle = TEAM[p.team]; ctx.lineWidth = 8 * S;
    ctx.beginPath(); ctx.arc(p.x, by - r * 1.4, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col.ink; ctx.font = `${r * 1.3}px "Segoe UI Symbol", "Noto Sans Symbols 2", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pieceOf(p.pc).glyph, p.x, by - r * 1.4);
  }
}

function drawStanding(ctx, p, me, labels) {
  const by = LANE_Y[p.lane]; const S = LANE_S[p.lane];
  if (me) { ctx.fillStyle = 'rgba(255,199,44,.75)'; ctx.beginPath(); ctx.ellipse(p.x, by + 2, 62 * S, 16 * S, 0, 0, Math.PI * 2); ctx.fill(); }
  drawPiece(ctx, p, by);
  // the bullseye — THIS is what has to be hit
  const c = targetCentre(p); const r = targetR(p);
  const rings = ['#e0402a', '#fff', '#e0402a', '#fff', '#e0402a'];
  rings.forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x, c.y, r * (1 - i * 0.2), 0, Math.PI * 2); ctx.fill(); });
  ctx.lineWidth = Math.max(2, 4 * S); ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3 * S; ctx.strokeStyle = TEAM[p.team]; ctx.beginPath(); ctx.arc(c.x, c.y, r + 3 * S, 0, Math.PI * 2); ctx.stroke();
  if (me || labels) {
    const label = me ? 'YOU' : p.name || '';
    ctx.font = `900 ${Math.round((me ? 30 : 22) * S)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const ty = me ? by - PIECE_H * S - 10 * S : by + 22 * S;
    ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.strokeText(label, p.x, ty); ctx.fillStyle = me ? '#ffc72c' : '#fff'; ctx.fillText(label, p.x, ty);
  }
}

function drawFallen(ctx, p, now) {
  const by = LANE_Y[p.lane]; const S = LANE_S[p.lane];
  const k = Math.min(1, (now - (p.outAt || 0)) / FALL);
  ctx.save();
  ctx.globalAlpha = 1 - k * 0.45;
  ctx.translate(p.x, by + k * 30 * S); ctx.rotate(k * 1.45 * (p.x > 800 ? 1 : -1)); ctx.translate(-p.x, -by);
  drawPiece(ctx, p, by);
  ctx.restore();
}

function reticle(ctx, r) {
  const col = TEAM[r.team] || '#ffc72c';
  ctx.lineWidth = 9; ctx.strokeStyle = '#111';
  ctx.beginPath(); ctx.arc(r.x, r.y, 40, 0, Math.PI * 2); ctx.stroke();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(r.x + dx * 22, r.y + dy * 22); ctx.lineTo(r.x + dx * 60, r.y + dy * 60); ctx.stroke(); }
  ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.arc(r.x, r.y, 40, 0, Math.PI * 2); ctx.stroke();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(r.x + dx * 22, r.y + dy * 22); ctx.lineTo(r.x + dx * 60, r.y + dy * 60); ctx.stroke(); }
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r.x, r.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
}

/** Stall position of a point on the canvas. */
export function toStall(L, cx, cy) { return { x: (cx - L.ox) / L.s, y: (cy - L.oy) / L.s }; }
