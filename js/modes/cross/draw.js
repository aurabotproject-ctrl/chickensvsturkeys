// CROSS THE ROAD — field drawing shared by the big screen and the phones (Canvas 2D).
import { img } from '../advance/draw.js?v=20261010200014';
import { W, L, objX } from './rules.js?v=20261010200014';

const ready = (im) => im && im.complete && im.naturalWidth > 0;
const TEAM = { chicken: '#1e6fe0', turkey: '#e0402a' };
/** Art that exists (CROSS_ROAD_IMAGE_PROMPTS.md). Missing pieces are drawn in code. */
export const CR_ART = new Set(['cr_haycart', 'cr_quad', 'cr_log2', 'cr_log3', 'cr_log4', 'cr_lilypad', 'cr_flat_c', 'cr_flat_t', 'cr_splash', 'cr_soggy_c', 'cr_win_c', 'cr_win_t', 'cr_truck', 'cr_van', 'cr_semi', 'cr_tractor_c', 'cr_tractor_t']);
const art = (name) => {
  if (name.startsWith('cr_') && !CR_ART.has(name)) return null;
  const im = img(name); return ready(im) ? im : null;
};

/**
 * Draw the field into (x, y, w, h).
 * S = { field, t, birds: [{uid, team, name, r, x, hop (0..1), face (-1|1)}], fx: [{kind, r, x, t0}] }
 * opts: me (uid), labels (names), follow { r, x, zoom, cam } (phones: zoomed camera on my bird)
 * Returns the layout { ox, oy, cell }.
 */
