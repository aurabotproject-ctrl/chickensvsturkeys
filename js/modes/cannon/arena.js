// =========================================================
// EGG CANNON — side-on artillery battle (PixiJS v7 + Matter.js)
// Chickens on the left, Turkeys on the right, each with a fort
// full of targets. Birds fire eggs from their rear-end cannons.
// =========================================================
/* global PIXI, Matter */
import { sprite } from '../../core/assets.js?v=20261010153644';
import { sfx } from '../../core/sfx.js?v=20261010153644';
import { FORTS, PIECES, DENSITY } from './forts.js?v=20261010153644';

export const W = 1700; export const H = 1200; export const GROUND = 1040;
export const VMAX = 22;          // egg speed at full power (px per physics step)
export const GRAV = 0.001 * (1000 / 60) ** 2; // Matter gravity per step²
const FORT_X = 300;              // chicken fort starts here (mirrored for turkeys)
const CAT = { ground: 0x1, cFort: 0x2, tFort: 0x4, cEgg: 0x8, tEgg: 0x10, nEgg: 0x20 };
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const CANNON_SPRITES = [
  'px_sky', 'px_far', 'px_mid', 'px_ground',
  'c_chicken_idle', 'c_chicken_aim', 'c_chicken_fire', 'c_chicken_win', 'c_chicken_sad',
  'c_turkey_idle', 'c_turkey_aim', 'c_turkey_fire', 'c_turkey_win', 'c_turkey_sad',
  'egg_blue', 'egg_red', 'egg', 'egg_gold', 'splat', 'impact', 'puff', 'sparkle', 'feathers', 'shield', 'debris_wood', 'debris_stone',
  'word_splat', 'word_blast', 'word_pow', 'word_bullseye', 'word_bok', 'word_gobble',
  ...new Set(Object.values(PIECES).flatMap((p) => (p.target ? ['chicken', 'turkey'] : p.mat === 'wood' ? ['blue', 'red'] : ['x'])
    .flatMap((t) => [p.tex(t), typeof p.cracked === 'function' ? p.cracked(t) : p.cracked, typeof p.broken === 'function' ? p.broken(t) : p.broken]).filter(Boolean))),
];

export class CannonArena {
  constructor(el, { onTarget, onEggsChanged, lite = false } = {}) {
    this.el = el; this.lite = lite;
    this.onTarget = onTarget || (() => {});
    this.onEggsChanged = onEggsChanged || (() => {});
    this.players = new Map();
    this.eggs = []; this.pieces = []; this.fx = [];
    this.running = false; this.paused = false; this.armed = false;
    this.time = 0; this.wind = 0; this.shake = 0;
    this.effects = { golden: 0, storm: 0, fog: 0, stormT: 0, shield: { chicken: 0, turkey: 0 } };
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.app = new PIXI.Application({ resizeTo: this.el, backgroundColor: 0x8fd3ff, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, this.lite ? 1 : 2) });
    this.el.appendChild(this.app.view);
    const names = [...new Set(CANNON_SPRITES)];
    const urls = names.map(sprite);
    const loaded = await PIXI.Assets.load(urls);
    this.tex = {}; names.forEach((n, i) => { this.tex[n] = loaded[urls[i]]; });

    const world = this.world = new PIXI.Container();
    this.app.stage.addChild(world);
    // Background layers (tiling so they always fill the screen width).
    const tile = (name, y, h, alpha = 1) => {
      const t = this.tex[name]; const s = new PIXI.TilingSprite(t, W * 2, h);
      s.tileScale.set(h / t.height); s.position.set(-W / 2, y); s.alpha = alpha; world.addChild(s); return s;
    };
    const skyFill = new PIXI.Graphics(); skyFill.beginFill(0x7ec8ff).drawRect(-W / 2, -1400, W * 2, 1500).endFill(); world.addChild(skyFill);
    this.sky = tile('px_sky', -120, 720);
    this.far = tile('px_far', 560, 210);
    this.mid = tile('px_mid', 690, 330);
    this.drawHill();
    this.layers = {};
    ['back', 'pieces', 'birds', 'eggs', 'fx', 'front', 'fog', 'words'].forEach((k) => { const c = new PIXI.Container(); this.layers[k] = c; world.addChild(c); });
    const groundTile = tile('px_ground', GROUND - 70, 330); this.layers.front.addChild(groundTile);
    const below = new PIXI.Graphics(); below.beginFill(0x5a3a1c).drawRect(-W / 2, GROUND + 255, W * 2, 1200).endFill(); this.layers.front.addChild(below);

