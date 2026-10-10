// ADVANCE — board drawing shared by the big screen and the phones (Canvas 2D).
import { sprite } from '../../core/assets.js?v=20261010154056';
import { pieceOf, colourOf, pieceSprite, ADV_ART, ADV_REF_H } from './rules.js?v=20261010154056';

const imgs = new Map();
export function img(name) {
  if (!imgs.has(name)) { const im = new Image(); im.src = sprite(name); imgs.set(name, im); }
  return imgs.get(name);
}
const ready = (im) => im && im.complete && im.naturalWidth > 0;
const TEAM = { chicken: '#1e6fe0', turkey: '#e0402a' };

/**
 * Draw the board into the rectangle (x, y, w, h).
 * opts: flip (turkey phones see their side at the bottom), me (uid), marks [{r,c,kind}], labels (show names)
 *       tiles  — draw each piece as a solid team-colour square (big screen: who is ahead at a glance)
 *       follow — { r, c, zoom, cam } zoomed camera that follows a square (phones). `cam` is a
 *                persistent {x, y} object the caller keeps between frames so the camera glides.
 * Returns the layout { ox, oy, cell, flip } for hit-testing taps.
 */
export function drawBoard(ctx, board, x, y, w, h, opts = {}) {
  const { W, L } = board; const flip = !!opts.flip; const F = opts.follow;
  const disp = (r, c) => (flip ? { dc: W - 1 - c, dr: L - 1 - r } : { dc: c, dr: r });
  let cell; let ox; let oy;
  if (F) {
    // zoomed: about `zoom` squares across the narrower side, camera centred on the followed square
    cell = Math.floor(Math.min(w, h) / F.zoom);
    const t = disp(F.r, F.c); const cam = F.cam;
    const axis = (want, span, n) => { const half = span / cell / 2; const m = 0.45; return n + 2 * m <= span / cell ? n / 2 : Math.max(half - m, Math.min(n + m - half, want)); };
    const tx = axis(t.dc + 0.5, w, W); const ty = axis(t.dr + 0.5, h, L);
    if (cam.x == null || Math.abs(cam.x - tx) > W) { cam.x = tx; cam.y = ty; }
    cam.x += (tx - cam.x) * 0.12; cam.y += (ty - cam.y) * 0.12;
    ox = Math.round(x + w / 2 - cam.x * cell); oy = Math.round(y + h / 2 - cam.y * cell);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#3a2412'; ctx.fillRect(x, y, w, h);
  } else {
    cell = Math.floor(Math.min(w / W, h / L));
    ox = Math.round(x + (w - cell * W) / 2); oy = Math.round(y + (h - cell * L) / 2);
  }
  const pos = (r, c) => { const d = disp(r, c); return { px: ox + d.dc * cell, py: oy + d.dr * cell }; };
  // frame
  ctx.fillStyle = '#5b3a1e'; rr(ctx, ox - cell * 0.25, oy - cell * 0.25, cell * (W + 0.5), cell * (L + 0.5), cell * 0.3); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
  const tint = opts.tiles ? 0.42 : 0.5;
  for (let r = 0; r < L; r++) {
    for (let c = 0; c < W; c++) {
      const { px, py } = pos(r, c);
      ctx.fillStyle = (r + c) % 2 ? '#b97a45' : '#f3d9a4';
      ctx.fillRect(px, py, cell, cell);
      // finish rows: each team's goal is the row the other team starts on
      if (r === 0) { ctx.fillStyle = `rgba(30,111,224,${tint})`; ctx.fillRect(px, py, cell, cell); }
      if (r === L - 1) { ctx.fillStyle = `rgba(224,64,42,${tint})`; ctx.fillRect(px, py, cell, cell); }
    }
  }
  // goal labels on the frame above / below the board
  ctx.font = `normal ${Math.max(9, cell * 0.22)}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const top = flip ? 'TURKEY GOAL' : 'CHICKEN GOAL'; const bot = flip ? 'CHICKEN GOAL' : 'TURKEY GOAL';
  ctx.fillStyle = flip ? '#ffb3a6' : '#9cc8ff'; ctx.fillText(`▲ ${top} ▲`, ox + (cell * W) / 2, oy - cell * 0.13);
  ctx.fillStyle = flip ? '#9cc8ff' : '#ffb3a6'; ctx.fillText(`▼ ${bot} ▼`, ox + (cell * W) / 2, oy + cell * L + cell * 0.13);
  // move / block markers
  for (const m of opts.marks || []) {
    const { px, py } = pos(m.r, m.c);
    ctx.fillStyle = m.kind === 'block' ? 'rgba(255,140,0,.55)' : 'rgba(126,211,33,.6)';
    ctx.strokeStyle = m.kind === 'block' ? '#ff8c00' : '#3b9b0a'; ctx.lineWidth = Math.max(2, cell * 0.06);
    rr(ctx, px + cell * 0.08, py + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${cell * 0.45}px Nunito, sans-serif`;
    ctx.fillText(m.kind === 'block' ? '🧱' : '⬆', px + cell / 2, py + cell / 2 + 1);
  }
  // blocks (hay bales)
  const hay = img('tw_hay1');
  for (const b of board.blocks) {
    const { px, py } = pos(b.r, b.c);
    if (ready(hay)) ctx.drawImage(hay, px + cell * 0.06, py + cell * 0.12, cell * 0.88, cell * 0.8);
    else { ctx.fillStyle = '#e0b84a'; ctx.fillRect(px + cell * 0.1, py + cell * 0.1, cell * 0.8, cell * 0.8); }
    ctx.fillStyle = '#111'; ctx.font = `900 ${cell * 0.3}px Nunito, sans-serif`;
    ctx.fillText(String(b.left), px + cell * 0.82, py + cell * 0.2);
  }
  // pieces (smoothly slide towards their square; tracked in squares so the camera can move freely)
  const sorted = [...board.pieces].sort((a, b) => disp(a.r, a.c).dr - disp(b.r, b.c).dr); // back rows first so pieces overlap nicely
  for (const p of sorted) {
    const t = disp(p.r, p.c);
    if (p.vc == null || p.vflip !== flip) { p.vc = t.dc; p.vr = t.dr; p.vflip = flip; }
    p.vc += (t.dc - p.vc) * 0.25; p.vr += (t.dr - p.vr) * 0.25;
    const px = ox + p.vc * cell; const py = oy + p.vr * cell;
    if (opts.tiles) drawTile(ctx, p, px, py, cell);
    else drawPiece(ctx, p, px, py, cell, { me: p.uid === opts.me, name: opts.labels });
  }
  if (F) { ctx.restore(); if (F.minimap !== false) miniMap(ctx, board, x, y, w, h, flip, opts.me); }
  return { ox, oy, cell, flip, W, L, clip: F ? { x, y, w, h } : null };
}

