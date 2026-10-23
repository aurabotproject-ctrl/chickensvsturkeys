// =========================================================
// GATES — the student's screen: only THEIR team's field (their own task and
// their own open gate). Finger down anywhere + drag = run; let go = stop.
// =========================================================
import { FW, FH, unpackRunners } from './rules.js?v=20261024102606';
import { drawGates, fitField, eventWord } from './draw.js?v=20261024102606';

export class GatesView {
  constructor(el, { uid, team, onSteer, onEvent } = {}) {
    this.el = el; this.uid = uid; this.team = team; this.onSteer = onSteer || (() => {}); this.onEvent = onEvent || (() => {});
    this.info = new Map(); this.runners = new Map(); this.me = 0; this.gates = []; this.st = {}; this.fx = []; this.lastEv = -1; this.t = 0;
    this.canvas = document.createElement('canvas'); this.canvas.className = 'gt-phone';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.el); this.resize();
    this.setupInput();
    let last = performance.now();
    const frame = (n) => { if (this.dead) return; this.t += Math.min(0.1, (n - last) / 1000); last = n; this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
    this.box = fitField(w, h, 46, 0, 10);
  }
  setInfo(info) {
    if (!info) return;
    this.gates = info.gates || [];
    this.info.clear();
    for (const [i, uid, team, av, name, bot] of info.players || []) { this.info.set(i, { i, uid, team, av, name, bot: !!bot }); if (uid === this.uid) this.me = i; }
    if (info.round !== this.round) { this.round = info.round; this.runners.clear(); }
  }
  setPos(str) {
    const seen = new Set();
    for (const q of unpackRunners(String(str || ''))) {
      seen.add(q.i);
      const r = this.runners.get(q.i);
      if (!r) this.runners.set(q.i, { ...q, tx: q.x, ty: q.y });
      else { r.f = q.f; r.tx = q.x; r.ty = q.y; }
    }
    for (const i of [...this.runners.keys()]) if (!seen.has(i)) this.runners.delete(i);
  }
  setState(st) { const before = this.st; this.st = st || {}; if (before.ph && before.ph !== this.st.ph) this.onEvent({ type: this.st.ph === 'gate' ? 'open' : 'next' }, false); }
  setEvents(list) {
    for (const e of list || []) {
      if (e.k <= this.lastEv) continue;
      if (this.lastEv >= 0 || Date.now() - (this.joined ||= Date.now()) > 1500) { this.fx.push(eventWord(e)); this.onEvent(e, e.i === this.me); }
      this.lastEv = e.k;
    }
  }
  /** My flag: 0 nothing · 1 held the circle · 2 must go through the gate · 3 through ✓ */
  myFlag() { return this.runners.get(this.me)?.f || 0; }

  setupInput() {
    const c = this.canvas; c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.joy = { x0: e.offsetX, y0: e.offsetY, x: e.offsetX, y: e.offsetY }; });
    c.addEventListener('pointermove', (e) => {
      const j = this.joy; if (!j) return; j.x = e.offsetX; j.y = e.offsetY;
      const dx = j.x - j.x0; const dy = j.y - j.y0;
      if (Math.hypot(dx, dy) > 10) this.steer(Math.atan2(dy, dx), 1);
    });
    const end = () => { if (this.joy) { this.joy = null; this.steer(0, 0); } };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    const held = new Set();
    const fromKeys = () => { let x = 0; let y = 0; if (held.has('r')) x += 1; if (held.has('l')) x -= 1; if (held.has('d')) y += 1; if (held.has('u')) y -= 1; if (x || y) this.steer(Math.atan2(y, x), 1); else this.steer(0, 0); };
    const K = { ArrowRight: 'r', ArrowLeft: 'l', ArrowUp: 'u', ArrowDown: 'd', d: 'r', a: 'l', w: 'u', s: 'd' };
    this.keyD = (e) => { const k = K[e.key]; if (!k || this.el.offsetParent === null) return; e.preventDefault(); if (!held.has(k)) { held.add(k); fromKeys(); } };
    this.keyU = (e) => { const k = K[e.key]; if (!k) return; held.delete(k); fromKeys(); };
    window.addEventListener('keydown', this.keyD); window.addEventListener('keyup', this.keyU);
  }
  steer(a, m) {
    a = Math.round(a * 100) / 100;
    if (this.last && this.last.m === m && (!m || Math.abs(((a - this.last.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.05)) return;
    this.last = { a, m }; this.onSteer(a, m);
  }

  render() {
    const ctx = this.ctx; const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    if (!W || !H || !this.box) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#2f5a1a'; ctx.fillRect(0, 0, W, H);
    const runners = [];
    for (const r of this.runners.values()) {
      r.x += (r.tx - r.x) * 0.3; r.y += (r.ty - r.y) * 0.3;
      if (Math.hypot(r.tx - r.x, r.ty - r.y) > 25) { r.x = r.tx; r.y = r.ty; }
      const inf = this.info.get(r.i); if (!inf) continue;
      runners.push({ ...r, name: inf.name, av: inf.av, bot: inf.bot });
    }
    const F = { gates: this.gates, team: this.team, st: this.st, runners, t: this.t, fx: this.fx };
    drawGates(ctx, F, this.box, { me: this.me });
    this.fx = F.fx;
    const j = this.joy;
    if (j) {
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(j.x0, j.y0, 46, 0, Math.PI * 2); ctx.stroke();
      const dx = j.x - j.x0; const dy = j.y - j.y0; const d = Math.min(46, Math.hypot(dx, dy)); const a = Math.atan2(dy, dx);
      ctx.fillStyle = '#ffc72c'; ctx.beginPath(); ctx.arc(j.x0 + Math.cos(a) * d, j.y0 + Math.sin(a) * d, 21, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#111'; ctx.stroke();
    }
  }
  destroy() { this.dead = true; this.ro?.disconnect(); window.removeEventListener('keydown', this.keyD); window.removeEventListener('keyup', this.keyU); this.canvas.remove(); }
}
export { FW, FH };
