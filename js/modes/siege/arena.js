// =========================================================
// COOP SIEGE — host simulation + projector rendering (PixiJS v7)
// The defending team's coop is on the LEFT. Attackers march in
// from the RIGHT along 5 rows. Defenders place shooters, walls,
// traps and bombs on the lawn; attackers buy troops and pick a row.
// =========================================================
/* global PIXI */
import { sprite } from '../../core/assets.js?v=20261010131725';
import { sfx } from '../../core/sfx.js?v=20261010131725';
import {
  ROWS, COLS, W, H, LAWN, LAWN_R, SPAWN_X, cellX, rowY, START_CORN, COOP_HP, CORN_PER_RIGHT,
  DEF, ATT, PTS, defenderFor, other, tc, defArt, attArt, coopArt, mowerArt, SG_ART,
} from './rules.js?v=20261010131725';

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);
const EGG_SPEED = 620;
const MOWER_SPEED = 560;
const COLORS = { chicken: 0x1e6fe0, turkey: 0xe0402a };

export class SiegeArena {
  constructor(el, { onChange, onSync, onWin } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onSync = onSync || (() => {});
    this.onWin = onWin || (() => {});
    this.players = new Map();
    this.bonus = { chicken: 0, turkey: 0 };
    this.grid = new Array(ROWS * COLS).fill(null);
    this.atts = []; this.eggs = []; this.fx = []; this.mowers = [];
    this.running = false; this.paused = false; this.time = 0; this.round = 0;
    this.def = 'chicken';
    this.effects = { golden: 0 };
    this.lastCmd = new Map();
    this.sync = {};
    this.nextId = 1;
    this.stats = { placed: 0, sent: 0, kills: 0, through: 0 };
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.app = new PIXI.Application({ resizeTo: this.el, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
    this.el.appendChild(this.app.view);
    await this.loadTextures();
    this.world = new PIXI.Container(); this.app.stage.addChild(this.world);
    this.layer = {};
    ['bg', 'lawn', 'units', 'fx', 'hud'].forEach((k) => { const c = new PIXI.Container(); this.layer[k] = c; this.world.addChild(c); });
    this.layer.units.sortableChildren = true;
    this.layout();
    this.app.renderer.on('resize', () => this.layout());
    this.app.ticker.add(() => this.render(Math.min(this.app.ticker.deltaMS / 1000, 0.1)));
    // The game runs on its own timer so it keeps going even if the browser slows down drawing.
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(); let dt = Math.min(2, (now - last) / 1000); last = now;
      this.time += dt;
      while (dt > 0) { const step = Math.min(0.05, dt); dt -= step; if (this.running && !this.paused) this.simulate(step); }
    }, 40);
    setInterval(() => this.pushSync(), 500);
  }

  async loadTextures() {
    const names = new Set(['egg_blue', 'egg_red', 'egg', 'impact', 'puff', 'feathers', 'sparkle', 'word_pow', 'word_splat', 'word_blast', 'splat',
      'tw_fx_dust', 'tw_fx_wfeath', 'tw_fx_bfeath', 'tw_fx_splat', 'tw_fx_sparkle', 'tw_map_farm', ...SG_ART]);
    for (const team of ['chicken', 'turkey']) {
      coopArt(team).forEach((n) => names.add(n)); mowerArt(team).forEach((n) => names.add(n));
      for (const k of Object.keys(DEF)) defArt(k, team).forEach((n) => names.add(n));
      for (const k of Object.keys(ATT)) { const a = attArt(k, team); [...a.frames, ...a.old].forEach((n) => names.add(n)); }
    }
    const list = [...names];
    const res = await Promise.allSettled(list.map((n) => PIXI.Assets.load(sprite(n))));
    this.tex = {};
    list.forEach((n, i) => { if (res[i].status === 'fulfilled') this.tex[n] = res[i].value; });
  }
  pick(names) { for (const n of names) if (this.tex[n]) return this.tex[n]; return PIXI.Texture.WHITE; }
  attFrames(k, team) {
    const a = attArt(k, team);
    const fresh = a.frames.map((n) => this.tex[n]).filter(Boolean);
    if (fresh.length) return fresh;
    const old = a.old.map((n) => this.tex[n]).filter(Boolean);
    return old.length ? old : [PIXI.Texture.WHITE];
  }