export function drawField(ctx, S, x, y, w, h, opts = {}) {
  const { field, t } = S; const F = opts.follow;
  let cell; let ox; let oy;
  const rowY = (r) => (L - 1 - r); // row 0 is drawn at the bottom
  if (F) {
    cell = Math.floor(Math.min(w / F.zoom, h / (F.zoom * 1.2)));
    const cam = F.cam;
    const axis = (want, span, n) => { const half = span / cell / 2; return n <= span / cell ? n / 2 : Math.max(half, Math.min(n - half, want)); };
    const tx = axis(F.x + 0.5, w, W); const ty = axis(rowY(F.r) + 0.5 - 1.2, h, L); // look a little ahead (up the field)
    if (cam.x == null || Math.abs(cam.y - ty) > 6) { cam.x = tx; cam.y = ty; }
    cam.x += (tx - cam.x) * 0.15; cam.y += (ty - cam.y) * 0.15;
    ox = x + w / 2 - cam.x * cell; oy = y + h / 2 - cam.y * cell;
  } else {
    cell = Math.floor(Math.min(w / W, h / L));
    ox = Math.round(x + (w - cell * W) / 2); oy = Math.round(y + (h - cell * L) / 2);
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(F ? x : ox, F ? y : oy, F ? w : cell * W, F ? h : cell * L); ctx.clip();
  if (F) { ctx.fillStyle = '#2f5a1a'; ctx.fillRect(x, y, w, h); }

  for (const b of S.birds || []) { // smooth movement: snap after a respawn, otherwise glide
    if (b.dr == null || Math.abs(b.dr - b.r) > 1.5 || Math.abs(b.dx - b.x) > 2.5) { b.dr = b.r; b.dx = b.x; }
    b.dr += (b.r - b.dr) * 0.35; b.dx += (b.x - b.dx) * 0.35;
    if (Math.abs(b.r - b.dr) < 0.01) b.dr = b.r;
    b.hop = 1 - Math.min(1, Math.abs(b.r - b.dr) * 1.4 + (field.lanes[b.r]?.type === 'river' ? 0 : Math.abs(b.x - b.dx) * 1.4));
  }
  // lanes, far (top) to near (bottom) so nearer things overlap
  for (let r = L - 1; r >= 0; r--) {
    const lane = field.lanes[r]; const ly = oy + rowY(r) * cell;
    drawLaneGround(ctx, lane, r, ox, ly, cell, t);
  }
  for (let r = L - 1; r >= 0; r--) {
    const lane = field.lanes[r]; const ly = oy + rowY(r) * cell;
    if (lane.type === 'river') for (const o of lane.objs) (lane.lily ? drawLily : drawLog)(ctx, ox + objX(lane, o, t) * cell, ly, o.len * cell, cell, o.len);
    if (lane.type === 'road') for (const o of lane.objs) drawVehicle(ctx, o, ox + objX(lane, o, t) * cell, ly, cell, lane.v < 0, t);
    if (lane.type === 'grass') for (const o of lane.obs) drawScenery(ctx, o.img, ox + o.c * cell, ly, cell);
    // birds on this row (they glide between squares with a little hop)
    for (const b of S.birds || []) if (Math.round(b.dr ?? b.r) === r) drawBird(ctx, b, ox + b.dx * cell, oy + rowY(b.dr) * cell, cell, b.uid === opts.me, opts.labels);
  }
  // effects (splats, splashes, crossings)
  const now = performance.now();
  for (const f of S.fx || []) {
    const k = (now - f.t0) / 1400; if (k < 0 || k >= 1) continue;
    const fx = ox + (f.x + 0.5) * cell; const fy = oy + (rowY(f.r) + 0.5) * cell;
    if (f.kind === 'road') splat(ctx, fx, fy, cell, k, f.team);
    else if (f.kind === 'river') splash(ctx, fx, fy, cell, k, f.team);
    else if (f.kind === 'cross') cheer(ctx, fx, fy, cell, k, f.team);
  }
  ctx.restore();
  // frame around the whole field on the big screen
  if (!F) { ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.strokeRect(ox - 2, oy - 2, cell * W + 4, cell * L + 4); }
  return { ox, oy, cell };
}

function drawLaneGround(ctx, lane, r, ox, y, cell, t) {
  const w = W * cell; const big = cell * 40; const x0 = ox - big; const ww = w + big * 2;
  if (lane.type === 'road') {
    ctx.fillStyle = '#4b5059'; ctx.fillRect(x0, y, ww, cell);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x0, y + cell - 3, ww, 3);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let k = -40; k < W + 40; k += 1.6) ctx.fillRect(ox + k * cell, y - 1.5, cell * 0.7, 3); // lane markings
  } else if (lane.type === 'river') {
    ctx.fillStyle = '#2b8ad8'; ctx.fillRect(x0, y, ww, cell);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1.5, cell * 0.04);
    const shift = (t * lane.v * 0.5) % 2;
    for (let k = -40; k < W + 40; k += 2) {
      const wx = ox + (k + shift) * cell; const wy = y + cell * (0.35 + 0.3 * ((k / 2) % 2 ? 1 : 0));
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + cell * 0.25, wy - cell * 0.12, wx + cell * 0.5, wy); ctx.stroke();
    }
  } else {
    const special = lane.type === 'start' || lane.type === 'finish';
    ctx.fillStyle = lane.type === 'finish' ? '#b9e07a' : r % 2 ? '#8fd14f' : '#84c646'; ctx.fillRect(x0, y, ww, cell);
    ctx.fillStyle = 'rgba(40,90,20,.25)';
    for (let k = -40; k < W + 40; k++) { const tx = ox + (k + ((k * 37 + r * 11) % 7) / 7) * cell; ctx.fillRect(tx, y + cell * (0.3 + ((k * 13 + r) % 5) / 10), cell * 0.06, cell * 0.14); }
    if (special) {
      ctx.save();
      ctx.font = `normal ${cell * 0.62}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = lane.type === 'finish' ? 'rgba(120,80,0,.35)' : 'rgba(30,70,10,.3)';
      const label = lane.type === 'finish' ? '★ SAFE ON THE OTHER SIDE! ★' : 'START';
      ctx.fillText(label, ox + (W * cell) / 2, y + cell * 0.55);
      ctx.restore();
      if (lane.type === 'finish') { // little fence along the top
        ctx.fillStyle = '#c8894d'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.fillRect(x0, y + 2, ww, cell * 0.08);
        for (let k = -40; k < W + 40; k++) { ctx.fillRect(ox + (k + 0.45) * cell, y, cell * 0.1, cell * 0.28); }
      }
    }
  }
}

/** Log art, stretched in the middle so any length looks right (3-slice). */
function drawLog(ctx, x, y, w, cell, len = 2) {
  const im = art(len >= 4 ? 'cr_log4' : len === 3 ? 'cr_log3' : 'cr_log2');
  if (im) {
    const h = cell * 0.86; const s = h / im.naturalHeight; const iw = im.naturalWidth; const ih = im.naturalHeight;
    const lw = iw * 0.2; const rw = iw * 0.3; const dl = lw * s; const dr = rw * s; const dy = y + (cell - h) / 2 + cell * 0.04;
    const mid = Math.max(0, w - dl - dr);
    ctx.drawImage(im, 0, 0, lw, ih, x, dy, dl, h);
    ctx.drawImage(im, lw, 0, iw - lw - rw, ih, x + dl, dy, mid, h);
    ctx.drawImage(im, iw - rw, 0, rw, ih, x + dl + mid, dy, dr, h);
    return;
  }
  codeLog(ctx, x, y, w, cell);
}
function drawLily(ctx, x, y, w, cell) {
  const im = art('cr_lilypad');
  if (im) { const s = (cell * 1.0) / im.naturalWidth; const dh = im.naturalHeight * s; ctx.drawImage(im, x, y + (cell - dh) / 2 + cell * 0.05, cell, dh); return; }
  ctx.fillStyle = '#2e8b3a'; ctx.beginPath(); ctx.ellipse(x + cell / 2, y + cell / 2, cell * 0.42, cell * 0.3, 0, 0, Math.PI * 2); ctx.fill();
}
function codeLog(ctx, x, y, w, cell) {
  const h = cell * 0.68; const ly = y + (cell - h) / 2;
  ctx.fillStyle = '#8a5528'; ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, cell * 0.05);
  rr(ctx, x + 2, ly, w - 4, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a8703a'; rr(ctx, x + 6, ly + h * 0.14, w - 12, h * 0.28, h * 0.14); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
  for (let k = 1; k < w / cell; k++) { ctx.beginPath(); ctx.moveTo(x + k * cell - cell * 0.2, ly + h * 0.55); ctx.lineTo(x + k * cell + cell * 0.2, ly + h * 0.55); ctx.stroke(); }
  // cut end
  ctx.fillStyle = '#e2b47a'; ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1.5, cell * 0.04);
  ctx.beginPath(); ctx.ellipse(x + w - 2 - h * 0.28, ly + h / 2, h * 0.26, h * 0.44, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,70,20,.6)'; ctx.beginPath(); ctx.ellipse(x + w - 2 - h * 0.28, ly + h / 2, h * 0.12, h * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
}

/**
 * Bumpy ride: a constant little engine rumble, plus every so often a bump in the road
 * (a quick hop with a tilt, back wheels then front). Each vehicle has its own rhythm.
 */
function bumpy(o, t) {
  const seed = o.o * 7.31 + o.len * 3.7;
  const rumble = Math.sin(t * 31 + seed) * 0.6 + Math.sin(t * 47 + seed * 2) * 0.4; // -1..1, fast and small
  const period = 1.6 + ((seed * 13.7) % 1.4); // a bump every 1.6–3 s
  const ph = ((t + seed) % period) / period; // 0..1
  const k = ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0; // the bump itself (~0.3 s)
  const tilt = ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI * 2) : 0; // nose up, then nose down
  return { dy: -k, rumble, tilt };
}
function drawVehicle(ctx, o, x, y, cell, left, t = 0) {
  const bw = o.len * cell; const im = art(o.img) || (o.fb ? art(o.fb) : null);
  const b = bumpy(o, t);
  const lift = b.dy * cell * 0.1 + b.rumble * cell * 0.012; const rot = b.tilt * 0.045 + b.rumble * 0.006;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + bw / 2, y + cell * 0.88, bw * 0.45 * (1 + b.dy * 0.1), cell * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  if (im) {
    const s = Math.min((bw * 1.02) / im.naturalWidth, (cell * 1.25) / im.naturalHeight);
    const dw = im.naturalWidth * s; const dh = im.naturalHeight * s;
    ctx.save(); ctx.translate(x + bw / 2, y + cell * 0.95 + lift);
    if (left) ctx.scale(-1, 1);
    ctx.rotate(-rot);
    ctx.drawImage(im, -dw / 2, -dh, dw, dh); ctx.restore();
  } else if (o.img === 'cr_haycart') { // hay cart drawn in code until the art arrives
    ctx.save(); ctx.translate(x + bw / 2, y); if (left) ctx.scale(-1, 1);
    ctx.fillStyle = '#9a5f2c'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    rr(ctx, -bw * 0.45, cell * 0.38, bw * 0.9, cell * 0.36, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2c94c'; rr(ctx, -bw * 0.42, cell * 0.08, bw * 0.84, cell * 0.36, 10); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c99a1e'; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * bw * 0.12, cell * 0.12); ctx.lineTo(k * bw * 0.12 + 6, cell * 0.4); ctx.stroke(); }
    ctx.fillStyle = '#333'; ctx.strokeStyle = '#111';
    for (const wx of [-bw * 0.28, bw * 0.28]) { ctx.beginPath(); ctx.arc(wx, cell * 0.78, cell * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  } else {
    ctx.fillStyle = '#d33'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; rr(ctx, x + 4, y + cell * 0.15, bw - 8, cell * 0.7, 8); ctx.fill(); ctx.stroke();
  }
}

function drawScenery(ctx, name, x, y, cell) {
  const im = art(name); if (!im) return;
  const tall = name.startsWith('fm_tree');
  const s = Math.min((cell * (tall ? 1.05 : 1.1)) / im.naturalWidth, (cell * (tall ? 1.5 : 1)) / im.naturalHeight);
  const dw = im.naturalWidth * s; const dh = im.naturalHeight * s;
  ctx.drawImage(im, x + (cell - dw) / 2, y + cell * 0.95 - dh, dw, dh);
}

function drawBird(ctx, b, bx, y, cell, me, labels) {
  const im = art(b.team === 'turkey' ? 'tw_turk1' : 'tw_chick1');
  const k = Math.max(0, Math.min(1, b.hop ?? 1)); const lift = Math.sin(Math.PI * k) * cell * 0.38; // hop arc
  const cx = bx + cell / 2; const base = y + cell * 0.9;
  ctx.fillStyle = me ? 'rgba(255,199,44,.85)' : 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(cx, base, cell * (me ? 0.4 : 0.3), cell * (me ? 0.13 : 0.1), 0, 0, Math.PI * 2); ctx.fill();
  if (me) { ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke(); }
  const h = cell * (me ? 1.02 : 0.92);
  if (im) {
    const dw = (im.naturalWidth / im.naturalHeight) * h;
    ctx.save(); ctx.translate(cx, base - lift); if ((b.face || 1) < 0) ctx.scale(-1, 1);
    ctx.drawImage(im, -dw / 2, -h, dw, h); ctx.restore();
  } else {
    ctx.fillStyle = TEAM[b.team]; ctx.beginPath(); ctx.arc(cx, base - lift - h * 0.45, h * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  if (me || labels) {
    const label = me ? 'YOU' : String(b.name || '');
    ctx.font = `900 ${Math.max(9, cell * (me ? 0.3 : 0.24))}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const ty = base - lift - h - 3;
    ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.strokeText(label, cx, ty); ctx.fillStyle = me ? '#ffc72c' : '#fff'; ctx.fillText(label, cx, ty);
  }
}

