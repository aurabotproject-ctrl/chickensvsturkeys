// =========================================================
// EGG FARM — the student's farm on their phone (PixiJS v7).
// Pure presentation: the host decides money, chickens etc.
// The scene shows hatching chicks running to coops, trucks on
// the road, balloons to pop and the occasional sneaky fox.
// =========================================================
/* global PIXI */
import { sprite } from '../../core/assets.js?v=20261009140635';
import { COOP_LV, TRUCK_LV, MACHINE_LV } from './economy.js?v=20261009140635';

const MAP_W = 900; const MAP_H = 1350;
export const PLOTS = [{ x: 330, y: 470 }, { x: 715, y: 610 }, { x: 560, y: 245 }, { x: 470, y: 950 }];
const HATCHERY = { x: 640, y: 440 };
const MACHINE_AT = { x: 215, y: 790 };
const DEPOT = { x: 720, y: 1110 };
const roadY = (x) => 1128 + 0.4 * x;
const rnd = (a, b) => a + Math.random() * (b - a);

const SPRITES = ['farm_ground', 'chicken_idle', 'chicken_run', 'turkey_idle', 'turkey_run', 'fm_statue',
  'fm_coop_c1', 'fm_coop_c2', 'fm_coop_c3', 'fm_coop_c4', 'fm_coop_c5', 'fm_coop_t1', 'fm_coop_t2', 'fm_coop_t3', 'fm_coop_t4', 'fm_coop_t5',
  'fm_van', 'fm_truck', 'fm_semi', 'fm_conveyor', 'fm_sorter', 'fm_packer', 'fm_silo', 'fm_trough', 'fm_tractor', 'fm_hopper', 'fm_tower', 'fm_scarecrow',
  'fm_bag', 'fm_goldegg', 'fox', 'egg', 'puff', 'sparkle', 'feathers', 'word_bok', 'word_gobble', 'word_pow'];

export class FarmScene {
  constructor(el, { team, onBalloon, onFox } = {}) {
    this.el = el; this.team = team || 'chicken';
    this.onBalloon = onBalloon || (() => {});
    this.onFox = onFox || (() => {});
    this.runners = []; this.queue = 0; this.trucks = []; this.balloons = []; this.fx = [];
    this.state = null; this.time = 0;
    this.nextBalloon = 8 + Math.random() * 6; this.nextFox = 45 + Math.random() * 25;
    this.paused = false;
  }