/** Big screen: a solid team-colour square per player (a star when they are home). */
function drawTile(ctx, p, px, py, cell) {
  const pad = Math.max(1, cell * 0.06);
  ctx.fillStyle = TEAM[p.team] || '#888'; rr(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, cell * 0.14); ctx.fill();
  ctx.lineWidth = Math.max(2, cell * 0.05); ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.22)'; rr(ctx, px + pad * 2, py + pad * 2, cell - pad * 4, (cell - pad * 4) * 0.4, cell * 0.1); ctx.fill();
  if (p.home) { ctx.font = `${cell * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⭐', px + cell / 2, py + cell / 2 + 1); }
}

/** Phones: a small overview of the whole board in the corner (you = yellow). */
function miniMap(ctx, board, x, y, w, h, flip, me) {
  const { W, L } = board; const size = Math.min(92, Math.min(w, h) * 0.3); const c = size / Math.max(W, L);
  const mw = c * W; const mh = c * L; const mx = x + w - mw - 8; const my = y + 8;
  ctx.fillStyle = 'rgba(17,17,17,.75)'; rr(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.fillStyle = '#d9b07a'; ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = 'rgba(30,111,224,.45)'; ctx.fillRect(mx, flip ? my + mh - c : my, mw, c);
  ctx.fillStyle = 'rgba(224,64,42,.45)'; ctx.fillRect(mx, flip ? my : my + mh - c, mw, c);
  for (const b of board.blocks) { const dc = flip ? W - 1 - b.c : b.c; const dr = flip ? L - 1 - b.r : b.r; ctx.fillStyle = '#7a5a1a'; ctx.fillRect(mx + dc * c, my + dr * c, c, c); }
  let mine = null;
  for (const p of board.pieces) {
    const dc = flip ? W - 1 - p.c : p.c; const dr = flip ? L - 1 - p.r : p.r;
    if (p.uid === me) { mine = { dc, dr }; continue; }
    ctx.fillStyle = TEAM[p.team]; ctx.fillRect(mx + dc * c + 0.5, my + dr * c + 0.5, c - 1, c - 1);
  }
  if (mine) { ctx.fillStyle = '#ffc72c'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.fillRect(mx + mine.dc * c - 1, my + mine.dr * c - 1, c + 2, c + 2); ctx.strokeRect(mx + mine.dc * c - 1, my + mine.dr * c - 1, c + 2, c + 2); }
}

export function drawPiece(ctx, p, px, py, cell, { me = false, name = false } = {}) {
  const cx = px + cell / 2; const cy = py + cell / 2;
  const art = pieceSprite(p.team, p.pc);
  const col = colourOf(p.team, p.pc);
  if (me) { ctx.fillStyle = 'rgba(255,199,44,.55)'; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.5, 0, Math.PI * 2); ctx.fill(); }
  if (ADV_ART.has(art) && ready(img(art))) {
    // stand the piece on its square at true relative size (pawns shorter than kings)
    const im = img(art);
    ctx.fillStyle = TEAM[p.team]; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(cx, py + cell * 0.86, cell * 0.36, cell * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    let k = (cell * 1.05) / ADV_REF_H;
    if (im.naturalWidth * k > cell) k = cell / im.naturalWidth;
    const dw = im.naturalWidth * k; const dh = im.naturalHeight * k;
    ctx.drawImage(im, cx - dw / 2, py + cell * 0.9 - dh, dw, dh);
  } else {
    // stand-in: coloured chess token with the piece symbol and the team's bird
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, cy + cell * 0.32, cell * 0.36, cell * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.fill; ctx.strokeStyle = TEAM[p.team]; ctx.lineWidth = Math.max(3, cell * 0.09);
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.38 + Math.max(3, cell * 0.09) / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col.ink; ctx.font = `${cell * 0.5}px "Segoe UI Symbol", "Noto Sans Symbols 2", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pieceOf(p.pc).glyph, cx, cy + cell * 0.03);
    const bird = img(p.team === 'turkey' ? 'ico_turkey' : 'ico_chicken');
    if (ready(bird)) ctx.drawImage(bird, cx + cell * 0.12, cy - cell * 0.5, cell * 0.32, cell * 0.32);
  }
  if (p.home) { ctx.font = `${cell * 0.32}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('⭐', cx - cell * 0.32, cy - cell * 0.32); }
  if (name || me) {
    const label = me ? 'YOU' : p.name;
    ctx.font = `900 ${Math.max(9, cell * 0.22)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.strokeText(label, cx, py + cell - 1); ctx.fillStyle = me ? '#ffc72c' : '#fff'; ctx.fillText(label, cx, py + cell - 1);
    ctx.textBaseline = 'middle';
  }
}

/** Which square was tapped? */
export function hitSquare(layout, x, y) {
  if (!layout) return null;
  const k = layout.clip; if (k && (x < k.x || y < k.y || x > k.x + k.w || y > k.y + k.h)) return null;
  let c = Math.floor((x - layout.ox) / layout.cell); let r = Math.floor((y - layout.oy) / layout.cell);
  if (c < 0 || r < 0 || c >= layout.W || r >= layout.L) return null;
  if (layout.flip) { c = layout.W - 1 - c; r = layout.L - 1 - r; }
  return { r, c };
}

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