function splat(ctx, x, y, cell, k, team) {
  const flat = art(team === 'turkey' ? 'cr_flat_t' : 'cr_flat_c');
  if (flat) {
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const s = cell * (1.35 + Math.min(1, k * 4) * 0.25); const dh = s * (flat.naturalHeight / flat.naturalWidth);
    ctx.drawImage(flat, x - s / 2, y - dh / 2, s, dh);
    label(ctx, 'SPLAT!', '#ffc72c', x, y - cell * (0.75 + k * 0.5), cell * 0.55);
    ctx.globalAlpha = 1; return;
  }
  const im = art('splat'); const s = cell * (1.1 + k * 0.4);
  ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
  if (im) ctx.drawImage(im, x - s / 2, y - s * 0.3, s, s * (im.naturalHeight / im.naturalWidth));
  const hit = art(team === 'turkey' ? 'tw_turk_hit' : 'tw_chick_hit');
  if (hit && k < 0.5) { const h = cell * 0.9; const dw = (hit.naturalWidth / hit.naturalHeight) * h; ctx.drawImage(hit, x - dw / 2, y - h * 0.7 - k * cell, dw, h * 0.6); }
  ctx.font = `normal ${cell * 0.55}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.strokeText('SPLAT!', x, y - cell * (0.6 + k * 0.5)); ctx.fillStyle = '#ffc72c'; ctx.fillText('SPLAT!', x, y - cell * (0.6 + k * 0.5));
  ctx.globalAlpha = 1;
}
function splash(ctx, x, y, cell, k, team) {
  const sp = art(k < 0.45 || team === 'turkey' ? 'cr_splash' : 'cr_soggy_c');
  if (sp) {
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const s = cell * 1.4; const dh = s * (sp.naturalHeight / sp.naturalWidth);
    ctx.drawImage(sp, x - s / 2, y + cell * 0.45 - dh, s, dh);
    label(ctx, 'SPLASH!', '#9fe0ff', x, y - cell * (0.9 + k * 0.5), cell * 0.5);
    ctx.globalAlpha = 1; return;
  }
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, cell * 0.06);
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y, cell * (0.2 + k * 0.6 + i * 0.15), cell * (0.08 + k * 0.2 + i * 0.05), 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = '#cfefff';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * cell * 0.4 * k, y - Math.sin(Math.PI * k) * cell * 0.6 + Math.sin(a) * cell * 0.15, cell * 0.06, 0, Math.PI * 2); ctx.fill(); }
  ctx.font = `normal ${cell * 0.5}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.strokeText('SPLASH!', x, y - cell * (0.6 + k * 0.5)); ctx.fillStyle = '#9fe0ff'; ctx.fillText('SPLASH!', x, y - cell * (0.6 + k * 0.5));
  ctx.globalAlpha = 1;
}
function cheer(ctx, x, y, cell, k, team) {
  const win = art(team === 'turkey' ? 'cr_win_t' : 'cr_win_c');
  if (win) {
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const s = cell * (1.2 + Math.sin(Math.min(1, k * 3) * Math.PI) * 0.3); const dh = s * (win.naturalHeight / win.naturalWidth);
    ctx.drawImage(win, x - s / 2, y - dh * 0.7 - k * cell * 0.6, s, dh);
    label(ctx, '+1!', '#7ed321', x, y - cell * (1.1 + k * 0.9), cell * 0.7);
    ctx.globalAlpha = 1; return;
  }
  ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
  ctx.font = `normal ${cell * 0.7}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.strokeText('+1!', x, y - cell * (0.4 + k * 1.2)); ctx.fillStyle = '#7ed321'; ctx.fillText('+1!', x, y - cell * (0.4 + k * 1.2));
  ctx.fillStyle = '#ffc72c';
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + k * 3; ctx.font = `${cell * 0.3}px sans-serif`; ctx.fillText('★', x + Math.cos(a) * cell * (0.3 + k), y - cell * 0.3 + Math.sin(a) * cell * (0.3 + k)); }
  ctx.globalAlpha = 1;
}

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function label(ctx, text, col, x, y, size) {
  ctx.font = `normal ${size}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y);
}
