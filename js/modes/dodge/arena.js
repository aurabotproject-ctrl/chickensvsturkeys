// =========================================================
// DODGE EGG — host-side arena simulation + rendering (PixiJS v7)
// Court space: x 0..1600 (Chickens left, Turkeys right), y 0..900.
// The court is drawn in fake 3D onto the arena picture
// (a trapezoid: far edge narrower than the near edge).
// =========================================================
/* global PIXI */
import { sprite, DODGE_SPRITES } from '../../core/assets.js?v=20261009144451';
import { sfx } from '../../core/sfx.js?v=20261009144451';

export const COURT_W = 1600;
export const COURT_H = 900;
const MID = COURT_W / 2;
const WORLD_W = 1536; // arena picture size
const WORLD_H = 1024;
// Court corners measured on the arena picture.
const FAR_Y = 255; const NEAR_Y = 772;
const FAR_L = 282; const FAR_R = 1252;
const NEAR_L = 182; const NEAR_R = 1358;

export const CFG = {
  speed: 320,          // court units / s
  radius: 30,
  eggSpeed: 980,
  eggRadius: 16,
  eggLift: 46,         // throw height
  eggUp: 70,           // upward speed at release
  gravity: 150,
  throwCooldown: 0.35,
  koSeconds: 5,
  shieldSeconds: 1.6,
  maxEggs: 8,
  aimAssistDeg: 12,
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

/** Court (x,y) → picture coords + depth scale. */
export function toWorld(x, y) {
  const v = clamp(y / COURT_H, -0.15, 1.15);
  const wy = lerp(FAR_Y, NEAR_Y, v);
  const l = lerp(FAR_L, NEAR_L, v); const r = lerp(FAR_R, NEAR_R, v);
  return { x: l + (x / COURT_W) * (r - l), y: wy, s: lerp(0.82, 1.12, v) };
}

export class DodgeArena {
  constructor(el, { onHit, onSweep, onEggsChanged, koMode = 'respawn', lite = false } = {}) {
    this.el = el;
    this.onHit = onHit || (() => {});
    this.onSweep = onSweep || (() => {});
    this.onEggsChanged = onEggsChanged || (() => {});
    this.koMode = koMode;
    this.lite = lite;
    this.players = new Map();
    this.eggs = [];
    this.fx = [];
    this.decals = [];
    this.running = false;
    this.paused = false;
    this.time = 0;
    this.mult = 1;
    this.shake = 0;
    this.effects = { golden: 0, fog: 0, storm: 0, fox: 0, stormT: 0 };
    this.fox = null;
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.app = new PIXI.Application({
      resizeTo: this.el, backgroundAlpha: 0, antialias: true, autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, this.lite ? 1 : 2),
    });
    this.el.appendChild(this.app.view);
    const urls = DODGE_SPRITES.map(sprite);
    const loaded = await PIXI.Assets.load(urls);
    this.tex = {};
    DODGE_SPRITES.forEach((n, i) => { this.tex[n] = loaded[urls[i]]; });

    const world = this.world = new PIXI.Container();
    this.app.stage.addChild(world);
    world.addChild(new PIXI.Sprite(this.tex.arena));
    this.layers = {};
    ['decals', 'shadows', 'actors', 'eggs', 'fx', 'fog', 'words'].forEach((k) => {
      const c = new PIXI.Container(); this.layers[k] = c; world.addChild(c);
    });
    this.layers.actors.sortableChildren = true;
    this.layers.eggs.sortableChildren = true;

    this.layout();
    this.app.renderer.on('resize', () => this.layout());
    this.app.ticker.add(() => this.tick(Math.min(this.app.ticker.deltaMS / 1000, 0.05)));
  }

  layout() {
    const w = this.el.clientWidth; const h = this.el.clientHeight;
    const s = Math.min(w / WORLD_W, h / WORLD_H);
    this.scale = s;
    this.world.scale.set(s);
    this.baseX = (w - WORLD_W * s) / 2;
    this.baseY = (h - WORLD_H * s) / 2;
    this.world.position.set(this.baseX, this.baseY);
  }

  // ---------------- players ----------------
  addPlayer({ uid, name, team, bot = false }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; p.team = team; this.updateTag(p); return p; }
    const p = {
      uid, name, team, bot,
      x: 0, y: 0, vx: 0, vy: 0, mx: 0, my: 0,
      eggs: 0, score: 0, ko: false, koT: 0, shieldT: 0, cd: 0,
      throwT: 0, hitT: 0, ping: 0, face: team === 'chicken' ? 1 : -1,
    };
    this.spawn(p);
    this.buildView(p);
    this.players.set(uid, p);
    return p;
  }

  removePlayer(uid) {
    const p = this.players.get(uid); if (!p) return;
    p.view.root.destroy({ children: true }); p.view.shadow.destroy();
    this.players.delete(uid);
  }

  setTeam(uid, team) {
    const p = this.players.get(uid); if (!p || p.team === team) return;
    const { name, bot } = p; this.removePlayer(uid); this.addPlayer({ uid, name, team, bot });
  }

  spawn(p, back = false) {
    const left = p.team === 'chicken';
    const x0 = left ? 70 : MID + 90; const x1 = left ? MID - 90 : COURT_W - 70;
    p.x = back ? (left ? rnd(60, 260) : rnd(COURT_W - 260, COURT_W - 60)) : rnd(x0, x1);
    p.y = rnd(70, COURT_H - 70);
    p.vx = p.vy = 0;
  }

  buildView(p) {
    const root = new PIXI.Container();
    const body = new PIXI.Sprite(this.tex[`${p.team}_idle`]);
    body.anchor.set(0.5, 0.94);
    const ring = new PIXI.Graphics();
    const color = p.team === 'chicken' ? 0x1e6fe0 : 0xe0402a;
    ring.lineStyle(5, color, 0.95).drawEllipse(0, 0, 38, 13);
    const tag = new PIXI.Container();
    const tagBg = new PIXI.Graphics();
    const tagText = new PIXI.Text('', { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 22, fill: 0xffffff, stroke: 0x111111, strokeThickness: 4, letterSpacing: 1 });
    tagText.anchor.set(0.5, 0.5);
    tag.addChild(tagBg, tagText);
    tag.position.set(0, 26);
    const stars = new PIXI.Sprite(this.tex.stars); stars.anchor.set(0.5); stars.scale.set(0.42); stars.visible = false;
    const shield = new PIXI.Sprite(this.tex.shield); shield.anchor.set(0.5, 0.62); shield.alpha = 0.55; shield.visible = false;
    root.addChild(ring, body, shield, stars, tag);
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.32).drawEllipse(0, 0, 34, 11).endFill();
    this.layers.shadows.addChild(shadow);
    this.layers.actors.addChild(root);
    p.view = { root, body, ring, tag, tagBg, tagText, stars, shield, shadow, color };
    this.updateTag(p);
  }

  updateTag(p) {
    const v = p.view; if (!v) return;
    v.tagText.text = (p.name || '?').slice(0, 12);
    const w = v.tagText.width + 16;
    v.tagBg.clear().lineStyle(3, 0x111111).beginFill(v.color).drawRoundedRect(-w / 2, -13, w, 26, 12).endFill();
  }

  setMove(uid, mx, my) {
    const p = this.players.get(uid); if (!p) return;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    p.mx = mx || 0; p.my = my || 0;
    if (len > 0.2) p.ping = 0.6; // little pulse so the student can find their bird
  }

  addEggs(uid, n) {
    const p = this.players.get(uid); if (!p) return 0;
    const before = p.eggs;
    p.eggs = clamp(p.eggs + n, 0, CFG.maxEggs);
    if (p.eggs !== before) this.onEggsChanged(p);
    return p.eggs - before;
  }

  /** Returns true if an egg was thrown. (ax, ay) = direction in court space. */
  throwEgg(uid, ax, ay) {
    const p = this.players.get(uid);
    if (!p || !this.running || this.paused || p.ko || p.eggs <= 0 || p.cd > 0) return false;
    let len = Math.hypot(ax, ay);
    if (len < 0.15) { ax = p.team === 'chicken' ? 1 : -1; ay = 0; len = 1; }
    ax /= len; ay /= len;
    // Gentle aim assist toward the closest enemy near the aim line.
    let best = null; let bestAng = CFG.aimAssistDeg * Math.PI / 180;
    for (const e of this.players.values()) {
      if (e.team === p.team || e.ko) continue;
      const dx = e.x - p.x; const dy = e.y - p.y; const d = Math.hypot(dx, dy);
      const ang = Math.acos(clamp((dx * ax + dy * ay) / d, -1, 1));
      if (ang < bestAng) { bestAng = ang; best = { dx: dx / d, dy: dy / d }; }
    }
    if (best) { ax = ax * 0.4 + best.dx * 0.6; ay = ay * 0.4 + best.dy * 0.6; len = Math.hypot(ax, ay); ax /= len; ay /= len; }

    p.eggs -= 1; p.cd = CFG.throwCooldown; p.throwT = 0.28;
    this.onEggsChanged(p);
    const golden = this.effects.golden > 0;
    const spr = new PIXI.Sprite(this.tex[golden ? 'egg_gold' : p.team === 'chicken' ? 'egg_blue' : 'egg_red']);
    spr.anchor.set(0.5); spr.scale.set(golden ? 0.2 : 0.18);
    const sh = new PIXI.Graphics(); sh.beginFill(0x000000, 0.28).drawEllipse(0, 0, 14, 5).endFill();
    this.layers.eggs.addChild(spr); this.layers.shadows.addChild(sh);
    this.eggs.push({
      x: p.x + ax * 36, y: p.y + ay * 20, vx: ax * CFG.eggSpeed, vy: ay * CFG.eggSpeed,
      z: CFG.eggLift, vz: CFG.eggUp, team: p.team, owner: p.uid, spr, sh, spin: rnd(8, 14) * (ax > 0 ? 1 : -1),
    });
    sfx.throw();
    return true;
  }

  startRound() {
    this.clearEggs();
    for (const p of this.players.values()) {
      p.ko = false; p.koT = 0; p.shieldT = 0; p.eggs = 0; p.cd = 0; p.mx = p.my = 0;
      this.spawn(p); this.onEggsChanged(p);
    }
    this.effects = { golden: 0, fog: 0, storm: 0, fox: 0, stormT: 0 };
    this.mult = 1;
    this.endFox(); this.clearFog();
    this.running = true; this.paused = false;
  }

  stopRound() {
    this.running = false;
    for (const p of this.players.values()) { p.mx = p.my = 0; }
    this.clearEggs();
  }

  clearEggs() {
    this.eggs.forEach((e) => { e.spr.destroy(); e.sh.destroy(); });
    this.eggs = [];
  }

  resetScores() { for (const p of this.players.values()) { p.score = 0; p.eggs = 0; } }

  celebrate(team) {
    for (const p of this.players.values()) {
      p.ko = false; p.view.stars.visible = false;
      p.win = team === 'tie' || p.team === team;
    }
  }

  // ---------------- events ----------------
  startEvent(type, losingTeam) {
    switch (type) {
      case 'golden': this.effects.golden = 20; break;
      case 'double': for (const p of this.players.values()) this.addEggs(p.uid, 2); break;
      case 'shield': for (const p of this.players.values()) if (p.team === losingTeam || !losingTeam) p.shieldT = 8; break;
      case 'storm': this.effects.storm = 12; break;
      case 'fog': this.effects.fog = 15; this.makeFog(); break;
      case 'fox': this.startFox(losingTeam === 'chicken' ? 'turkey' : losingTeam === 'turkey' ? 'chicken' : (Math.random() < 0.5 ? 'chicken' : 'turkey')); break;
      default: break;
    }
  }

  startFox(team) {
    this.endFox();
    const spr = new PIXI.Sprite(this.tex.fox); spr.anchor.set(0.5, 0.9);
    const left = team === 'chicken';
    this.fox = { team, x: left ? -60 : COURT_W + 60, y: COURT_H / 2, spr, t: 12 };
    this.layers.actors.addChild(spr);
    this.effects.fox = 12;
  }
  endFox() { if (this.fox) { this.fox.spr.destroy(); this.fox = null; } this.effects.fox = 0; }

  makeFog() {
    this.clearFog();
    const n = this.lite ? 18 : 40;
    for (let i = 0; i < n; i++) {
      const s = new PIXI.Sprite(this.tex.feathers); s.anchor.set(0.5);
      s.position.set(rnd(150, 1400), rnd(220, 820)); s.scale.set(rnd(0.6, 1.2)); s.alpha = 0;
      s.vx = rnd(-30, 30); s.vy = rnd(-12, 12); s.vr = rnd(-0.6, 0.6);
      this.layers.fog.addChild(s);
    }
    const mist = new PIXI.Graphics(); mist.beginFill(0xe8eef7, 1).drawRect(0, 0, WORLD_W, WORLD_H).endFill(); mist.alpha = 0; mist.isMist = true;
    this.layers.fog.addChildAt(mist, 0);
  }
  clearFog() { this.layers?.fog.removeChildren().forEach((c) => c.destroy()); }

  // ---------------- main loop ----------------
  tick(dt) {
    this.time += dt;
    if (this.running && !this.paused) this.simulate(dt);
    this.render(dt);
  }

  simulate(dt) {
    const E = this.effects;
    if (E.golden > 0) E.golden -= dt;
    if (E.fog > 0) { E.fog -= dt; if (E.fog <= 0) this.clearFog(); }
    if (E.storm > 0) {
      E.storm -= dt; E.stormT -= dt;
      if (E.stormT <= 0) { E.stormT = 0.32; this.dropStormEgg(); }
    }
    if (this.fox) this.moveFox(dt);

    for (const p of this.players.values()) {
      p.cd = Math.max(0, p.cd - dt);
      p.throwT = Math.max(0, p.throwT - dt);
      p.hitT = Math.max(0, p.hitT - dt);
      p.ping = Math.max(0, p.ping - dt);
      p.shieldT = Math.max(0, p.shieldT - dt);
      if (p.ko) {
        p.koT -= dt;
        if (p.koT <= 0 && this.koMode === 'respawn') { p.ko = false; this.spawn(p, true); p.shieldT = CFG.shieldSeconds; }
        p.vx *= 0.85; p.vy *= 0.85;
      } else {
        const tvx = p.mx * CFG.speed; const tvy = p.my * CFG.speed;
        const k = Math.min(1, dt * 12);
        p.vx += (tvx - p.vx) * k; p.vy += (tvy - p.vy) * k;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const left = p.team === 'chicken';
      p.x = clamp(p.x, left ? 30 : MID + 40, left ? MID - 40 : COURT_W - 30);
      p.y = clamp(p.y, 30, COURT_H - 30);
    }

    // eggs
    for (const e of this.eggs) {
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vz -= CFG.gravity * dt; e.z += e.vz * dt;
      if (e.dead) continue;
      if (e.z < 90) for (const p of this.players.values()) {
        if (p.ko || (e.team && p.team === e.team)) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < CFG.radius + CFG.eggRadius) {
          e.dead = true;
          if (p.shieldT > 0) { this.puff('sparkle', e.x, e.y, 0.35); sfx.tick(); break; }
          this.knockOut(p, e);
          break;
        }
      }
      if (!e.dead && e.z <= 0) { e.dead = true; this.splatFloor(e.x, e.y); }
      if (!e.dead && (e.x < -60 || e.x > COURT_W + 60 || e.y < -80 || e.y > COURT_H + 80)) { e.dead = true; e.gone = true; }
    }
    this.eggs = this.eggs.filter((e) => {
      if (!e.dead) return true;
      e.spr.destroy(); e.sh.destroy(); return false;
    });

    this.checkSweep();
  }

  knockOut(p, e, { points = true } = {}) {
    p.ko = true; p.koT = this.koMode === 'respawn' ? CFG.koSeconds : 9999; p.hitT = 0.4;
    p.vx += (e?.vx || 0) * 0.35; p.vy += (e?.vy || 0) * 0.35;
    const thrower = e?.owner ? this.players.get(e.owner) : null;
    const pts = points && thrower ? this.mult * (this.effects.golden > 0 ? 2 : 1) : 0;
    if (thrower && pts) { thrower.score += pts; this.floatText(`+${pts}`, thrower.x, thrower.y, thrower.team === 'chicken' ? 0x5fa2ff : 0xff7a5c); }
    this.hitFx(p);
    this.onHit({ victim: p, thrower, points: pts, cause: e?.cause || 'egg' });
  }

  checkSweep() {
    if (this.sweepCooldown > 0) { this.sweepCooldown -= 1 / 60; return; }
    for (const team of ['chicken', 'turkey']) {
      const members = [...this.players.values()].filter((p) => p.team === team);
      if (members.length >= 2 && members.every((p) => p.ko)) {
        this.sweepCooldown = 6;
        this.onSweep(team === 'chicken' ? 'turkey' : 'chicken', team);
        members.forEach((p) => { p.ko = false; this.spawn(p, true); p.shieldT = 2.5; });
        this.word('word_cleansweep', 768, 500, 1.4);
        return;
      }
    }
  }

  dropStormEgg() {
    const x = rnd(40, COURT_W - 40); const y = rnd(40, COURT_H - 40);
    const spr = new PIXI.Sprite(this.tex.egg); spr.anchor.set(0.5); spr.scale.set(0.2);
    const sh = new PIXI.Graphics(); sh.beginFill(0x000000, 0.3).drawEllipse(0, 0, 18, 6).endFill();
    this.layers.eggs.addChild(spr); this.layers.shadows.addChild(sh);
    this.eggs.push({ x, y, vx: 0, vy: 0, z: 520, vz: -380, team: null, owner: null, spr, sh, spin: 6, cause: 'storm' });
  }

  moveFox(dt) {
    const f = this.fox;
    f.t -= dt; this.effects.fox = f.t;
    const targets = [...this.players.values()].filter((p) => p.team === f.team && !p.ko && p.shieldT <= 0);
    let tx; let ty;
    if (f.t <= 0 || !targets.length) { tx = f.team === 'chicken' ? -200 : COURT_W + 200; ty = f.y; }
    else {
      targets.sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y));
      tx = targets[0].x; ty = targets[0].y;
    }
    const dx = tx - f.x; const dy = ty - f.y; const d = Math.hypot(dx, dy) || 1;
    const sp = 360;
    f.x += (dx / d) * sp * dt; f.y += (dy / d) * sp * dt;
    f.dir = dx >= 0 ? 1 : -1;
    for (const p of targets) {
      if (Math.hypot(p.x - f.x, p.y - f.y) < 46) { this.knockOut(p, { cause: 'fox', vx: (dx / d) * 300, vy: (dy / d) * 300 }, { points: false }); this.word('word_oof', ...this.wxy(p.x, p.y - 60), 0.8); }
    }
    if (f.t <= 0 && (f.x < -150 || f.x > COURT_W + 150)) this.endFox();
  }

  // ---------------- effects ----------------
  wxy(x, y) { const w = toWorld(x, y); return [w.x, w.y]; }

  hitFx(p) {
    const [x, y] = this.wxy(p.x, p.y);
    this.puff('impact', x, y - 45, 0.55, 0.28);
    if (!this.lite) this.puff('feathers', x, y - 40, 0.5, 0.7, true);
    const words = p.team === 'turkey' ? ['word_splat', 'word_gobble', 'word_pow', 'word_oof', 'word_blast'] : ['word_splat', 'word_bok', 'word_pow', 'word_oof', 'word_blast'];
    this.word(words[Math.floor(Math.random() * words.length)], x, y - 110, 0.62);
    this.shake = Math.max(this.shake, 9);
    sfx.splat();
  }

  splatFloor(cx, cy) {
    const [x, y] = this.wxy(cx, cy);
    const s = new PIXI.Sprite(this.tex.splat); s.anchor.set(0.5); s.position.set(x, y);
    s.scale.set(0.24, 0.13); s.rotation = rnd(-0.3, 0.3); s.life = 5;
    this.layers.decals.addChild(s); this.decals.push(s);
    if (this.decals.length > 40) this.decals.shift().destroy();
    this.puff('dust', x, y - 6, 0.22, 0.4);
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

  floatText(text, cx, cy, color) {
    const [x, y] = this.wxy(cx, cy);
    const t = new PIXI.Text(text, { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 44, fill: color, stroke: 0x111111, strokeThickness: 6 });
    t.anchor.set(0.5); t.position.set(x, y - 120); t.maxLife = 1.1; t.life = 1.1; t.isText = true;
    this.layers.words.addChild(t); this.fx.push(t);
  }

  // ---------------- render ----------------
  render(dt) {
    const t = this.time;
    for (const p of this.players.values()) {
      const v = p.view; const w = toWorld(p.x, p.y); const s = w.s;
      const speed = Math.hypot(p.vx, p.vy);
      let tex = 'idle'; let hop = 0; let rot = 0; let sx = 1; let sy = 1;
      if (p.ko) {
        tex = 'dizzy'; rot = Math.sin(t * 6) * 0.12;
        if (p.hitT > 0) { sx = 1.25; sy = 0.75; }
      } else if (p.win) {
        tex = 'win'; hop = -Math.abs(Math.sin(t * 7 + p.x)) * 22; sy = 1 + Math.sin(t * 14) * 0.04;
      } else if (p.throwT > 0) {
        tex = 'throw'; const k = p.throwT / 0.28; sx = 1 + k * 0.18; sy = 1 - k * 0.12;
      } else if (speed > 25) {
        tex = Math.floor(t * 9 + p.x * 0.01) % 2 ? 'run' : 'idle';
        hop = -Math.abs(Math.sin(t * 15)) * 10; rot = Math.sin(t * 15) * 0.07; sy = 1 - Math.cos(t * 30) * 0.05; sx = 2 - sy;
      } else {
        sy = 1 + Math.sin(t * 3 + p.y) * 0.025; sx = 1 - Math.sin(t * 3 + p.y) * 0.015;
      }
      const texture = this.tex[`${p.team}_${tex}`];
      if (v.body.texture !== texture) v.body.texture = texture;
      const h = 92 * s; const k = h / 300;
      v.body.scale.set(k * sx * p.face, k * sy);
      v.body.rotation = rot;
      v.body.y = hop;
      v.root.position.set(w.x, w.y); v.root.zIndex = w.y;
      v.root.alpha = p.ko && p.koT < 1.2 && p.koT < 999 ? (Math.floor(t * 12) % 2 ? 0.45 : 1) : 1;
      v.ring.scale.set(s * (1 + p.ping * 0.6)); v.ring.alpha = 0.55 + p.ping * 0.7;
      v.tag.scale.set(Math.max(0.8, s)); v.tag.y = 24 * s;
      v.stars.visible = p.ko; if (p.ko) { v.stars.position.set(0, -h * 0.95 + hop); v.stars.rotation = t * 3; }
      v.shield.visible = p.shieldT > 0; if (p.shieldT > 0) { v.shield.scale.set(0.62 * s); v.shield.alpha = 0.35 + 0.2 * Math.sin(t * 10); }
      v.shadow.position.set(w.x, w.y + 2); v.shadow.scale.set(s * (hop ? 0.85 : 1));
    }
    for (const e of this.eggs) {
      const w = toWorld(e.x, e.y);
      e.spr.position.set(w.x, w.y - Math.max(0, e.z) * w.s); e.spr.rotation += e.spin * dt; e.spr.zIndex = w.y;
      e.sh.position.set(w.x, w.y); const k = Math.max(0.3, 1 - Math.max(0, e.z) / 300); e.sh.scale.set(k * w.s); e.sh.alpha = k;
    }
    if (this.fox) {
      const w = toWorld(this.fox.x, this.fox.y);
      this.fox.spr.position.set(w.x, w.y - Math.abs(Math.sin(this.time * 16)) * 8);
      this.fox.spr.scale.set(0.42 * w.s * (this.fox.dir || 1), 0.42 * w.s); this.fox.spr.zIndex = w.y;
    }
    // fx
    this.fx = this.fx.filter((s) => {
      s.life -= dt;
      if (s.life <= 0) { s.destroy(); return false; }
      const k = 1 - s.life / s.maxLife;
      if (s.isWord) {
        const pop = k < 0.18 ? (k / 0.18) * 1.25 : k < 0.3 ? 1.25 - ((k - 0.18) / 0.12) * 0.25 : 1;
        s.scale.set(s.base * pop); s.y -= dt * 30; s.alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      } else if (s.isText) { s.y -= dt * 60; s.alpha = 1 - k; } else {
        s.scale.set(s.base * (0.6 + k * 0.6)); s.alpha = 1 - k; if (s.drift) { s.y += dt * 30; s.rotation += s.vr * dt; }
      }
      return true;
    });
    for (const d of this.decals) { if (d.life !== undefined) { d.life -= dt; d.alpha = Math.min(1, Math.max(0, d.life / 2)); } }
    // fog
    if (this.layers.fog.children.length) {
      const fogOn = this.effects.fog > 0;
      for (const c of this.layers.fog.children) {
        if (c.isMist) { c.alpha += ((fogOn ? 0.42 : 0) - c.alpha) * Math.min(1, dt * 2); continue; }
        c.x += c.vx * dt; c.y += c.vy * dt; c.rotation += c.vr * dt;
        c.alpha += ((fogOn ? 0.95 : 0) - c.alpha) * Math.min(1, dt * 2);
      }
    }
    // screen shake
    if (this.shake > 0.2 && !this.lite) {
      this.world.position.set(this.baseX + rnd(-this.shake, this.shake), this.baseY + rnd(-this.shake, this.shake));
      this.shake *= 0.86;
    } else { this.world.position.set(this.baseX, this.baseY); this.shake = 0; }
  }

  destroy() { this.app?.destroy(true, { children: true }); }
}
