// =========================================================
// STACK ATTACK — host game logic (Matter.js physics) + big-screen drawing.
// Phones send inputs/{uid}.q = [{ s, op: 'drop', k, x, rot } | { s, op: 'egg', x, y }]
// The host keeps everyone's actions, runs the physics and sends
//   sa/info = { round }   sa/b = "id,k,t,x,y,a100;…|egg x,y,t;…|splat x,y;…"
// =========================================================
/* global Matter */
import { sfx } from '../../core/sfx.js?v=20261010214912';
import { img } from '../advance/draw.js?v=20261010214912';
import {
  U, PLATS, PLAT_W, MAX_ACTIONS, FALL_Y, SPAWN_GAP, SHAPES, SHAPE_KEYS, outline, randomShape, colourOf, other,
  LAUNCH, throwVelocity, BLAST, BLAST_R, EGG_STEPS, FILTER,
} from './rules.js?v=20261010214912';

const rnd = (a, b) => a + Math.random() * (b - a);
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);
const ready = (im) => im && im.complete && im.naturalWidth > 0;
/** Stack Attack art that exists (STACK_ATTACK_IMAGE_PROMPTS.md). Anything missing is drawn in code. */
export const SA_ART = new Set(['sa_bg']);
/** Where the background picture sits in the world: its painted cliff tops are the real platforms. */
const BG = { cx: 845, cy: 668, ppu: 56.7 };
const SKY = '#0186fd'; // the colour along the top of the panorama // image px of the ravine centre / cliff-top line, image px per metre
const saArt = (name) => { if (!SA_ART.has(name)) return null; const im = img(name); return ready(im) ? im : null; };
const TEAMS = ['chicken', 'turkey'];

