// =========================================================
// CROSS THE ROAD — host game logic + big-screen drawing.
// Phones drive their own bird (so hop timing feels instant) and send
//   inputs/{uid}.q = [{ s, op: 'hop', r, x } | { s, op: 'splat', why, nx } | { s, op: 'cross', nx }]
// The host keeps the hop balance, the scores and the bots, and sends
//   cr/info = { round, seed, t0, players: [[uid, team, name]] }
//   cr/s    = "i,r,x100,deaths,crossings;…"
// =========================================================
import { sfx } from '../../core/sfx.js?v=20261010211359';
import { W, L, HOPS_PER, MAX_HOPS, makeField, tryHop, stepBird, startCol, danger, dangerAhead } from './rules.js?v=20261010211359';
import { drawField } from './draw.js?v=20261010211359';

const rnd = (a, b) => a + Math.random() * (b - a);
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);

export class CrossArena {
  constructor(el, { onChange, onSync, onWin } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onSync = onSync || (() => {});
    this.onWin = onWin || (() => {});
    this.players = new Map();
    this.round = 0; this.field = null; this.t0 = 0;
    this.totals = { chicken: 0, turkey: 0 }; this.roundTotals = { chicken: 0, turkey: 0 };
    this.running = false; this._paused = false; this.pausedAt = 0;
    this.fx = []; this.lastCmd = new Map(); this.sync = {};
    this.now = () => Date.now(); // the host swaps in its server clock
  }

