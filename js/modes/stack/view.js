// =========================================================
// STACK ATTACK — the student's screen.
//   BUILD: your team's tower, with your next block hovering above it.
//          Drag left/right to line it up, ⟳ to turn it, DROP to let go.
//   THROW: the other team's tower. Press and hold to aim (a dotted arc shows
//          exactly where the egg will fly), slide to adjust, let go to throw.
// =========================================================
import { U, PLATS, PLAT_W, SHAPES, SHAPE_KEYS, SPAWN_GAP, outline, other, LAUNCH, throwVelocity, EGG_STEPS, G_STEP } from './rules.js?v=20261010214912';
import { drawScene, drawBlock } from './arena.js?v=20261010214912';

const centroid = (k) => { const o = outline(k); return o.reduce((a, v) => ({ x: a.x + v.x / o.length, y: a.y + v.y / o.length }), { x: 0, y: 0 }); };

export class StackView {
  constructor(el, { uid, team, onOp, onEvent } = {}) {
    this.el = el; this.uid = uid; this.team = team || 'chicken';
    this.onOp = onOp || (() => {}); this.onEvent = onEvent || (() => {});
    this.blocks = new Map(); this.eggs = []; this.splats = []; this.heights = { chicken: 0, turkey: 0 };
    this.mode = 'build'; this.next = 'crate'; this.rot = 0; this.gx = PLATS[this.team].x;
    this.acts = 0; this.sent = []; this.seq = Date.now(); this.q = []; this.cam = {}; this.marks = [];
    this.flying = new Map(); this.mine = []; this.aim = null; this.shake = 0;
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
  newRound() { this.blocks.clear(); this.eggs = []; this.flying.clear(); this.mine = []; this.splats = []; this.sent = []; this.cam = {}; this.gx = PLATS[this.team].x; this.rot = 0; }

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
    // eggs in flight: launch point, velocity and age — flown smoothly here between updates
    const now = performance.now(); const live = new Set();
    for (const t of es.split(';').filter(Boolean)) {
      const [id, x0, y0, vx, vy, step, ti, seq] = t.split(',').map(Number); live.add(id);
      const f = this.flying.get(id);
      if (!f) this.flying.set(id, { x0, y0, vx: vx / 1000, vy: vy / 1000, step, at: now, team: ti ? 'turkey' : 'chicken', seq });
      else { f.step = step; f.at = now; }
      if (seq) this.mine = this.mine.filter((m) => m.seq !== seq); // the real egg has taken over from my preview egg
    }
    for (const id of [...this.flying.keys()]) if (!live.has(id)) this.flying.delete(id);
    for (const t of ss.split(';').filter(Boolean)) {
      const [x, y, t0] = t.split(',').map(Number);
      if (!this.splats.some((s) => s.key === t0)) {
        this.splats.push({ x, y, key: t0, t0: now });
        // was that MY egg landing? shake + buzz
        if (this.marks.some((m) => now - m.t0 < 4000 && Math.hypot(m.x - x, m.y - y) < 3.5 * U)) { this.shake = now; this.onEvent('hit'); }
        // my preview egg was heading here: it has landed, stop drawing it
        this.mine = this.mine.filter((m) => Math.hypot(m.tx - x, m.ty - y) > 3.5 * U);
      }
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
    x = Math.round(x); y = Math.round(y);
    this.send({ op: 'egg', x, y });
    const from = LAUNCH[this.team]; const v = throwVelocity(from, { x, y }, EGG_STEPS);
    this.follow = { seq: this.seq, t0: performance.now(), target: { x, y } };
    this.mine.push({ seq: this.seq, x0: from.x, y0: from.y, vx: v.x, vy: v.y, step: 0, at: performance.now(), team: this.team, tx: x, ty: y }); // fly it straight away
    this.marks.push({ x, y, t0: performance.now() });
    this.onEvent('egg'); return true;
  }
  /** Where an egg is n physics steps after launch (same maths as the big screen). */
  static eggAt(f, n) { return { x: f.x0 + f.vx * n, y: f.y0 + f.vy * n + (G_STEP * n * (n + 1)) / 2 }; }

  // ---------- input ----------
  setupInput() {
    const c = this.canvas; c.style.touchAction = 'none';
    const world = (e) => { const r = c.getBoundingClientRect(); const V = this.V; if (!V) return null; return { x: (e.clientX - r.left - V.ox) / V.s, y: (e.clientY - r.top - V.oy) / V.s }; };
    const LIFT = 56; // the crosshair sits this far (screen px) above your finger so you can see it
    const aimAt = (e) => { const r = c.getBoundingClientRect(); const V = this.V; if (!V) return; this.aim = { x: (e.clientX - r.left - V.ox) / V.s, y: (e.clientY - r.top - LIFT - V.oy) / V.s }; };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      if (this.mode === 'build') { const w = world(e); if (!w) return; this.dragging = true; this.moveGhost(w.x); } else aimAt(e);
    });
    c.addEventListener('pointermove', (e) => {
      if (this.dragging) { const w = world(e); if (w) this.moveGhost(w.x); } else if (this.aim) aimAt(e);
    });
    c.addEventListener('pointerup', () => {
      this.dragging = false;
      if (this.aim && this.mode === 'throw') { const a = this.aim; this.aim = null; this.throwAt(a.x, a.y); }
    });
    c.addEventListener('pointercancel', () => { this.dragging = false; this.aim = null; });
  }
  moveGhost(x) { const p = PLATS[this.team]; this.gx = Math.max(p.x - PLAT_W / 2 - U * 0.5, Math.min(p.x + PLAT_W / 2 + U * 0.5, x)); }

  render() {
    const ctx = this.ctx; const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    if (!W || !H || this.el.offsetParent === null) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const b of this.blocks.values()) { b.position.x += (b.tx - b.position.x) * 0.3; b.position.y += (b.ty - b.position.y) * 0.3; b.angle += (b.ta - b.angle) * 0.3; }
    const build = this.mode === 'build'; const team = build ? this.team : other(this.team); const p = PLATS[team];
    const top = this.topY(team);
    const now = performance.now(); const stepNow = (f) => f.step + (now - f.at) / (1000 / 60);
    // my egg in flight (my instant preview egg, or the real one once it arrives) — the camera follows it
    let chase = null;
    if (this.follow && now - this.follow.t0 < 3000) {
      const fl = this.mine.find((m) => m.seq === this.follow.seq) || [...this.flying.values()].find((m) => m.seq === this.follow.seq);
      if (fl && stepNow(fl) <= EGG_STEPS + 10) chase = StackView.eggAt(fl, stepNow(fl));
      else if (!fl && now - this.follow.t0 > 600) this.follow = null;
    } else this.follow = null;
    // camera: build = zoomed on the top of my tower; throw = the enemy tower (or following my egg)
    let cx; let cy; let span;
    if (build) { cx = p.x; cy = Math.min(-2 * U, top - 1.2 * U); span = { w: PLAT_W + 3 * U, h: 10 * U }; } else { const dir = this.team === 'chicken' ? -1 : 1; cx = p.x + dir * 1.5 * U; cy = top / 2 - 2 * U; span = { w: 9 * U, h: Math.max(11 * U, -top + 7 * U) }; }
    const s = Math.min(W / span.w, H / span.h);
    cy = Math.min(cy, 4.6 * U - H / 2 / s); // never look below the bottom of the background picture
    if (chase && !build) { cx = chase.x * 0.7 + this.follow.target.x * 0.3; cy = Math.min(chase.y, this.follow.target.y) * 0.75 + cy * 0.25; }
    cy = Math.min(cy, 4.6 * U - H / 2 / s);
    const cam = this.cam; if (cam.x == null || cam.mode !== this.mode) { cam.x = cx; cam.y = cy; cam.s = s; cam.mode = this.mode; }
    const ease = chase && !build ? 0.22 : 0.12;
    cam.x += (cx - cam.x) * ease; cam.y += (cy - cam.y) * ease; cam.s += (s - cam.s) * 0.12;
    const V = this.V = { ox: W / 2 - cam.x * cam.s, oy: H / 2 - cam.y * cam.s, s: cam.s, W, H, viewTop: 0, labels: false };
    const eggs = [];
    for (const f of [...this.flying.values(), ...this.mine]) {
      const n = stepNow(f); if (n > EGG_STEPS + 40) continue;
      const pos = StackView.eggAt(f, n);
      eggs.push({ position: pos, team: f.team, trail: [12, 9, 6, 3].map((d) => StackView.eggAt(f, Math.max(0, n - d))) });
    }
    this.mine = this.mine.filter((f) => stepNow(f) <= EGG_STEPS + 6);
    // shake when my egg lands
    const sh = now - this.shake < 380 ? (1 - (now - this.shake) / 380) * 7 : 0;
    if (sh) { V.ox += (Math.random() - 0.5) * sh * 2; V.oy += (Math.random() - 0.5) * sh * 2; }
    drawScene(ctx, { blocks: [...this.blocks.values()], eggs, splats: this.splats, heights: this.heights }, V);
    if (this.aim && !build) this.drawAim(ctx, V);
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
    this.marks = this.marks.filter((m) => now - m.t0 < 4000);
    for (const m of this.marks) { const k = Math.min(1, (now - m.t0) / 1200); const X = V.ox + m.x * V.s; const Y = V.oy + m.y * V.s; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffc72c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X, Y, 14 + k * 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    if (!build) { // tap target hint
      ctx.font = `900 ${Math.max(13, W * 0.04)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#111';
      const t = this.actsLeft() > 0 ? (this.aim ? 'Let go to throw!' : '🎯 Press and hold on their tower to aim') : 'Answer questions to get eggs';
      ctx.strokeText(t, W / 2, 26); ctx.fillStyle = '#fff'; ctx.fillText(t, W / 2, 26);
    }
  }
  /** Dotted arc from my thrower to the crosshair — exactly the path the egg will fly. */
  drawAim(ctx, V) {
    const from = LAUNCH[this.team]; const to = this.aim; const v = throwVelocity(from, to, EGG_STEPS);
    const f = { x0: from.x, y0: from.y, vx: v.x, vy: v.y };
    const ok = this.actsLeft() > 0;
    ctx.fillStyle = ok ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.4)';
    for (let n = 2; n <= EGG_STEPS; n += 3) { const p = StackView.eggAt(f, n); ctx.beginPath(); ctx.arc(V.ox + p.x * V.s, V.oy + p.y * V.s, 2.2 + (n / EGG_STEPS) * 2.5, 0, Math.PI * 2); ctx.fill(); }
    const X = V.ox + to.x * V.s; const Y = V.oy + to.y * V.s; const col = this.team === 'turkey' ? '#e0402a' : '#1e6fe0';
    ctx.lineWidth = 7; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(X, Y, 18, 0, Math.PI * 2); ctx.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(X + dx * 10, Y + dy * 10); ctx.lineTo(X + dx * 28, Y + dy * 28); ctx.stroke(); }
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(X, Y, 18, 0, Math.PI * 2); ctx.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(X + dx * 10, Y + dy * 10); ctx.lineTo(X + dx * 28, Y + dy * 28); ctx.stroke(); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill();
  }
  destroy() { this.dead = true; this.ro?.disconnect(); this.canvas.remove(); }
}
