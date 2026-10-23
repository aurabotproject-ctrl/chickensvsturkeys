// =========================================================
// GATES — host simulation + big screen (both teams side by side).
// Each team has its own copy of the field: their own task, their own open gate.
// Devices steer with inputs/{uid} = { a: angle, m: 1|0 }; the host sends
//   gt/info                 { round, gates, players }
//   gt/{team}/p             packed runners of that team (see rules.packRunner)
//   gt/{team}/s             { ph, c, n, inN, h, g, need, done, sc }
//   gt/{team}/e             last few events
// =========================================================
import { sfx } from '../../core/sfx.js?v=20261024093445';
import { FW, FH, PR, HOLD, CORNERS, speedFor, inCircle, makeGates, crosses, packRunner } from './rules.js?v=20261024093445';
import { drawGates, fitField, eventWord } from './draw.js?v=20261024093445';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);
const TEAMS = ['chicken', 'turkey'];

export class GatesArena {
  constructor(el, { onChange, onSync } = {}) {
    this.el = el; this.onChange = onChange || (() => {}); this.onSync = onSync || (() => {});
    this.players = new Map(); this.byIdx = [];
    this.totals = { chicken: 0, turkey: 0 }; this.roundPts = { chicken: 0, turkey: 0 };
    this.T = {}; for (const team of TEAMS) this.T[team] = this.blankTeam();
    this.gates = makeGates(1); this.round = 0; this.running = false; this.paused = false; this.t = 0; this.sent = {}; this.fx = { chicken: [], turkey: [] };
  }
  blankTeam() { return { ph: 'circle', c: 0, n: 1, inN: 0, hold: 0, g: -1, need: new Set(), done: new Set(), circle: new Set(), sc: 0, lastC: -1, lastG: -1, ev: [], evDirty: true }; }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.canvas = document.createElement('canvas'); this.canvas.className = 'gt-canvas';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.resize(); new ResizeObserver(() => this.resize()).observe(this.el);
    const frame = () => { this.render(); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(); let dt = Math.min(1, (now - last) / 1000); last = now; this.t += dt;
      while (dt > 0) { const step = Math.min(1 / 30, dt); dt -= step; if (this.running && !this.paused) this.simulate(step); }
    }, 33);
    setInterval(() => this.pushSync(), 170);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
    const top = h * 0.17 + 46; const bottom = h * 0.09; const half = w / 2;
    this.boxes = {
      chicken: fitField(half, h, top, bottom, 14),
      turkey: (() => { const b = fitField(half, h, top, bottom, 14); b.ox += half; return b; })(),
    };
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false, av }) {
    let p = this.players.get(uid);
    if (p) { p.name = name; if (av != null) p.av = av; return p; }
    p = { uid, name, team, bot, av, i: 0, score: 0, passes: 0, holds: 0, rc: 0, x: FW / 2, y: FH / 2, dx: 0, dy: 0, moving: false, speed: speedFor(0) };
    let n = 1; while (this.byIdx[n]) n++; p.i = n; this.byIdx[n] = p;
    this.players.set(uid, p);
    if (this.round) { this.spot(p); this.sendInfo(); }
    return p;
  }
  removePlayer(uid) {
    const p = this.players.get(uid); if (!p) return;
    const T = this.T[p.team]; T.need.delete(uid); T.done.delete(uid); T.circle.delete(uid);
    this.byIdx[p.i] = null; this.players.delete(uid); this.sendInfo();
  }
  setTeam(uid, team) { const p = this.players.get(uid); if (p && p.team !== team) { const T = this.T[p.team]; T.need.delete(uid); T.done.delete(uid); T.circle.delete(uid); p.team = team; this.spot(p); this.sendInfo(); } }
  updateTag() {} addEggs() { return 0; } celebrate() {} startEvent() {}
  team(team) { return [...this.players.values()].filter((p) => p.team === team); }
  spot(p) { p.x = FW / 2 + rnd(-14, 14); p.y = FH / 2 + rnd(-10, 10); p.moving = false; }

  // ---------- rounds ----------
  startRound() {
    this.round += 1; this.running = false; this.roundPts = { chicken: 0, turkey: 0 };
    this.gates = makeGates(Math.floor(Math.random() * 1e9));
    for (const team of TEAMS) { const sc = 0; this.T[team] = { ...this.blankTeam(), sc }; this.fx[team] = []; }
    for (const p of this.players.values()) { p.rc = 0; this.spot(p); }
    this.sendInfo(); this.pushSync(true);
  }
  sendInfo() {
    if (!this.round) return;
    this.onSync({ 'gt/info': { round: this.round, gates: this.gates, players: [...this.players.values()].map((p) => [p.i, p.uid, p.team, Number.isInteger(p.av) ? p.av : 0, first(p.name), p.bot ? 1 : 0]) } });
  }
  startBattle() {
    for (const p of this.players.values()) {
      if (p.bot) { p.rc = Math.floor(rnd(2, 9)); p.correct = (p.correct || 0) + p.rc; p.answered = (p.answered || 0) + p.rc + Math.floor(rnd(0, 4)); }
      p.speed = speedFor(p.rc); this.onChange(p);
    }
    for (const team of TEAMS) this.newTask(team);
    this.running = true; this.paused = false;
    for (const team of TEAMS) this.fx[team].push({ text: 'GO!', color: '#ffc72c', x: FW / 2, y: FH / 2, size: 12, t0: performance.now() });
    this.pushSync(true);
  }
  stopRound() {
    if (!this.running && this.lastRound?.round === this.round) return;
    this.running = false;
    for (const p of this.players.values()) { p.moving = false; this.onChange(p); }
    this.lastRound = { round: this.round, ...this.roundPts };
    this.pushSync(true);
  }
  resetScores() { this.totals = { chicken: 0, turkey: 0 }; this.round = 0; for (const p of this.players.values()) { p.score = 0; p.passes = 0; p.holds = 0; } }

  /** A new corner + number for this team. */
  newTask(team) {
    const T = this.T[team]; const size = this.team(team).length;
    const corners = [0, 1, 2, 3].filter((k) => k !== T.lastC && k !== T.c);
    T.c = pick(corners.length ? corners : [0, 1, 2, 3]); T.lastC = T.c;
    T.n = size <= 1 ? 1 : 1 + Math.floor(Math.random() * (size - 1)); // 1 … one less than the team size
    T.ph = 'circle'; T.hold = 0; T.inN = 0; T.g = -1; T.need = new Set(); T.done = new Set(); T.circle = new Set();
  }

  // ---------- answers + steering ----------
  reward(uid, { correct }) {
    const p = this.players.get(uid); if (!p) return null;
    if (correct) p.rc += 1;
    p.speed = speedFor(p.rc); this.onChange(p);
    return { rc: p.rc, speed: Math.round(p.speed) };
  }
  handleInput(uid, inp) {
    const p = this.players.get(uid); if (!p || !inp) return;
    if (+inp.m && Number.isFinite(+inp.a)) { p.dx = Math.cos(+inp.a); p.dy = Math.sin(+inp.a); p.moving = true; } else p.moving = false;
  }

  // ---------- simulation ----------
  simulate(dt) {
    for (const p of this.players.values()) {
      if (p.bot) this.botThink(p, dt);
      if (!p.moving) continue;
      const T = this.T[p.team]; const v = p.speed * dt;
      const ax = p.x; const ay = p.y;
      let nx = Math.max(PR, Math.min(FW - PR, ax + p.dx * v)); let ny = Math.max(PR, Math.min(FH - PR, ay + p.dy * v));
      p.blocked = false;
      this.gates.forEach((g, k) => {
        const open = T.ph === 'gate' && T.g === k;
        if (open) {
          if (crosses(g, ax, ay, nx, ny) && T.need.has(p.uid) && !T.done.has(p.uid)) {
            T.done.add(p.uid); p.passes += 1; p.score += 1; this.event(p.team, 'pass', p); sfx.click?.(); this.onChange(p);
          }
        } else if (crosses(g, ax, ay, nx, ny, PR * 0.5)) { // closed gates are fences
          if (g.o === 'v') nx = ax; else ny = ay;
          if (crosses(g, ax, ay, nx, ny, PR * 0.5)) { nx = ax; ny = ay; }
          p.blocked = true;
        }
      });
      p.x = nx; p.y = ny;
    }
    for (const team of TEAMS) this.teamTick(team, dt);
  }
  teamTick(team, dt) {
    const T = this.T[team]; const list = this.team(team);
    if (!list.length) return;
    if (T.ph === 'circle') {
      const inside = list.filter((p) => inCircle(p, T.c));
      T.inN = inside.length;
      T.hold = T.inN === T.n ? T.hold + dt : 0; // too few or too many = start again
      if (T.hold >= HOLD) {
        T.circle = new Set(inside.map((p) => p.uid));
        for (const p of inside) { p.holds += 1; p.score += 1; this.onChange(p); }
        const others = list.filter((p) => !T.circle.has(p.uid));
        T.need = new Set((others.length ? others : list).map((p) => p.uid));
        const gates = [0, 1, 2, 3, 4].filter((k) => k !== T.lastG);
        T.g = pick(gates); T.ph = 'gate'; T.done = new Set(); T.hold = 0;
        this.event(team, 'hold', this.gates[T.g]); sfx.correct?.();
      }
    } else {
      for (const uid of [...T.need]) if (!this.players.has(uid)) { T.need.delete(uid); T.done.delete(uid); }
      if (T.need.size && [...T.need].every((uid) => T.done.has(uid))) {
        T.sc += 1; this.totals[team] += 1; this.roundPts[team] += 1; T.lastG = T.g;
        this.event(team, 'gate', this.gates[T.g]); sfx.whistle?.();
        this.newTask(team);
        for (const p of list) this.onChange(p);
      } else if (!T.need.size) this.newTask(team);
    }
  }
  event(team, type, at) {
    const T = this.T[team]; this.evSeq = (this.evSeq || 0) + 1;
    const e = { k: this.evSeq, type, x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, i: at.i || 0 };
    T.ev = [...T.ev, e].slice(-6); T.evDirty = true;
    this.fx[team].push(eventWord(e));
  }

  // ---------- bots ----------
  botThink(p, dt) {
    p.think = (p.think || 0) - dt; if (p.think > 0) return; p.think = 0.12;
    const T = this.T[p.team]; const list = this.team(p.team);
    let tx = p.x; let ty = p.y; let go = false;
    if (T.ph === 'circle') {
      const c = CORNERS[T.c];
      const ranked = [...list].sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
      const k = ranked.indexOf(p);
      if (k < T.n) { const a = (k / Math.max(1, T.n)) * Math.PI * 2; tx = c.x + Math.cos(a) * 3.5 * Math.min(1, k); ty = c.y + Math.sin(a) * 3.5 * Math.min(1, k); go = Math.hypot(tx - p.x, ty - p.y) > 1; }
      else if (inCircle(p, T.c) || Math.hypot(p.x - c.x, p.y - c.y) < 20) { tx = FW / 2 + (c.x < FW / 2 ? -10 : 10); ty = FH / 2; go = true; } // step out of the way
    } else if (T.need.has(p.uid) && !T.done.has(p.uid)) {
      const g = this.gates[T.g];
      const along = g.o === 'v' ? p.x - g.x : p.y - g.y; const across = g.o === 'v' ? p.y - g.y : p.x - g.x;
      const side = along >= 0 ? 1 : -1;
      if (Math.abs(across) > 4 || Math.abs(along) > 7) { tx = g.o === 'v' ? g.x + side * 5 : g.x; ty = g.o === 'v' ? g.y : g.y + side * 5; } // line up in front of the gate
      else { tx = g.o === 'v' ? g.x - side * 9 : g.x; ty = g.o === 'v' ? g.y : g.y - side * 9; } // run through
      go = true;
    }
    if (!go) { p.moving = false; return; }
    let dx = tx - p.x; let dy = ty - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    if (p.blocked) { p.dodge = 0.6; p.dodgeDir = Math.random() < 0.5 ? 1 : -1; }
    if (p.dodge > 0) { p.dodge -= 0.12; const ddx = -dy * p.dodgeDir; const ddy = dx * p.dodgeDir; dx = ddx; dy = ddy; }
    p.dx = dx; p.dy = dy; p.moving = d > 0.5;
  }

  // ---------- scores + sync ----------
  teamTotals() { return { ...this.totals }; }
  flagOf(p) { const T = this.T[p.team]; if (T.ph !== 'gate') return 0; if (T.done.has(p.uid)) return 3; if (T.need.has(p.uid)) return 2; if (T.circle.has(p.uid)) return 1; return 0; }
  teamState(team) { const T = this.T[team]; return { ph: T.ph, c: T.c, n: T.n, inN: T.inN, h: Math.round((T.hold / HOLD) * 20) / 20, g: T.g, need: T.need.size, done: T.done.size, sc: T.sc }; }
  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    return { score: p.score, i: p.i, rc: p.rc, speed: Math.round(p.speed), passes: p.passes, holds: p.holds, tc: this.totals.chicken, tt: this.totals.turkey };
  }
  pushSync(force = false) {
    if (!this.round) return;
    const up = {};
    for (const team of TEAMS) {
      const pos = this.team(team).map((p) => packRunner(p, this.flagOf(p))).join('');
      if (force || pos !== this.sent[`${team}p`]) { this.sent[`${team}p`] = pos; up[`gt/${team}/p`] = pos; }
      const s = JSON.stringify(this.teamState(team));
      if (force || s !== this.sent[`${team}s`]) { this.sent[`${team}s`] = s; up[`gt/${team}/s`] = JSON.parse(s); }
      const T = this.T[team]; if (force || T.evDirty) { T.evDirty = false; up[`gt/${team}/e`] = T.ev; }
    }
    if (Object.keys(up).length) this.onSync(up);
  }

  // ---------- drawing ----------
  render() {
    const ctx = this.ctx; if (!ctx || !this.boxes) return;
    const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const team of TEAMS) {
      const box = this.boxes[team]; const T = this.T[team];
      const runners = this.team(team).map((p) => ({ i: p.i, x: p.x, y: p.y, f: this.flagOf(p), av: p.av, name: first(p.name), bot: p.bot }));
      const F = { gates: this.gates, team, st: { ...this.teamState(team), h: T.hold / HOLD }, runners, t: this.t, fx: this.fx[team] };
      drawGates(ctx, F, box, { small: runners.length > 12 });
      this.fx[team] = F.fx;
      // title over each field
      const cx = box.ox + (FW * box.cell) / 2; const y = box.oy - 26;
      ctx.font = 'normal 30px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = '#111';
      const task = !this.running ? '' : T.ph === 'circle' ? `  ·  GET ${T.n} IN THE CORNER (${T.inN} IN)` : `  ·  THROUGH THE GATE! ${T.done.size}/${T.need.size}`;
      const label = `${team === 'chicken' ? 'CHICKENS' : 'TURKEYS'}: ${T.sc} GATE${T.sc === 1 ? '' : 'S'}${task}`;
      ctx.strokeText(label, cx, y); ctx.fillStyle = team === 'chicken' ? '#8ec0ff' : '#ff9a85'; ctx.fillText(label, cx, y);
    }
  }
  destroy() { this.canvas?.remove(); }
}
