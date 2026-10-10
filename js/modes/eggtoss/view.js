// =========================================================
// EGG TOSS — the student's screen.
//   Flingers: put a finger down and drag — your crosshair sits just above
//             your finger (only YOU can see it). Let go to fling an egg.
//   Dodgers:  hold ◀ / ▶ (or the arrow keys) to slide your piece along its rail.
// =========================================================
import { GW, GH, SPEED, FLIGHT, X_MIN, X_MAX, COOLDOWN, PHONE_VIEW } from './rules.js?v=20261010182233';
import { drawGallery, toStall } from './draw.js?v=20261010182233';

const AIM_LIFT = 70; // css px the crosshair sits above the finger

export class EtView {
  constructor(el, { uid, onFling, onX } = {}) {
    this.el = el; this.uid = uid; this.onFling = onFling || (() => {}); this.onX = onX || (() => {});
    this.sentX = null; this.sentAt = 0;
    this.info = null; this.defs = []; this.eggs = new Map(); this.splats = new Map();
    this.role = 'att'; this.team = 'chicken'; this.eggsLeft = 0; this.dir = 0; this.myX = null; this.lastFling = 0; this.local = [];
    this.canvas = document.createElement('canvas'); this.canvas.className = 'et-phone';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.el); this.resize();
    this.setupInput();
    let last = performance.now();
    const frame = (now) => { if (this.dead) return; const dt = Math.min(0.1, (now - last) / 1000); last = now; this.step(dt); this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
  }
  setRole({ role, team, eggs }) { this.role = role; this.team = team; this.eggsLeft = eggs; if (role !== 'def') this.setDir(0); }
  setInfo(info) {
    if (!info) return;
    if (this.info && this.info.round !== info.round) { this.eggs.clear(); this.splats.clear(); this.local = []; this.myX = null; this.sentX = null; this.setDir(0); }
    this.info = info;
    const old = new Map(this.defs.map((p) => [p.uid, p]));
    this.defs = (info.d || []).map(([uid, team, pc, name, lane]) => { const o = old.get(uid); return { uid, team, pc, name, lane, x: o?.x ?? GW / 2, tx: o?.tx ?? GW / 2, out: o?.out || false, outAt: o?.outAt, ts: o?.ts ?? 1, seen: o?.seen }; });
  }
  setState(str) {
    const [dp = '', eg = '', sp = ''] = String(str || '').split('|');
    const now = performance.now();
    for (const t of dp.split(';').filter(Boolean)) {
      const [i, x, out, ts] = t.split(',').map(Number); const p = this.defs[i]; if (!p) continue;
      p.tx = x; p.ts = ts / 100;
      if (!p.seen) { p.x = x; p.seen = true; }
      if (out && !p.out) { p.out = true; p.outAt = now; if (p.uid === this.uid) this.onOut?.(); }
      if (!out) p.out = false;
    }
    const ids = new Set();
    for (const t of eg.split(';').filter(Boolean)) {
      const [id, x0, x1, y1, k, ai] = t.split(',').map(Number); ids.add(id);
      const mine = this.info?.a?.[ai] === this.uid;
      const e = this.eggs.get(id);
      if (!e) {
        if (mine) { const loc = this.local.findIndex((l) => Math.abs(l.x1 - x1) < 2 && Math.abs(l.y1 - y1) < 2); if (loc >= 0) { const l = this.local.splice(loc, 1)[0]; this.eggs.set(id, { ...l, x0 }); continue; } }
        this.eggs.set(id, { x0, x1, y1, k: k / 100 });
      } else if (!mine) e.k = Math.max(e.k, k / 100);
    }
    for (const id of [...this.eggs.keys()]) if (!ids.has(id) && this.eggs.get(id).k < 0.9) this.eggs.delete(id);
    const sids = new Set();
    for (const t of sp.split(';').filter(Boolean)) {
      const [id, x, y, kind] = t.split(','); sids.add(+id);
      if (!this.splats.has(+id)) this.splats.set(+id, { x: +x, y: +y, kind: kind === 'h' ? 'hit' : 'miss', t0: now });
    }
    for (const id of [...this.splats.keys()]) if (!sids.has(id)) this.splats.delete(id);
  }