export class StackArena {
  constructor(el, { onChange, onSync } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onSync = onSync || (() => {});
    this.players = new Map();
    this.round = 0; this.running = false; this.paused = false;
    this.totals = { chicken: 0, turkey: 0 }; this.heights = { chicken: 0, turkey: 0 }; this.best = { chicken: 0, turkey: 0 };
    this.blocks = []; this.eggs = []; this.splats = []; this.pops = []; this.bid = 0;
    this.lastCmd = new Map(); this.sync = {};
    this.cam = { top: -12 * U };
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.canvas = document.createElement('canvas'); this.canvas.className = 'pt-canvas';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.resize(); new ResizeObserver(() => this.resize()).observe(this.el);
    this.makeWorld();
    const frame = () => { this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    // fixed-step physics (60 steps a second)
    let last = performance.now(); let acc = 0;
    setInterval(() => {
      const now = performance.now(); acc += Math.min(250, now - last); last = now;
      while (acc >= 1000 / 60) { acc -= 1000 / 60; if (!this.paused) this.step(); }
    }, 1000 / 60);
    setInterval(() => this.pushSync(), 120);
    setInterval(() => this.measure(), 250);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
  }

  // ---------- physics world ----------
  makeWorld() {
    const E = this.engine = Matter.Engine.create({ enableSleeping: true });
    E.positionIterations = 10; E.velocityIterations = 8;
    for (const t of TEAMS) {
      const p = PLATS[t];
      Matter.World.add(E.world, Matter.Bodies.rectangle(p.x, 6 * U, PLAT_W, 12 * U, { isStatic: true, friction: 1, label: 'cliff', collisionFilter: FILTER.cliff }));
    }
    Matter.Events.on(E, 'collisionStart', (ev) => {
      for (const pr of ev.pairs) {
        for (const [a, b] of [[pr.bodyA, pr.bodyB], [pr.bodyB, pr.bodyA]]) if (a.label === 'egg' && !a.done) { a.done = true; this.splat(a, b); }
      }
    });
  }
  clearWorld() {
    for (const b of this.blocks) Matter.World.remove(this.engine.world, b);
    for (const e of this.eggs) Matter.World.remove(this.engine.world, e);
    this.blocks = []; this.eggs = []; this.splats = [];
  }
  addBlock(team, k, x, rot, owner) {
    const s = SHAPES[k]; if (!s) return null;
    const top = this.topY(team);
    const opts = { friction: 0.9, frictionStatic: 1.2, restitution: 0.02, density: 0.0015 * (s.light ? 0.6 : 1), frictionAir: 0.01, sleepThreshold: 50, label: 'block', collisionFilter: FILTER.block(team) };
    const y = top - SPAWN_GAP;
    const b = s.poly ? Matter.Bodies.fromVertices(x, y, [outline(k)], opts) : Matter.Bodies.rectangle(x, y, s.w * U, s.h * U, opts);
    if (s.poly) { // fromVertices re-centres the body on its centre of mass; keep the art lined up with it
      const c = outline(k).reduce((a, v) => ({ x: a.x + v.x / outline(k).length, y: a.y + v.y / outline(k).length }), { x: 0, y: 0 });
      b.artOff = { x: -c.x, y: -c.y };
    }
    if (rot) Matter.Body.setAngle(b, rot);
    Object.assign(b, { id: ++this.bid, k, team, owner, born: performance.now() });
    Matter.World.add(this.engine.world, b); this.blocks.push(b);
    return b;
  }
  /** Students' eggs fly exactly to where they aimed (their phone showed the arc); bots wobble a little. */
  throwEgg(team, target, owner, seq = 0, wobble = false) {
    const from = { x: LAUNCH[team].x, y: LAUNCH[team].y };
    const to = wobble ? { x: target.x + rnd(-14, 14), y: target.y + rnd(-10, 10) } : { x: target.x, y: target.y };
    const v = throwVelocity(from, to, EGG_STEPS);
    const e = Matter.Bodies.circle(from.x, from.y, 13, { density: 0.006, restitution: 0.1, frictionAir: 0, label: 'egg', collisionFilter: FILTER.egg(team) });
    Matter.Body.setVelocity(e, v);
    Object.assign(e, { team, owner, born: performance.now(), from, v0: v, steps: 0, seq, trail: [] });
    Matter.World.add(this.engine.world, e); this.eggs.push(e);
    sfx.egg?.();
  }
  splat(egg, hit) {
    const c = { ...egg.position };
    this.splats.push({ x: c.x, y: c.y, t0: performance.now(), team: egg.team });
    for (const b of this.blocks) {
      const dx = b.position.x - c.x; const dy = b.position.y - c.y; const d = Math.hypot(dx, dy);
      if (d > BLAST_R) continue;
      const k = BLAST * (1 - d / BLAST_R);
      Matter.Sleeping.set(b, false);
      Matter.Body.setVelocity(b, { x: b.velocity.x + (dx / (d || 1)) * k + Math.sign(egg.velocity.x) * k * 0.5, y: b.velocity.y + (dy / (d || 1)) * k - k * 0.3 });
      Matter.Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.06 * k);
    }
    if (hit?.label === 'block' && hit.team !== egg.team) { const p = this.players.get(egg.owner); if (p) { p.score += 1; p.hits = (p.hits || 0) + 1; this.onChange(p); } }
    sfx.splat?.();
    setTimeout(() => { Matter.World.remove(this.engine.world, egg); this.eggs = this.eggs.filter((e) => e !== egg); }, 0);
  }
  step() {
    Matter.Engine.update(this.engine, 1000 / 60);
    // anything that fell off a cliff is gone
    const gone = this.blocks.filter((b) => b.position.y > FALL_Y || Math.abs(b.position.x) > 30 * U);
    if (gone.length) {
      for (const b of gone) { Matter.World.remove(this.engine.world, b); this.pop('TIMBER!', b.position.x, Math.min(b.position.y, 2 * U), b.team); }
      this.blocks = this.blocks.filter((b) => !gone.includes(b));
    }
    for (const e of this.eggs) { e.steps += 1; if (e.steps % 3 === 0) { e.trail.push({ x: e.position.x, y: e.position.y }); if (e.trail.length > 8) e.trail.shift(); } }
    for (const e of this.eggs.filter((q) => q.position.y > FALL_Y)) { Matter.World.remove(this.engine.world, e); this.eggs = this.eggs.filter((q) => q !== e); }
    // bots
    if (this.running) for (const p of this.players.values()) if (p.bot) this.botThink(p, 1 / 60);
  }

