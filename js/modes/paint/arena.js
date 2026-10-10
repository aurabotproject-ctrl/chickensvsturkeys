// =========================================================
// LAND GRAB — host simulation + projector rendering (Canvas 2D)
// paper.io rules, Chickens vs Turkeys style:
//   • leave your land to draw a trail, come back to claim everything inside
//   • an ENEMY running over your trail before you get home = you're OUT
//     (all your land disappears; you watch until the round ends)
//   • you can carve into other players' land
// Speed for the 30-second battle comes from the 1-minute question phase.
// =========================================================
import { avatar } from '../../core/assets.js?v=20261010182602';
import { sfx } from '../../core/sfx.js?v=20261010182602';
import { GW, GH, START_R, BATTLE_MS, MAX_PLAYERS, speedFor, encode, paintGrid, makePalette } from './common.js?v=20261010182602';

const rnd = (a, b) => a + Math.random() * (b - a);
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);
const TURN = 9; // radians per second (snappy steering)

export class PaintArena {
  constructor(el, { onChange, onSync, layout = 'split' } = {}) {
    this.mixed = layout === 'mixed'; // mixed = chickens and turkeys start scattered all over the field
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onSync = onSync || (() => {});
    this.players = new Map();
    this.own = new Uint8Array(GW * GH); this.trail = new Uint8Array(GW * GH);
    this.byIdx = []; this.palette = [];
    this.totals = { chicken: 0, turkey: 0 }; this.banked = true;
    this.running = false; this.paused = false; this.time = 0; this.fx = [];
    this.lastCmd = new Map();
    this.sync = {};
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.canvas = document.createElement('canvas'); this.canvas.className = 'pt-canvas';
    this.el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.gridC = document.createElement('canvas'); this.gridC.width = GW; this.gridC.height = GH;
    this.darkC = document.createElement('canvas'); this.darkC.width = GW; this.darkC.height = GH;
    this.avImg = new Map();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.el);
    const frame = () => { this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    // the game runs on its own timer so it keeps going even if drawing slows down
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(); let dt = Math.min(1, (now - last) / 1000); last = now;
      this.time += dt;
      while (dt > 0) { const step = Math.min(0.03, dt); dt -= step; if (this.running && !this.paused) this.simulate(step); }
    }, 33);
    setInterval(() => this.pushSync(), 250);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
    this.dpr = dpr;
    const top = h * 0.17; const bottom = h * 0.09;
    const cell = Math.min((w - 30) / GW, (h - top - bottom) / GH);
    this.cell = cell; this.ox = (w - GW * cell) / 2; this.oy = top + (h - top - bottom - GH * cell) / 2;
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false, av }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; if (av != null) p.av = av; return p; }
    const p = { uid, name, team, bot, av, score: 0, kills: 0, rc: 0, alive: false, x: 0, y: 0, ang: 0, want: 0, trail: [], i: 0, cells: 0 };
    this.players.set(uid, p);
    if (!this.running && this.round) this.place(p); // joined during the question minute → gets a starting patch
    return p;
  }
  removePlayer(uid) {
    const p = this.players.get(uid); if (!p) return;
    if (p.i) this.wipe(p);
    this.players.delete(uid);
  }
  setTeam(uid, team) { const p = this.players.get(uid); if (p) p.team = team; }
  updateTag() {}
  avatarImg(av) {
    if (!this.avImg.has(av)) { const im = new Image(); im.src = avatar(av); this.avImg.set(av, im); }
    return this.avImg.get(av);
  }

  // ---------- rounds ----------
  startRound() {
    this.round = (this.round || 0) + 1;
    this.own.fill(0); this.trail.fill(0); this.fx = [];
    this.running = false; this.banked = false;
    this.byIdx = []; let n = 0; const k = { chicken: 0, turkey: 0 };
    for (const p of this.players.values()) {
      if (n >= MAX_PLAYERS) break;
      n += 1; p.i = n; this.byIdx[n] = p; p.k = k[p.team]++; p.rc = 0; p.kills = 0; p.trail = []; p.alive = false;
    }
    this.palette = makePalette([...this.players.values()].filter((p) => p.i).map((p) => ({ i: p.i, team: p.team, k: p.k })));
    for (const p of this.players.values()) if (p.i) this.place(p);
    this.sync = {};
    this.onSync({ 'pt/info': this.info(), 'pt/s': null });
    this.pushSync(true);
  }
  info() {
    return { round: this.round, players: [...this.players.values()].filter((p) => p.i).map((p) => [p.i, p.uid, p.team, p.k, Number.isInteger(p.av) ? p.av : 0, first(p.name)]) };
  }
  /** Give a player a 5 × 5 starting patch on their team's side. */
  place(p) {
    if (!p.i) {
      let n = 1; while (this.byIdx[n] && n < MAX_PLAYERS) n++;
      if (this.byIdx[n]) return;
      p.i = n; this.byIdx[n] = p; p.k = [...this.players.values()].filter((q) => q.team === p.team && q.i && q !== p).length;
      this.palette = makePalette([...this.players.values()].filter((q) => q.i).map((q) => ({ i: q.i, team: q.team, k: q.k })));
      this.onSync({ 'pt/info': this.info() });
    }
    const left = p.team === 'chicken';
    let best = null; let bestD = -1;
    for (let tries = 0; tries < 80; tries++) {
      const x = Math.floor(this.mixed ? rnd(6, GW - 6) : left ? rnd(6, GW / 2 - 8) : rnd(GW / 2 + 8, GW - 6)); const y = Math.floor(rnd(6, GH - 6));
      let d = 1e9;
      for (const q of this.players.values()) if (q !== p && q.alive) d = Math.min(d, Math.hypot(q.x - x, q.y - y));
      if (d > bestD) { bestD = d; best = { x, y }; }
      if (d > (this.mixed ? 26 : 22)) break;
    }
    for (let dy = -START_R; dy <= START_R; dy++) for (let dx = -START_R; dx <= START_R; dx++) this.own[(best.y + dy) * GW + best.x + dx] = p.i;
    p.x = best.x + 0.5; p.y = best.y + 0.5; p.ang = left ? 0 : Math.PI; p.want = p.ang;
    p.alive = true; p.trail = []; p.cell = best.y * GW + best.x; p.out = false;
  }
  startBattle() {
    for (const p of this.players.values()) {
      if (p.bot) { p.rc = Math.floor(rnd(2, 10)); p.correct = (p.correct || 0) + p.rc; p.answered = (p.answered || 0) + p.rc + Math.floor(rnd(0, 4)); }
      p.speed = speedFor(p.rc);
      if (p.i && !p.alive && !p.out) this.place(p);
      this.onChange(p);
    }
    this.lastCmd.clear();
    this.running = true; this.paused = false; this.battleT = 0;
    this.floatText('GO! GRAB LAND!', GW / 2, GH / 2, '#ffc72c', 7);
  }
  stopRound() {
    if (this.running || !this.banked) {
      this.running = false;
      const pc = this.percents();
      if (!this.banked) { this.totals.chicken += pc.chicken; this.totals.turkey += pc.turkey; this.banked = true; this.lastRound = pc; }
      for (const p of this.players.values()) this.onChange(p);
    }
  }
  resetScores() { this.totals = { chicken: 0, turkey: 0 }; this.round = 0; this.banked = true; for (const p of this.players.values()) { p.score = 0; p.kills = 0; } }
  celebrate() {}
  addEggs() { return 0; }

  // ---------- answers + steering ----------
  /** Right answer in the question minute = more speed. */
  reward(uid, { correct }) {
    const p = this.players.get(uid); if (!p) return null;
    if (correct) p.rc += 1;
    this.onChange(p);
    return { rc: p.rc, speed: speedFor(p.rc) };
  }
  handleInput(uid, inp) {
    const p = this.players.get(uid); if (!p || !p.alive) return;
    if (inp && Number.isFinite(+inp.a)) p.want = +inp.a;
  }

  // ---------- simulation ----------
  simulate(dt) {
    this.battleT += dt;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (p.bot) this.botSteer(p, dt);
      // turn towards the wanted direction
      let d = ((p.want - p.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      p.ang += Math.max(-TURN * dt, Math.min(TURN * dt, d));
      let move = p.speed * dt;
      while (move > 0 && p.alive) {
        const st = Math.min(0.4, move); move -= st;
        let nx = p.x + Math.cos(p.ang) * st; let ny = p.y + Math.sin(p.ang) * st;
        // walls: slide along the fence
        if (nx < 0.5 || nx > GW - 0.5) { nx = Math.max(0.5, Math.min(GW - 0.5, nx)); p.want = Math.PI - p.ang; }
        if (ny < 0.5 || ny > GH - 0.5) { ny = Math.max(0.5, Math.min(GH - 0.5, ny)); p.want = -p.ang; }
        p.x = nx; p.y = ny;
        const c = Math.floor(ny) * GW + Math.floor(nx);
        if (c !== p.cell) { p.cell = c; this.enter(p, c); }
      }
    }
    // score = share of the field
    if ((this.scoreT = (this.scoreT || 0) - dt) <= 0) {
      this.scoreT = 0.5;
      const cnt = this.counts();
      for (const p of this.players.values()) { p.cells = p.i ? cnt[p.i] || 0 : 0; p.score = Math.round((p.cells / (GW * GH)) * 1000) / 10; }
    }
  }
  enter(p, c) {
    const t = this.trail[c];
    if (t && t !== p.i) {
      const q = this.byIdx[t];
      if (q && q.alive && q.team !== p.team) this.kill(q, p, 'cut'); // ran over an enemy's trail
    }
    if (this.own[c] === p.i) {
      if (p.trail.length) this.close(p);
    } else if (this.trail[c] !== p.i) {
      this.trail[c] = p.i; p.trail.push(c);
    }
  }
  /** Back home: the trail and everything it surrounds becomes yours. */
  close(p) {
    for (const c of p.trail) { this.own[c] = p.i; this.trail[c] = 0; }
    p.trail = [];
    // flood from the edges through cells that aren't ours: anything not reached is enclosed
    const N = GW * GH; const seen = new Uint8Array(N); const q = new Int32Array(N); let h = 0; let tl = 0;
    const push = (c) => { if (!seen[c] && this.own[c] !== p.i) { seen[c] = 1; q[tl++] = c; } };
    for (let x = 0; x < GW; x++) { push(x); push((GH - 1) * GW + x); }
    for (let y = 0; y < GH; y++) { push(y * GW); push(y * GW + GW - 1); }
    while (h < tl) {
      const c = q[h++]; const x = c % GW;
      if (x > 0) push(c - 1); if (x < GW - 1) push(c + 1);
      if (c >= GW) push(c - GW); if (c < N - GW) push(c + GW);
    }
    let gained = 0;
    for (let c = 0; c < N; c++) if (!seen[c] && this.own[c] !== p.i) { this.own[c] = p.i; gained += 1; }
    if (gained + 1 > 25) this.floatText(`+${gained}`, p.x, p.y - 2, this.palette[p.i]?.css || '#fff', 3.2);
    // anyone whose land has been completely taken is out
    const cnt = this.counts();
    for (const o of this.players.values()) if (o !== p && o.alive && o.i && !cnt[o.i]) this.kill(o, p, 'eaten');
    this.onChange(p);
  }
  counts() { const cnt = new Uint32Array(MAX_PLAYERS + 2); for (let i = 0; i < this.own.length; i++) cnt[this.own[i]] += 1; return cnt; }
  wipe(p) { for (let i = 0; i < this.own.length; i++) { if (this.own[i] === p.i) this.own[i] = 0; if (this.trail[i] === p.i) this.trail[i] = 0; } p.trail = []; }
  kill(q, by, why) {
    q.alive = false; q.out = true;
    this.wipe(q);
    if (by) by.kills += 1;
    this.burstText(why === 'cut' ? 'SNIP!' : 'GOBBLED!', q.x, q.y);
    this.floatText(`${first(q.name)} is OUT!`, q.x, q.y - 3, '#fff', 3);
    sfx.splat?.();
    this.onChange(q); if (by) this.onChange(by);
  }

  // ---------- bots ----------
  botSteer(p, dt) {
    const b = p.plan ||= { leg: 0, left: 0 };
    const home = this.own[p.cell] === p.i;
    b.left -= p.speed * dt;
    if (home && !p.trail.length && b.leg !== 1) { b.leg = 1; b.left = rnd(5, 12); p.want = rnd(-Math.PI, Math.PI); }
    else if (b.left <= 0 && b.leg === 1) { b.leg = 2; b.left = rnd(4, 9); p.want += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; }
    else if ((b.left <= 0 && b.leg === 2) || p.trail.length > 40) {
      b.leg = 3; // head home: aim at the nearest cell we own
      let best = null; let bd = 1e9;
      for (let k = 0; k < 400; k++) {
        const c = Math.floor(Math.random() * this.own.length);
        if (this.own[c] !== p.i) continue;
        const d = Math.hypot((c % GW) + 0.5 - p.x, Math.floor(c / GW) + 0.5 - p.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best != null) p.want = Math.atan2(Math.floor(best / GW) + 0.5 - p.y, (best % GW) + 0.5 - p.x);
      if (home) b.leg = 0;
    }
  }

  // ---------- team score ----------
  percents() {
    const cnt = this.counts(); const t = { chicken: 0, turkey: 0 };
    for (const p of this.players.values()) if (p.i && t[p.team] != null) t[p.team] += cnt[p.i] || 0;
    return { chicken: (t.chicken / (GW * GH)) * 100, turkey: (t.turkey / (GW * GH)) * 100 };
  }
  /** Total over all rounds so far (+ this round's live share while it's being played). */
  teamTotals() {
    const live = this.banked ? { chicken: 0, turkey: 0 } : this.percents();
    return { chicken: this.totals.chicken + live.chicken, turkey: this.totals.turkey + live.turkey };
  }
  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    const tot = this.teamTotals(); const live = this.percents();
    return { score: p.score, i: p.i, rc: p.rc, speed: speedFor(p.rc), alive: p.alive ? 1 : 0, out: p.out ? 1 : 0, kills: p.kills, pct: p.score,
      tc: Math.round(tot.chicken * 10) / 10, tt: Math.round(tot.turkey * 10) / 10, lc: Math.round(live.chicken * 10) / 10, lt: Math.round(live.turkey * 10) / 10 };
  }

  // ---------- phone sync ----------
  pushSync(force = false) {
    if (!this.round) return;
    const g = encode(this.own); const t = encode(this.trail);
    const p = [...this.players.values()].filter((x) => x.i).map((x) => `${x.i},${x.x.toFixed(1)},${x.y.toFixed(1)},${x.alive ? 1 : 0},${x.ang.toFixed(2)}`).join(';');
    const up = {};
    if (force || g !== this.sync.g) { this.sync.g = g; up['pt/s/g'] = g; }
    if (force || t !== this.sync.t) { this.sync.t = t; up['pt/s/t'] = t; }
    if (force || p !== this.sync.p) { this.sync.p = p; up['pt/s/p'] = p; }
    if (Object.keys(up).length) this.onSync(up);
  }

  // ---------- rendering ----------
  render() {
    const ctx = this.ctx; if (!ctx) return;
    const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { ox, oy, cell } = this; const fw = GW * cell; const fh = GH * cell;
    // field: grass with a soft checker + fence
    ctx.fillStyle = '#3f7a1f'; this.round3(ctx, ox - 10, oy - 10, fw + 20, fh + 20, 18); ctx.fill();
    ctx.fillStyle = '#8fd14f'; ctx.fillRect(ox, oy, fw, fh);
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (let y = 0; y < GH; y += 6) for (let x = (y / 6) % 2 ? 6 : 0; x < GW; x += 12) ctx.fillRect(ox + x * cell, oy + y * cell, 6 * cell, 6 * cell);
    if (!this.mixed) { ctx.fillStyle = 'rgba(30,111,224,.06)'; ctx.fillRect(ox, oy, fw / 2, fh); ctx.fillStyle = 'rgba(224,64,42,.06)'; ctx.fillRect(ox + fw / 2, oy, fw / 2, fh); }
    // territory: dark copy shifted down for a chunky 3-D edge, then the colours
    if (this.round) {
      const gctx = this.gridC.getContext('2d'); const dctx = this.darkC.getContext('2d');
      paintGrid(dctx, this.own, this.emptyTrail(), this.palette, { shade: 1 });
      paintGrid(gctx, this.own, this.trail, this.palette);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.darkC, ox, oy + cell * 0.6, fw, fh);
      ctx.drawImage(this.gridC, ox, oy, fw, fh);
    }
    // players
    const sz = Math.max(26, cell * 3.2);
    for (const p of this.players.values()) {
      if (!p.i || (!p.alive && !p.out)) continue;
      const x = ox + p.x * cell; const y = oy + p.y * cell; const pal = this.palette[p.i];
      ctx.globalAlpha = p.alive ? 1 : 0.35;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + sz * 0.42, sz * 0.42, sz * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
      const im = this.avatarImg(p.av ?? 0); if (im.complete && im.naturalWidth) ctx.drawImage(im, x - sz / 2, y - sz / 2, sz, sz);
      ctx.restore();
      ctx.lineWidth = Math.max(3, sz * 0.12); ctx.strokeStyle = pal?.css || '#fff'; ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, sz / 2 + ctx.lineWidth, 0, Math.PI * 2); ctx.stroke();
      if (p.alive) { // direction arrow
        const ax = x + Math.cos(p.ang) * sz * 0.72; const ay = y + Math.sin(p.ang) * sz * 0.72;
        ctx.fillStyle = pal?.css || '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ax + Math.cos(p.ang) * 7, ay + Math.sin(p.ang) * 7);
        ctx.lineTo(ax + Math.cos(p.ang + 2.4) * 7, ay + Math.sin(p.ang + 2.4) * 7); ctx.lineTo(ax + Math.cos(p.ang - 2.4) * 7, ay + Math.sin(p.ang - 2.4) * 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.font = `900 ${Math.max(12, sz * 0.36)}px Nunito, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#111'; const label = (p.bot ? '🤖' : '') + first(p.name) + (p.alive ? '' : ' (out)');
      ctx.strokeText(label, x, y - sz * 0.62); ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - sz * 0.62);
      ctx.globalAlpha = 1;
    }
    // floating text
    const now = performance.now();
    this.fx = this.fx.filter((f) => {
      const k = (now - f.t0) / 1400; if (k >= 1) return false;
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.font = `${f.big ? 'normal' : '900'} ${f.size * cell}px ${f.big ? 'Bangers, Impact' : 'Nunito'}, sans-serif`; ctx.textAlign = 'center';
      const x = ox + f.x * cell; const y = oy + (f.y - k * 3) * cell;
      ctx.lineWidth = Math.max(4, f.size * cell * 0.14); ctx.strokeStyle = '#111'; ctx.strokeText(f.text, x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1;
      return true;
    });
  }
  emptyTrail() { return (this._et ||= new Uint8Array(GW * GH)); }
  round3(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  floatText(text, x, y, color = '#ffc72c', size = 3) { this.fx.push({ text, x, y, color, size, t0: performance.now() }); }
  burstText(text, x, y) { this.fx.push({ text, x, y, color: '#ffc72c', size: 5, big: true, t0: performance.now() }); }
  startEvent() {}
  destroy() { this.canvas?.remove(); }
}

export { BATTLE_MS };
