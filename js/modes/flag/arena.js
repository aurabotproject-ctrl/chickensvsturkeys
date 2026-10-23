// =========================================================
// CAPTURE THE FLAG — host simulation + big-screen drawing.
// Rules: see rules.js. Devices steer with a finger (inputs/{uid} = { a: angle, m: 1|0 });
// the host moves everyone and sends positions to cf/* (~6 times a second).
// =========================================================
import { sfx } from '../../core/sfx.js?v=20261024102606';
import { FW, FH, MID, PR, TAG_D, TAG_TIME, IMMUNE, ZR, ZONE, BATTLE_MS, speedFor, enemyOf, sideOf, inZone, packRunner } from './rules.js?v=20261024102606';
import { drawField, fitField, eventWord } from './draw.js?v=20261024102606';

const rnd = (a, b) => a + Math.random() * (b - a);
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);

export class FlagArena {
  constructor(el, { onChange, onSync } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onSync = onSync || (() => {});
    this.players = new Map(); this.byIdx = [];
    this.flags = { chicken: null, turkey: null }; // who is carrying each team's flag (player object)
    this.locked = { chicken: false, turkey: false }; // true = that team just scored and must all go home before grabbing again
    this.totals = { chicken: 0, turkey: 0 }; this.roundCaps = { chicken: 0, turkey: 0 };
    this.running = false; this.paused = false; this.round = 0; this.fx = []; this.events = []; this.evSeq = 0;
    this.t = 0; this.sent = {};
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.canvas = document.createElement('canvas'); this.canvas.className = 'cf-canvas';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.resize(); new ResizeObserver(() => this.resize()).observe(this.el);
    const frame = () => { this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(); let dt = Math.min(1, (now - last) / 1000); last = now; this.t += dt;
      while (dt > 0) { const step = Math.min(1 / 30, dt); dt -= step; if (this.running && !this.paused) this.simulate(step); }
    }, 33);
    setInterval(() => this.pushSync(), 160);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
    this.box = fitField(w, h, h * 0.17, h * 0.09, 18);
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false, av }) {
    let p = this.players.get(uid);
    if (p) { p.name = name; if (av != null) p.av = av; return p; }
    p = { uid, name, team, bot, av, i: 0, score: 0, caps: 0, tags: 0, frees: 0, rc: 0, x: 0, y: 0, dx: 0, dy: 0, moving: false, frozen: false, carry: false, tagT: 0, freeT: 0, immune: 0, speed: speedFor(0) };
    this.players.set(uid, p);
    this.index(p);
    if (this.round) { this.place(p); this.sendInfo(); }
    return p;
  }
  index(p) { let n = 1; while (this.byIdx[n]) n++; p.i = n; this.byIdx[n] = p; }
  removePlayer(uid) {
    const p = this.players.get(uid); if (!p) return;
    this.dropFlag(p, false);
    this.byIdx[p.i] = null; this.players.delete(uid); this.sendInfo();
  }
  setTeam(uid, team) { const p = this.players.get(uid); if (p && p.team !== team) { this.dropFlag(p, false); p.team = team; p.frozen = false; this.place(p); this.sendInfo(); } }
  updateTag() {}
  addEggs() { return 0; }
  celebrate() {}
  startEvent() {}

  // ---------- rounds ----------
  startRound() {
    this.round += 1;
    this.running = false; this.fx = []; this.roundCaps = { chicken: 0, turkey: 0 };
    this.flags = { chicken: null, turkey: null }; this.locked = { chicken: false, turkey: false };
    for (const p of this.players.values()) { p.rc = 0; p.frozen = false; p.carry = false; p.tagT = 0; p.freeT = 0; p.immune = 0; p.moving = false; }
    this.lineUp();
    this.sendInfo(); this.pushSync(true);
  }
  /** Everyone lines up on their own half, facing the halfway line. */
  lineUp() {
    for (const team of ['chicken', 'turkey']) {
      const list = [...this.players.values()].filter((p) => p.team === team);
      list.forEach((p, k) => {
        const cols = Math.ceil(list.length / 9); const col = k % cols; const row = Math.floor(k / cols); const rows = Math.ceil(list.length / cols);
        const x = MID - 14 - col * 7; const y = FH / 2 + (row - (rows - 1) / 2) * Math.min(9, (FH - 12) / Math.max(1, rows - 1 || 1));
        p.x = team === 'chicken' ? x : FW - x; p.y = Math.max(5, Math.min(FH - 5, y));
      });
    }
  }
  place(p) { const own = p.team === 'chicken'; p.x = own ? rnd(MID - 30, MID - 10) : rnd(MID + 10, MID + 30); p.y = rnd(10, FH - 10); p.frozen = false; p.carry = false; }
  sendInfo() {
    if (!this.round) return;
    this.onSync({ 'cf/info': { round: this.round, players: [...this.players.values()].map((p) => [p.i, p.uid, p.team, Number.isInteger(p.av) ? p.av : 0, first(p.name), p.bot ? 1 : 0]) } });
  }
  startBattle() {
    for (const p of this.players.values()) {
      if (p.bot) { p.rc = Math.floor(rnd(2, 9)); p.correct = (p.correct || 0) + p.rc; p.answered = (p.answered || 0) + p.rc + Math.floor(rnd(0, 4)); p.role = Math.random() < 0.55 ? 'att' : 'def'; }
      p.speed = speedFor(p.rc); this.onChange(p);
    }
    this.running = true; this.paused = false;
    this.fx.push({ text: 'GO! GET THEIR FLAG!', color: '#ffc72c', x: MID, y: FH / 2, size: 7, t0: performance.now() });
  }
  stopRound() {
    if (!this.running && this.lastRound?.round === this.round) return;
    this.running = false;
    for (const p of this.players.values()) { p.moving = false; this.onChange(p); }
    this.lastRound = { round: this.round, ...this.roundCaps };
    this.pushSync(true);
  }
  resetScores() { this.totals = { chicken: 0, turkey: 0 }; this.round = 0; for (const p of this.players.values()) { p.score = 0; p.caps = 0; p.tags = 0; p.frees = 0; } }

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
    const all = [...this.players.values()];
    for (const p of all) {
      if (p.immune > 0) p.immune -= dt;
      if (p.bot) this.botThink(p, dt);
      if (p.frozen || !p.moving) continue;
      const v = p.speed * (p.carry ? 0.95 : 1) * dt;
      p.x = Math.max(PR, Math.min(FW - PR, p.x + p.dx * v)); p.y = Math.max(PR, Math.min(FH - PR, p.y + p.dy * v));
      // no standing in your own flag area
      const z = ZONE[p.team]; const d = Math.hypot(p.x - z.x, p.y - z.y);
      if (d < ZR + PR * 0.6) { const k = (ZR + PR * 0.6) / (d || 1); p.x = z.x + (p.x - z.x) * k; p.y = z.y + (p.y - z.y) * k; if (!d) p.x = z.x + (p.team === 'chicken' ? 1 : -1) * (ZR + PR); }
      const enemy = enemyOf(p.team);
      // grab their flag
      if (!p.carry && !this.flags[enemy] && !this.locked[p.team] && inZone(p, enemy)) { this.flags[enemy] = p; p.carry = true; this.event('grab', p); sfx.join?.(); }
      // bring it home = 1 point
      if (p.carry && sideOf(p.x) === p.team) {
        p.carry = false; this.flags[enemy] = null;
        p.caps += 1; p.score = p.caps; this.totals[p.team] += 1; this.roundCaps[p.team] += 1;
        this.event('cap', p); sfx.correct?.(); this.onChange(p);
        this.locked[p.team] = true; // everyone back to your own half before the next grab
      }
    }
    // a team that just scored can grab again once every (unfrozen) player is back on their own half
    for (const team of ['chicken', 'turkey']) {
      if (!this.locked[team]) continue;
      const out = all.filter((q) => q.team === team && !q.frozen && sideOf(q.x) !== team);
      if (!out.length) { this.locked[team] = false; this.event('unlock', { x: ZONE[enemyOf(team)].x, y: ZONE[enemyOf(team)].y, team }); }
    }
    // tags + rescues: overlapping for a whole second
    for (const p of all) {
      if (p.frozen) {
        // two or more teammates touching = twice as fast (½ second)
        const helpers = all.filter((q) => q.team === p.team && !q.frozen && q !== p && Math.hypot(q.x - p.x, q.y - p.y) < TAG_D);
        p.freeT = helpers.length ? p.freeT + dt * (helpers.length >= 2 ? 2 : 1) : 0;
        if (p.freeT >= TAG_TIME) { p.frozen = false; p.freeT = 0; p.immune = IMMUNE; for (const h of helpers) { h.frees += 1; this.onChange(h); } this.event('free', p); sfx.correct?.(); this.onChange(p); }
        continue;
      }
      const vulnerable = sideOf(p.x) !== p.team && !inZone(p, enemyOf(p.team)) && p.immune <= 0;
      // two or more opponents touching = twice as fast (½ second)
      const taggers = vulnerable ? all.filter((q) => q.team !== p.team && !q.frozen && Math.hypot(q.x - p.x, q.y - p.y) < TAG_D) : [];
      const tagger = taggers[0];
      p.tagT = taggers.length ? p.tagT + dt * (taggers.length >= 2 ? 2 : 1) : 0;
      if (p.tagT >= TAG_TIME) {
        p.tagT = 0; p.frozen = true; p.moving = false; tagger.tags += 1;
        this.dropFlag(p, true);
        this.event('tag', p); sfx.splat?.();
        this.onChange(p); this.onChange(tagger);
      }
    }
  }
  /** Tagged (or left) while carrying: their flag goes back home. */
  dropFlag(p, show) {
    if (!p.carry) return;
    p.carry = false; const enemy = enemyOf(p.team);
    if (this.flags[enemy] === p) this.flags[enemy] = null;
    if (show) this.event('drop', { x: ZONE[enemy].x, y: ZONE[enemy].y, team: enemy });
  }
  event(type, p) {
    this.evSeq += 1;
    const e = { k: this.evSeq, type, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, i: p.i || 0, team: p.team };
    this.events = [...this.events, e].slice(-6);
    this.fx.push(eventWord(e));
    this.dirtyEv = true;
  }

  // ---------- bots ----------
  botThink(p, dt) {
    if (p.frozen) return;
    p.think = (p.think || 0) - dt; if (p.think > 0) return; p.think = 0.15;
    const enemy = enemyOf(p.team); const all = [...this.players.values()];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let tx; let ty;
    const frozenMate = all.filter((q) => q.team === p.team && q.frozen).sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (p.carry || (this.locked[p.team] && sideOf(p.x) !== p.team)) { tx = p.team === 'chicken' ? MID - 12 : MID + 12; ty = p.y; }
    else if (p.role === 'def') {
      const intruder = all.filter((q) => q.team === enemy && !q.frozen && sideOf(q.x) === p.team && !inZone(q, p.team)).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (intruder) { tx = intruder.x; ty = intruder.y; } else { tx = p.team === 'chicken' ? MID - 22 : MID + 22; ty = FH / 2 + Math.sin(this.t * 0.7 + p.i) * 22; }
    } else if (frozenMate && dist(frozenMate, p) < 45 && Math.random() < 0.7) { tx = frozenMate.x; ty = frozenMate.y; }
    else {
      // pick a lane: run up the side with the fewest defenders, then cut in to their flag area
      if (!p.lane || Math.random() < 0.02) {
        const defs = all.filter((q) => q.team === enemy && !q.frozen && sideOf(q.x) === enemy);
        const busy = (y) => defs.filter((q) => Math.abs(q.y - y) < 18).length;
        p.lane = [12, FH / 2, FH - 12].sort((a, b) => busy(a) - busy(b) + (Math.random() - 0.5))[0];
      }
      const dz = Math.abs(p.x - ZONE[enemy].x);
      tx = ZONE[enemy].x; ty = dz > 30 ? p.lane : ZONE[enemy].y;
    }
    let dx = tx - p.x; let dy = ty - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    // attackers on the enemy half shy away from defenders
    if (p.role !== 'def' && sideOf(p.x) !== p.team) {
      for (const q of all) {
        if (q.team === p.team || q.frozen) continue; const dd = dist(q, p);
        if (dd < 16) { dx += ((p.x - q.x) / dd) * (16 - dd) / 5; dy += ((p.y - q.y) / dd) * (16 - dd) / 5; }
      }
      const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    }
    p.dx = dx; p.dy = dy; p.moving = d > 0.6;
  }

  // ---------- scores + device state ----------
  teamTotals() { return { ...this.totals }; }
  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    return { score: p.score, i: p.i, rc: p.rc, speed: Math.round(p.speed), caps: p.caps, tags: p.tags, frees: p.frees, frozen: p.frozen ? 1 : 0, carry: p.carry ? 1 : 0, tc: this.totals.chicken, tt: this.totals.turkey };
  }
  pushSync(force = false) {
    if (!this.round) return;
    const up = {};
    const pos = [...this.players.values()].map(packRunner).join('');
    if (force || pos !== this.sent.p) { this.sent.p = pos; up['cf/p'] = pos; }
    const fl = `${this.flags.chicken?.i || 0},${this.flags.turkey?.i || 0},${this.locked.chicken ? 1 : 0},${this.locked.turkey ? 1 : 0}`;
    if (force || fl !== this.sent.f) { this.sent.f = fl; up['cf/f'] = fl; }
    if (force || this.dirtyEv) { this.dirtyEv = false; up['cf/e'] = this.events; }
    if (Object.keys(up).length) this.onSync(up);
  }

  // ---------- drawing ----------
  render() {
    const ctx = this.ctx; if (!ctx || !this.box) return;
    const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const runners = [...this.players.values()].map((p) => ({ i: p.i, team: p.team, name: first(p.name), av: p.av, bot: p.bot, x: p.x, y: p.y, frozen: p.frozen, carry: p.carry, immune: p.immune > 0, prog: Math.min(1, (p.frozen ? p.freeT : p.tagT) / TAG_TIME) }));
    const S = { runners, flags: { chicken: this.flags.chicken?.i ?? null, turkey: this.flags.turkey?.i ?? null }, locks: { ...this.locked }, t: this.t, fx: this.fx };
    drawField(ctx, S, this.box);
    this.fx = S.fx;
  }
  destroy() { this.canvas?.remove(); }
}

export { BATTLE_MS };