    // physics
    const E = this.engine = Matter.Engine.create({ enableSleeping: true });
    E.gravity.y = 1; E.positionIterations = 8; E.velocityIterations = 6;
    const ground = Matter.Bodies.rectangle(W / 2, GROUND + 100, W * 3, 200, { isStatic: true, friction: 1, collisionFilter: { category: CAT.ground }, label: 'ground' });
    const hill = Matter.Bodies.fromVertices(W / 2, 0, [[{ x: 690, y: GROUND }, { x: 790, y: 915 }, { x: 910, y: 915 }, { x: 1010, y: GROUND }]], { isStatic: true, friction: 1, collisionFilter: { category: CAT.ground }, label: 'hill' });
    Matter.Body.setPosition(hill, { x: W / 2, y: GROUND - (GROUND - 915) / 2 + 10 });
    Matter.World.add(E.world, [ground, hill]);
    Matter.Events.on(E, 'collisionStart', (ev) => this.onCollide(ev));

    this.layout();
    this.app.renderer.on('resize', () => this.layout());
    this.app.ticker.add(() => this.tick(Math.min(this.app.ticker.deltaMS / 1000, 0.05)));
  }

  drawHill() {
    const g = new PIXI.Graphics();
    g.lineStyle(8, 0x111111);
    g.beginFill(0x8a5a2b); g.drawPolygon([690, GROUND + 40, 790, 915, 910, 915, 1010, GROUND + 40]); g.endFill();
    g.lineStyle(0); g.beginFill(0x6ab934); g.drawPolygon([772, 928, 792, 912, 908, 912, 928, 928, 890, 940, 810, 940]); g.endFill();
    g.lineStyle(6, 0x111111); g.moveTo(772, 928); g.lineTo(792, 912); g.lineTo(908, 912); g.lineTo(928, 928);
    for (let i = 0; i < 6; i++) { g.lineStyle(0); g.beginFill(0x5f3d1c, 0.6).drawEllipse(755 + i * 40 + (i % 2) * 12, 975 + (i % 3) * 18, 14, 8).endFill(); }
    this.world.addChild(g);
  }

  layout() {
    const w = this.el.clientWidth; const h = this.el.clientHeight;
    const s = Math.min(w / W, h / (GROUND + 70 - 360));
    this.scale = s; this.world.scale.set(s);
    this.baseX = (w - W * s) / 2;
    this.baseY = h * 0.93 - GROUND * s;
    this.world.position.set(this.baseX, this.baseY);
  }

  // ---------------- players ----------------
  addPlayer({ uid, name, team, bot = false }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; this.updateTag(p); return p; }
    const p = { uid, name, team, bot, score: 0, eggs: 0, angle: 45, aimPing: 0, fireT: 0, cd: 0, win: null, x: 0, y: GROUND, depth: 1 };
    const root = new PIXI.Container();
    const body = new PIXI.Sprite(this.tex[`c_${team}_idle`]); body.anchor.set(0.5, 0.95);
    const aim = new PIXI.Graphics();
    const tag = new PIXI.Text('', { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 20, fill: 0xffffff, stroke: 0x111111, strokeThickness: 5, align: 'center' });
    tag.anchor.set(0.5, 1);
    root.addChild(aim, body, tag);
    this.layers.birds.addChild(root);
    p.view = { root, body, aim, tag };
    this.players.set(uid, p);
    this.placeBirds();
    this.updateTag(p);
    return p;
  }
  removePlayer(uid) { const p = this.players.get(uid); if (!p) return; p.view.root.destroy({ children: true }); this.players.delete(uid); this.placeBirds(); }
  setTeam(uid, team) { const p = this.players.get(uid); if (!p || p.team === team) return; const { name, bot } = p; this.removePlayer(uid); this.addPlayer({ uid, name, team, bot }); }

  placeBirds() {
    for (const team of ['chicken', 'turkey']) {
      const list = [...this.players.values()].filter((p) => p.team === team);
      const n = list.length; const front = Math.ceil(n / 2);
      list.forEach((p, i) => {
        const back = i >= front; const k = back ? i - front : i; const cnt = back ? n - front : front;
        const span = 240; const step = cnt > 1 ? span / (cnt - 1) : 0;
        let x = 58 + (back ? 22 : 0) + (cnt > 1 ? k * step : span / 2);
        if (team === 'turkey') x = W - x;
        p.x = x; p.y = GROUND + (back ? -26 : 4); p.depth = back ? 0.82 : 1;
        p.view.root.zIndex = back ? 0 : 1;
      });
    }
    this.layers.birds.sortableChildren = true;
  }

  updateTag(p) { p.view.tag.text = `${(p.name || '?').slice(0, 9)}${p.eggs ? `\n🥚${p.eggs}` : ''}`; }

  addEggs(uid, n) {
    const p = this.players.get(uid); if (!p) return 0;
    const before = p.eggs; p.eggs = clamp(p.eggs + n, 0, 8);
    if (p.eggs !== before) { this.onEggsChanged(p); this.updateTag(p); }
    return p.eggs - before;
  }

  setAim(uid, angle) {
    const p = this.players.get(uid); if (!p) return;
    const a = clamp(+angle || 45, 5, 85);
    if (Math.abs(a - p.angle) > 0.5) p.aimPing = 1.5;
    p.angle = a;
  }

  mouth(p) {
    const dir = p.team === 'chicken' ? 1 : -1;
    const h = 120 * p.depth;
    return { x: p.x + dir * h * 0.42, y: p.y - h * 0.86 };
  }

  /** Fire one egg. angle in degrees above horizontal (toward the enemy), power 0..1. */
  fire(uid, angle, power) {
    const p = this.players.get(uid);
    if (!p || !this.running || this.paused || p.eggs <= 0 || p.cd > 0) return false;
    this.setAim(uid, angle);
    const a = (p.angle * Math.PI) / 180; const dir = p.team === 'chicken' ? 1 : -1;
    const v = VMAX * clamp(+power || 0.5, 0.12, 1);
    const m = this.mouth(p);
    p.eggs -= 1; p.cd = 0.7; p.fireT = 0.35;
    this.onEggsChanged(p); this.updateTag(p);
    this.spawnEgg(m.x, m.y, dir * Math.cos(a) * v, -Math.sin(a) * v, p.team, p.uid);
    this.puff('puff', m.x, m.y, 0.35, 0.5);
    sfx.throw(); sfx.bok();
    return true;
  }

  spawnEgg(x, y, vx, vy, team, owner) {
    const cat = team === 'chicken' ? CAT.cEgg : team === 'turkey' ? CAT.tEgg : CAT.nEgg;
    const mask = CAT.ground | (team === 'chicken' ? CAT.tFort : team === 'turkey' ? CAT.cFort : CAT.cFort | CAT.tFort);
    const body = Matter.Bodies.circle(x, y, 13, { density: 0.006, restitution: 0.2, friction: 0.4, frictionAir: 0, collisionFilter: { category: cat, mask }, label: 'egg' });
    body.plugin = { kind: 'egg', owner, team };
    Matter.Body.setVelocity(body, { x: vx, y: vy });
    Matter.World.add(this.engine.world, body);
    const golden = this.effects.golden > 0 && owner;
    const spr = new PIXI.Sprite(this.tex[golden ? 'egg_gold' : team === 'chicken' ? 'egg_blue' : team === 'turkey' ? 'egg_red' : 'egg']);
    spr.anchor.set(0.5); spr.width = 30; spr.height = 36;
    this.layers.eggs.addChild(spr);
    this.eggs.push({ body, spr, born: this.time, owner, team, dead: false });
  }

  // ---------------- forts ----------------
  buildForts(fortIndex) {
    this.clearPieces();
    const tpl = FORTS[fortIndex ?? Math.floor(Math.random() * FORTS.length)];
    this.fortName = tpl.name;
    for (const team of ['chicken', 'turkey']) {
      const colour = team === 'chicken' ? 'blue' : 'red';
      for (const [type, lx, ly] of tpl.pieces) {
        const def = PIECES[type];
        const x = team === 'chicken' ? FORT_X + lx : W - FORT_X - lx;
        const h = def.r ? def.r * 2 : def.h;
        const y = GROUND - ly - h / 2;
        this.addPiece(type, def, x, y, team, colour);
      }
    }
    // Let everything settle before anyone can shoot.
    for (let i = 0; i < 120; i++) Matter.Engine.update(this.engine, 1000 / 60);
    for (const pc of this.pieces) pc.home = { x: pc.body.position.x, y: pc.body.position.y };
    this.renderPieces();
  }

  addPiece(type, def, x, y, team, colour) {
    const cat = team === 'chicken' ? CAT.cFort : CAT.tFort;
    const mask = CAT.ground | cat | (team === 'chicken' ? CAT.tEgg : CAT.cEgg) | CAT.nEgg;
    const opts = { density: def.target ? 0.0011 : DENSITY[def.mat] || 0.0012, friction: 0.9, frictionStatic: 1.2, restitution: 0.05, collisionFilter: { category: cat, mask }, label: type, sleepThreshold: 30 };
    let body;
    if (def.shape === 'circle') body = Matter.Bodies.circle(x, y, def.r, opts);
    else if (def.shape === 'tri') body = Matter.Bodies.fromVertices(x, y, [[{ x: -def.w / 2, y: def.h / 2 }, { x: 0, y: -def.h / 2 }, { x: def.w / 2, y: def.h / 2 }]], opts);
    else if (def.shape === 'roof') body = Matter.Bodies.trapezoid(x, y, def.w, def.h, 0.6, opts);
    else body = Matter.Bodies.rectangle(x, y, def.w, def.h, opts);
    const texName = def.tex(def.target ? team : colour);
    const spr = new PIXI.Sprite(this.tex[texName]);
    spr.anchor.set(0.5, def.shape === 'tri' ? 0.62 : def.shape === 'roof' ? 0.55 : 0.5);
    if (def.rotTex) { spr.rotation = Math.PI / 2; spr.width = def.h; spr.height = def.w; } else if (def.r) { spr.width = def.r * 2.15; spr.height = def.r * 2.15; } else { spr.width = def.w * 1.08; spr.height = def.h * 1.08; }
    const holder = new PIXI.Container(); holder.addChild(spr);
    this.layers.pieces.addChild(holder);
    const pc = { type, def, body, holder, spr, team, colour, hp: def.hp, maxHp: def.hp, alive: true, lastHitBy: null, lastHitAt: 0 };
    body.plugin = { kind: def.target ? 'target' : 'block', pc };
    Matter.World.add(this.engine.world, body);
    this.pieces.push(pc);
  }

  clearPieces() {
    for (const pc of this.pieces) { Matter.World.remove(this.engine.world, pc.body); pc.holder.destroy({ children: true }); }
    this.pieces = [];
  }

  targetsLeft(team) { return this.pieces.filter((pc) => pc.alive && pc.def.target && pc.team === team).length; }

  // ---------------- collisions + damage ----------------
  onCollide(ev) {
    if (!this.armed) return;
    for (const pair of ev.pairs) {
      const a = pair.bodyA; const b = pair.bodyB;
      const rel = Matter.Vector.sub(a.velocity, b.velocity);
      const imp = Math.abs(Matter.Vector.dot(rel, pair.collision.normal));
      const ea = a.plugin?.kind === 'egg' ? a : null; const eb = b.plugin?.kind === 'egg' ? b : null;
      const egg = ea || eb; const other = egg === a ? b : a;
      if (egg) {
        const e = this.eggs.find((x) => x.body === egg);
        if (other.plugin?.pc) { const pc = other.plugin.pc; if (egg.plugin.owner) { pc.lastHitBy = egg.plugin.owner; pc.lastHitAt = this.time; } this.damage(pc, Math.max(0, imp - 1.5) * 8); }
        if (e && !e.dead && imp > 2.5) this.splatEgg(e, other.plugin?.pc ? 'hit' : 'ground');
        continue;
      }
      const pa = a.plugin?.pc; const pb = b.plugin?.pc;
      if (pa && pb) {
        // pass credit along a toppling chain
        if (pa.lastHitBy && this.time - pa.lastHitAt < 8 && (!pb.lastHitBy || pb.lastHitAt < pa.lastHitAt)) { pb.lastHitBy = pa.lastHitBy; pb.lastHitAt = pa.lastHitAt; }
        if (pb.lastHitBy && this.time - pb.lastHitAt < 8 && (!pa.lastHitBy || pa.lastHitAt < pb.lastHitAt)) { pa.lastHitBy = pb.lastHitBy; pa.lastHitAt = pb.lastHitAt; }
      }
      const d = Math.max(0, imp - 1.6) * 5;
      if (d > 0) { if (pa) this.damage(pa, d); if (pb) this.damage(pb, d); }
    }
  }

  damage(pc, d) {
    if (!pc.alive || d <= 0) return;
    pc.hp -= d;
    const def = pc.def;
    if (pc.hp > 0 && pc.hp < pc.maxHp * 0.55 && def.cracked && !pc.cracked) {
      pc.cracked = true;
      const n = typeof def.cracked === 'function' ? def.cracked(pc.team) : def.cracked;
      if (this.tex[n]) pc.spr.texture = this.tex[n];
    }
    if (pc.hp <= 0) this.destroyPiece(pc);
  }

  destroyPiece(pc, { silent = false } = {}) {
    if (!pc.alive) return;
    pc.alive = false;
    const { x, y } = pc.body.position;
    Matter.World.remove(this.engine.world, pc.body);
    const def = pc.def;
    const brokenName = typeof def.broken === 'function' ? def.broken(pc.team) : def.broken;
    if (brokenName && this.tex[brokenName]) {
      pc.spr.texture = this.tex[brokenName]; pc.fade = 0.7;
    } else { pc.holder.visible = false; }
    this.puff(def.mat === 'stone' || def.mat === 'metal' ? 'debris_stone' : def.mat === 'glass' ? 'sparkle' : 'debris_wood', x, y, def.target ? 0.35 : 0.3, 0.7, true);
    this.puff('puff', x, y, 0.3, 0.5);
    if (def.target) {
      const owner = pc.lastHitBy && this.time - pc.lastHitAt < 10 ? pc.lastHitBy : null;
      const shooter = owner ? this.players.get(owner) : null;
      const pts = shooter && shooter.team !== pc.team ? def.target * (this.effects.golden > 0 ? 2 : 1) : 0;
      if (pts) { shooter.score += pts; this.floatText(`+${pts}`, x, y - 70, shooter.team === 'chicken' ? 0x5fa2ff : 0xff7a5c); }
      this.word(pc.type === 'bullseye' ? 'word_bullseye' : pc.team === 'turkey' ? 'word_gobble' : 'word_bok', x, y - 110, 0.7);
      if (!silent) { sfx.splat(); this.shake = Math.max(this.shake, 10); }
      this.onTarget({ piece: pc, shooter, points: pts });
    }
    if (def.explode) this.explode(x, y, pc.lastHitBy, pc.lastHitAt);
  }

  explode(x, y, owner, at) {
    this.puff('impact', x, y, 0.9, 0.45); this.word('word_blast', x, y - 120, 0.9); this.shake = 18; sfx.splat();
    for (const pc of this.pieces) {
      if (!pc.alive) continue;
      const dx = pc.body.position.x - x; const dy = pc.body.position.y - y; const d = Math.hypot(dx, dy);
      if (d > 220) continue;
      const k = 1 - d / 220;
      Matter.Sleeping.set(pc.body, false);
      Matter.Body.setVelocity(pc.body, { x: pc.body.velocity.x + (dx / (d || 1)) * 14 * k, y: pc.body.velocity.y + (dy / (d || 1)) * 14 * k - 6 * k });
      if (owner) { pc.lastHitBy = owner; pc.lastHitAt = at; }
      this.damage(pc, 90 * k);
    }
  }

  splatEgg(e, where) {
    e.dead = true;
    const { x, y } = e.body.position;
    this.puff(where === 'hit' ? 'impact' : 'splat', x, y, where === 'hit' ? 0.45 : 0.3, 0.45);
    if (where === 'hit') this.shake = Math.max(this.shake, 6);
    sfx.splat();
  }

  // ---------------- rounds ----------------
  startRound(fortIndex) {
    this.running = false; this.armed = false;
    this.clearEggs();
    this.buildForts(fortIndex);
    for (const p of this.players.values()) { p.eggs = 0; p.cd = 0; p.win = null; this.updateTag(p); this.onEggsChanged(p); }
    this.effects = { golden: 0, storm: 0, fog: 0, stormT: 0, shield: { chicken: 0, turkey: 0 } };
    this.clearFog();
    this.wind = Math.round(rnd(-2, 2) * 2) / 2;
  }
  startBattle() { this.running = true; this.armed = true; this.paused = false; this.battleT = 0; }
  stopRound() { this.running = false; for (const e of this.eggs) e.dead = true; }
  clearEggs() { for (const e of this.eggs) { Matter.World.remove(this.engine.world, e.body); e.spr.destroy(); } this.eggs = []; }
  resetScores() { for (const p of this.players.values()) { p.score = 0; p.eggs = 0; p.win = null; this.updateTag(p); } }
  celebrate(team) { for (const p of this.players.values()) p.win = team === 'tie' || p.team === team; }
  /** True when nobody has eggs left and nothing is flying. */
  isSettled() {
    if (this.eggs.some((e) => !e.dead)) return false;
    if ([...this.players.values()].some((p) => p.eggs > 0)) return false;
    return true;
  }

  // ---------------- events ----------------
  startEvent(type, losingTeam) {
    if (type === 'golden') this.effects.golden = 20;
    else if (type === 'double') for (const p of this.players.values()) this.addEggs(p.uid, 2);
    else if (type === 'shield') { for (const t of ['chicken', 'turkey']) if (!losingTeam || t === losingTeam) this.effects.shield[t] = 8; }
    else if (type === 'storm') this.effects.storm = 10;
    else if (type === 'fog') { this.effects.fog = 15; this.makeFog(); }
  }
  makeFog() {
    this.clearFog();
    for (let i = 0; i < (this.lite ? 14 : 28); i++) {
      const s = new PIXI.Sprite(this.tex.feathers); s.anchor.set(0.5); s.position.set(rnd(150, W - 150), rnd(450, GROUND)); s.scale.set(rnd(0.35, 0.7)); s.alpha = 0;
      s.vx = rnd(-40, 40); s.vy = rnd(-15, 15); s.vr = rnd(-0.6, 0.6); this.layers.fog.addChild(s);
    }
  }
  clearFog() { this.layers?.fog.removeChildren().forEach((c) => c.destroy()); }

  // ---------------- loop ----------------
  tick(dt) {
    this.time += dt;
    if (!this.paused) this.simulate(dt);
    this.render(dt);
  }

  simulate(dt) {
    const E = this.effects;
    if (E.golden > 0) E.golden -= dt;
    for (const t of ['chicken', 'turkey']) if (E.shield[t] > 0) E.shield[t] -= dt;
    if (E.fog > 0) { E.fog -= dt; if (E.fog <= 0) this.clearFog(); }
    if (E.storm > 0 && this.running) {
      E.storm -= dt; E.stormT -= dt;
      if (E.stormT <= 0) { E.stormT = 0.45; const left = Math.random() < 0.5; const x = left ? rnd(FORT_X - 20, FORT_X + 360) : rnd(W - FORT_X - 360, W - FORT_X + 20); this.spawnEgg(x, -200, rnd(-1, 1), 0, null, null); }
    }
    for (const p of this.players.values()) { p.cd = Math.max(0, p.cd - dt); p.fireT = Math.max(0, p.fireT - dt); p.aimPing = Math.max(0, p.aimPing - dt); }
    // wind pushes flying eggs
    for (const e of this.eggs) if (!e.dead && e.team) Matter.Body.setVelocity(e.body, { x: e.body.velocity.x + this.wind * 0.004, y: e.body.velocity.y });
    // shields stop enemy eggs near a shielded fort
    for (const t of ['chicken', 'turkey']) {
      if (E.shield[t] <= 0) continue;
      const cx = t === 'chicken' ? FORT_X + 170 : W - FORT_X - 170;
      for (const e of this.eggs) {
        if (e.dead || e.team === t) continue;
        const { x, y } = e.body.position;
        if (Math.hypot(x - cx, (y - (GROUND - 160)) * 1.3) < 280) { e.dead = true; this.puff('sparkle', x, y, 0.4, 0.4); sfx.tick(); }
      }
    }
    Matter.Engine.update(this.engine, 1000 / 60);
    // eggs that rolled to a stop or left the world
    for (const e of this.eggs) {
      if (e.dead) continue;
      const { x, y } = e.body.position;
      if (x < -300 || x > W + 300 || y > H + 200 || this.time - e.born > 7) e.dead = true;
      else if (this.time - e.born > 0.4 && Math.hypot(e.body.velocity.x, e.body.velocity.y) < 0.4) { this.splatEgg(e, 'ground'); }
    }
    this.eggs = this.eggs.filter((e) => {
      if (!e.dead) return true;
      Matter.World.remove(this.engine.world, e.body); e.spr.destroy(); return false;
    });
    // targets knocked over or off the map are out too
    if (this.armed) {
      for (const pc of this.pieces) {
        if (!pc.alive || !pc.def.target) continue;
        const { x, y } = pc.body.position;
        const tilted = pc.def.shape !== 'circle' && Math.abs(Math.sin(pc.body.angle)) > 0.85;
        if (tilted || y > GROUND + 60 || x < -100 || x > W + 100 || (pc.home && Math.hypot(x - pc.home.x, y - pc.home.y) > 260)) this.destroyPiece(pc);
      }
    }
  }

  renderPieces() {
    for (const pc of this.pieces) {
      pc.holder.position.set(pc.body.position.x, pc.body.position.y);
      pc.holder.rotation = pc.body.angle;
    }
  }

  render(dt) {
    const t = this.time;
    this.sky.tilePosition.x -= dt * 6;
    for (const pc of this.pieces) {
      if (pc.alive) { pc.holder.position.set(pc.body.position.x, pc.body.position.y); pc.holder.rotation = pc.body.angle; } else if (pc.fade !== undefined && pc.holder.visible) { pc.fade -= dt; pc.holder.alpha = Math.max(0, pc.fade / 0.7); pc.holder.y += dt * 40; if (pc.fade <= 0) pc.holder.visible = false; }
    }
    for (const p of this.players.values()) {
      const v = p.view; const dir = p.team === 'chicken' ? 1 : -1;
      let name = 'idle'; let sy = 1 + Math.sin(t * 3 + p.x) * 0.02; let sx = 2 - sy; let rot = 0; let hop = 0;
      if (p.win === true) { name = 'win'; hop = -Math.abs(Math.sin(t * 7 + p.x)) * 18; } else if (p.win === false) name = 'sad';
      else if (p.fireT > 0) { name = 'fire'; const k = p.fireT / 0.35; sx = 1 + k * 0.15; sy = 1 - k * 0.12; rot = -dir * k * 0.12; } else if (p.aimPing > 0) name = 'aim';
      const tex = this.tex[`c_${p.team}_${name}`]; if (v.body.texture !== tex) v.body.texture = tex;
      const hgt = 120 * p.depth; const k = hgt / 260;
      // chickens are drawn facing left so their rear cannon points right at the turkeys
      v.body.scale.set(k * sx * -dir, k * sy); v.body.rotation = rot; v.body.y = hop;
      v.root.position.set(p.x, p.y);
      v.tag.position.set(0, -hgt - 4 + hop - (p.depth < 1 ? 26 : 0)); v.tag.scale.set(p.depth);
      v.aim.clear();
      if ((p.aimPing > 0 || p.cd > 0) && this.running) {
        const m = this.mouth(p); const a = (p.angle * Math.PI) / 180;
        v.aim.lineStyle(4, 0xffffff, Math.min(1, p.aimPing + 0.3));
        for (let i = 1; i <= 5; i++) { const d = 22 * i; v.aim.drawCircle(m.x - p.x + dir * Math.cos(a) * d, m.y - p.y - Math.sin(a) * d, 3); }
      }
    }
    for (const e of this.eggs) { e.spr.position.set(e.body.position.x, e.body.position.y); e.spr.rotation = e.body.angle; }
    this.fx = this.fx.filter((s) => {
      s.life -= dt;
      if (s.life <= 0) { s.destroy(); return false; }
      const k = 1 - s.life / s.maxLife;
      if (s.isWord) { const pop = k < 0.18 ? (k / 0.18) * 1.25 : k < 0.3 ? 1.25 - ((k - 0.18) / 0.12) * 0.25 : 1; s.scale.set(s.base * pop); s.y -= dt * 30; s.alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; } else if (s.isText) { s.y -= dt * 60; s.alpha = 1 - k; } else { s.scale.set(s.base * (0.6 + k * 0.7)); s.alpha = 1 - k; if (s.drift) { s.y += dt * 60; s.rotation += s.vr * dt; } }
      return true;
    });
    if (this.layers.fog.children.length) {
      const on = this.effects.fog > 0;
      for (const c of this.layers.fog.children) { c.x += c.vx * dt; c.y += c.vy * dt; c.rotation += c.vr * dt; c.alpha += ((on ? 0.85 : 0) - c.alpha) * Math.min(1, dt * 2); }
    }
    this.drawShields();
    if (this.shake > 0.2 && !this.lite) { this.world.position.set(this.baseX + rnd(-this.shake, this.shake) * this.scale, this.baseY + rnd(-this.shake, this.shake) * this.scale); this.shake *= 0.86; } else { this.world.position.set(this.baseX, this.baseY); this.shake = 0; }
  }

  drawShields() {
    if (!this.shieldG) { this.shieldG = new PIXI.Graphics(); this.layers.fx.addChild(this.shieldG); }
    const g = this.shieldG; g.clear();
    for (const t of ['chicken', 'turkey']) {
      const s = this.effects.shield[t]; if (s <= 0) continue;
      const cx = t === 'chicken' ? FORT_X + 170 : W - FORT_X - 170;
      g.lineStyle(8, 0x7fe3ff, 0.9).beginFill(0x7fe3ff, 0.18 + 0.06 * Math.sin(this.time * 8)).drawEllipse(cx, GROUND - 160, 280, 215).endFill();
    }
  }

  puff(name, x, y, scale = 0.4, life = 0.5, drift = false) {
    const s = new PIXI.Sprite(this.tex[name]); s.anchor.set(0.5); s.position.set(x, y); s.scale.set(scale * 0.6);
    s.maxLife = life; s.life = life; s.base = scale; s.drift = drift; s.vr = rnd(-2, 2);
    this.layers.fx.addChild(s); this.fx.push(s);
  }
  word(name, x, y, scale = 0.6) {
    const s = new PIXI.Sprite(this.tex[name]); s.anchor.set(0.5); s.position.set(x, y); s.scale.set(0.01);
    s.maxLife = 1; s.life = 1; s.base = scale; s.isWord = true; s.rotation = rnd(-0.2, 0.2);
    this.layers.words.addChild(s); this.fx.push(s);
  }
  floatText(text, x, y, color) {
    const t = new PIXI.Text(text, { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 56, fill: color, stroke: 0x111111, strokeThickness: 7 });
    t.anchor.set(0.5); t.position.set(x, y); t.maxLife = 1.2; t.life = 1.2; t.isText = true;
    this.layers.words.addChild(t); this.fx.push(t);
  }
  destroy() { this.app?.destroy(true, { children: true }); }
}

/** Ballistic helper for bots: speed needed to hit (dx, dy) at angle a (radians). dy > 0 = target higher. */
export function speedFor(dx, dy, a) {
  const den = 2 * Math.cos(a) ** 2 * (dx * Math.tan(a) - dy);
  return den > 0 ? Math.sqrt((GRAV * dx * dx) / den) : null;
}
