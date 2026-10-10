// =========================================================
// CROSS THE ROAD — the student's screen.
// My bird is simulated right here (instant hops, fair timing): it uses
// the same traffic clock as the big screen. Everyone else comes from
// the host. Controls: tap = hop forward, swipe = hop that way,
// or the arrow buttons / arrow keys.
// =========================================================
import { W, L, makeField, tryHop, stepBird, startCol } from './rules.js?v=20261010230402';
import { drawField } from './draw.js?v=20261010230402';

export class CrossView {
  constructor(el, { uid, now, onOp, onEvent } = {}) {
    this.el = el; this.uid = uid; this.now = now || (() => Date.now());
    this.onOp = onOp || (() => {}); this.onEvent = onEvent || (() => {});
    this.info = null; this.field = null; this.others = new Map(); this.me = null; this.fx = [];
    this.seq = Date.now(); this.sent = []; this.hopsFromHost = 0; this.ackSeq = 0; this.cam = {};
    this.active = false; // true while the round is being played
    this.canvas = document.createElement('canvas'); this.canvas.className = 'cr-canvas';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.el); this.resize();
    this.setupInput();
    let last = performance.now();
    // the simulation keeps running even while the QUIZ tab is showing (you can still get splatted!)
    this.timer = setInterval(() => { const n = performance.now(); this.step(Math.min(1.5, (n - last) / 1000)); last = n; }, 40); // true elapsed time, so riding a log stays exact even if the tab was throttled
    const frame = () => { if (this.dead) return; this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
  }
  time() { const i = this.info; if (!i) return 0; return ((i.paused ? this.pausedAt ?? this.now() : this.now()) - i.t0) / 1000; }

  setInfo(info) {
    if (!info) return;
    const newRound = !this.info || this.info.round !== info.round || this.info.seed !== info.seed;
    if (info.paused && !this.info?.paused) this.pausedAt = this.now();
    if (!info.paused) this.pausedAt = null;
    this.info = info;
    if (newRound) { this.field = makeField(info.seed); this.me = null; this.sent = []; this.fx = []; this.cam = {}; this.others.clear(); }
  }
  setState(str) {
    if (!this.info) return;
    const rows = this.info.players || [];
    const now = performance.now();
    for (const part of String(str || '').split(';').filter(Boolean)) {
      const [i, r, x100, deaths, crosses] = part.split(',').map(Number);
      const row = rows[i]; if (!row) continue;
      const [uid, team, name] = row;
      if (uid === this.uid) { if (!this.me) this.me = { uid, team, name, r, x: x100 / 100, face: 1 }; continue; }
      let b = this.others.get(uid);
      if (!b) { b = { uid, team, name, r, x: x100 / 100, face: 1, deaths, crosses }; this.others.set(uid, b); }
      if (deaths > b.deaths) this.fx.push({ kind: this.field?.lanes[b.r]?.type === 'river' ? 'river' : 'road', r: b.r, x: b.x, team, t0: now });
      if (crosses > b.crosses) this.fx.push({ kind: 'cross', r: L - 1, x: b.x, team, t0: now });
      const nx = x100 / 100; if (nx !== b.x) b.face = nx > b.x ? 1 : -1;
      Object.assign(b, { team, name, r, x: nx, deaths, crosses });
    }
  }
  /** From my pstate: how many hops the host says I have, and the last command it applied. */
  setMine({ hops = 0, hs = 0 } = {}) { this.hopsFromHost = hops; this.ackSeq = hs; this.sent = this.sent.filter((s) => s > hs); }
  hopsLeft() { return Math.max(0, this.hopsFromHost - this.sent.length); }