  layout() {
    const w = this.el.clientWidth; const h = this.el.clientHeight;
    const top = h * 0.17; const bottom = h * 0.09;
    const s = Math.min((w - 20) / W, (h - top - bottom) / H);
    this.scale = s; this.world.scale.set(s);
    this.world.position.set((w - W * s) / 2, top + (h - top - bottom - H * s) / 2);
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; return p; }
    const p = { uid, name, team, bot, score: 0, corn: 0, kills: 0, placed: 0, sent: 0, think: rnd(1, 3), answerT: rnd(2, 5) };
    if (this.round) p.corn = this.roleOf(p) === 'def' ? START_CORN.def : START_CORN.att;
    this.players.set(uid, p);
    return p;
  }
  removePlayer(uid) { this.players.delete(uid); }
  setTeam(uid, team) { const p = this.players.get(uid); if (p) p.team = team; }
  updateTag() {}
  roleOf(p) { return p.team === this.def ? 'def' : 'att'; }
  get att() { return other(this.def); }

  // ---------- rounds ----------
  startRound(round = this.round + 1) {
    this.round = round;
    this.def = defenderFor(round);
    for (const d of this.grid) d?.view?.destroy({ children: true });
    for (const u of this.atts) u.view.destroy({ children: true });
    for (const e of this.eggs) e.s.destroy();
    this.grid = new Array(ROWS * COLS).fill(null);
    this.atts = []; this.eggs = [];
    this.coopHp = COOP_HP;
    this.raided = false;
    this.ambientT = 8; this.roundTime = 0;
    this.effects = { golden: 0 };
    this.lastCmd.clear();
    for (const p of this.players.values()) { p.corn = this.roleOf(p) === 'def' ? START_CORN.def : START_CORN.att; p.kills = 0; p.placed = 0; p.sent = 0; }
    this.buildScene();
    this.sync = {};
    this.pushSync(true);
    // DEFEND! by the coop, ATTACK! on the road
    this.word('sg_defend', 330, H / 2 - 20, 330, 3.2);
    this.word('sg_attack', W - 300, H / 2 - 20, 330, 3.2);
  }
  startBattle() { this.running = true; this.paused = false; }
  stopRound() { this.running = false; }
  resetScores() { for (const p of this.players.values()) { p.score = 0; p.kills = 0; } this.bonus = { chicken: 0, turkey: 0 }; this.round = 0; }
  celebrate() {}
  addEggs() { return 0; }

  buildScene() {
    for (const k of ['bg', 'lawn', 'units', 'fx', 'hud']) this.layer[k].removeChildren().forEach((c) => c.destroy({ children: true }));
    this.fx = [];
    const bg = this.layer.bg;
    // surroundings
    if (this.tex.tw_map_farm) { const m = new PIXI.Sprite(this.tex.tw_map_farm); m.position.set(-40, -40); m.width = W + 80; m.height = H + 80; m.alpha = 0.95; bg.addChild(m); }
    else { const g0 = new PIXI.Graphics(); g0.beginFill(0x4f8f26).drawRoundedRect(-40, -40, W + 80, H + 80, 40).endFill(); bg.addChild(g0); }
    // lawn: checkerboard like a real game board
    const g = new PIXI.Graphics();
    g.beginFill(0x2f5f17, 0.55).drawRoundedRect(LAWN.x - 10, LAWN.y - 10, COLS * LAWN.cw + 20, ROWS * LAWN.ch + 20, 18).endFill();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const light = (r + c) % 2 === 0;
        g.beginFill(light ? 0x8fd14f : 0x76bd3c).drawRect(LAWN.x + c * LAWN.cw, LAWN.y + r * LAWN.ch, LAWN.cw, LAWN.ch).endFill();
      }
    }
    // dirt road where the attackers come in
    g.beginFill(0xb98a4f, 0.92).drawRoundedRect(LAWN_R, LAWN.y - 10, W - LAWN_R + 30, ROWS * LAWN.ch + 20, 18).endFill();
    for (let r = 0; r <= ROWS; r++) g.lineStyle(3, 0x2f5f17, 0.35).moveTo(LAWN.x, LAWN.y + r * LAWN.ch).lineTo(LAWN_R, LAWN.y + r * LAWN.ch);
    g.lineStyle(0);
    this.layer.lawn.addChild(g);
    // row numbers on the road (students pick a row by number)
    for (let r = 0; r < ROWS; r++) {
      const t = new PIXI.Text(String(r + 1), { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 54, fill: 0xffffff, stroke: 0x111111, strokeThickness: 8 });
      t.anchor.set(0.5); t.position.set(W - 26, rowY(r)); t.alpha = 0.9; this.layer.lawn.addChild(t);
    }
    // the defending team's coop
    const coop = new PIXI.Sprite(this.pick(coopArt(this.def)));
    coop.anchor.set(0.5, 0.75); coop.position.set(92, H / 2 + 70); coop.scale.set(180 / coop.texture.width);
    coop.zIndex = -1; this.layer.lawn.addChild(coop);
    const sign = new PIXI.Text(this.def === 'chicken' ? 'CHICKEN COOP' : 'TURKEY BARN', { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 26, fill: 0xffffff, stroke: COLORS[this.def], strokeThickness: 7 });
    sign.anchor.set(0.5); sign.position.set(92, H / 2 + 118); this.layer.lawn.addChild(sign);
    // coop health
    this.hpG = new PIXI.Graphics(); this.hpT = new PIXI.Text('', { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 30, fill: 0xffffff, stroke: 0x111111, strokeThickness: 6 });
    this.hpT.anchor.set(0.5); this.hpT.position.set(92, H / 2 - 112);
    this.layer.hud.addChild(this.hpG, this.hpT);
    // lane tractors (the "lawnmowers")
    this.mowers = [];
    for (let r = 0; r < ROWS; r++) {
      const s = new PIXI.Sprite(this.pick(mowerArt(this.def)));
      s.anchor.set(0.5, 0.85); s.position.set(LAWN.x - 28, rowY(r) + 50); s.scale.set(84 / s.texture.width);
      s.zIndex = rowY(r) * 10 + 1; this.layer.units.addChild(s);
      this.mowers.push({ r, s, state: 'ready', x: LAWN.x - 28 });
    }
  }

  // ---------- commands from phones ----------
  /** inp.q: [{ s: seq, op: 'def', k, r, c } | { s, op: 'att', k, r }] */
  handleInput(uid, inp) {
    if (!this.running || this.paused) return;
    const last = this.lastCmd.get(uid) || 0;
    const q = Object.values(inp?.q || {}).filter((c) => c && c.s > last).sort((x, y) => x.s - y.s);
    for (const c of q) {
      this.lastCmd.set(uid, c.s);
      if (c.op === 'def') this.placeDef(uid, c.k, +c.r, +c.c);
      else if (c.op === 'att') this.sendAtt(uid, c.k, +c.r);
    }
  }

  placeDef(uid, k, r, c) {
    const p = this.players.get(uid); const info = DEF[k];
    if (!p || !info || this.roleOf(p) !== 'def') return false;
    if (!(r >= 0 && r < ROWS && c >= 0 && c < COLS)) return false;
    const i = r * COLS + c;
    if (this.grid[i] || p.corn < info.cost) return false;
    p.corn -= info.cost; p.placed += 1; this.stats.placed += 1;
    const d = { i, k, r, c, hp: info.hp || 1, max: info.hp || 1, owner: uid, team: p.team, cd: rnd(0.2, 0.8), t: 0, fuse: info.fuse || 0 };
    d.view = this.makeDefView(d, p);
    this.grid[i] = d;
    this.burst('tw_fx_dust', cellX(c), rowY(r) + 40, 0.5);
    sfx.click?.();
    this.onChange(p);
    return true;
  }

  sendAtt(uid, k, r) {
    const p = this.players.get(uid); const info = ATT[k];
    if (!p || !info || this.roleOf(p) !== 'att') return false;
    if (!(r >= 0 && r < ROWS) || p.corn < info.cost) return false;
    p.corn -= info.cost; p.sent += 1; this.stats.sent += 1;
    this.spawn(k, r, uid, p.team);
    this.onChange(p);
    return true;
  }

  spawn(k, r, owner, team) {
    const info = ATT[k];
    const u = { id: this.nextId++, k, r, x: SPAWN_X + rnd(-10, 25), hp: info.hp, max: info.hp, owner, team, slow: 0, jumped: false, lastBy: '', ph: Math.random() * 6 };
    u.view = this.makeAttView(u);
    this.atts.push(u);
    return u;
  }

  /** Correct answer → corn. */
  reward(uid, { correct, conf, streak }) {
    const p = this.players.get(uid);
    if (!p) return null;
    if (!correct) return { corn: 0, role: this.roleOf(p) };
    let amt = CORN_PER_RIGHT + (conf === 'sure' ? 10 : 0) + (streak && streak % 3 === 0 ? 25 : 0);
    if (this.effects.golden > 0) amt *= 2;
    p.corn += amt;
    this.onChange(p);
    return { corn: amt, role: this.roleOf(p) };
  }

  // ---------- simulation ----------
  simulate(dt) {
    this.roundTime += dt;
    if (this.effects.golden > 0) this.effects.golden -= dt;
    // a trickle of wild raiders keeps the defenders busy (gets faster as the half goes on)
    // Wild raiders head for rows that have defences but nothing to shoot at, so every egg shooter gets action.
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = Math.max(4, 9 - this.roundTime / 40);
      const busy = (r) => this.atts.some((u) => u.r === r && u.hp > 0);
      const guarded = [...Array(ROWS).keys()].filter((r) => this.grid.some((d) => d && d.r === r && (DEF[d.k].fire || DEF[d.k].trap || DEF[d.k].fuse)) && !busy(r));
      const r = guarded.length && Math.random() < 0.8 ? guarded[Math.floor(Math.random() * guarded.length)] : Math.floor(Math.random() * ROWS);
      this.spawn(Math.random() < 0.15 ? 'h' : 'r', r, '', this.att);
    }
    const lane = (r) => this.atts.filter((u) => u.r === r && u.hp > 0);
    // defences
    for (const d of this.grid) {
      if (!d) continue;
      const info = DEF[d.k];
      if (info.corn) {
        d.t += dt;
        if (d.t >= info.every) {
          d.t = 0; const p = this.players.get(d.owner);
          if (p) { p.corn += info.corn; this.onChange(p); this.floatText(`+${info.corn} 🌽`, cellX(d.c), rowY(d.r) - 40, 0xffd34d, 26); }
        }
      }
      if (info.fire) {
        d.cd -= dt;
        if (d.cd <= 0 && lane(d.r).some((u) => u.x > cellX(d.c) - 20 && u.x < SPAWN_X + 20)) {
          d.cd = info.fire;
          for (let s = 0; s < (info.shots || 1); s++) this.fireEgg(d, s * 46);
          d.kick = 0.15;
          this.burst('tw_fx_dust', cellX(d.c) + 46, rowY(d.r) - 14, 0.18);
        }
      }
      if (info.trap) {
        for (const u of lane(d.r)) {
          if (Math.abs(u.x - cellX(d.c)) >= LAWN.cw * 0.5) continue;
          (d.popped ||= new Set());
          if (!d.popped.has(u.id)) { // first step on it → SPLAT
            d.popped.add(u.id);
            this.hurt(u, info.pop, d.owner); u.slow = Math.max(u.slow || 0, 2.5); d.kick = 0.25;
            this.burst('tw_fx_splat', cellX(d.c), rowY(d.r) + 20, 0.7);
            this.word('word_splat', cellX(d.c), rowY(d.r) - 50, 120, 0.8);
          }
          this.hurt(u, info.trap * dt, d.owner);
        }
      }
      if (info.fuse) {
        // armed mine: waits for an attacker within about a square, then a short fuse
        if (!d.lit && this.atts.some((u) => u.hp > 0 && Math.abs(u.r - d.r) <= 0 && Math.abs(u.x - cellX(d.c)) < LAWN.cw * 1.3)) d.lit = true;
        if (d.lit) { d.fuse -= dt; if (d.fuse <= 0) this.explode(d); }
      }
    }
    // eggs
    for (const e of this.eggs) {
      e.x += EGG_SPEED * dt;
      const hit = this.atts.find((u) => u.r === e.r && u.hp > 0 && Math.abs(u.x - e.x) < 34);
      if (hit) {
        this.hurt(hit, e.dmg, e.owner);
        if (e.slow) hit.slow = e.slow;
        e.dead = true;
        if (Math.random() < 0.5) this.burst('tw_fx_splat', e.x, rowY(e.r) - 10, 0.18);
      } else if (e.x > W + 30) e.dead = true;
    }
    this.eggs = this.eggs.filter((e) => { if (e.dead) { e.s.destroy(); return false; } return true; });
    // attackers
    for (const u of this.atts) {
      if (u.hp <= 0) continue;
      const info = ATT[u.k];
      if (u.slow > 0) u.slow -= dt;
      const f = u.slow > 0 ? 0.5 : 1;
      const front = u.x - 40;
      const block = this.grid.filter((d) => d && d.r === u.r && !DEF[d.k].fuse && !DEF[d.k].trap && Math.abs(cellX(d.c) - front) < 34).sort((a, b) => b.c - a.c)[0];
      u.eating = !!block;
      if (block) {
        if (info.jump && !u.jumped && !DEF[block.k].trap) {
          u.jumped = true; u.x = cellX(block.c) - LAWN.cw * 0.75; u.hop = 0.5;
          this.burst('tw_fx_dust', u.x, rowY(u.r) + 40, 0.5);
        } else {
          const bite = Math.min(block.hp, info.smash ? 99999 : info.bite * f * dt);
          block.hp -= bite;
          if (u.owner && !DEF[block.k].trap) { u.chewed = (u.chewed || 0) + bite; if (u.chewed >= 100) { u.chewed -= 100; const p = this.players.get(u.owner); if (p) p.score += 1; } }
          block.hurt = 0.2;
          if (block.hp <= 0) this.destroyDef(block, u);
        }
      } else {
        const speed = info.jump && u.jumped ? 28 : info.speed;
        u.x -= speed * f * dt;
      }
      // attackers earn points for every few seconds their troops survive on the lawn
      if (u.owner && u.x < LAWN_R) {
        u.alive = (u.alive || 0) + dt;
        if (u.alive >= 3) { u.alive -= 3; const p = this.players.get(u.owner); if (p) { p.score += 1; p.pressure = (p.pressure || 0) + 1; } }
      }
      if (u.x < LAWN.x - 20) this.reachHome(u);
    }
    // lane tractors
    for (const m of this.mowers) {
      if (m.state !== 'go') continue;
      m.x += MOWER_SPEED * dt; m.s.x = m.x;
      for (const u of this.atts) if (u.r === m.r && u.hp > 0 && u.x < m.x + 50 && u.x > m.x - 70) { u.hp = 0; u.byMower = true; this.burst('tw_fx_dust', u.x, rowY(u.r), 0.6); }
      if (m.x > W + 120) { m.state = 'gone'; m.s.visible = false; }
    }
    // remove the fallen
    this.atts = this.atts.filter((u) => {
      if (u.hp > 0 && !u.gone) return true;
      if (!u.gone) this.killed(u);
      u.view.destroy({ children: true });
      return false;
    });
  }

  fireEgg(d, offset) {
    const info = DEF[d.k];
    const s = new PIXI.Sprite(this.pick([d.team === 'turkey' ? 'egg_red' : 'egg_blue', 'egg']));
    s.anchor.set(0.5); s.scale.set(28 / s.texture.width);
    if (info.slow) s.tint = 0x8fe3ff;
    this.layer.fx.addChild(s);
    this.eggs.push({ r: d.r, x: cellX(d.c) + 34 - offset, dmg: info.dmg, slow: info.slow || 0, owner: d.owner, s });
  }

  hurt(u, dmg, by) {
    if (u.hp <= 0) return;
    u.hp -= dmg; if (by) u.lastBy = by; u.flash = 0.12;
  }

  killed(u) {
    if (u.byMower) return;
    const p = u.owner ? this.players.get(u.lastBy) : null; // wild raiders give no points
    if (p) { p.score += ATT[u.k].pts; p.kills += 1; this.onChange(p); }
    this.stats.kills += 1;
    this.burst(u.team === 'turkey' ? 'tw_fx_bfeath' : 'tw_fx_wfeath', u.x, rowY(u.r) - 10, 0.55);
    if (ATT[u.k].pts >= 40) this.word('word_pow', u.x, rowY(u.r) - 80, 150);
  }

  destroyDef(d, u) {
    this.grid[d.i] = null;
    d.view.destroy({ children: true });
    this.burst('impact', cellX(d.c), rowY(d.r), 0.5);
    const p = this.players.get(u?.owner);
    if (p) { p.score += PTS.defDestroyed(d.k); this.onChange(p); }
    const owner = this.players.get(d.owner); if (owner) this.onChange(owner);
  }

  explode(d) {
    this.grid[d.i] = null;
    d.view.destroy({ children: true });
    const cx = cellX(d.c); const cy = rowY(d.r);
    for (const u of this.atts) if (Math.abs(u.r - d.r) <= 1 && Math.abs(u.x - cx) <= LAWN.cw * 1.5) this.hurt(u, DEF.B.blast, d.owner);
    this.burst('impact', cx, cy, 1.6); this.burst('tw_fx_dust', cx, cy + 20, 1.4);
    this.word('word_blast', cx, cy - 90, 220);
    sfx.splat?.();
  }

  reachHome(u) {
    const m = this.mowers[u.r];
    if (m && m.state === 'ready') {
      m.state = 'go';
      const p = this.players.get(u.owner); if (p) { p.score += PTS.mower; this.onChange(p); }
      this.floatText('TRACTOR!', LAWN.x + 40, rowY(u.r) - 50, 0xffc72c, 34);
      u.hp = 0; u.byMower = true; // the tractor flattens it (and everything else in the row)
      return;
    }
    u.gone = true;
    const dmg = ATT[u.k].coop || 1;
    this.coopHp = Math.max(0, this.coopHp - dmg);
    this.stats.through += 1;
    const p = this.players.get(u.owner); if (p) { p.score += PTS.breakthrough; this.onChange(p); }
    this.burst('impact', 100, H / 2, 1.1);
    this.word(this.tex.sg_breakin ? 'sg_breakin' : 'word_splat', 140, H / 2 - 40, 240);
    this.floatText(p ? `${first(p.name)} broke in!` : 'BREAK IN!', 160, H / 2 - 150, COLORS[this.att], 30);
    sfx.splat?.();
    if (this.coopHp <= 0 && !this.raided) {
      this.raided = true;
      this.bonus[this.att] += PTS.raided;
      this.floatText(`COOP RAIDED! +${PTS.raided}`, W / 2, H / 2, 0xffc72c, 70);
      for (const q of this.players.values()) this.onChange(q);
      setTimeout(() => this.onWin(this.att), 1200);
    }
  }

  teamTotals() {
    const t = { chicken: this.bonus.chicken, turkey: this.bonus.turkey };
    for (const p of this.players.values()) if (t[p.team] != null) t[p.team] += p.score;
    return t;
  }

  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    const tot = this.teamTotals();
    return { score: p.score, corn: Math.floor(p.corn), role: this.roleOf(p), kills: p.kills, tc: Math.floor(tot.chicken), tt: Math.floor(tot.turkey), golden: this.effects.golden > 0 ? 1 : 0, hp: this.coopHp, half: this.round };
  }

  // ---------- events ----------
  startEvent(type, losingTeam) {
    if (type === 'golden') this.effects.golden = 20;
    else if (type === 'double') for (const p of this.players.values()) p.corn += 100;
    else if (type === 'shield') { for (const p of this.players.values()) if (!losingTeam || p.team === losingTeam) p.corn += 150; }
    else if (type === 'storm') {
      for (let i = 0; i < 14; i++) {
        setTimeout(() => {
          if (!this.running) return;
          const r = Math.floor(Math.random() * ROWS); const x = rnd(LAWN.x + 40, LAWN_R + 60);
          this.burst('tw_fx_splat', x, rowY(r), 0.7);
          for (const u of this.atts) if (u.r === r && Math.abs(u.x - x) < 70) this.hurt(u, 120, '');
          for (const d of this.grid) if (d && d.r === r && Math.abs(cellX(d.c) - x) < 70 && !DEF[d.k].trap) { d.hp -= 80; if (d.hp <= 0) this.destroyDef(d, null); }
        }, i * 220);
      }
    }
    for (const p of this.players.values()) this.onChange(p);
  }

  // ---------- bots ----------
  botTick(dt) {
    if (!this.running || this.paused) return;
    for (const p of this.players.values()) {
      if (!p.bot) continue;
      p.answerT -= dt;
      if (p.answerT <= 0) {
        p.answerT = rnd(4, 8);
        const ok = Math.random() < 0.65;
        p.answered = (p.answered || 0) + 1; p.correct = (p.correct || 0) + (ok ? 1 : 0);
        p.streak = ok ? (p.streak || 0) + 1 : 0;
        this.reward(p.uid, { correct: ok, conf: 'think', streak: p.streak });
      }
      p.think -= dt;
      if (p.think > 0) continue;
      p.think = rnd(1.5, 3.5);
      if (this.roleOf(p) === 'def') this.botDefend(p); else this.botAttack(p);
    }
  }
  botDefend(p) {
    const threat = (r) => this.atts.filter((u) => u.r === r).reduce((a, u) => a + u.hp, 0);
    const shooters = (r) => this.grid.filter((d) => d && d.r === r && DEF[d.k].fire).length;
    const rows = [...Array(ROWS).keys()].sort((a, b) => (threat(b) - shooters(b) * 150) - (threat(a) - shooters(a) * 150) || Math.random() - 0.5);
    const free = (r, cols) => cols.filter((c) => !this.grid[r * COLS + c]);
    const mine = this.grid.filter((d) => d && d.owner === p.uid);
    const tryPlace = (k, r, cols) => { const f = free(r, cols); return f.length && p.corn >= DEF[k].cost && this.placeDef(p.uid, k, r, f[0]); };
    const r = rows[0];
    const front = this.atts.filter((u) => u.r === r && u.x < LAWN_R - 100).sort((a, b) => a.x - b.x)[0];
    if (front && threat(r) > 900 && p.corn >= DEF.B.cost && Math.random() < 0.4) { const c = Math.max(0, Math.min(COLS - 1, Math.floor((front.x - LAWN.x) / LAWN.cw))); if (tryPlace('B', r, [c, c - 1, c + 1].filter((x) => x >= 0 && x < COLS))) return; }
    if (!mine.some((d) => d.k === 'C') && p.corn >= 50 && Math.random() < 0.6 && tryPlace('C', pickOne([...Array(ROWS).keys()]), [0, 1])) return;
    if (shooters(r) >= 2 && Math.random() < 0.5 && tryPlace('W', r, [6, 5, 7])) return;
    const k = p.corn >= 200 && Math.random() < 0.3 ? 'D' : p.corn >= 175 && Math.random() < 0.3 ? 'F' : Math.random() < 0.15 ? 'T' : 'S';
    tryPlace(k, r, k === 'T' ? [7, 6, 8] : [1, 2, 3, 0, 4]);
  }
  botAttack(p) {
    if (p.corn < 50 || Math.random() < 0.25) return; // sometimes save up
    const defence = (r) => this.grid.filter((d) => d && d.r === r).reduce((a, d) => a + (DEF[d.k].fire ? 2 : 1), 0);
    const rows = [...Array(ROWS).keys()].sort((a, b) => defence(a) - defence(b) || Math.random() - 0.5);
    const options = Object.keys(ATT).filter((k) => ATT[k].cost <= p.corn);
    const k = options.length > 1 && Math.random() < 0.6 ? options[options.length - 1] : options[0];
    this.sendAtt(p.uid, k, Math.random() < 0.7 ? rows[0] : rows[Math.floor(Math.random() * ROWS)]);
  }

  // ---------- phone sync ----------
  pushSync(force = false) {
    if (!this.round) return;
    const up = {};
    const info = { def: this.def, hp: this.coopHp, max: COOP_HP, half: this.round };
    const infoS = JSON.stringify(info);
    if (force || infoS !== this.sync.info) { this.sync.info = infoS; up['sg/info'] = info; }
    const g = this.grid.map((d) => (d ? `${d.k}|${d.owner}` : '')).join(',');
    if (force || g !== this.sync.g) { this.sync.g = g; up['sg/g'] = g; }
    const u = this.atts.slice(0, 90).map((a) => `${a.id}.${a.r}.${Math.round(a.x)}.${a.k}.${a.owner ? (this.players.get(a.owner)?.bot ? 'b' : a.owner.slice(0, 6)) : ''}`).join(';');
    if (force || u !== this.sync.u) { this.sync.u = u; up['sg/u'] = u; }
    const m = this.mowers.map((x) => (x.state === 'ready' ? 1 : 0)).join('');
    if (force || m !== this.sync.m) { this.sync.m = m; up['sg/m'] = m; }
    if (Object.keys(up).length) this.onSync(up);
  }

  // ---------- views ----------
  nameTag(text, color) {
    return new PIXI.Text(text, { fontFamily: 'Nunito, sans-serif', fontWeight: '900', fontSize: 14, fill: 0xffffff, stroke: color, strokeThickness: 4 });
  }
  makeDefView(d, p) {
    const info = DEF[d.k];
    const v = new PIXI.Container(); v.position.set(cellX(d.c), rowY(d.r) + 54); v.zIndex = rowY(d.r) * 10;
    const s = new PIXI.Sprite(this.pick(defArt(d.k, d.team))); s.anchor.set(0.5, 0.95);
    const size = { S: 108, D: 112, C: 84, W: 104, F: 108, T: 112, B: 74 }[d.k];
    s.scale.set(size / s.texture.width);
    if (!SG_ART.has(`sg_${info.key}_${tc(d.team)}`) && !SG_ART.has(`sg_${info.key}`)) { // older art stand-ins
      if (d.k === 'F') s.tint = 0x9fdcff;
      if (d.k === 'D') s.tint = 0xffe08a;
    }
    const bar = new PIXI.Graphics(); bar.position.set(0, 6);
    const tag = this.nameTag(p ? first(p.name) : '', COLORS[d.team]); tag.anchor.set(0.5, 0); tag.position.set(0, 4);
    v.addChild(s, bar, tag);
    v.spr = s; v.bar = bar; v.baseScale = s.scale.x;
    this.layer.units.addChild(v);
    return v;
  }
  makeAttView(u) {
    const v = new PIXI.Container(); v.zIndex = rowY(u.r) * 10 + 5;
    const frames = this.attFrames(u.k, u.team);
    const s = new PIXI.Sprite(frames[0]); s.anchor.set(0.5, 0.95);
    const size = { r: 74, h: 88, v: 80, b: 120, g: 170 }[u.k];
    // walkers are sized by height (the Hurdler's pole makes it wide); vehicles by width
    s.base = u.k === 'b' || u.k === 'g' ? size / s.texture.width : (size * 0.95) / s.texture.height;
    const fresh = attArt(u.k, u.team).frames.length > 0;
    if (!fresh && u.k === 'h') s.tint = 0xd8d8d8;
    const p = this.players.get(u.owner);
    const tag = this.nameTag(p ? (p.bot ? '🤖' : '') + first(p.name) : '', COLORS[u.team]); tag.anchor.set(0.5, 1);
    const bar = new PIXI.Graphics();
    v.addChild(s, bar, tag);
    v.spr = s; v.bar = bar; v.tag = tag; v.frames = frames; v.fresh = fresh;
    this.layer.units.addChild(v);
    return v;
  }

  // ---------- rendering ----------
  render(dt) {
    if (!this.round || !this.layer) return;
    const t = this.time;
    for (const d of this.grid) {
      if (!d) continue;
      const v = d.view; const info = DEF[d.k];
      if (d.kick > 0) { d.kick -= dt; v.spr.scale.set(v.baseScale * (1 + d.kick * 0.6), v.baseScale * (1 - d.kick * 0.4)); } else v.spr.scale.set(v.baseScale, v.baseScale * (1 + Math.sin(t * 3 + d.i) * 0.02));
      if (info.fuse) { if (d.lit) { v.spr.scale.set(v.baseScale * (1 + (1 - d.fuse / info.fuse) * 0.5)); v.spr.tint = Math.sin(t * 40) > 0 ? 0xff6040 : 0xffffff; } else v.spr.scale.set(v.baseScale * (1 + Math.sin(t * 3 + d.i) * 0.04)); }
      if (d.hurt > 0) { d.hurt -= dt; v.spr.x = Math.sin(t * 60) * 2; } else v.spr.x = 0;
      v.bar.clear();
      if (info.hp && info.hp < 99999 && d.hp < d.max) v.bar.beginFill(0x111111).drawRect(-34, -4, 68, 9).endFill().beginFill(d.hp / d.max > 0.4 ? 0x7ed321 : 0xff5a3c).drawRect(-33, -3, 66 * Math.max(0, d.hp / d.max), 7).endFill();
    }
    for (const u of this.atts) {
      const v = u.view; const s = v.spr;
      const walk = !u.eating;
      if (v.frames.length > 1) s.texture = v.frames[Math.floor(t * (walk ? 8 : 4) + u.ph) % v.frames.length];
      const bob = walk ? Math.abs(Math.sin(t * 9 + u.ph)) * 5 : 0;
      const chomp = u.eating ? Math.sin(t * 14 + u.ph) * 0.12 : 0;
      if (u.hop > 0) u.hop -= dt;
      v.position.set(u.x, rowY(u.r) + 52 - bob - (u.hop > 0 ? Math.sin((u.hop / 0.5) * Math.PI) * 70 : 0));
      s.scale.set(-s.base, s.base); // art faces right → flip to march left
      s.rotation = chomp;
      s.tint = u.flash > 0 ? 0xff9a9a : u.slow > 0 ? 0x8fd8ff : (!v.fresh && u.k === 'h' ? 0xd8d8d8 : 0xffffff);
      if (u.flash > 0) u.flash -= dt;
      const top = -s.height - 6;
      v.tag.y = top - 10;
      v.bar.clear();
      if (u.hp < u.max) v.bar.beginFill(0x111111).drawRect(-30, top - 4, 60, 8).endFill().beginFill(0xff5a3c).drawRect(-29, top - 3, 58 * Math.max(0, u.hp / u.max), 6).endFill();
    }
    for (const e of this.eggs) { e.s.position.set(e.x, rowY(e.r) - 16); e.s.rotation += dt * 14; }
    // coop health bar
    if (this.hpG) {
      const w = 150; const f = this.coopHp / COOP_HP;
      this.hpG.clear().beginFill(0x111111).drawRoundedRect(92 - w / 2 - 4, H / 2 - 90, w + 8, 24, 10).endFill()
        .beginFill(f > 0.5 ? 0x7ed321 : f > 0.25 ? 0xffc72c : 0xff5a3c).drawRoundedRect(92 - w / 2, H / 2 - 86, w * f, 16, 8).endFill();
      this.hpT.text = `🥚 ${this.coopHp} / ${COOP_HP}`;
    }
    this.fx = this.fx.filter((s) => {
      s.life -= dt; if (s.life <= 0) { s.destroy(); return false; }
      const k = 1 - s.life / s.maxLife;
      if (s.isWord) { const pop = k < 0.2 ? (k / 0.2) * 1.2 : 1.2 - Math.min(0.2, k - 0.2); s.scale.set(s.base * pop); s.alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; } else if (s.isText) { s.y -= dt * 40; s.alpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1; } else { s.scale.set(s.base * (0.6 + k)); s.alpha = 1 - k; }
      return true;
    });
  }

  burst(name, x, y, scale = 0.5) {
    const alt = { tw_fx_dust: 'puff', tw_fx_wfeath: 'feathers', tw_fx_bfeath: 'feathers', tw_fx_sparkle: 'sparkle', tw_fx_splat: 'splat' };
    const tx = this.tex[name] || this.tex[alt[name]]; if (!tx) return;
    const s = new PIXI.Sprite(tx); s.anchor.set(0.5); s.position.set(x, y);
    s.base = scale * (160 / s.texture.width); s.maxLife = 0.5; s.life = 0.5;
    this.layer.fx.addChild(s); this.fx.push(s);
  }
  word(name, x, y, width = 180, life = 1.1) {
    if (!this.tex[name]) return;
    const s = new PIXI.Sprite(this.tex[name]); s.anchor.set(0.5); s.position.set(x, y);
    s.base = width / s.texture.width; s.scale.set(0.01); s.maxLife = life; s.life = life; s.isWord = true;
    this.layer.fx.addChild(s); this.fx.push(s);
  }
  floatText(text, x, y, color = 0xffc72c, size = 34) {
    const t = new PIXI.Text(text, { fontFamily: 'Bangers, Impact, sans-serif', fontSize: size, fill: color, stroke: 0x111111, strokeThickness: 6 });
    t.anchor.set(0.5); t.position.set(x, y); t.maxLife = 1.4; t.life = 1.4; t.isText = true;
    this.layer.fx.addChild(t); this.fx.push(t);
  }
  destroy() { this.app?.destroy(true, { children: true }); }
}