  async init() {
    this.app = new PIXI.Application({ resizeTo: this.el, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
    this.el.appendChild(this.app.view);
    const urls = SPRITES.map(sprite);
    const loaded = await PIXI.Assets.load(urls);
    this.tex = {}; SPRITES.forEach((n, i) => { this.tex[n] = loaded[urls[i]]; });
    const W = this.world = new PIXI.Container();
    this.app.stage.addChild(W);
    W.addChild(new PIXI.Sprite(this.tex.farm_ground));
    this.layer = {};
    ['ground', 'road', 'objects', 'runners', 'sky', 'fx'].forEach((k) => { const c = new PIXI.Container(); this.layer[k] = c; W.addChild(c); });
    this.layer.objects.sortableChildren = true; this.layer.runners.sortableChildren = true;
    // decorations
    const deco = (name, x, y, w, z = y) => { const s = new PIXI.Sprite(this.tex[name]); s.anchor.set(0.5, 0.85); s.position.set(x, y); s.scale.set(w / s.texture.width); s.zIndex = z; this.layer.objects.addChild(s); return s; };
    deco('fm_silo', 150, 290, 70); deco('fm_trough', 215, 330, 90); deco('fm_tractor', 420, 150, 110); deco('fm_scarecrow', 100, 860, 60);
    deco('fm_tower', 860, 400, 70); deco('fm_hopper', 640, 1060, 80);
    this.hatchery = deco('fm_statue', HATCHERY.x, HATCHERY.y, 110);
    this.label('HATCHERY', HATCHERY.x, HATCHERY.y + 26, 30);
    // coop plots
    this.plots = PLOTS.map((p, i) => {
      const g = new PIXI.Graphics();
      g.lineStyle(5, 0xffffff, 0.75).beginFill(0xffffff, 0.12);
      g.drawPolygon([p.x, p.y - 70, p.x + 120, p.y, p.x, p.y + 70, p.x - 120, p.y]); g.endFill();
      this.layer.ground.addChild(g);
      const sign = this.label('🔨 BUILD', p.x, p.y, 36); sign.alpha = 0.9;
      const coop = new PIXI.Sprite(PIXI.Texture.EMPTY); coop.anchor.set(0.5, 0.72); coop.position.set(p.x, p.y); coop.zIndex = p.y;
      this.layer.objects.addChild(coop);
      const badge = this.label('', p.x, p.y + 84, 32);
      const residents = [];
      return { ...p, i, g, sign, coop, badge, level: 0, residents };
    });
    this.machine = deco('fm_conveyor', MACHINE_AT.x, MACHINE_AT.y, 150); this.machine.visible = false;
    this.machineLabel = this.label('', MACHINE_AT.x, MACHINE_AT.y + 34, 28);
    this.depotSign = this.label('📦 TRUCKS FULL!', DEPOT.x, DEPOT.y - 80, 36, 0xff5a3c); this.depotSign.visible = false;
    this.layout();
    this.app.renderer.on('resize', () => this.layout());
    this.ro = new ResizeObserver(() => { this.app.resize(); this.layout(); }); this.ro.observe(this.el);
    this.app.ticker.add(() => this.tick(Math.min(this.app.ticker.deltaMS / 1000, 0.05)));
    // tapping balloons + fox
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, 4000, 4000);
  }

  label(text, x, y, size = 22, color = 0xffffff) {
    const t = new PIXI.Text(text, { fontFamily: 'Bangers, Impact, sans-serif', fontSize: size, fill: color, stroke: 0x111111, strokeThickness: 5, letterSpacing: 1 });
    t.anchor.set(0.5); t.position.set(x, y); t.zIndex = 5000;
    this.layer.objects.addChild(t);
    return t;
  }

  layout() {
    const w = this.el.clientWidth; const h = this.el.clientHeight;
    const s = Math.min(w / MAP_W, h / MAP_H);
    this.scale = s; this.world.scale.set(s);
    this.world.position.set((w - MAP_W * s) / 2, (h - MAP_H * s) / 2);
  }

  /** New state from the host (the phone calls this whenever pstate changes). */
  update(st) {
    const first = !this.state; this.state = st;
    if (!this.tex) return;
    const t = this.team === 'chicken' ? 'c' : 't';
    (st.coops || []).forEach((lvl, i) => {
      const p = this.plots[i];
      if (p.level !== lvl) {
        const grew = p.level > 0 || !first;
        p.level = lvl;
        if (lvl) {
          p.coop.texture = this.tex[`fm_coop_${t}${lvl}`];
          const w = 150 + lvl * 22; p.coop.scale.set(w / p.coop.texture.width);
          p.sign.visible = false; p.g.alpha = 0.25;
          if (grew && !first) { this.burst(p.x, p.y - 40, 'sparkle', 0.9); this.word('word_pow', p.x, p.y - 120); }
        }
      }
    });
    this.updateBadges();
    // machine
    const m = MACHINE_LV[st.machine || 0];
    this.machine.visible = !!m.sprite;
    if (m.sprite) { this.machine.texture = this.tex[m.sprite]; this.machine.scale.set(150 / this.machine.texture.width); this.machine.tint = st.machine >= 4 ? 0xffe066 : 0xffffff; }
    this.machineLabel.text = m.sprite ? m.name : '';
    // trucks on the road
    const owned = (st.trucks || []).filter(Boolean).length;
    while (this.trucks.length < owned) this.trucks.push({ x: -200 - this.trucks.length * 260, wait: this.trucks.length * 1.5, spr: null });
    this.trucks.forEach((tr, i) => { tr.level = st.trucks.filter(Boolean)[i]; });
    this.depotSign.visible = st.lay > st.ship + 0.01;
  }

  updateBadges() {
    const st = this.state; if (!st) return;
    // share chickens out across coops in proportion to their size
    let left = st.chickens;
    this.plots.forEach((p) => {
      if (!p.level) { p.badge.text = ''; return; }
      const cap = COOP_LV[p.level].cap;
      const n = Math.min(cap, left); left -= n;
      p.badge.text = `${n}/${cap}`;
      p.badge.style.fill = n >= cap ? 0xffc72c : 0xffffff;
      // little residents wandering around each coop
      const want = Math.min(6, Math.ceil(n / Math.max(4, cap / 6)));
      while (p.residents.length < want) {
        const s = this.bird(); s.home = p; s.tx = p.x + rnd(-90, 90); s.ty = p.y + rnd(10, 60); s.position.set(s.tx, s.ty); s.wait = rnd(0, 2);
        this.layer.runners.addChild(s); p.residents.push(s);
      }
      while (p.residents.length > want) p.residents.pop().destroy();
    });
  }

  bird(scale = 1) {
    const s = new PIXI.Sprite(this.tex[`${this.team}_idle`]);
    s.anchor.set(0.5, 0.95);
    s.base = (38 / s.texture.height) * scale; s.scale.set(s.base);
    return s;
  }

  /** Chicks run from the hatchery to the coops. */
  hatchRun(n, fast = false) {
    this.queue += n;
    this.fast = fast;
  }

  spawnRunner() {
    const targets = this.plots.filter((p) => p.level);
    if (!targets.length) return;
    const p = targets[Math.floor(Math.random() * targets.length)];
    const s = this.bird(0.9);
    s.position.set(HATCHERY.x + rnd(-20, 20), HATCHERY.y + 10);
    s.tx = p.x + rnd(-30, 30); s.ty = p.y + rnd(20, 45);
    s.speed = rnd(240, 320) * (this.fast ? 1.4 : 1); s.t = Math.random();
    this.layer.runners.addChild(s); this.runners.push(s);
  }

  stampede(n) {
    this.word(this.team === 'turkey' ? 'word_gobble' : 'word_bok', HATCHERY.x, HATCHERY.y - 140, 1.1);
    this.burst(HATCHERY.x, HATCHERY.y - 30, 'feathers', 1.2);
    this.hatchRun(Math.min(n, 60), true);
    this.shake = 14;
  }

  // ---------- balloons + fox ----------
  spawnBalloon() {
    const gold = Math.random() < 0.3;
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const col = gold ? 0xffc72c : [0xff5a3c, 0x2c7cf0, 0x7b2ff7, 0x3dab2b][Math.floor(Math.random() * 4)];
    g.lineStyle(3, 0x111111).moveTo(0, 30).lineTo(0, 78);
    g.lineStyle(5, 0x111111).beginFill(col).drawEllipse(0, 0, 36, 44).endFill();
    g.beginFill(0xffffff, 0.5).drawEllipse(-12, -16, 8, 13).endFill();
    const cargo = new PIXI.Sprite(this.tex[gold ? 'fm_goldegg' : 'fm_bag']); cargo.anchor.set(0.5, 0); cargo.position.set(0, 74); cargo.scale.set(54 / cargo.texture.height);
    c.addChild(g, cargo);
    const fromLeft = Math.random() < 0.5;
    c.position.set(fromLeft ? -80 : MAP_W + 80, rnd(160, 800));
    c.vx = (fromLeft ? 1 : -1) * rnd(55, 85); c.phase = Math.random() * 6; c.gold = gold;
    c.eventMode = 'static'; c.cursor = 'pointer';
    c.hitArea = new PIXI.Circle(0, 20, 80);
    c.on('pointerdown', (e) => { e.stopPropagation(); this.popBalloon(c); });
    this.layer.sky.addChild(c); this.balloons.push(c);
  }

  popBalloon(c) {
    if (c.popped) return; c.popped = true;
    this.burst(c.x, c.y, 'sparkle', 1);
    this.balloons = this.balloons.filter((b) => b !== c); c.destroy({ children: true });
    this.onBalloon(c.gold ? 'gold' : 'cash', c.x, c.y);
  }

  spawnFox() {
    const targets = this.plots.filter((p) => p.level);
    if (!targets.length || this.fox) return;
    const p = targets[Math.floor(Math.random() * targets.length)];
    const s = new PIXI.Sprite(this.tex.fox); s.anchor.set(0.5, 0.9);
    const fromLeft = p.x > MAP_W / 2 ? false : true;
    s.position.set(fromLeft ? -60 : MAP_W + 60, p.y + rnd(-40, 40));
    s.scale.set((120 / s.texture.width) * (fromLeft ? 1 : -1), 120 / s.texture.width);
    s.target = p; s.hits = 0; s.eventMode = 'static'; s.cursor = 'pointer'; s.hitArea = new PIXI.Circle(0, -30, 90);
    s.on('pointerdown', (e) => { e.stopPropagation(); this.hitFox(); });
    const warn = this.label('🦊 TAP THE FOX!', MAP_W / 2, 90, 40, 0xff5a3c);
    this.fox = { s, warn, fromLeft, t: 0, hits: 0 };
    this.layer.fx.addChild(s);
  }

  hitFox() {
    const f = this.fox; if (!f || f.done) return;
    f.hits += 1; f.s.hits = f.hits;
    this.burst(f.s.x, f.s.y - 40, 'puff', 0.5);
    if (f.hits >= 3) { f.done = 'chased'; f.warn.text = 'CHASED AWAY! 👏'; this.onFox(false); }
  }

  // ---------- loop ----------
  tick(dt) {
    this.time += dt;
    if (this.paused) return;
    // runners
    this.spawnT = (this.spawnT || 0) - dt;
    while (this.queue > 0 && this.spawnT <= 0 && this.runners.length < 90) {
      this.spawnRunner(); this.queue -= 1; this.spawnT += this.fast ? 0.02 : 0.08;
    }
    if (this.queue <= 0) this.fast = false;
    if (this.spawnT < 0) this.spawnT = 0;
    this.runners = this.runners.filter((s) => {
      const dx = s.tx - s.x; const dy = s.ty - s.y; const d = Math.hypot(dx, dy);
      if (d < 8) { s.destroy(); return false; }
      const v = Math.min(d, s.speed * dt);
      s.x += (dx / d) * v; s.y += (dy / d) * v; s.zIndex = s.y;
      s.t += dt * 14;
      s.texture = this.tex[`${this.team}_${Math.floor(s.t) % 2 ? 'run' : 'idle'}`];
      s.scale.set(s.base * (dx < 0 ? -1 : 1), s.base * (1 - Math.abs(Math.sin(s.t)) * 0.08));
      s.pivot.y = Math.abs(Math.sin(s.t)) * 14;
      return true;
    });
    // residents wander
    for (const p of this.plots) for (const s of p.residents) {
      s.wait -= dt;
      if (s.wait <= 0) { s.tx = p.x + rnd(-100, 100); s.ty = p.y + rnd(5, 70); s.wait = rnd(1.5, 4); }
      const dx = s.tx - s.x; const dy = s.ty - s.y; const d = Math.hypot(dx, dy);
      if (d > 3) { const v = Math.min(d, 40 * dt); s.x += (dx / d) * v; s.y += (dy / d) * v; s.pivot.y = Math.abs(Math.sin(this.time * 10 + s.ty)) * 6; s.scale.x = s.base * (dx < 0 ? -1 : 1); } else s.pivot.y = 0;
      s.zIndex = s.y;
    }
    // trucks
    for (const tr of this.trucks) {
      if (!tr.spr) {
        tr.spr = new PIXI.Sprite(this.tex.fm_van); tr.spr.anchor.set(0.5, 0.8); this.layer.road.addChild(tr.spr);
      }
      const lv = tr.level || 1; const info = TRUCK_LV[lv];
      if (tr.spr.texture !== this.tex[info.sprite]) tr.spr.texture = this.tex[info.sprite];
      const w = [0, 120, 150, 190, 205][lv];
      tr.spr.scale.set(w / tr.spr.texture.width); tr.spr.tint = lv === 4 ? 0xffd34d : 0xffffff;
      if (tr.wait > 0) { tr.wait -= dt; tr.spr.visible = false; continue; }
      tr.spr.visible = true;
      tr.x += dt * (150 + lv * 25);
      tr.spr.position.set(tr.x, roadY(tr.x) + Math.sin(this.time * 20) * 1.5);
      if (tr.x > MAP_W + 150) { tr.x = -150; tr.wait = rnd(0.5, 2.5); }
    }
    // balloons
    this.nextBalloon -= dt;
    if (this.nextBalloon <= 0) { this.nextBalloon = rnd(12, 20); this.spawnBalloon(); }
    this.balloons = this.balloons.filter((c) => {
      c.x += c.vx * dt; c.y += Math.sin(this.time * 1.6 + c.phase) * 12 * dt; c.rotation = Math.sin(this.time * 2 + c.phase) * 0.08;
      if (c.x < -150 || c.x > MAP_W + 150) { c.destroy({ children: true }); return false; }
      return true;
    });
    // fox
    this.nextFox -= dt;
    if (this.nextFox <= 0) { this.nextFox = rnd(50, 80); this.spawnFox(); }
    if (this.fox) {
      const f = this.fox; f.t += dt; const s = f.s;
      if (f.done === 'chased' || f.done === 'ate') {
        s.x += (f.fromLeft ? -1 : 1) * 420 * dt; s.scale.x = Math.abs(s.scale.x) * (f.fromLeft ? -1 : 1);
        if (s.x < -150 || s.x > MAP_W + 150 || f.t > 12) { s.destroy(); f.warn.destroy(); this.fox = null; }
      } else {
        const dx = f.s.target.x - s.x; const dy = f.s.target.y + 30 - s.y; const d = Math.hypot(dx, dy);
        const v = 70 * dt; if (d > 10) { s.x += (dx / d) * v; s.y += (dy / d) * v; }
        s.pivot.y = Math.abs(Math.sin(this.time * 12)) * 8;
        f.warn.alpha = 0.6 + 0.4 * Math.sin(this.time * 10);
        if (d <= 12) { f.done = 'ate'; f.warn.text = 'THE FOX GOT SOME CHICKENS! 😱'; this.burst(s.x, s.y - 30, 'feathers', 1.3); this.onFox(true); }
      }
    }
    // fx
    this.fx = this.fx.filter((s) => {
      s.life -= dt; if (s.life <= 0) { s.destroy(); return false; }
      const k = 1 - s.life / s.maxLife;
      if (s.isWord) { const pop = k < 0.2 ? (k / 0.2) * 1.2 : 1.2 - Math.min(0.2, (k - 0.2)); s.scale.set(s.base * pop); s.alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; s.y -= dt * 20; } else if (s.isText) { s.y -= dt * 70; s.alpha = 1 - k; } else { s.scale.set(s.base * (0.6 + k)); s.alpha = 1 - k; }
      return true;
    });
    // hatchery pulse + shake
    const pulse = this.queue > 0 ? 1 + Math.sin(this.time * 30) * 0.05 : 1;
    this.hatchery.scale.set((110 / this.hatchery.texture.width) * pulse);
    if (this.shake > 0.3) { this.world.pivot.set(rnd(-this.shake, this.shake), rnd(-this.shake, this.shake)); this.shake *= 0.85; } else this.world.pivot.set(0, 0);
  }

  burst(x, y, name, scale = 1) {
    const s = new PIXI.Sprite(this.tex[name]); s.anchor.set(0.5); s.position.set(x, y);
    s.base = scale * (160 / s.texture.width); s.maxLife = 0.6; s.life = 0.6;
    this.layer.fx.addChild(s); this.fx.push(s);
  }
  word(name, x, y, scale = 0.9) {
    const s = new PIXI.Sprite(this.tex[name]); s.anchor.set(0.5); s.position.set(x, y);
    s.base = scale * (260 / s.texture.width); s.scale.set(0.01); s.maxLife = 1.3; s.life = 1.3; s.isWord = true;
    this.layer.fx.addChild(s); this.fx.push(s);
  }
  floatText(text, x, y, color = 0xffc72c) {
    const t = new PIXI.Text(text, { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 46, fill: color, stroke: 0x111111, strokeThickness: 7 });
    t.anchor.set(0.5); t.position.set(x, y); t.maxLife = 1.2; t.life = 1.2; t.isText = true;
    this.layer.fx.addChild(t); this.fx.push(t);
  }
  destroy() { this.ro?.disconnect(); this.app?.destroy(true, { children: true }); }

  /** Map coords → position inside the scene element (for DOM overlays). */
  toScreen(x, y) { return { x: this.world.x + x * this.scale, y: this.world.y + y * this.scale }; }
  get hatcheryPos() { return HATCHERY; }
}
