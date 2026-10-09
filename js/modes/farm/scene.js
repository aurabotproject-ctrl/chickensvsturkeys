// =========================================================
// EGG FARM — the student's farm on their phone (PixiJS v7).
// Pure presentation: the host decides money, chickens etc.
// The scene shows hatching chicks running to coops, trucks on
// the road, balloons to pop and the occasional sneaky fox.
// =========================================================
/* global PIXI */
import { sprite } from '../../core/assets.js?v=20261009144451';
import { COOP_LV, TRUCK_LV, MACHINE_LV } from './economy.js?v=20261009144451';

const MAP_W = 900; const MAP_H = 1350;
export const PLOTS = [{ x: 330, y: 470 }, { x: 715, y: 610 }, { x: 560, y: 245 }, { x: 470, y: 950 }];
const HATCHERY = { x: 640, y: 440 };
const MACHINE_AT = { x: 215, y: 790 };
const DEPOT = { x: 720, y: 1110 };
const roadY = (x) => 1128 + 0.4 * x;
const rnd = (a, b) => a + Math.random() * (b - a);
// Animated egg machines: empty machine art + eggs moving along belts.
// Paths are fractions of the (empty) sprite: [x0, y0, x1, y1]. 'in' = eggs going in, 'out' = what comes out.
const BELTS = {
  1: { tex: 'fm_conveyor_e', w: 170, out: [0.13, 0.72, 0.79, 0.08], item: 'egg' },
  2: { tex: 'fm_sorter_e', w: 190, out: [0.55, 0.50, 0.94, 0.71], item: 'egg', glow: [0.25, 0.43] },
  3: { tex: 'fm_packer_e', w: 205, in: [0.06, 0.33, 0.30, 0.46], out: [0.58, 0.56, 0.95, 0.75], item: 'carton' },
  4: { tex: 'fm_packer_e', w: 215, in: [0.06, 0.33, 0.30, 0.46], out: [0.58, 0.56, 0.95, 0.75], item: 'carton', gold: true },
};

const SPRITES = ['farm_ground', 'chicken_idle', 'chicken_run', 'turkey_idle', 'turkey_run', 'fm_statue',
  'fm_coop_c1', 'fm_coop_c2', 'fm_coop_c3', 'fm_coop_c4', 'fm_coop_c5', 'fm_coop_t1', 'fm_coop_t2', 'fm_coop_t3', 'fm_coop_t4', 'fm_coop_t5',
  'fm_van', 'fm_truck', 'fm_semi', 'fm_conveyor', 'fm_sorter', 'fm_packer', 'fm_silo', 'fm_trough', 'fm_tractor', 'fm_hopper', 'fm_tower', 'fm_scarecrow',
  'fm_conveyor_e', 'fm_sorter_e', 'fm_packer_e', 'fm_egg1', 'fm_egg_gold1', 'fm_carton',
  'fm_bag', 'fm_goldegg', 'fox', 'egg', 'puff', 'sparkle', 'feathers', 'word_bok', 'word_gobble', 'word_pow'];

