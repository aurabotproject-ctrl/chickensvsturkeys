// =========================================================
// EGG TOSS — host game logic + projector drawing.
// The host decides every hit. Phones send:
//   dodgers:  inputs/{uid}.d  = -1 | 0 | 1   (slide left / stop / right)
//   flingers: inputs/{uid}.q  = [{ s, x, y }] (fling an egg at x, y)
// and get the stall back through et/info + et/s.
// =========================================================
import { sfx } from '../../core/sfx.js?v=20261010230402';
import { allCombos } from '../advance/rules.js?v=20261010230402';
import {
  GW, LANES, X_MIN, X_MAX, SPEED, FLIGHT, EGGS_PER_CORRECT, COOLDOWN, LANE_Y,
  targetScale, attackerFor, other, targetCentre, launchX, findHit, eggAt,
} from './rules.js?v=20261010230402';
import { drawGallery } from './draw.js?v=20261010230402';

const rnd = (a, b) => a + Math.random() * (b - a);
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);

export class EggTossArena {
  constructor(el, { onChange, onSync, onWin } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onSync = onSync || (() => {});
    this.onWin = onWin || (() => {});
    this.players = new Map();
    this.round = 0; this.att = 'turkey';
    this.totals = { chicken: 0, turkey: 0 }; this.roundHits = { chicken: 0, turkey: 0 };
    this.eggs = []; this.splats = []; this.eid = 0; this.sid = 0;
    this.running = false; this.paused = false; this.time = 0; this.fx = [];
    this.lastCmd = new Map(); this.sync = {};
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.canvas = document.createElement('canvas'); this.canvas.className = 'pt-canvas';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.resize(); new ResizeObserver(() => this.resize()).observe(this.el);
    const frame = () => { this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (this.running && !this.paused) this.simulate(dt);
    }, 33);
    setInterval(() => this.pushSync(), 120);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false, av, pc }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; if (pc) p.pc = pc; return p; }
    const p = { uid, name, team, bot, av, pc, score: 0, eggs: 0, rc: 0, ts: 1, lane: 0, x: GW / 2, d: 0, out: false, cool: 0, think: rnd(1, 3), roundHits: 0 };
    this.players.set(uid, p);
    if (!p.pc) p.pc = this.freePiece(team, uid);
    if (this.round && team !== this.att) { this.placeDefender(p); this.sync.info = ''; }
    return p;
  }
  removePlayer(uid) { this.players.delete(uid); this.sync.info = ''; }
  setTeam(uid, team) { const p = this.players.get(uid); if (p && p.team !== team) { p.team = team; this.sync.info = ''; } }
  setPiece(uid, pc) { const p = this.players.get(uid); if (p && pc) { p.pc = pc; this.sync.info = ''; } }
  updateTag() { this.sync.info = ''; }
  freePiece(team, uid) {
    const taken = new Set([...this.players.values()].filter((q) => q.team === team && q.uid !== uid && q.pc).map((q) => q.pc));
    const free = allCombos(team).filter((c) => !taken.has(c));
    return free[Math.floor(Math.random() * free.length)] || 'pw';
  }
  defenders() { return [...this.players.values()].filter((p) => p.team !== this.att); }
  attackers() { return [...this.players.values()].filter((p) => p.team === this.att); }
  /** Late joiner on the dodging team: the emptiest rail. */
  placeDefender(p) {
    const n = new Array(LANES).fill(0);
    for (const q of this.defenders()) if (q !== p) n[q.lane] += 1;
    p.lane = n.indexOf(Math.min(...n)); p.x = rnd(X_MIN + 60, X_MAX - 60); p.tx = null; p.out = false; p.d = 0; p.ts = targetScale(p.rc);
  }

  // ---------- rounds ----------
  startRound(round) {
    this.round = round || this.round + 1;
    this.att = attackerFor(this.round);
    this.eggs = []; this.splats = []; this.fx = []; this.lastCmd.clear();
    this.roundHits = { chicken: 0, turkey: 0 };
    this.running = false; this.ending = 0; this.idleT = 0;
    for (const p of this.players.values()) { p.eggs = 0; p.rc = 0; p.ts = 1; p.out = false; p.d = 0; p.tx = null; p.cool = 0; p.roundHits = 0; if (!p.pc) p.pc = this.freePiece(p.team, p.uid); }
    // dodgers: shuffled over the 4 rails, spread out along each rail
    const def = this.defenders().sort(() => Math.random() - 0.5);
    def.forEach((p, i) => { p.lane = LANES - 1 - (i % LANES); });
    for (let lane = 0; lane < LANES; lane++) {
      const row = def.filter((p) => p.lane === lane);
      row.forEach((p, k) => { p.x = X_MIN + ((X_MAX - X_MIN) * (k + 0.5)) / row.length + rnd(-30, 30); });
    }
    this.sync = {};
    this.pushSync(true);
    for (const p of this.players.values()) this.onChange(p);
  }
  startBattle() {
    for (const p of this.players.values()) {
      if (p.bot) { // bots "answered" during the question part
        const rc = Math.floor(rnd(1, 7)); p.correct = (p.correct || 0) + rc; p.answered = (p.answered || 0) + rc + Math.floor(rnd(0, 3));
        if (p.team === this.att) p.eggs = rc * EGGS_PER_CORRECT; else p.rc = rc;
      }
      if (p.team !== this.att) p.ts = targetScale(p.rc);
      this.onChange(p);
    }
    this.lastCmd.clear(); this.idleT = 0; this.ending = 0;
    this.running = true; this.paused = false;
    this.pushSync(true);
  }
  stopRound() {
    this.running = false;
    this.eggs = [];
    for (const p of this.players.values()) { p.eggs = 0; p.d = 0; this.onChange(p); }
    this.lastRound = { att: this.att, hits: this.roundHits[this.att], of: this.defenders().length };
    this.pushSync(true);
  }
  resetScores() { this.totals = { chicken: 0, turkey: 0 }; this.round = 0; for (const p of this.players.values()) p.score = 0; }
  celebrate() {}
  addEggs() { return 0; }
  teamTotals() { return { ...this.totals }; }

  // ---------- answers ----------
  reward(uid, { correct }) {
    const p = this.players.get(uid); if (!p) return null;
    if (p.team === this.att) { if (correct) p.eggs += EGGS_PER_CORRECT; this.onChange(p); return { role: 'att', eggs: p.eggs, add: correct ? EGGS_PER_CORRECT : 0 }; }
    if (correct) p.rc += 1;
    p.ts = targetScale(p.rc);
    this.onChange(p);
    return { role: 'def', ts: Math.round(p.ts * 100) };
  }

  // ---------- input ----------
  handleInput(uid, inp) {
    const p = this.players.get(uid); if (!p || !inp) return;
    if (p.team !== this.att) { if (inp.x != null && !p.out && Number.isFinite(+inp.x)) p.tx = Math.max(X_MIN, Math.min(X_MAX, +inp.x)); return; }
    const last = this.lastCmd.get(uid) || 0;
    const q = Object.values(inp.q || {}).filter((c) => c && c.s > last).sort((a, b) => a.s - b.s);
    for (const c of q) { this.lastCmd.set(uid, c.s); this.fling(p, +c.x, +c.y); }
  }
  fling(p, x, y) {
    if (!this.running || this.paused || p.eggs <= 0 || p.cool > 0 || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    p.eggs -= 1; p.cool = COOLDOWN;
    const atts = this.attackers(); const k = Math.max(0, atts.indexOf(p));
    this.eggs.push({ id: ++this.eid, o: p.uid, x0: launchX(k, atts.length), x1: Math.max(0, Math.min(GW, x)), y1: Math.max(0, Math.min(900, y)), k: 0 });
    sfx.egg?.();
    this.onChange(p);
    return true;
  }

  // ---------- simulation ----------
  simulate(dt) {
    this.time += dt;
    for (const p of this.players.values()) {
      if (p.cool > 0) p.cool -= dt;
      if (p.team === this.att) { if (p.bot) this.botFling(p, dt); continue; }
      if (p.out) continue;
      if (p.bot) { this.botDodge(p, dt); p.x += p.d * SPEED * dt; } else if (p.tx != null) {
        // follow where the student's device says their piece is (capped so nobody can teleport)
        const gap = p.tx - p.x; const max = SPEED * 1.4 * dt;
        p.x += Math.abs(gap) <= max ? gap : Math.sign(gap) * max;
      }
      if (p.x < X_MIN) { p.x = X_MIN; if (p.bot) p.d = 1; }
      if (p.x > X_MAX) { p.x = X_MAX; if (p.bot) p.d = -1; }
    }
    // eggs fly, then land
    for (const e of this.eggs) e.k += dt / FLIGHT;
    const landed = this.eggs.filter((e) => e.k >= 1);
    if (landed.length) { this.eggs = this.eggs.filter((e) => e.k < 1); for (const e of landed) this.land(e); }
    if (this.splats.length > 24) this.splats = this.splats.filter((s) => s.kind === 'hit' || this.time - s.t < 5).slice(-24);
    // round over early: every dodger is down, or nobody has eggs left
    if (this.ending) return;
    const def = this.defenders();
    const eggsLeft = this.attackers().reduce((a, p) => a + p.eggs, 0) + this.eggs.length;
    if (def.length && def.every((p) => p.out)) { this.ending = 1; setTimeout(() => this.onWin(this.att), 1600); return; }
    this.idleT = eggsLeft ? 0 : this.idleT + dt;
    if (this.idleT > 3) { this.ending = 1; this.onWin(null); }
  }
  land(e) {
    const att = this.players.get(e.o);
    const hit = findHit(this.defenders(), e.x1, e.y1);
    if (hit) {
      const c = targetCentre(hit);
      hit.out = true; hit.d = 0; hit.outAt = performance.now();
      this.splats.push({ id: ++this.sid, x: c.x, y: c.y, kind: 'hit', t: this.time, t0: performance.now() });
      this.totals[this.att] += 1; this.roundHits[this.att] += 1;
      if (att) { att.score += 1; att.roundHits += 1; this.onChange(att); }
      this.pop(`SPLAT! ${first(hit.name)}`, c.x, c.y - 40, true);
      sfx.splat?.();
      this.onChange(hit);
    } else {
      this.splats.push({ id: ++this.sid, x: e.x1, y: e.y1, kind: 'miss', t: this.time, t0: performance.now() });
    }
  }

  // ---------- bots ----------
  botDodge(p, dt) {
    p.think -= dt; if (p.think > 0) return;
    p.think = rnd(0.4, 1.4);
    // dodge eggs that are about to land near me, otherwise wander
    const danger = this.eggs.find((e) => e.k > 0.35 && Math.abs(e.x1 - p.x) < 110 && Math.abs(e.y1 - LANE_Y[p.lane]) < 220);
    if (danger && Math.random() < 0.6) p.d = e2d(danger.x1, p.x); else p.d = [-1, 0, 1][Math.floor(Math.random() * 3)];
  }
  botFling(p, dt) {
    if (p.eggs <= 0 || p.cool > 0) return;
    p.think -= dt; if (p.think > 0) return;
    p.think = rnd(0.9, 2.2);
    const live = this.defenders().filter((q) => !q.out); if (!live.length) return;
    const q = live[Math.floor(Math.random() * live.length)]; const c = targetCentre(q);
    // lead the target a little, with some wobble
    this.fling(p, c.x + q.d * 120 + rnd(-70, 70), c.y + rnd(-40, 40));
  }

  // ---------- phone sync ----------
  info() {
    const def = this.defenders();
    return {
      round: this.round, att: this.att,
      d: def.map((p) => [p.uid, p.team, p.pc || 'pw', first(p.name), p.lane]),
      a: this.attackers().map((p) => p.uid),
    };
  }
  pushSync(force = false) {
    if (!this.round) return;
    const info = this.info(); const infoS = JSON.stringify(info);
    const idx = new Map(info.d.map((r, i) => [r[0], i]));
    const dp = this.defenders().map((p) => `${idx.get(p.uid)},${Math.round(p.x)},${p.out ? 1 : 0},${Math.round(p.ts * 100)},${p.d}`).join(';');
    const ai = new Map(info.a.map((u, i) => [u, i]));
    const eg = this.eggs.map((e) => `${e.id},${Math.round(e.x0)},${Math.round(e.x1)},${Math.round(e.y1)},${Math.round(e.k * 100)},${ai.get(e.o) ?? -1}`).join(';');
    const sp = this.splats.filter((s) => s.kind === 'hit' || this.time - s.t < 5).map((s) => `${s.id},${Math.round(s.x)},${Math.round(s.y)},${s.kind === 'hit' ? 'h' : 'm'}`).join(';');
    const s = `${dp}|${eg}|${sp}`;
    const up = {};
    if (force || infoS !== this.sync.info) { this.sync.info = infoS; up['et/info'] = info; }
    if (force || s !== this.sync.s) { this.sync.s = s; up['et/s'] = s; }
    if (Object.keys(up).length) this.onSync(up);
  }
  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    const role = p.team === this.att ? 'att' : 'def';
    const def = this.defenders();
    return {
      score: p.score, role, eggs: p.eggs, rc: p.rc, ts: Math.round(p.ts * 100), out: p.out ? 1 : 0, lane: p.lane, rh: p.roundHits,
      hc: this.totals.chicken, ht: this.totals.turkey, standing: def.filter((q) => !q.out).length, of: def.length,
    };
  }

  // ---------- drawing ----------
  render() {
    const ctx = this.ctx; if (!ctx || !this.round) return;
    const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const top = H * 0.19; const bottom = H * 0.11;
    const G = {
      defenders: this.defenders(),
      eggs: this.eggs,
      splats: this.splats.map((s) => ({ ...s })),
    };
    const L = drawGallery(ctx, G, W * 0.02, top, W * 0.96, H - top - bottom, { labels: true });
    // who is flinging / dodging
    const def = this.defenders(); const standing = def.filter((p) => !p.out).length;
    const eggsLeft = this.attackers().reduce((a, p) => a + p.eggs, 0);
    const name = (t) => (t === 'chicken' ? 'CHICKENS' : 'TURKEYS');
    // status pills on the awning (kept off the rails so they never cover a piece)
    const pill = (text, cx, col) => {
      ctx.font = `normal ${Math.round(L.s * 40)}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(text).width + 40 * L.s; const ph = 58 * L.s; const px = L.ox + cx * L.s - tw / 2; const py = L.oy + 30 * L.s;
      ctx.fillStyle = 'rgba(17,17,17,.82)'; ctx.beginPath(); ctx.roundRect(px, py, tw, ph, ph / 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = col; ctx.fillText(text, px + tw / 2, py + ph / 2 + 2);
    };
    const tc = (t) => (t === 'chicken' ? '#9cc8ff' : '#ffb3a6');
    pill(`🥚 ${name(this.att)} FLING · ${eggsLeft} egg${eggsLeft === 1 ? '' : 's'} left`, 420, tc(this.att));
    pill(`🛡️ ${name(other(this.att))} DODGE · ${standing}/${def.length} standing`, 1180, tc(other(this.att)));
    // pop-up texts
    const now = performance.now();
    this.fx = this.fx.filter((f) => {
      const k = (now - f.t0) / 1400; if (k >= 1) return false;
      const fx = L.ox + f.x * L.s; const fy = L.oy + (f.y - k * 90) * L.s;
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.font = `normal ${Math.round(L.s * (f.big ? 64 : 44))}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.strokeText(f.text, fx, fy); ctx.fillStyle = '#ffc72c'; ctx.fillText(f.text, fx, fy);
      ctx.globalAlpha = 1; return true;
    });
  }
  pop(text, x, y, big = false) { this.fx.push({ text, x, y, big, t0: performance.now() }); }
  startEvent() {}
  destroy() { this.canvas?.remove(); }
}

const e2d = (eggX, x) => (eggX > x ? -1 : 1);
export { eggAt };
