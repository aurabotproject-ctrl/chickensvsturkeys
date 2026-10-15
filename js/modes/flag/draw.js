// =========================================================
// CAPTURE THE FLAG — drawing (Canvas 2D), shared by the big screen
// and the devices. Uses the cf_* art when it has been added (CF_ART);
// until then everything is drawn in code.
// =========================================================
import { sprite, avatar } from '../../core/assets.js?v=20261015235654';
import { FW, FH, MID, ZR, ZONE, PR } from './rules.js?v=20261015235654';

/** Art that has been added to assets/sprites (see CAPTURE_THE_FLAG_IMAGE_PROMPTS.md). */
export const CF_ART = new Set(['cf_field', 'cf_flag_blue', 'cf_flag_red', 'cf_ice', 'cf_zone_blue', 'cf_zone_red']);
const TEAM = { chicken: { main: '#1e6fe0', light: '#7fb2ff', dark: '#0d3f8f', flag: 'cf_flag_blue', zone: 'cf_zone_blue' }, turkey: { main: '#e0402a', light: '#ff9a85', dark: '#8f1d10', flag: 'cf_flag_red', zone: 'cf_zone_red' } };

const imgs = new Map();
export function img(name) { if (!imgs.has(name)) { const im = new Image(); im.src = name.startsWith('av:') ? avatar(+name.slice(3)) : sprite(name); imgs.set(name, im); } return imgs.get(name); }
const ready = (im) => im.complete && im.naturalWidth;
const art = (name) => (CF_ART.has(name) ? img(name) : null);

/** Fit the field into a w×h box (leaving `top`/`bottom` room for the HUD). */
export function fitField(w, h, top = 0, bottom = 0, pad = 12) {
  const cell = Math.min((w - pad * 2) / FW, (h - top - bottom - pad * 2) / FH);
  return { cell, ox: (w - FW * cell) / 2, oy: top + (h - top - bottom - FH * cell) / 2 };
}

function flagShape(ctx, x, y, s, team, t, art) {
  if (art && ready(art)) { const h = s * 2.6; const w = h * (art.naturalWidth / art.naturalHeight); ctx.drawImage(art, x - w * 0.106, y - h, w, h); return; } // the pole is ~11% in from the left, its spike at the bottom
  ctx.save(); ctx.translate(x, y);
  ctx.lineCap = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = s * 0.28; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 2.1); ctx.stroke();
  ctx.strokeStyle = '#d9d2c3'; ctx.lineWidth = s * 0.14; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 2.1); ctx.stroke();
  const wave = Math.sin(t * 6) * s * 0.12;
  ctx.fillStyle = TEAM[team].main; ctx.strokeStyle = '#111'; ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.moveTo(0, -s * 2.1); ctx.quadraticCurveTo(s * 0.7, -s * 2.0 + wave, s * 1.45, -s * 1.7); ctx.quadraticCurveTo(s * 0.7, -s * 1.45 - wave, 0, -s * 1.25); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffc72c'; ctx.beginPath(); ctx.arc(0, -s * 2.15, s * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/**
 * S = { runners: [{ i, team, name, av, bot, x, y, frozen, carry, immune, prog }], flags: { chicken: carrierIdx|null, turkey }, t, fx }
 * opts = { me: runner index to highlight, labels: true }
 */