export class FarmScene {
  constructor(el, { team, onBalloon, onFox, onTap } = {}) {
    this.el = el; this.team = team || 'chicken';
    this.onBalloon = onBalloon || (() => {});
    this.onFox = onFox || (() => {});
    this.onTap = onTap || (() => {}); // tap a coop / the machine / the trucks
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
    // empty machine spot
    this.machineSpot = new PIXI.Graphics();
    this.machineSpot.lineStyle(5, 0xffffff, 0.75).beginFill(0xffffff, 0.12).drawRoundedRect(MACHINE_AT.x - 85, MACHINE_AT.y - 75, 170, 110, 22).endFill();
    this.layer.ground.addChild(this.machineSpot);
    this.machineSign = this.label('🔨 BUILD\nMACHINE', MACHINE_AT.x, MACHINE_AT.y - 20, 30);
    // truck garage sign by the road
    this.garage = this.label('🚚 TRUCKS', 150, roadY(150) - 70, 34);
    // green "upgrade available" arrows
    this.arrows = {};
    const arrow = (x, y) => { const t = this.label('⬆', x, y, 64, 0x7ed321); t.visible = false; t.baseY = y; return t; };
    this.plots.forEach((p) => { this.arrows[`coop${p.i}`] = arrow(p.x + 95, p.y - 110); });
    this.arrows.machine = arrow(MACHINE_AT.x + 80, MACHINE_AT.y - 110);
    this.arrows.truck = arrow(150 + 110, roadY(150) - 75);
    this.depotSign = this.label('📦 TRUCKS FULL!', DEPOT.x, DEPOT.y - 80, 36, 0xff5a3c); this.depotSign.visible = false;
    this.layout();
    this.app.renderer.on('resize', () => this.layout());
    this.ro = new ResizeObserver(() => { this.app.resize(); this.layout(); }); this.ro.observe(this.el);
    this.app.ticker.add(() => this.tick(Math.min(this.app.ticker.deltaMS / 1000, 0.05)));
    // tapping balloons + fox
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, 4000, 4000);
    window.cvtFarm = this; // handy for debugging
    this.app.stage.on('pointertap', (e) => {
      if (e.target !== this.app.stage) return; // balloons and the fox handle their own taps
      const p = this.world.toLocal(e.global);
      const hit = this.hitTest(p.x, p.y);
      if (hit) { this.tapRing(hit.x, hit.y); this.onTap(hit); }
    });
  }

  /** Which building is at this map point? */
  hitTest(x, y) {
    for (const p of this.plots) if (Math.abs(x - p.x) / 135 + Math.abs(y - (p.y - 40)) / 120 <= 1) return { kind: 'coop', slot: p.i, x: p.x, y: p.y };
    if (Math.abs(x - MACHINE_AT.x) < 110 && y > MACHINE_AT.y - 140 && y < MACHINE_AT.y + 60) return { kind: 'machine', slot: 0, x: MACHINE_AT.x, y: MACHINE_AT.y };
    if (Math.abs(y - (roadY(x) - 20)) < 80 || (Math.abs(x - 150) < 110 && Math.abs(y - (roadY(150) - 70)) < 45)) return { kind: 'truck', slot: 0, x, y: roadY(x) - 20 };
    for (const tr of this.trucks) if (tr.spr?.visible && Math.hypot(x - tr.spr.x, y - tr.spr.y + 30) < 90) return { kind: 'truck', slot: 0, x: tr.spr.x, y: tr.spr.y };
    return null;
  }
  tapRing(x, y) {
    const g = new PIXI.Graphics(); g.position.set(x, y - 30);
    g.lineStyle(8, 0xffc72c, 1).drawCircle(0, 0, 60);
    g.base = 1; g.scale.set(1); g.maxLife = 0.35; g.life = 0.35;
    this.layer.fx.addChild(g); this.fx.push(g);
  }
  /** Show green arrows over things the student can afford to upgrade or build. */
  setAffordable(map) {
    this.afford = map || {};
    for (const [k, t] of Object.entries(this.arrows || {})) t.visible = !!this.afford[k];
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
    const belt = BELTS[st.machine || 0];
    if (this.beltLv !== (st.machine || 0)) { this.beltLv = st.machine || 0; this.beltItems?.forEach((it) => it.s.destroy()); if (this.beltItems) this.beltItems = []; }
    this.belt = belt && this.tex[belt.tex] ? belt : null;
    if (this.belt) { this.machine.texture = this.tex[belt.tex]; this.machine.scale.set(belt.w / this.machine.texture.width); this.machine.tint = belt.gold ? 0xffe9a0 : 0xffffff; }
    else if (m.sprite) { this.machine.texture = this.tex[m.sprite]; this.machine.scale.set(150 / this.machine.texture.width); this.machine.tint = st.machine >= 4 ? 0xffe066 : 0xffffff; }
    if (!this.belt) this.beltItems?.forEach((it) => { it.s.visible = false; });
    this.beltRate = st.rate || 0;
    this.machineLabel.text = m.sprite ? m.name : '';
    this.machineSpot.visible = !m.sprite; this.machineSign.visible = !m.sprite;
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
    this.tickBelt(dt);
    // bobbing upgrade arrows
    for (const t of Object.values(this.arrows || {})) if (t.visible) t.y = t.baseY + Math.sin(this.time * 6) * 8;
    // hatchery pulse + shake
    const pulse = this.queue > 0 ? 1 + Math.sin(this.time * 30) * 0.05 : 1;
    this.hatchery.scale.set((110 / this.hatchery.texture.width) * pulse);
    if (this.shake > 0.3) { this.world.pivot.set(rnd(-this.shake, this.shake), rnd(-this.shake, this.shake)); this.shake *= 0.85; } else this.world.pivot.set(0, 0);
  }

  /** Eggs rolling along the egg machine's belts (faster when the farm earns more). */
  tickBelt(dt) {
    const b = this.belt;
    if (!this.beltLayer) { this.beltLayer = new PIXI.Container(); this.beltLayer.zIndex = MACHINE_AT.y + 1; this.layer.objects.addChild(this.beltLayer); this.beltItems = []; }
    if (!b || !this.machine.visible) { this.beltItems.forEach((it) => it.s.destroy()); this.beltItems = []; return; }
    const m = this.machine; const w = m.width; const h = m.height;
    const at = (fx, fy) => ({ x: MACHINE_AT.x + (fx - 0.5) * w, y: MACHINE_AT.y + (fy - 0.85) * h });
    const speed = Math.min(2.2, 0.8 + Math.log10(1 + (this.beltRate || 0)) * 0.35); // belt speed grows with income
    this.beltT = (this.beltT || 0) - dt * speed;
    if (this.beltT <= 0) {
      this.beltT = 0.55;
      const egg = b.gold ? 'fm_egg_gold1' : 'fm_egg1';
      const add = (path, tex, size, delay = 0) => {
        if (!path || !this.tex[tex]) return;
        const s = new PIXI.Sprite(this.tex[tex]); s.anchor.set(0.5, 0.8); s.scale.set(size / s.texture.width); s.alpha = 0;
        this.beltLayer.addChild(s); this.beltItems.push({ s, path, t: -delay, rot: tex.startsWith('fm_egg') });
      };
      if (b.in) add(b.in, egg, 20);
      this.beltN = (this.beltN || 0) + 1;
      if (b.item === 'carton') { if (this.beltN % 3 === 0) add(b.out, 'fm_carton', 44, 0.6); } else add(b.out, egg, 20, b.in ? 0.6 : 0);
    }
    this.beltItems = this.beltItems.filter((it) => {
      it.t += dt * 0.55 * speed;
      if (it.t >= 1) { it.s.destroy(); return false; }
      if (it.t < 0) { it.s.alpha = 0; return true; }
      const [x0, y0, x1, y1] = it.path; const p = at(x0 + (x1 - x0) * it.t, y0 + (y1 - y0) * it.t);
      it.s.position.set(p.x, p.y);
      it.s.alpha = it.t < 0.12 ? it.t / 0.12 : it.t > 0.88 ? (1 - it.t) / 0.12 : 1; // fade in/out at the belt ends
      if (it.rot) it.s.rotation = Math.sin(it.t * 40) * 0.12; // little wobble as it rides the belt
      return true;
    });
    // the sorter's window glows as eggs pass through
    if (b.glow) {
      if (!this.glow) { this.glow = new PIXI.Graphics(); this.beltLayer.addChild(this.glow); }
      const p = at(b.glow[0], b.glow[1]);
      this.glow.clear().beginFill(0xffd34d, 0.25 + 0.2 * Math.sin(this.time * 6)).drawEllipse(p.x, p.y, w * 0.11, h * 0.12).endFill();
    } else if (this.glow) { this.glow.clear(); }
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