  /** Top of a team's tower (y of the highest settled block over its cliff; 0 = the cliff top). */
  topY(team, settledOnly = false) {
    const p = PLATS[team]; let top = 0;
    for (const b of this.blocks) {
      if (b.team !== team || Math.abs(b.position.x - p.x) > PLAT_W / 2 + 2 * U || b.position.y > U) continue;
      if (settledOnly && (Math.hypot(b.velocity.x, b.velocity.y) > 0.25 || performance.now() - b.born < 1200)) continue;
      top = Math.min(top, b.bounds.min.y);
    }
    return top;
  }
  measure() {
    if (!this.round) return;
    for (const t of TEAMS) {
      const h = Math.max(0, -this.topY(t, true) / U);
      this.heights[t] = Math.round(h * 10) / 10;
      this.best[t] = Math.max(this.best[t], this.heights[t]);
    }
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false, av }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; return p; }
    const p = { uid, name, team, bot, av, score: 0, acts: 0, next: randomShape(), drops: 0, hits: 0, think: rnd(2, 6), wait: rnd(1, 3) };
    this.players.set(uid, p); return p;
  }
  removePlayer(uid) { this.players.delete(uid); }
  setTeam(uid, team) { const p = this.players.get(uid); if (p) p.team = team; }
  updateTag() {}

  // ---------- rounds ----------
  startRound(round) {
    this.round = round || this.round + 1;
    this.clearWorld();
    this.heights = { chicken: 0, turkey: 0 }; this.best = { chicken: 0, turkey: 0 }; this.pops = []; this.lastCmd.clear();
    for (const p of this.players.values()) { p.acts = 0; p.next = randomShape(); this.onChange(p); }
    this.running = false; this.lastRound = null; this.sync = {}; this.pushSync(true);
  }
  startBattle() { this.running = true; }
  stopRound() {
    this.running = false; this.measure();
    this.lastRound = { ...this.heights };
    for (const t of TEAMS) this.totals[t] = Math.round((this.totals[t] + this.heights[t]) * 10) / 10;
    for (const p of this.players.values()) this.onChange(p);
    this.pushSync(true);
  }
  resetScores() { this.totals = { chicken: 0, turkey: 0 }; this.round = 0; for (const p of this.players.values()) p.score = 0; }
  celebrate() {}
  addEggs() { return 0; }
  startEvent() {}
  /** Scoreboard: heights from finished rounds + the live height this round. */
  teamTotals() { const live = this.running ? this.heights : { chicken: 0, turkey: 0 }; return { chicken: this.totals.chicken + live.chicken, turkey: this.totals.turkey + live.turkey }; }

  // ---------- answers ----------
  reward(uid, { correct }) {
    const p = this.players.get(uid); if (!p) return null;
    const before = p.acts;
    if (correct) p.acts = Math.min(MAX_ACTIONS, p.acts + 1);
    this.onChange(p);
    return { acts: p.acts, add: p.acts - before };
  }

  // ---------- phone input ----------
  handleInput(uid, inp) {
    const p = this.players.get(uid); if (!p || !inp) return;
    const last = this.lastCmd.get(uid) || 0;
    const q = Object.values(inp.q || {}).filter((c) => c && c.s > last).sort((a, b) => a.s - b.s);
    for (const c of q) { this.lastCmd.set(uid, c.s); p.seq = c.s; this.act(p, c); }
    if (q.length) this.onChange(p);
  }
  act(p, c) {
    if (!this.running || this.paused || p.acts <= 0) return false;
    if (c.op === 'drop') {
      const k = SHAPES[c.k] ? c.k : p.next; const plat = PLATS[p.team];
      const x = Math.max(plat.x - PLAT_W / 2 - U, Math.min(plat.x + PLAT_W / 2 + U, +c.x || plat.x));
      const rot = (+c.rot || 0) % 4 * (Math.PI / 2);
      if (!this.addBlock(p.team, k, x, rot, p.uid)) return false;
      p.acts -= 1; p.drops += 1; p.score += 1; p.next = randomShape(); sfx.click?.();
      return true;
    }
    if (c.op === 'egg') {
      const tx = +c.x; const ty = +c.y; if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
      this.throwEgg(p.team, { x: tx, y: ty }, p.uid, +c.s || 0, !!p.bot);
      p.acts -= 1; return true;
    }
    return false;
  }

  // ---------- bots ----------
  botThink(p, dt) {
    p.think -= dt;
    if (p.think <= 0) {
      p.think = rnd(5, 10);
      const ok = Math.random() < 0.7;
      p.answered = (p.answered || 0) + 1; p.correct = (p.correct || 0) + (ok ? 1 : 0);
      this.reward(p.uid, { correct: ok });
    }
    p.wait -= dt; if (p.wait > 0 || p.acts <= 0) return;
    p.wait = rnd(1.5, 4);
    if (Math.random() < 0.72) {
      const plat = PLATS[p.team];
      const rot = (p.next === 'pillar' || p.next === 'door') ? 0 : Math.random() < 0.15 ? 1 : 0;
      this.act(p, { op: 'drop', k: p.next, x: plat.x + rnd(-0.7, 0.7) * U, rot });
    } else {
      const en = other(p.team); const top = this.topY(en);
      this.act(p, { op: 'egg', x: PLATS[en].x + rnd(-0.6, 0.6) * U, y: top + U * 0.4 });
    }
    this.onChange(p);
  }

  // ---------- phone sync ----------
  pushSync(force = false) {
    if (!this.round) return;
    const bs = this.blocks.map((b) => `${b.id},${SHAPE_KEYS.indexOf(b.k)},${b.team === 'turkey' ? 1 : 0},${Math.round(b.position.x)},${Math.round(b.position.y)},${Math.round(b.angle * 100)}`).join(';');
    // eggs: launch point + velocity + age, so phones can fly them smoothly between updates
    const es = this.eggs.map((e) => `${e.id || (e.id = ++this.bid)},${Math.round(e.from.x)},${Math.round(e.from.y)},${Math.round(e.v0.x * 1000)},${Math.round(e.v0.y * 1000)},${e.steps},${e.team === 'turkey' ? 1 : 0},${e.seq || 0}`).join(';');
    const now = performance.now();
    const ss = this.splats.filter((s) => now - s.t0 < 1500).map((s) => `${Math.round(s.x)},${Math.round(s.y)},${Math.round(s.t0)}`).join(';');
    const str = `${bs}|${es}|${ss}|${this.heights.chicken},${this.heights.turkey}`;
    const up = {};
    if (force || this.sync.round !== this.round) { this.sync.round = this.round; up['sa/info'] = { round: this.round }; }
    if (force || str !== this.sync.s) { this.sync.s = str; up['sa/s'] = str; }
    if (Object.keys(up).length) this.onSync(up);
  }
  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    return { score: p.score, acts: p.acts, next: p.next, hs: p.seq || 0, hc: this.heights.chicken, ht: this.heights.turkey, tc: this.totals.chicken, tt: this.totals.turkey };
  }

  // ---------- drawing ----------
  render() {
    const ctx = this.ctx; if (!ctx) return;
    const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const top = H * 0.19; const bottom = H * 0.11;
    // camera: both cliffs side by side, zoomed out as the towers grow
    const tallest = Math.max(-this.topY('chicken'), -this.topY('turkey'), 7 * U);
    const wantTop = -(tallest + 4 * U); this.cam.top += (wantTop - this.cam.top) * 0.05;
    const view = { x0: -17 * U, x1: 17 * U, y0: this.cam.top, y1: 3 * U };
    const s = Math.min(W / (view.x1 - view.x0), (H - top - bottom) / (view.y1 - view.y0));
    const ox = W / 2; const oy = top + (H - top - bottom) - view.y1 * s;
    drawScene(ctx, { blocks: this.blocks, eggs: this.eggs, splats: this.splats, heights: this.heights, best: this.best, topY: (t) => this.topY(t) }, { ox, oy, s, W, H, viewTop: top, labels: true });
    // pop-ups
    const now = performance.now();
    this.pops = this.pops.filter((f) => {
      const k = (now - f.t0) / 1300; if (k >= 1) return false;
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.font = `normal ${Math.round(U * s * 0.9)}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const x = ox + f.x * s; const y = oy + f.y * s - k * 40;
      ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.strokeText(f.text, x, y); ctx.fillStyle = '#ffc72c'; ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1; return true;
    });
  }
  pop(text, x, y, team) { if (this.pops.length < 6) this.pops.push({ text, x, y, team, t0: performance.now() }); }
  destroy() { this.canvas?.remove(); }
}

/**
 * Draw the scene (shared with the phones).
 * D = { blocks: [{k, team, position:{x,y}, angle, artOff?}], eggs: [{team, position}], splats: [{x, y, t0}], heights, best, topY(team) }
 * V = { ox, oy, s } world → screen: X = ox + x·s, Y = oy + y·s
 */
export function drawScene(ctx, D, V) {
  const { ox, oy, s } = V; const W = V.W; const H = V.H;
  // background: the panorama is pinned to the world (its cliffs ARE the platforms); beyond its edges we extend sky/scenery
  const bg = saArt('sa_bg'); const vt = V.viewTop ?? 0;
  if (bg) {
    const k = (s * U) / BG.ppu; // screen px per image px
    const bx = ox - BG.cx * k; const by = oy - BG.cy * k; const bw = bg.naturalWidth * k; const bh = bg.naturalHeight * k;
    ctx.save(); ctx.beginPath(); ctx.rect(0, vt, W, H - vt); ctx.clip();
    ctx.fillStyle = SKY; ctx.fillRect(0, vt, W, H - vt); // sky beyond the top of the picture
    // the picture, plus mirrored copies to the left and right so the hills carry on
    for (let i = -2; i <= 2; i++) {
      const x = bx + i * bw; if (x > W || x + bw < 0) continue;
      if (i % 2) { ctx.save(); ctx.translate(x + bw, by); ctx.scale(-1, 1); ctx.drawImage(bg, 0, 0, bw, bh); ctx.restore(); } else ctx.drawImage(bg, x, by, bw, bh);
    }
    if (by > vt) { const g = ctx.createLinearGradient(0, by, 0, by + bh * 0.12); g.addColorStop(0, SKY); g.addColorStop(1, 'rgba(1,134,253,0)'); ctx.fillStyle = g; ctx.fillRect(0, by - 1, W, bh * 0.12 + 1); }
    if (by + bh < H) { ctx.fillStyle = '#3d6b2a'; ctx.fillRect(0, by + bh - 1, W, H - (by + bh) + 1); }
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5fb4ff'); g.addColorStop(1, '#bfe6ff');
    ctx.fillStyle = g; ctx.fillRect(0, V.viewTop ?? 0, W, H - (V.viewTop ?? 0));
    ctx.fillStyle = '#8fcf6a'; ctx.beginPath(); ctx.moveTo(0, oy + 2 * U * s);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, oy - (2.2 + Math.sin(x / 140) * 0.9 + Math.sin(x / 57) * 0.3) * U * s);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  }
  // ravine
  if (!bg) { ctx.fillStyle = '#3a6b9e'; ctx.fillRect(0, oy + 5 * U * s, W, H); }
  // the two cliffs
  for (const t of TEAMS) {
    const p = PLATS[t]; const x = ox + (p.x - PLAT_W / 2) * s; const w = PLAT_W * s;
    if (bg) { drawFlag(ctx, t, x, w, oy, s); continue; } // the panorama already has the cliffs
    const cl = saArt(t === 'turkey' ? 'sa_cliff_t' : 'sa_cliff_c');
    if (cl) { // cliff art: its flat grassy top lines up with the cliff top (the top ~6% of the picture is grass)
      const cw = w * 1.08; const ch = cw * (cl.naturalHeight / cl.naturalWidth);
      ctx.drawImage(cl, x - (cw - w) / 2, oy - ch * 0.06, cw, ch);
      if (ch * 0.94 < H - oy) { ctx.fillStyle = '#5b3a1e'; ctx.fillRect(x, oy + ch * 0.93, w, H); }
      continue;
    }
    ctx.fillStyle = '#8a5a35'; ctx.fillRect(x, oy, w, H);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let k = 0; k < 6; k++) ctx.fillRect(x + ((k * 37) % 9) / 9 * w, oy + (0.6 + k * 0.9) * U * s, w * 0.18, 0.25 * U * s);
    ctx.fillStyle = '#6cc04a'; ctx.fillRect(x - 3, oy - 0.25 * U * s, w + 6, 0.45 * U * s);
    ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.strokeRect(x, oy - 0.25 * U * s, w, H);
    // team flag on the cliff edge
    const fx = t === 'chicken' ? x + 6 : x + w - 6; const fy = oy - 0.25 * U * s;
    ctx.fillStyle = '#333'; ctx.fillRect(fx - 2, fy - 2.2 * U * s, 4, 2.2 * U * s);
    ctx.fillStyle = t === 'chicken' ? '#1e6fe0' : '#e0402a'; ctx.beginPath();
    const dir = t === 'chicken' ? 1 : -1; ctx.moveTo(fx, fy - 2.2 * U * s); ctx.lineTo(fx + dir * 0.9 * U * s, fy - 1.9 * U * s); ctx.lineTo(fx, fy - 1.6 * U * s); ctx.fill(); ctx.stroke();
  }
  // the egg throwers at the inner edge of each cliff
  for (const t of TEAMS) {
    const im = img(t === 'turkey' ? 'turkey_throw' : 'chicken_throw'); if (!ready(im)) continue;
    const L = LAUNCH[t]; const h = 1.9 * U * s; const w = h * (im.naturalWidth / im.naturalHeight);
    ctx.save(); ctx.translate(ox + L.x * s, oy - 0.2 * U * s); if (t === 'turkey') ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
  }
  // height markers
  for (const t of TEAMS) {
    const p = PLATS[t]; const h = D.heights?.[t] || 0; const y = oy - h * U * s;
    const x0 = ox + (p.x - PLAT_W / 2 - 0.4 * U) * s; const x1 = ox + (p.x + PLAT_W / 2 + 0.4 * U) * s;
    if (h > 0) {
      ctx.setLineDash([10, 8]); ctx.strokeStyle = t === 'chicken' ? '#1e6fe0' : '#e0402a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
    }
    if (V.labels !== false) {
      ctx.font = `normal ${Math.max(18, U * s * 0.95)}px Bangers, Impact, sans-serif`; ctx.textAlign = t === 'chicken' ? 'right' : 'left'; ctx.textBaseline = 'middle';
      const lx = t === 'chicken' ? x0 - 8 : x1 + 8; const label = `${h.toFixed(1)} m`;
      ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.strokeText(label, lx, y - 2); ctx.fillStyle = t === 'chicken' ? '#9cc8ff' : '#ffb3a6'; ctx.fillText(label, lx, y - 2);
    }
  }
  // blocks
  for (const b of D.blocks) drawBlock(ctx, b, ox + b.position.x * s, oy + b.position.y * s, s);
  // eggs
  for (const e of D.eggs) {
    const im = img(e.team === 'turkey' ? 'egg_red' : 'egg_blue'); const r = Math.max(9, 22 * s);
    const x = ox + e.position.x * s; const y = oy + e.position.y * s;
    (e.trail || []).forEach((p, i, a) => { ctx.fillStyle = `rgba(255,255,255,${0.12 + (0.4 * i) / a.length})`; ctx.beginPath(); ctx.arc(ox + p.x * s, oy + p.y * s, r * (0.25 + (0.35 * i) / a.length), 0, Math.PI * 2); ctx.fill(); });
    if (ready(im)) { ctx.save(); ctx.translate(x, y); ctx.rotate(performance.now() / 120); ctx.drawImage(im, -r * 0.8, -r, r * 1.6, r * 2); ctx.restore(); } else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  }
  // splats
  const now = performance.now(); const sp = img('splat');
  for (const f of D.splats) {
    const k = (now - f.t0) / 1400; if (k < 0 || k >= 1) continue;
    ctx.globalAlpha = 1 - k; const w = U * s * (2.4 + k * 1.2); const x = ox + f.x * s; const y = oy + f.y * s;
    if (ready(sp)) ctx.drawImage(sp, x - w / 2, y - w * 0.3, w, w * (sp.naturalHeight / sp.naturalWidth));
    ctx.font = `normal ${U * s * 0.7}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#111';
    ctx.strokeText('SPLAT!', x, y - U * s * (0.8 + k)); ctx.fillStyle = '#ffc72c'; ctx.fillText('SPLAT!', x, y - U * s * (0.8 + k));
    ctx.globalAlpha = 1;
  }
}

/** One block, drawn with its Egg Cannon fort texture (or a coloured shape). alpha for the phone's ghost block. */
export function drawBlock(ctx, b, x, y, s, alpha = 1) {
  const sh = SHAPES[b.k]; if (!sh) return;
  const w = sh.w * U * s; const h = sh.h * U * s; const off = b.artOff || { x: 0, y: 0 };
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(b.angle || 0); ctx.translate(off.x * s, off.y * s);
  const im = img(sh.art(colourOf(b.team)));
  if (ready(im)) {
    if (sh.rotArt) { ctx.rotate(Math.PI / 2); ctx.drawImage(im, -h / 2, -w / 2, h, w); } else ctx.drawImage(im, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = b.team === 'turkey' ? '#e0402a' : '#1e6fe0'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    const pts = outline(b.k); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x * s, p.y * s) : ctx.moveTo(p.x * s, p.y * s))); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawFlag(ctx, t, x, w, oy, s) {
  const fx = t === 'chicken' ? x + 0.6 * U * s : x + w - 0.6 * U * s; const fy = oy;
  ctx.fillStyle = '#333'; ctx.fillRect(fx - 2, fy - 2.4 * U * s, 4, 2.4 * U * s);
  ctx.fillStyle = t === 'chicken' ? '#1e6fe0' : '#e0402a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath();
  const dir = t === 'chicken' ? 1 : -1; ctx.moveTo(fx, fy - 2.4 * U * s); ctx.lineTo(fx + dir * 1.0 * U * s, fy - 2.05 * U * s); ctx.lineTo(fx, fy - 1.7 * U * s); ctx.closePath(); ctx.fill(); ctx.stroke();
}