  // ---------- moving ----------
  hop(dir) {
    const me = this.me; if (!me || !this.field || !this.active || this.info?.paused) return 'off';
    if (this.hopsLeft() <= 0) { this.onEvent('nohops'); return 'nohops'; }
    const res = tryHop(this.field, me, dir, this.time());
    if (!res) { this.onEvent('blocked'); return 'blocked'; }
    if (res.x !== me.x) me.face = res.x > me.x ? 1 : -1;
    me.r = res.r; me.x = res.x;
    this.send({ op: 'hop', r: res.r, x: Math.round(res.x * 100) / 100 }, true);
    this.onEvent('hop');
    if (res.dead) this.die(res.dead);
    else if (res.cross) this.crossed();
    return 'ok';
  }
  die(why) {
    const me = this.me; const nx = startCol();
    (this.log ||= []).push({ why, r: me.r, x: Math.round(me.x * 100) / 100, t: Math.round(this.time() * 10) / 10, vis: document.visibilityState, hops: this.hopsLeft() }); // for testing
    this.fx.push({ kind: why, r: me.r, x: me.x, team: me.team, t0: performance.now() });
    this.send({ op: 'splat', why, nx });
    me.r = 0; me.x = nx; me.dr = null; this.cam.y = null;
    this.onEvent(why);
  }
  crossed() {
    const me = this.me; const nx = startCol();
    this.fx.push({ kind: 'cross', r: L - 1, x: me.x, team: me.team, t0: performance.now() });
    this.send({ op: 'cross', nx });
    setTimeout(() => { if (this.me === me) { me.r = 0; me.x = nx; me.dr = null; this.cam.y = null; } }, 450);
    this.onEvent('cross');
  }
  send(cmd, isHop = false) {
    this.seq += 1; if (isHop) this.sent.push(this.seq);
    this.q = [...(this.q || []), { s: this.seq, ...cmd }].slice(-12);
    this.onOp(this.q);
  }
  step(dt) {
    if (!this.field || !this.me || !this.active || this.info?.paused) return;
    const why = stepBird(this.field, this.me, dt, this.time());
    if (why) this.die(why);
    // others riding logs drift between host updates
    for (const b of this.others.values()) { const lane = this.field.lanes[b.r]; if (lane?.type === 'river') b.x += lane.v * dt; }
    this.fx = this.fx.filter((f) => performance.now() - f.t0 < 1500);
  }

  // ---------- input ----------
  setupInput() {
    const c = this.canvas; c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    c.addEventListener('pointerup', (e) => {
      const d = this.down; this.down = null; if (!d) return;
      const dx = e.clientX - d.x; const dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) < 24) { this.hop('u'); return; } // tap = forward
      if (Math.abs(dx) > Math.abs(dy)) this.hop(dx > 0 ? 'r' : 'l'); else this.hop(dy < 0 ? 'u' : 'd');
    });
    this.keyH = (e) => {
      const d = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r' }[e.key];
      if (!d || !this.visible()) return; e.preventDefault(); this.hop(d);
    };
    window.addEventListener('keydown', this.keyH);
  }
  visible() { return this.el.offsetParent !== null; }

  render() {
    const ctx = this.ctx; const dpr = this.dpr; const Wd = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    if (!Wd || !H || !this.visible()) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wd, H);
    ctx.fillStyle = '#2f5a1a'; ctx.fillRect(0, 0, Wd, H);
    if (!this.field) return;
    const me = this.me;
    const birds = [...this.others.values()]; if (me) birds.push(me);
    const S = { field: this.field, t: this.time(), birds, fx: this.fx };
    const zoom = Wd > H ? 9 : 6.5;
    drawField(ctx, S, 0, 0, Wd, H, { me: this.uid, follow: me ? { r: me.dr ?? me.r, x: me.dx ?? me.x, zoom, cam: this.cam } : { r: 0, x: W / 2, zoom, cam: this.cam } });
    // how far up the field am I?
    if (me) {
      const k = me.r / (L - 1); const bx = Wd - 14; const by0 = 12; const bh = H - 24;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(bx, by0, 6, bh);
      ctx.fillStyle = '#ffc72c'; ctx.beginPath(); ctx.arc(bx + 3, by0 + bh * (1 - k), 7, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
    }
  }
  destroy() { this.dead = true; clearInterval(this.timer); this.ro?.disconnect(); window.removeEventListener('keydown', this.keyH); this.canvas.remove(); }
}