  // the host sets arena.paused — freeze the traffic clock while paused
  get paused() { return this._paused; }
  set paused(v) {
    if (v === this._paused) return;
    this._paused = v;
    if (v) this.pausedAt = this.now();
    else if (this.pausedAt) { this.t0 += this.now() - this.pausedAt; this.pausedAt = 0; this.sync.info = ''; this.pushSync(true); }
  }
  /** Seconds on the shared traffic clock. */
  time() { return ((this._paused ? this.pausedAt : this.now()) - this.t0) / 1000; }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.canvas = document.createElement('canvas'); this.canvas.className = 'pt-canvas';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.resize(); new ResizeObserver(() => this.resize()).observe(this.el);
    const frame = () => { this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(); const dt = Math.min(1.5, (now - last) / 1000); last = now;
      if (this.field && !this._paused) this.simulate(dt);
    }, 40);
    setInterval(() => this.pushSync(), 150);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false, av }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; return p; }
    const p = { uid, name, team, bot, av, score: 0, hops: 0, r: 0, x: startCol(), face: 1, deaths: 0, crosses: 0, roundCross: 0, think: rnd(2, 5), wait: 0 };
    this.players.set(uid, p); this.sync.info = '';
    return p;
  }
  removePlayer(uid) { this.players.delete(uid); this.sync.info = ''; }
  setTeam(uid, team) { const p = this.players.get(uid); if (p && p.team !== team) { p.team = team; this.sync.info = ''; } }
  updateTag() { this.sync.info = ''; }

  // ---------- rounds ----------
  startRound(round) {
    this.round = round || this.round + 1;
    this.field = makeField(Math.floor(Math.random() * 2 ** 31));
    this.t0 = this.now(); this.pausedAt = this._paused ? this.t0 : 0;
    this.roundTotals = { chicken: 0, turkey: 0 }; this.fx = []; this.lastCmd.clear();
    for (const p of this.players.values()) { p.r = 0; p.x = startCol(); p.hops = 0; p.roundCross = 0; p.face = 1; p.dr = null; }
    this.running = false; this.lastRound = null;
    this.sync = {}; this.pushSync(true);
    for (const p of this.players.values()) this.onChange(p);
  }
  startBattle() { this.running = true; }
  stopRound() {
    this.running = false;
    this.lastRound = { ...this.roundTotals };
    for (const p of this.players.values()) this.onChange(p);
    this.pushSync(true);
  }
  resetScores() { this.totals = { chicken: 0, turkey: 0 }; this.round = 0; for (const p of this.players.values()) { p.score = 0; p.crosses = 0; } }
  celebrate() {}
  addEggs() { return 0; }
  startEvent() {}
  teamTotals() { return { ...this.totals }; }

  // ---------- answers ----------
  reward(uid, { correct }) {
    const p = this.players.get(uid); if (!p) return null;
    const before = p.hops;
    if (correct) p.hops = Math.min(MAX_HOPS, p.hops + HOPS_PER);
    this.onChange(p);
    return { hops: p.hops, add: p.hops - before, full: correct && before + HOPS_PER > MAX_HOPS };
  }

  // ---------- phone input ----------
  handleInput(uid, inp) {
    const p = this.players.get(uid); if (!p || !inp || !this.field) return;
    const last = this.lastCmd.get(uid) || 0;
    const q = Object.values(inp.q || {}).filter((c) => c && c.s > last).sort((a, b) => a.s - b.s);
    for (const c of q) { this.lastCmd.set(uid, c.s); p.seq = c.s; this.apply(p, c); }
    if (q.length) this.onChange(p);
  }
  apply(p, c) {
    if (!this.running || this._paused) return;
    if (c.op === 'hop') {
      if (p.hops <= 0) return;
      const r = Math.round(+c.r); const x = +c.x;
      if (!Number.isFinite(x) || r < 0 || r > L - 1 || Math.abs(r - p.r) > 1) return;
      p.hops -= 1; if (x !== p.x) p.face = x > p.x ? 1 : -1; p.r = r; p.x = x;
    } else if (c.op === 'splat') {
      this.die(p, c.why === 'river' ? 'river' : 'road', +c.nx);
    } else if (c.op === 'cross') {
      if (p.r < L - 2) return; // must actually be at the top
      this.cross(p, +c.nx);
    }
  }
  die(p, why, nx) {
    this.fx.push({ kind: why, r: p.r, x: p.x, team: p.team, t0: performance.now() });
    p.deaths += 1; p.r = 0; p.x = Number.isFinite(nx) ? Math.max(0, Math.min(W - 1, Math.round(nx))) : startCol();
    sfx.splat?.();
    this.onChange(p);
  }
  cross(p, nx) {
    this.fx.push({ kind: 'cross', r: L - 1, x: p.x, team: p.team, t0: performance.now() });
    this.totals[p.team] += 1; this.roundTotals[p.team] += 1;
    p.score += 1; p.crosses += 1; p.roundCross += 1;
    this.pop(`${first(p.name)} made it across!`, p.team);
    p.r = 0; p.x = Number.isFinite(nx) ? Math.max(0, Math.min(W - 1, Math.round(nx))) : startCol();
    sfx.correct?.();
    this.onChange(p);
  }

  // ---------- simulation ----------
  simulate(dt) {
    const t = this.time();
    for (const p of this.players.values()) {
      if (p.bot) {
        if (this.running) this.botThink(p, dt, t);
        const why = stepBird(this.field, p, dt, t);
        if (why && this.running) this.die(p, why);
      } else if (this.field.lanes[p.r]?.type === 'river') {
        p.x = Math.max(-0.5, Math.min(W - 0.5, p.x + this.field.lanes[p.r].v * dt)); // ride the log (the phone decides if they fall in)
      }
    }
    this.fx = this.fx.filter((f) => performance.now() - f.t0 < 1500);
  }

  // ---------- bots ----------
  botThink(p, dt, t) {
    // "answer" questions now and then
    p.think -= dt;
    if (p.think <= 0) {
      p.think = rnd(4, 9);
      const ok = Math.random() < 0.7;
      p.answered = (p.answered || 0) + 1; p.correct = (p.correct || 0) + (ok ? 1 : 0);
      this.reward(p.uid, { correct: ok });
    }
    // hop when it looks safe
    p.wait -= dt; if (p.wait > 0 || p.hops <= 0) return;
    p.wait = rnd(0.35, 0.8);
    const lane = this.field.lanes[p.r];
    const tryDir = (d) => {
      const res = tryHop(this.field, p, d, t); if (!res || res.dead) return false;
      if (res.r !== p.r && res.r < L - 1 && danger(this.field, res.r, res.x, t, 0.7) && Math.random() < 0.85) return false;
      p.hops -= 1; if (res.x !== p.x) p.face = res.x > p.x ? 1 : -1; p.r = res.r; p.x = res.x;
      if (res.cross) this.cross(p);
      this.onChange(p); return true;
    };
    const standingInDanger = lane.type === 'road' && danger(this.field, p.r, p.x, t, 0.5);
    const safeHere = lane.type !== 'road' && lane.type !== 'river';
    // smart bots save up enough hops to get all the way over the next roads/river before stepping off the grass
    if (safeHere && p.hops < dangerAhead(this.field, p.r) + 1 && Math.random() < 0.8) return;
    if (tryDir('u')) return;
    if (standingInDanger || Math.random() < 0.25) { const side = Math.random() < 0.5 ? ['l', 'r'] : ['r', 'l']; if (tryDir(side[0]) || tryDir(side[1])) return; }
    if (standingInDanger && Math.random() < 0.5) tryDir('d');
  }

  // ---------- phone sync ----------
  pushSync(force = false) {
    if (!this.field) return;
    const list = [...this.players.values()];
    const info = { round: this.round, seed: this.field.seed, t0: this.t0, paused: this._paused ? 1 : 0, players: list.map((p) => [p.uid, p.team, first(p.name)]) };
    const infoS = JSON.stringify(info);
    const s = list.map((p, i) => `${i},${p.r},${Math.round(p.x * 100)},${p.deaths},${p.crosses}`).join(';');
    const up = {};
    if (force || infoS !== this.sync.info) { this.sync.info = infoS; up['cr/info'] = info; }
    if (force || s !== this.sync.s) { this.sync.s = s; up['cr/s'] = s; }
    if (Object.keys(up).length) this.onSync(up);
  }
  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    return {
      score: p.score, hops: p.hops, hs: p.seq || 0, rc: p.roundCross,
      cc: this.totals.chicken, ct: this.totals.turkey, rcc: this.roundTotals.chicken, rct: this.roundTotals.turkey,
    };
  }

  // ---------- drawing ----------
  render() {
    const ctx = this.ctx; if (!ctx || !this.field) return;
    const dpr = this.dpr; const Wd = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wd, H);
    const top = H * 0.19; const bottom = H * 0.11;
    const S = { field: this.field, t: this.time(), birds: [...this.players.values()], fx: this.fx };
    const Lt = drawField(ctx, S, Wd * 0.17, top, Wd * 0.66, H - top - bottom, { labels: true });
    // crossing tallies beside the field
    const fw = Lt.cell * W; const fh = Lt.cell * L;
    tally(ctx, Lt.ox - 18, Lt.oy, fh, this.roundTotals.chicken, 'chicken', 'right');
    tally(ctx, Lt.ox + fw + 18, Lt.oy, fh, this.roundTotals.turkey, 'turkey', 'left');
    // pop-up messages
    const now = performance.now();
    this.pops = (this.pops || []).filter((f) => {
      const k = (now - f.t0) / 1800; if (k >= 1) return false;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `normal ${Math.round(Lt.cell * 0.75)}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = Lt.oy + Lt.cell * (0.9 + f.slot * 0.9) - k * Lt.cell * 0.6;
      ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.strokeText(f.text, Lt.ox + fw / 2, y); ctx.fillStyle = f.team === 'turkey' ? '#ffb3a6' : '#9cc8ff'; ctx.fillText(f.text, Lt.ox + fw / 2, y);
      ctx.globalAlpha = 1; return true;
    });
  }
  pop(text, team) { this.pops = this.pops || []; this.pops.push({ text, team, slot: this.pops.length % 3, t0: performance.now() }); }
  destroy() { this.canvas?.remove(); }
}

/** Crossings this round, stacked as big numbers beside the field. */
function tally(ctx, x, y, h, n, team, align) {
  const col = team === 'turkey' ? '#e0402a' : '#1e6fe0';
  ctx.save();
  ctx.textAlign = align; ctx.textBaseline = 'top';
  ctx.font = 'normal 26px Bangers, Impact, sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#111';
  const label = team === 'turkey' ? 'TURKEYS' : 'CHICKENS';
  ctx.strokeText(label, x, y); ctx.fillStyle = col; ctx.fillText(label, x, y);
  ctx.font = 'normal 22px Bangers, Impact, sans-serif'; ctx.strokeText('CROSSED THIS ROUND', x, y + 30); ctx.fillStyle = '#fff'; ctx.fillText('CROSSED THIS ROUND', x, y + 30);
  ctx.font = `normal ${Math.min(120, h * 0.18)}px Bangers, Impact, sans-serif`; ctx.lineWidth = 8;
  ctx.strokeText(String(n), x, y + 62); ctx.fillStyle = col; ctx.fillText(String(n), x, y + 62);
  ctx.restore();
}
