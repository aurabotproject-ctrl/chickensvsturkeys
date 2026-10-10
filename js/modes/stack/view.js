// =========================================================
// STACK ATTACK — the student's screen.
//   BUILD: your team's tower, with your next block hovering above it.
//          Drag left/right to line it up, ⟳ to turn it, DROP to let go.
//   THROW: the other team's tower. Tap where you want your egg to land.
// =========================================================
import { U, PLATS, PLAT_W, SHAPES, SHAPE_KEYS, SPAWN_GAP, outline, other } from './rules.js?v=20261010212825';
import { drawScene, drawBlock } from './arena.js?v=20261010212825';

const centroid = (k) => { const o = outline(k); return o.reduce((a, v) => ({ x: a.x + v.x / o.length, y: a.y + v.y / o.length }), { x: 0, y: 0 }); };

export class StackView {
  constructor(el, { uid, team, onOp, onEvent } = {}) {
    this.el = el; this.uid = uid; this.team = team || 'chicken';
    this.onOp = onOp || (() => {}); this.onEvent = onEvent || (() => {});
    this.blocks = new Map(); this.eggs = []; this.splats = []; this.heights = { chicken: 0, turkey: 0 };
    this.mode = 'build'; this.next = 'crate'; this.rot = 0; this.gx = PLATS[this.team].x;
    this.acts = 0; this.sent = []; this.seq = Date.now(); this.q = []; this.cam = {}; this.marks = [];
    this.canvas = document.createElement('canvas'); this.canvas.className = 'sa-canvas';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.el); this.resize();
    this.setupInput();
    const frame = () => { if (this.dead) return; this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
  }
  setTeam(team) { if (team && team !== this.team) { this.team = team; this.gx = PLATS[team].x; } }
  newRound() { this.blocks.clear(); this.eggs = []; this.splats = []; this.sent = []; this.cam = {}; this.gx = PLATS[this.team].x; this.rot = 0; }

  setState(str) {
    const [bs = '', es = '', ss = '', hs = ''] = String(str || '').split('|');
    const seen = new Set();
    for (const t of bs.split(';').filter(Boolean)) {
      const [id, ki, ti, x, y, a] = t.split(',').map(Number); seen.add(id);
      const k = SHAPE_KEYS[ki]; const team = ti ? 'turkey' : 'chicken';
      let b = this.blocks.get(id);
      if (!b) {
        const c = SHAPES[k]?.poly ? centroid(k) : { x: 0, y: 0 };
        b = { id, k, team, position: { x, y }, angle: a / 100, tx: x, ty: y, ta: a / 100, artOff: { x: -c.x, y: -c.y } }; this.blocks.set(id, b);
      }
      b.tx = x; b.ty = y; b.ta = a / 100;
    }
    for (const id of [...this.blocks.keys()]) if (!seen.has(id)) this.blocks.delete(id);
    this.eggs = es.split(';').filter(Boolean).map((t) => { const [x, y, ti] = t.split(',').map(Number); return { position: { x, y }, team: ti ? 'turkey' : 'chicken' }; });
    const now = performance.now();
    for (const t of ss.split(';').filter(Boolean)) {
      const [x, y, t0] = t.split(',').map(Number);
      if (!this.splats.some((s) => s.key === t0)) this.splats.push({ x, y, key: t0, t0: now });
    }
    this.splats = this.splats.filter((s) => now - s.t0 < 1500);
    const [hc, ht] = hs.split(',').map(Number); this.heights = { chicken: hc || 0, turkey: ht || 0 };
  }
  setMine({ acts = 0, next = 'crate', hs = 0 } = {}) {
    this.acts = acts; this.sent = this.sent.filter((s) => s > hs);
    if (next !== this.next) { this.next = next; if (SHAPES[next] && SHAPES[next].h > SHAPES[next].w) this.rot = 0; }
  }
  actsLeft() { return Math.max(0, this.acts - this.sent.length); }

  /** Highest point of a team's tower (y, 0 = cliff top) from the synced blocks. */
  topY(team) {
    const p = PLATS[team]; let top = 0;
    for (const b of this.blocks.values()) {
      if (b.team !== team || Math.abs(b.position.x - p.x) > PLAT_W / 2 + 2 * U || b.position.y > U) continue;
      const c = Math.cos(b.angle); const s = Math.sin(b.angle); const off = b.artOff;
      for (const v of outline(b.k)) { const vx = v.x + off.x; const vy = v.y + off.y; top = Math.min(top, b.position.y + vx * s + vy * c); }
    }
    return top;
  }

  // ---------- actions ----------
  send(cmd) {
    this.seq += 1; this.sent.push(this.seq);
    this.q = [...this.q, { s: this.seq, ...cmd }].slice(-10); this.onOp(this.q);
  }
  rotate() { this.rot = (this.rot + 1) % 4; this.onEvent('rotate'); }
  drop() {
    if (this.actsLeft() <= 0) { this.onEvent('noacts'); return false; }
    this.send({ op: 'drop', k: this.next, x: Math.round(this.gx), rot: this.rot });
    this.onEvent('drop'); return true;
  }
  throwAt(x, y) {
    if (this.actsLeft() <= 0) { this.onEvent('noacts'); return false; }
    this.send({ op: 'egg', x: Math.round(x), y: Math.round(y) });
    this.marks.push({ x, y, t0: performance.now() });
    this.onEvent('egg'); return true;
  }

