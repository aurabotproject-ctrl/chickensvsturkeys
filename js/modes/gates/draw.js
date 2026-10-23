// =========================================================
// GATES — drawing (Canvas 2D), shared by the big screen and the devices.
// Uses the gt_* art once it's been added (GT_ART); until then it's drawn in code.
// =========================================================
import { sprite, avatar } from '../../core/assets.js?v=20261024103837';
import { FW, FH, PR, CR, GL, CORNERS } from './rules.js?v=20261024103837';

export const GT_ART = new Set(['gt_gate_closed', 'gt_gate_open', 'gt_pad']);
const TEAM = { chicken: { main: '#1e6fe0', glow: 'rgba(30,111,224,', light: '#8ec0ff' }, turkey: { main: '#e0402a', glow: 'rgba(224,64,42,', light: '#ff9a85' } };
const imgs = new Map();
export function img(name) { if (!imgs.has(name)) { const im = new Image(); im.src = name.startsWith('av:') ? avatar(+name.slice(3)) : sprite(name); imgs.set(name, im); } return imgs.get(name); }
const ready = (im) => im && im.complete && im.naturalWidth;
const art = (n) => (GT_ART.has(n) ? img(n) : null);
const field = img('cf_field'); // the same grass field as Capture the Flag

export function fitField(w, h, top = 0, bottom = 0, pad = 12) {
  const cell = Math.min((w - pad * 2) / FW, (h - top - bottom - pad * 2) / FH);
  return { cell, ox: (w - FW * cell) / 2, oy: top + (h - top - bottom - FH * cell) / 2 };
}
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/**
 * F = { gates, team, st: { ph, c, n, inN, h, g, need, done }, runners: [{ i, x, y, f, av, name, bot }], t, fx }
 * opts = { me, small }
 */
