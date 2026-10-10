// ADVANCE — board drawing shared by the big screen and the phones (Canvas 2D).
import { sprite } from '../../core/assets.js?v=20261010153644';
import { pieceOf, colourOf, pieceSprite, ADV_ART, ADV_REF_H } from './rules.js?v=20261010153644';

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
 * Returns the layout { ox, oy, cell, flip } for hit-testing taps.
 */
export function drawBoard(ctx, board, x, y, w, h, opts = {}) {
  const { W, L } = board; const flip = !!opts.flip;
  const cell = Math.floor(Math.min(w / W, h / L));
  const ox = Math.round(x + (w - cell * W) / 2); const oy = Math.round(y + (h - cell * L) / 2);
  const pos = (r, c) => (flip ? { px: ox + (W - 1 - c) * cell, py: oy + (L - 1 - r) * cell } : { px: ox + c * cell, py: oy + r * cell });
  // frame
  ctx.fillStyle = '#5b3a1e'; rr(ctx, ox - cell * 0.25, oy - cell * 0.25, cell * (W + 0.5), cell * (L + 0.5), cell * 0.3); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
  for (let r = 0; r < L; r++) {
    for (let c = 0; c < W; c++) {
      const { px, py } = pos(r, c);
      ctx.fillStyle = (r + c) % 2 ? '#b97a45' : '#f3d9a4';
      ctx.fillRect(px, py, cell, cell);
      // finish rows: each team's goal is the row the other team starts on
      if (r === 0) { ctx.fillStyle = 'rgba(30,111,224,.5)'; ctx.fillRect(px, py, cell, cell); }
      if (r === L - 1) { ctx.fillStyle = 'rgba(224,64,42,.5)'; ctx.fillRect(px, py, cell, cell); }
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
  // pieces (smoothly slide towards their square)
  for (const p of board.pieces) {
    const t = pos(p.r, p.c);
    if (p.dx == null) { p.dx = t.px; p.dy = t.py; }
    p.dx += (t.px - p.dx) * 0.25; p.dy += (t.py - p.dy) * 0.25;
    drawPiece(ctx, p, p.dx, p.dy, cell, { me: p.uid === opts.me, name: opts.labels });
  }
  return { ox, oy, cell, flip, W, L };
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
  let c = Math.floor((x - layout.ox) / layout.cell); let r = Math.floor((y - layout.oy) / layout.cell);
  if (c < 0 || r < 0 || c >= layout.W || r >= layout.L) return null;
  if (layout.flip) { c = layout.W - 1 - c; r = layout.L - 1 - r; }
  return { r, c };
}

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