  // ---------- input ----------
  setupInput() {
    const c = this.canvas; c.style.touchAction = 'none';
    const world = (e) => { const r = c.getBoundingClientRect(); const V = this.V; if (!V) return null; return { x: (e.clientX - r.left - V.ox) / V.s, y: (e.clientY - r.top - V.oy) / V.s }; };
    c.addEventListener('pointerdown', (e) => {
      const w = world(e); if (!w) return;
      if (this.mode === 'build') { c.setPointerCapture(e.pointerId); this.dragging = true; this.moveGhost(w.x); } else this.throwAt(w.x, w.y);
    });
    c.addEventListener('pointermove', (e) => { if (this.dragging) { const w = world(e); if (w) this.moveGhost(w.x); } });
    const up = () => { this.dragging = false; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
  moveGhost(x) { const p = PLATS[this.team]; this.gx = Math.max(p.x - PLAT_W / 2 - U * 0.5, Math.min(p.x + PLAT_W / 2 + U * 0.5, x)); }

  render() {
    const ctx = this.ctx; const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    if (!W || !H || this.el.offsetParent === null) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const b of this.blocks.values()) { b.position.x += (b.tx - b.position.x) * 0.3; b.position.y += (b.ty - b.position.y) * 0.3; b.angle += (b.ta - b.angle) * 0.3; }
    const build = this.mode === 'build'; const team = build ? this.team : other(this.team); const p = PLATS[team];
    const top = this.topY(team);
    // camera: build = zoomed on the top of my tower; throw = the whole enemy tower
    let cx; let cy; let span;
    if (build) { cx = p.x; cy = Math.min(-2 * U, top - 1.2 * U); span = { w: PLAT_W + 3 * U, h: 10 * U }; } else { cx = p.x; cy = (top - 3 * U) / 2; span = { w: PLAT_W + 4 * U, h: Math.max(10 * U, -top + 6 * U) }; }
    const s = Math.min(W / span.w, H / span.h);
    cy = Math.min(cy, 4.6 * U - H / 2 / s); // never look below the bottom of the background picture
    const cam = this.cam; if (cam.x == null || cam.mode !== this.mode) { cam.x = cx; cam.y = cy; cam.s = s; cam.mode = this.mode; }
    cam.x += (cx - cam.x) * 0.12; cam.y += (cy - cam.y) * 0.12; cam.s += (s - cam.s) * 0.12;
    const V = this.V = { ox: W / 2 - cam.x * cam.s, oy: H / 2 - cam.y * cam.s, s: cam.s, W, H, viewTop: 0, labels: false };
    drawScene(ctx, { blocks: [...this.blocks.values()], eggs: this.eggs, splats: this.splats, heights: this.heights }, V);
    // ghost of my next block (build) / aim marks (throw)
    if (build && this.next) {
      const gy = top - SPAWN_GAP; const ghost = { k: this.next, team: this.team, angle: (this.rot * Math.PI) / 2, artOff: SHAPES[this.next]?.poly ? (() => { const c = centroid(this.next); return { x: -c.x, y: -c.y }; })() : { x: 0, y: 0 } };
      const X = V.ox + this.gx * V.s; const Y = V.oy + gy * V.s;
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, V.oy + top * V.s); ctx.stroke(); ctx.setLineDash([]);
      drawBlock(ctx, ghost, X, Y, V.s, this.actsLeft() > 0 ? 0.85 : 0.35);
      ctx.font = `900 ${Math.max(12, U * V.s * 0.32)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#111';
      const hint = this.actsLeft() > 0 ? '◀ drag ▶' : 'answer to unlock';
      ctx.strokeText(hint, X, Y - U * V.s * 1.1); ctx.fillStyle = '#fff'; ctx.fillText(hint, X, Y - U * V.s * 1.1);
    }
    const now = performance.now();
    this.marks = this.marks.filter((m) => now - m.t0 < 1200);
    for (const m of this.marks) { const k = (now - m.t0) / 1200; const X = V.ox + m.x * V.s; const Y = V.oy + m.y * V.s; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffc72c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X, Y, 14 + k * 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    if (!build) { // tap target hint
      ctx.font = `900 ${Math.max(13, W * 0.04)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#111';
      const t = this.actsLeft() > 0 ? '🎯 Tap their tower to throw an egg!' : 'Answer questions to get eggs';
      ctx.strokeText(t, W / 2, 26); ctx.fillStyle = '#fff'; ctx.fillText(t, W / 2, 26);
    }
  }
  destroy() { this.dead = true; this.ro?.disconnect(); this.canvas.remove(); }
}