export function drawGates(ctx, F, box, opts = {}) {
  const { ox, oy, cell } = box; const fw = FW * cell; const fh = FH * cell; const t = F.t || 0; const col = TEAM[F.team] || TEAM.chicken; const st = F.st || {};
  // ---- grass ----
  ctx.save(); rr(ctx, ox - 10, oy - 10, fw + 20, fh + 20, 18); ctx.fillStyle = '#3f7a1f'; ctx.fill(); ctx.clip();
  if (ready(field)) { const L = 0.042; const R = 0.04; const T = 0.066; const B = 0.072; const iw = fw / (1 - L - R); const ih = fh / (1 - T - B); ctx.drawImage(field, ox - iw * L, oy - ih * T, iw, ih); }
  else { ctx.fillStyle = '#8fd14f'; ctx.fillRect(ox, oy, fw, fh); }
  ctx.restore();
  // ---- corner circles ----
  CORNERS.forEach((c, k) => {
    const x = ox + c.x * cell; const y = oy + c.y * cell; const r = CR * cell; const on = st.ph === 'circle' && st.c === k;
    const pad = art('gt_pad');
    if (on) { ctx.fillStyle = `${col.glow}${0.25 + 0.12 * Math.sin(t * 5)})`; ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, Math.PI * 2); ctx.fill(); }
    if (ready(pad)) { ctx.globalAlpha = on ? 1 : 0.6; ctx.drawImage(pad, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
    else {
      ctx.fillStyle = on ? `${col.glow}.45)` : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.setLineDash([cell * 1.6, cell * 1.1]); ctx.lineWidth = Math.max(2, cell * (on ? 0.7 : 0.4)); ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.7)'; ctx.stroke(); ctx.restore();
    }
    if (on) {
      // the 3-second timer
      if (st.h > 0) { ctx.lineWidth = Math.max(4, cell * 1.1); ctx.strokeStyle = '#ffc72c'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r + cell * 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, st.h)); ctx.stroke(); ctx.lineCap = 'butt'; }
      ctx.font = `normal ${cell * 11}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(4, cell * 1.2); ctx.strokeStyle = '#111'; ctx.strokeText(st.n, x, y); ctx.fillStyle = '#fff'; ctx.fillText(st.n, x, y);
      const ok = st.inN === st.n;
      const label = `${st.inN ?? 0} / ${st.n} IN`;
      ctx.font = `normal ${cell * 3.4}px Bangers, Impact, sans-serif`; ctx.lineWidth = Math.max(3, cell * 0.6);
      const ly = c.y < FH / 2 ? y + r + cell * 4 : y - r - cell * 3.2;
      ctx.strokeText(label, x, ly); ctx.fillStyle = ok ? '#7dff6a' : st.inN > st.n ? '#ff8a7a' : '#fff'; ctx.fillText(label, x, ly);
      ctx.textBaseline = 'alphabetic';
    }
  });
  // ---- gates ----
  (F.gates || []).forEach((g, k) => {
    const open = st.ph === 'gate' && st.g === k;
    const x = ox + g.x * cell; const y = oy + g.y * cell; const L = GL * cell;
    ctx.save(); ctx.translate(x, y); if (g.o === 'v') ctx.rotate(Math.PI / 2); // drawn as a horizontal gate, turned for 'v'
    if (open) { // a bright pulsing glow so the open gate is easy to spot
      const k = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.fillStyle = `rgba(90,255,120,${0.35 + 0.25 * k})`; ctx.beginPath(); ctx.ellipse(0, 0, L * 0.62, cell * (7 + k), 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * k})`; ctx.lineWidth = Math.max(2, cell * 0.5); ctx.setLineDash([cell * 1.4, cell]); ctx.stroke(); ctx.setLineDash([]);
    }
    const a = art(open ? 'gt_gate_open' : 'gt_gate_closed');
    if (ready(a)) { const w = L * 1.3; const h = w * (a.naturalHeight / a.naturalWidth); ctx.drawImage(a, -w / 2, -h / 2, w, h); } // a little chunkier than the bar so it reads well
    else {
      const post = (px) => { ctx.fillStyle = '#6b3f1f'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, 0, cell * 1.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
      ctx.lineCap = 'round';
      if (open) { // two halves swung open
        for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * L / 2, 0); ctx.rotate(s * -1.25 * (0.85 + 0.15 * Math.sin(t * 3))); ctx.strokeStyle = '#111'; ctx.lineWidth = cell * 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * L * 0.45, 0); ctx.stroke(); ctx.strokeStyle = '#d99a52'; ctx.lineWidth = cell * 0.9; ctx.stroke(); ctx.restore(); }
        // arrows through the gap
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, s * cell * 4.6); ctx.lineTo(-cell * 1.6, s * cell * 2.4); ctx.lineTo(cell * 1.6, s * cell * 2.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      } else {
        for (const dy of [-0.55, 0.55]) { ctx.strokeStyle = '#111'; ctx.lineWidth = cell * 1.4; ctx.beginPath(); ctx.moveTo(-L / 2, dy * cell); ctx.lineTo(L / 2, dy * cell); ctx.stroke(); ctx.strokeStyle = '#c4823f'; ctx.lineWidth = cell * 0.75; ctx.stroke(); }
        ctx.strokeStyle = '#111'; ctx.lineWidth = cell * 0.9; ctx.beginPath(); ctx.moveTo(-L / 2, -cell * 0.6); ctx.lineTo(L / 2, cell * 0.6); ctx.stroke(); ctx.strokeStyle = '#c4823f'; ctx.lineWidth = cell * 0.45; ctx.stroke();
      }
      ctx.lineCap = 'butt'; post(-L / 2); post(L / 2);
    }
    ctx.restore();
  });
  // ---- runners ----
  const sz = PR * 2 * cell * 1.05;
  for (const p of [...(F.runners || [])].sort((a, b) => a.y - b.y)) {
    const x = ox + p.x * cell; const y = oy + p.y * cell; const me = opts.me != null && p.i === opts.me;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y + sz * 0.45, sz * 0.42, sz * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    if (p.f === 2) { ctx.fillStyle = `rgba(255,199,44,${0.35 + 0.25 * Math.sin(t * 8)})`; ctx.beginPath(); ctx.arc(x, y, sz * 0.85, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
    const av = img(`av:${Number.isInteger(p.av) ? p.av : 0}`); if (ready(av)) ctx.drawImage(av, x - sz / 2, y - sz / 2, sz, sz);
    ctx.restore();
    ctx.lineWidth = Math.max(3, sz * (me ? 0.16 : 0.11)); ctx.strokeStyle = me ? '#ffc72c' : col.main; ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, sz / 2 + Math.max(3, sz * 0.11) / 2 + 1, 0, Math.PI * 2); ctx.stroke();
    if (p.f === 3) { // went through ✓
      const bx = x + sz * 0.42; const by = y - sz * 0.42; ctx.fillStyle = '#3ddc5a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, sz * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, sz * 0.08); ctx.beginPath(); ctx.moveTo(bx - sz * 0.12, by); ctx.lineTo(bx - sz * 0.02, by + sz * 0.1); ctx.lineTo(bx + sz * 0.14, by - sz * 0.1); ctx.stroke();
    }
    if (!opts.small || me) {
      ctx.font = `900 ${Math.max(10, sz * 0.42)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#111';
      const label = me ? 'YOU' : `${p.bot ? '🤖' : ''}${p.name || ''}`;
      ctx.strokeText(label, x, y - sz * 0.72); ctx.fillStyle = me ? '#ffc72c' : '#fff'; ctx.fillText(label, x, y - sz * 0.72);
    }
  }
  // ---- floating words ----
  const now = performance.now();
  if (F.fx) F.fx = F.fx.filter((f) => {
    const k = (now - f.t0) / 1600; if (k >= 1) return false;
    ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1; const pop = k < 0.12 ? k / 0.12 : 1;
    ctx.font = `normal ${f.size * cell * pop}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center';
    const x = ox + f.x * cell; const y = oy + (f.y - k * 4) * cell;
    ctx.lineWidth = Math.max(4, f.size * cell * 0.14); ctx.strokeStyle = '#111'; ctx.strokeText(f.text, x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    ctx.globalAlpha = 1; return true;
  });
}

/** Floating word for a team event: { type: 'hold'|'gate'|'pass', x, y } */
export function eventWord(e) {
  const W = { hold: ['GATE OPEN!', '#7dff6a', 6], gate: ['+1 GATE!', '#ffc72c', 7], pass: ['THROUGH!', '#fff', 3.6] }[e.type] || ['!', '#fff', 4];
  return { text: W[0], color: W[1], size: W[2], x: Math.max(16, Math.min(FW - 16, e.x)), y: Math.max(9, e.y - 4), t0: performance.now() };
}