  // ---------- input ----------
  setupInput() {
    const c = this.canvas; c.style.touchAction = 'none';
    const aimAt = (e) => { const r = c.getBoundingClientRect(); const pt = toStall(this.L, e.clientX - r.left, e.clientY - r.top - AIM_LIFT); this.aim = { x: Math.max(0, Math.min(GW, pt.x)), y: Math.max(0, Math.min(GH, pt.y)) }; };
    c.addEventListener('pointerdown', (e) => { if (this.role !== 'att' || !this.L) return; c.setPointerCapture(e.pointerId); this.aiming = true; aimAt(e); });
    c.addEventListener('pointermove', (e) => { if (this.aiming) aimAt(e); });
    const release = () => {
      if (!this.aiming) return; this.aiming = false;
      const a = this.aim; if (!a) return;
      const now = performance.now();
      if (this.eggsLeft <= 0) { this.onEmpty?.(); return; }
      if (now - this.lastFling < COOLDOWN * 1000) return;
      this.lastFling = now; this.eggsLeft -= 1;
      const x = Math.round(a.x); const y = Math.round(a.y);
      this.local.push({ x0: GW / 2, x1: x, y1: y, k: 0, local: true });
      this.onFling(x, y);
    };
    c.addEventListener('pointerup', release); c.addEventListener('pointercancel', () => { this.aiming = false; });
    this.keyH = (e) => {
      if (this.role !== 'def') return;
      const d = { ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1 }[e.key];
      if (d == null) return;
      e.preventDefault(); this.setDir(e.type === 'keydown' ? d : 0);
    };
    window.addEventListener('keydown', this.keyH); window.addEventListener('keyup', this.keyH);
  }
  setDir(d) { if (d === this.dir) return; this.dir = d; if (!d) this.sendX(true); }
  /** Tell the host where my piece is (about 12 times a second while moving, and once when I stop). */
  sendX(force = false) {
    if (this.myX == null) return;
    const x = Math.round(this.myX); const now = performance.now();
    if (x === this.sentX || (!force && now - this.sentAt < 80)) return;
    this.sentX = x; this.sentAt = now; this.onX(x);
  }

  // ---------- animation ----------
  step(dt) {
    for (const e of this.eggs.values()) e.k += dt / FLIGHT;
    for (const e of this.local) e.k += dt / FLIGHT;
    for (const [id, e] of this.eggs) if (e.k >= 1.05) this.eggs.delete(id);
    this.local = this.local.filter((e) => e.k < 1.05);
    for (const p of this.defs) {
      if (p.uid === this.uid && !p.out) {
        // my own piece is driven ONLY by my buttons (the big screen follows me, not the other way round)
        if (this.myX == null) { if (!p.seen) continue; this.myX = p.tx; }
        if (this.dir) { this.myX = Math.max(X_MIN, Math.min(X_MAX, this.myX + this.dir * SPEED * dt)); this.sendX(); }
        p.x = this.myX;
      } else p.x += (p.tx - p.x) * Math.min(1, dt * 12);
    }
  }
  render() {
    const ctx = this.ctx; const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#2a170a'; ctx.fillRect(0, 0, W, H);
    if (!this.info) return;
    const G = { defenders: this.defs, eggs: [...this.eggs.values(), ...this.local], splats: [...this.splats.values()] };
    const ret = this.role === 'att' && this.aiming && this.aim ? { ...this.aim, team: this.team } : null;
    this.L = drawGallery(ctx, G, 0, 0, W, H, { me: this.uid, reticle: ret, view: PHONE_VIEW });
  }
  destroy() { this.dead = true; this.ro?.disconnect(); window.removeEventListener('keydown', this.keyH); window.removeEventListener('keyup', this.keyH); this.canvas.remove(); }
}