export function drawField(ctx, S, box, opts = {}) {
  const { ox, oy, cell } = box; const fw = FW * cell; const fh = FH * cell; const t = S.t || 0;
  // ---- field ----
  ctx.fillStyle = '#3f7a1f'; rr(ctx, ox - 12, oy - 12, fw + 24, fh + 24, 20); ctx.fill();
  const bg = art('cf_field');
  if (bg && ready(bg)) {
    // the art has a fence round the edge: stretch it so the fence sits just OUTSIDE the playing area
    const L = 0.042; const R = 0.04; const T = 0.066; const B = 0.072;
    const iw = fw / (1 - L - R); const ih = fh / (1 - T - B);
    ctx.save(); rr(ctx, ox - 12, oy - 12, fw + 24, fh + 24, 20); ctx.clip();
    ctx.drawImage(bg, ox - iw * L, oy - ih * T, iw, ih); ctx.restore();
  }
  else {
    ctx.fillStyle = '#8fd14f'; ctx.fillRect(ox, oy, fw, fh);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < FW; x += 16) ctx.fillRect(ox + x * cell, oy, 8 * cell, fh); // mowing stripes
  }
  const tint = bg && ready(bg) ? 0.16 : 0.24;
  ctx.fillStyle = `rgba(30,111,224,${tint})`; ctx.fillRect(ox, oy, fw / 2, fh);
  ctx.fillStyle = `rgba(224,64,42,${tint})`; ctx.fillRect(ox + fw / 2, oy, fw / 2, fh);
  // team names faintly painted on each half
  ctx.save(); ctx.globalAlpha = 0.22; ctx.font = `normal ${cell * 7}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText('CHICKENS', ox + fw * 0.3, oy + fh * 0.16); ctx.fillText('TURKEYS', ox + fw * 0.7, oy + fh * 0.16); ctx.restore();
  // halfway line
  ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, cell * 0.8); ctx.setLineDash([cell * 3, cell * 2]);
  ctx.beginPath(); ctx.moveTo(ox + MID * cell, oy); ctx.lineTo(ox + MID * cell, oy + fh); ctx.stroke(); ctx.restore();
  if (!(bg && ready(bg))) { ctx.strokeStyle = '#2b5a12'; ctx.lineWidth = 6; ctx.strokeRect(ox - 3, oy - 3, fw + 6, fh + 6); }
  // flag areas (safe for the OTHER team)
  for (const team of ['chicken', 'turkey']) {
    const z = ZONE[team]; const x = ox + z.x * cell; const y = oy + z.y * cell; const r = ZR * cell;
    const pad = art(TEAM[team].zone);
    if (pad && ready(pad)) ctx.drawImage(pad, x - r, y - r, r * 2, r * 2);
    else {
      ctx.fillStyle = team === 'chicken' ? 'rgba(30,111,224,.28)' : 'rgba(224,64,42,.28)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, cell * 0.5); ctx.setLineDash([cell * 1.6, cell * 1.1]); ctx.lineDashOffset = -t * 6 * cell; ctx.stroke(); ctx.restore();
    }
    ctx.font = `normal ${Math.max(10, cell * 2.2)}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = Math.max(3, cell * 0.5); ctx.strokeStyle = '#111';
    ctx.strokeText('SAFE', x, y + r * 0.82); ctx.fillStyle = '#fff'; ctx.fillText('SAFE', x, y + r * 0.82);
    if (S.flags?.[team] == null) flagShape(ctx, x, y + cell * 1.4, cell * 2.6, team, t, art(TEAM[team].flag));
  }
  // ---- runners ----
  const sz = PR * 2 * cell * 1.05;
  const list = [...S.runners].sort((a, b) => a.y - b.y);
  for (const p of list) {
    const x = ox + p.x * cell; const y = oy + p.y * cell; const col = TEAM[p.team];
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y + sz * 0.45, sz * 0.42, sz * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    if (p.immune) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x, y, sz * 0.78, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
    const av = img(`av:${Number.isInteger(p.av) ? p.av : 0}`); if (ready(av)) ctx.drawImage(av, x - sz / 2, y - sz / 2, sz, sz);
    ctx.restore();
    const me = opts.me != null && p.i === opts.me;
    ctx.lineWidth = Math.max(3, sz * (me ? 0.16 : 0.11)); ctx.strokeStyle = me ? '#ffc72c' : col.main; ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, sz / 2 + Math.max(3, sz * 0.11) / 2 + 1, 0, Math.PI * 2); ctx.stroke();
    // frozen = an ice block
    if (p.frozen) {
      const ice = art('cf_ice');
      if (ice && ready(ice)) ctx.drawImage(ice, x - sz * 0.78, y - sz * 0.8, sz * 1.56, sz * 1.56);
      else {
        ctx.fillStyle = 'rgba(160,225,255,.6)'; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = Math.max(2, sz * 0.07);
        rr(ctx, x - sz * 0.68, y - sz * 0.68, sz * 1.36, sz * 1.36, sz * 0.2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(x - sz * 0.45, y - sz * 0.3); ctx.lineTo(x - sz * 0.2, y - sz * 0.55); ctx.moveTo(x + sz * 0.25, y + sz * 0.5); ctx.lineTo(x + sz * 0.5, y + sz * 0.25); ctx.stroke();
        ctx.font = `${Math.max(10, sz * 0.5)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('❄', x + sz * 0.5, y - sz * 0.38);
      }
    }
    // tag / rescue meter (fills over one second)
    if (p.prog > 0) {
      ctx.lineWidth = Math.max(4, sz * 0.16); ctx.strokeStyle = p.frozen ? '#3ddc5a' : '#ff3b2f'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, sz * 0.82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.prog); ctx.stroke(); ctx.lineCap = 'butt';
    }
    if (p.carry) flagShape(ctx, x + sz * 0.42, y - sz * 0.2, cell * 2.1, p.team === 'chicken' ? 'turkey' : 'chicken', t, art(TEAM[p.team === 'chicken' ? 'turkey' : 'chicken'].flag));
    if (opts.labels !== false) {
      ctx.font = `900 ${Math.max(11, sz * 0.42)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#111';
      const label = me ? 'YOU' : `${p.bot ? '🤖' : ''}${p.name || ''}`;
      ctx.strokeText(label, x, y - sz * 0.72); ctx.fillStyle = me ? '#ffc72c' : '#fff'; ctx.fillText(label, x, y - sz * 0.72);
    }
  }
  // ---- floating words ----
  const now = performance.now();
  if (S.fx) S.fx = S.fx.filter((f) => {
    const k = (now - f.t0) / 1600; if (k >= 1) return false;
    ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
    const pop = k < 0.12 ? k / 0.12 : 1;
    ctx.font = `normal ${f.size * cell * pop}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center';
    const x = ox + f.x * cell; const y = oy + (f.y - k * 4) * cell;
    ctx.lineWidth = Math.max(4, f.size * cell * 0.14); ctx.strokeStyle = '#111'; ctx.strokeText(f.text, x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    ctx.globalAlpha = 1;
    return true;
  });
}

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/** Floating word for an event: { type: 'tag'|'free'|'cap'|'grab'|'drop', x, y, team } */
export function eventWord(e) {
  const W = { tag: ['FROZEN!', '#9fe6ff'], free: ['FREED!', '#3ddc5a'], cap: ['FLAG CAPTURED!', '#ffc72c'], grab: ['GOT THE FLAG!', '#fff'], drop: ['FLAG HOME!', '#fff'] }[e.type] || ['!', '#fff'];
  return { text: W[0], color: W[1], x: Math.max(14, Math.min(FW - 14, e.x)), y: Math.max(8, e.y - 5), size: e.type === 'cap' ? 6.5 : 4.2, t0: performance.now() };
}
