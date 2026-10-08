// =========================================================
// COOP WARS — host simulation + projector rendering (PixiJS v7)
// Tower-war style: draw lines from your coops to march chickens /
// turkeys. Troops lower enemy & neutral levels (0 = captured!) and
// raise friendly ones. Right answers add troops to your coops.
// =========================================================
/* global PIXI */
import { MAP_W, MAP_H, KINDS, generateMap, maxPaths, pathProblem, tier } from './map.js';
import { loadTextures, drawBackground, makeBuilding, updateBuilding, rangeOf, guardsSelf, COLORS } from './draw.js';
import { sfx } from '../../core/sfx.js';

const SPEED = 95;            // troop speed (map px / s)
const SEND_EVERY = 0.55;     // seconds between troops on each path
const GROW_EVERY = 1.8;      // passive growth interval (slow mode)
const rnd = (a, b) => a + Math.random() * (b - a);
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);

export class TowerArena {
  constructor(el, { onChange, onSync, onWin, growth = 'auto' } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onSync = onSync || (() => {});
    this.onWin = onWin || (() => {});
    this.growthSetting = growth;
    this.players = new Map();
    this.map = null; this.troops = []; this.fx = []; this.views = [];
    this.running = false; this.paused = false; this.time = 0;
    this.effects = { golden: 0, shield: { chicken: 0, turkey: 0 }, storm: 0, stormT: 0 };
    this.lastCmd = new Map();
    this.stats = { spawn: 0, arrive: 0, shot: 0, clash: 0 };
    this.sync = { own: '', lv: '', paths: '' };
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.app = new PIXI.Application({ resizeTo: this.el, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
    this.el.appendChild(this.app.view);
    this.tex = await loadTextures();
    this.world = new PIXI.Container(); this.app.stage.addChild(this.world);
    this.layer = {};
    ['bg', 'range', 'paths', 'buildings', 'troops', 'fx'].forEach((k) => { const c = new PIXI.Container(); this.layer[k] = c; this.world.addChild(c); });
    this.layer.buildings.sortableChildren = true;
    this.pathG = new PIXI.Graphics(); this.layer.paths.addChild(this.pathG);
    this.layout();
    this.app.renderer.on('resize', () => this.layout());
    this.app.ticker.add(() => this.render(Math.min(this.app.ticker.deltaMS / 1000, 0.1)));
    // The game runs on its own timer so it keeps going even if the browser slows down drawing.
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(); let dt = Math.min(2, (now - last) / 1000); last = now;
      this.time += dt;
      while (dt > 0) { const step = Math.min(0.05, dt); dt -= step; if (this.map && this.running && !this.paused) this.simulate(step); }
    }, 40);
    setInterval(() => this.pushSync(), 500);
  }

  layout() {
    const w = this.el.clientWidth; const h = this.el.clientHeight;
    const top = h * 0.17; const bottom = h * 0.09;
    const s = Math.min((w - 20) / (MAP_W + 150), (h - top - bottom) / (MAP_H + 70));
    this.scale = s; this.world.scale.set(s);
    this.world.position.set((w - MAP_W * s) / 2, top + (h - top - bottom - MAP_H * s) / 2);
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; return p; }
    const p = { uid, name, team, bot, score: 0, captures: 0, damage: 0, think: rnd(1, 3), answerT: rnd(2, 5) };
    this.players.set(uid, p);
    if (this.map && this.running) this.giveStart(p);
    return p;
  }
  removePlayer(uid) { this.players.delete(uid); }
  setTeam(uid, team) { const p = this.players.get(uid); if (p) p.team = team; }

  /** Late joiner: hand them the nearest neutral coop on their side. */
  giveStart(p) {
    if (!this.map || this.map.b.some((b) => b.owner === p.uid)) return;
    const homeX = p.team === 'chicken' ? 0 : MAP_W;
    const free = this.map.b.filter((b) => !b.team && b.k === 'coop').sort((a, b) => Math.abs(a.x - homeX) - Math.abs(b.x - homeX));
    const own = this.map.b.filter((b) => b.team === p.team && !b.owner);
    const pick = own[0] || free[0];
    if (pick) { pick.team = p.team; pick.owner = p.uid; pick.lv = Math.max(pick.lv, 10); pick.paths = []; }
  }

  growthOn() {
    if (this.growthSetting === 'slow') return true;
    if (this.growthSetting === 'questions') return false;
    return [...this.players.values()].filter((p) => !p.bot).length <= 4;
  }

  // ---------- rounds ----------
  startRound() {
    const teams = { chicken: [], turkey: [] };
    for (const p of this.players.values()) if (teams[p.team]) teams[p.team].push(p);
    const n = Math.max(teams.chicken.length, teams.turkey.length, 1);
    const m = generateMap(n);
    m.b.forEach((b, i) => { b.i = i; b.owner = ''; b.paths = []; b.cd = rnd(0, SEND_EVERY); b.fireCd = rnd(0.5, 1.5); b.growT = rnd(0, GROW_EVERY); });
    for (const team of ['chicken', 'turkey']) {
      m.startIdx[team].forEach((idx, k) => {
        const p = teams[team][k];
        if (p) m.b[idx].owner = p.uid;
        else { m.b[idx].team = null; m.b[idx].lv = 8; } // unused start → neutral
      });
    }
    for (const p of this.players.values()) { p.score = 0; p.captures = 0; p.damage = 0; }
    this.map = m; this.troops.forEach((t) => t.s.destroy()); this.troops = [];
    this.effects = { golden: 0, shield: { chicken: 0, turkey: 0 }, storm: 0, stormT: 0 };
    this.lastCmd.clear();
    this.buildScene();
    this.sync = { own: '', lv: '', paths: '' };
    this.word('tw_conquer', MAP_W / 2, MAP_H / 2 - 150, 640, 2.6);
    this.onSync({ 'tw/static': { b: m.b.map((b) => [b.x, b.y, b.k]), walls: m.walls, seed: m.seed }, 'tw/own': null, 'tw/lv': null, 'tw/p': null });
    this.pushSync(true);
    this.winner = null;
  }
  startBattle() { this.running = true; this.paused = false; }
  stopRound() { this.running = false; }
  resetScores() { for (const p of this.players.values()) { p.score = 0; p.captures = 0; p.damage = 0; } }
  celebrate() {}
  addEggs() { return 0; }

  buildScene() {
    for (const k of ['bg', 'range', 'buildings', 'fx']) this.layer[k].removeChildren().forEach((c) => c.destroy({ children: true }));
    this.layer.bg.addChild(drawBackground(this.tex, this.map.seed, this.map.b, this.map.walls));
    this.views = this.map.b.map((b) => {
      const v = makeBuilding(this.tex, b);
      v.root.zIndex = b.y;
      this.layer.buildings.addChild(v.root);
      this.layer.range.addChild(v.range); v.range.position.set(b.x, b.y);
      return v;
    });
  }

  // ---------- commands from phones ----------
  /** inp: { q: [{s: seq, op: 'path'|'cut', a, b}] } */
  handleInput(uid, inp) {
    if (!this.map || !this.running || this.paused) return;
    const last = this.lastCmd.get(uid) || 0;
    const q = Object.values(inp?.q || {}).filter((c) => c && c.s > last).sort((x, y) => x.s - y.s);
    for (const c of q) {
      this.lastCmd.set(uid, c.s);
      if (c.op === 'path') this.addPath(uid, +c.a, +c.b);
      else if (c.op === 'cut') this.cutPath(uid, +c.a, +c.b);
    }
  }

  addPath(uid, from, to) {
    const m = this.map;
    if (pathProblem(m, from, to, uid)) return false;
    const a = m.b[from];
    if (a.paths.includes(to)) return false;
    a.paths.push(to);
    // drawing towards a building that already sends to you replaces its old line? no — both run (classic tower war)
    return true;
  }
  cutPath(uid, from, to) {
    const a = this.map.b[from];
    if (!a || a.owner !== uid) return false;
    a.paths = a.paths.filter((t) => t !== to);
    return true;
  }

  /** Correct answer → troops for every building this player owns. */
  reward(uid, { correct, conf, streak }) {
    const p = this.players.get(uid);
    if (!p || !this.map) return null;
    if (!correct) return { troops: 0, buildings: 0 };
    let total = 8 + (conf === 'sure' ? 3 : 0) + (streak && streak % 3 === 0 ? 4 : 0);
    if (this.effects.golden > 0) total *= 2;
    const mine = this.map.b.filter((b) => b.owner === uid && b.k !== 'gold');
    let targets = mine; let helper = false;
    if (!mine.length) { // knocked out → reinforce the team's weakest building
      helper = true;
      targets = this.map.b.filter((b) => b.team === p.team && b.k !== 'gold').sort((a, b) => a.lv - b.lv).slice(0, 1);
    }
    if (!targets.length) return { troops: 0, buildings: 0, helper };
    const each = Math.max(1, Math.ceil(total / targets.length));
    for (const b of targets) {
      b.lv = Math.min(KINDS[b.k].max, b.lv + each);
      this.floatText(`+${each}`, b.x, b.y - 70, COLORS[b.team]);
      this.burst('tw_fx_sparkle', b.x, b.y - 30, 0.35);
    }
    // big "REINFORCEMENTS!" now and then (not every answer, or it would cover the map)
    const now = this.time;
    if (this.tex.tw_reinforce && targets[0] && (!this.lastReinf || now - this.lastReinf > 9)) {
      this.lastReinf = now; this.word('tw_reinforce', targets[0].x, targets[0].y - 120, 190);
    }
    this.onChange(p);
    return { troops: each * targets.length, buildings: targets.length, helper };
  }

  // ---------- simulation ----------
  simulate(dt) {
    const m = this.map; const E = this.effects;
    if (E.golden > 0) E.golden -= dt;
    for (const t of ['chicken', 'turkey']) if (E.shield[t] > 0) E.shield[t] -= dt;
    const grow = this.growthOn();
    for (const b of m.b) {
      const k = KINDS[b.k];
      // passive growth
      if (grow && b.team && k.gen && b.lv < k.max) {
        b.growT -= dt * (b.k === 'fort' ? 3 : 1);
        if (b.growT <= 0) { b.growT += GROW_EVERY; b.lv += 1; }
      }
      // send troops
      if (b.team && k.gen && b.paths.length) {
        b.cd -= dt;
        if (b.cd <= 0) {
          const tractor = b.k === 'shed';
          b.cd += SEND_EVERY * (tractor ? 1.6 : 1);
          b.pathIdx = ((b.pathIdx || 0) + 1) % b.paths.length;
          const value = tractor ? 2 : 1;
          if (b.lv >= value) {
            const to = m.b[b.paths[b.pathIdx]];
            if (to.k === 'gold' && to.lv <= 0) { b.paths = b.paths.filter((x) => x !== to.i); } else {
              b.lv -= value;
              this.spawnTroop(b, to, value, tractor);
            }
          }
        }
      }
      // defences
      const r = rangeOf(b);
      if (r || guardsSelf(b)) {
        b.fireCd -= dt;
        if (b.fireCd <= 0) {
          const target = r
            ? this.troops.find((t) => !t.dead && (b.team ? t.team !== b.team : true) && Math.hypot(t.x - b.x, t.y - b.y) < r)
            : this.troops.find((t) => !t.dead && t.to === b && Math.hypot(t.x - b.x, t.y - b.y) < 110);
          if (target) {
            b.fireCd = r ? Math.max(0.35, 1.3 - b.lv * 0.02) : 2.4;
            this.shoot(b, target);
          } else b.fireCd = 0.2;
        }
      }
    }
    if (E.storm > 0) {
      E.storm -= dt; E.stormT -= dt;
      if (E.stormT <= 0) { E.stormT = 0.25; const t = this.troops[Math.floor(Math.random() * this.troops.length)]; if (t && !t.dead) { t.dead = true; this.burst('impact', t.x, t.y, 0.3); } }
    }
    // move troops
    for (const t of this.troops) {
      if (t.dead) continue;
      t.d += SPEED * (t.tractor ? 0.8 : 1) * dt;
      t.x = t.from.x + t.ux * t.d; t.y = t.from.y + t.uy * t.d;
      if (t.d >= t.len - KINDS[t.to.k].r * 0.6) this.arrive(t);
    }
    this.clash();
    this.troops = this.troops.filter((t) => { if (t.dead) { t.s.destroy(); return false; } return true; });
    this.checkWin();
  }

  spawnTroop(from, to, value, tractor) {
    const dx = to.x - from.x; const dy = to.y - from.y; const len = Math.hypot(dx, dy) || 1;
    const frames = this.troopFrames(from.team, tractor);
    const s = new PIXI.Sprite(frames[0]);
    s.anchor.set(0.5, 0.9);
    const size = tractor ? 44 : 30;
    s.base = size / (tractor ? s.texture.width : s.texture.height);
    s.frames = frames; s.flip = frames.old && tractor ? -1 : 1;
    if (frames.old && tractor) s.tint = from.team === 'chicken' ? 0xbcd6ff : 0xffc4b8;
    this.layer.troops.addChild(s);
    const off = rnd(-6, 6);
    this.stats.spawn += value;
    this.troops.push({ from, to, team: from.team, owner: from.owner, value, tractor, len, ux: dx / len, uy: dy / len, d: KINDS[from.k].r * 0.5, x: from.x, y: from.y, off, s, ph: Math.random() * 6, dead: false });
  }

  /** Walk-cycle frames (new art), or the older sprites as a backup. */
  troopFrames(team, tractor) {
    const key = team + (tractor ? 'T' : '');
    this.frameCache = this.frameCache || {};
    if (this.frameCache[key]) return this.frameCache[key];
    const tx = this.tex; const t = team === 'chicken' ? 'c' : 't';
    let f = tractor ? [tx[`tw_tractor_${t}1`], tx[`tw_tractor_${t}2`]] : [1, 2, 3, 4].map((i) => tx[`tw_${team === 'chicken' ? 'chick' : 'turk'}${i}`]);
    if (f.some((x) => !x)) { f = tractor ? [tx.fm_tractor] : [tx[`${team}_run`]]; f.old = true; }
    this.frameCache[key] = f; return f;
  }

  arrive(t) {
    t.dead = true; this.stats.arrive += t.value;
    const b = t.to; const m = this.map;
    if (b.k === 'gold') {
      if (b.lv > 0) {
        b.lv -= t.value;
        const home = t.from.team === t.team ? t.from : null;
        if (home) home.lv = Math.min(KINDS[home.k].max, home.lv + t.value * 2);
        if (b.lv <= 0) { b.lv = 0; this.burst('tw_fx_sparkle', b.x, b.y, 0.8); for (const x of m.b) x.paths = x.paths.filter((i) => i !== b.i); }
      }
      return;
    }
    if (b.team === t.team) { b.lv = Math.min(KINDS[b.k].max, b.lv + t.value); return; }
    // attack
    let dmg = t.value;
    if (b.team && this.effects.shield[b.team] > 0) dmg = Math.random() < 0.5 ? 0 : dmg;
    const p = this.players.get(t.owner);
    const done = Math.min(dmg, b.lv);
    b.lv -= dmg;
    if (p) { p.damage += done; p.score += done; }
    if (Math.random() < 0.3) this.burst(t.team === 'turkey' ? 'tw_fx_bfeath' : 'tw_fx_wfeath', b.x + rnd(-24, 24), b.y - 24, 0.32);
    if (b.lv <= 0 && dmg > 0) this.capture(b, t, p);
  }

  capture(b, t, p) {
    const prev = b.owner;
    b.team = t.team; b.owner = t.owner || ''; b.lv = Math.max(0, -b.lv); b.paths = [];
    if (p) { p.captures += 1; p.score += 10; }
    this.burst('tw_fx_dust', b.x, b.y - 20, 1);
    this.burst(t.team === 'turkey' ? 'tw_fx_bfeath' : 'tw_fx_wfeath', b.x, b.y - 40, 0.8);
    if (this.tex.tw_captured) this.word('tw_captured', b.x, b.y - 105, 170);
    else this.word(t.team === 'turkey' ? 'word_gobble' : 'word_bok', b.x, b.y - 110);
    if (p) this.floatText(`${first(p.name)} captured it!`, b.x, b.y - 165, COLORS[t.team], 28);
    sfx.splat();
    if (p) this.onChange(p);
    const lost = prev && this.players.get(prev); if (lost) this.onChange(lost);
  }

  shoot(b, t) {
    t.value -= 1; this.stats.shot += 1;
    if (t.value <= 0) t.dead = true;
    const line = new PIXI.Graphics(); line.lineStyle(4, 0xffffff, 0.9).moveTo(b.x, b.y - 50).lineTo(t.x, t.y - 10);
    line.life = 0.15; line.maxLife = 0.15; line.isLine = true; this.layer.fx.addChild(line); this.fx.push(line);
    this.burst('tw_fx_splat', t.x, t.y - 10, 0.22);
  }

  /** Opposing troops that meet cancel each other out. */
  clash() {
    const cell = 40; const grid = new Map();
    for (const t of this.troops) {
      if (t.dead) continue;
      const k = `${Math.floor(t.x / cell)},${Math.floor(t.y / cell)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(t);
    }
    for (const t of this.troops) {
      if (t.dead) continue;
      const cx = Math.floor(t.x / cell); const cy = Math.floor(t.y / cell);
      for (let i = -1; i <= 1 && !t.dead; i++) for (let j = -1; j <= 1 && !t.dead; j++) {
        for (const o of grid.get(`${cx + i},${cy + j}`) || []) {
          if (o.dead || o.team === t.team || Math.hypot(o.x - t.x, o.y - t.y) > 16) continue;
          const v = Math.min(o.value, t.value); this.stats.clash += v * 2;
          o.value -= v; t.value -= v;
          if (o.value <= 0) o.dead = true;
          if (t.value <= 0) t.dead = true;
          if (Math.random() < 0.4) this.burst('feathers', (o.x + t.x) / 2, (o.y + t.y) / 2 - 10, 0.2);
          if (t.dead) break;
        }
      }
    }
  }

  checkWin() {
    if (this.winner) return;
    const tot = this.teamTotals();
    if (tot.chicken === 0 && tot.turkey > 0) this.winner = 'turkey';
    else if (tot.turkey === 0 && tot.chicken > 0) this.winner = 'chicken';
    if (this.winner) this.onWin(this.winner);
  }

  /** Team score = buildings owned (+ tiny tie-breaker for total levels). */
  teamTotals() {
    const t = { chicken: 0, turkey: 0 };
    if (!this.map) return t;
    for (const b of this.map.b) if (b.team && b.k !== 'gold') t[b.team] += 1 + b.lv / 100000;
    return t;
  }

  // ---------- events ----------
  startEvent(type, losingTeam) {
    const m = this.map; if (!m) return;
    const leading = losingTeam === 'chicken' ? 'turkey' : losingTeam === 'turkey' ? 'chicken' : null;
    if (type === 'golden') this.effects.golden = 20;
    else if (type === 'double') for (const b of m.b) { if (b.team && KINDS[b.k].gen) { b.lv = Math.min(KINDS[b.k].max, b.lv + 5); this.floatText('+5', b.x, b.y - 70, COLORS[b.team]); } }
    else if (type === 'shield') { for (const t of ['chicken', 'turkey']) if (!losingTeam || t === losingTeam) this.effects.shield[t] = 10; }
    else if (type === 'storm') this.effects.storm = 8;
    else if (type === 'fox') {
      const list = m.b.filter((b) => b.team === (leading || (Math.random() < 0.5 ? 'chicken' : 'turkey')) && b.k !== 'gold').sort((a, b) => b.lv - a.lv).slice(0, 3);
      for (const b of list) { const l = Math.ceil(b.lv * 0.4); b.lv -= l; this.floatText(`🦊 -${l}`, b.x, b.y - 80, 0xff7a00); this.burst(b.team === 'turkey' ? 'tw_fx_bfeath' : 'tw_fx_wfeath', b.x, b.y - 30, 0.8); }
    }
    for (const p of this.players.values()) this.onChange(p);
  }

  // ---------- bots ----------
  botTick(dt) {
    if (!this.map || !this.running || this.paused) return;
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
      p.think = rnd(2, 4);
      const mine = this.map.b.filter((b) => b.owner === p.uid && KINDS[b.k].gen);
      for (const b of mine) {
        if (b.lv < 4) { b.paths = []; continue; }
        if (b.paths.length >= maxPaths(b)) continue;
        const options = this.map.b.filter((o) => o !== b && !b.paths.includes(o.i) && !pathProblem(this.map, b.i, o.i, p.uid)
          && (o.k === 'gold' ? o.lv > 0 : o.team !== b.team && o.lv < b.lv * 1.2 + 4));
        options.sort((x, y) => Math.hypot(x.x - b.x, x.y - b.y) + x.lv * 8 - Math.hypot(y.x - b.x, y.y - b.y) - y.lv * 8);
        if (options[0]) this.addPath(p.uid, b.i, options[0].i);
      }
    }
  }

  // ---------- phone sync ----------
  pushSync(force = false) {
    if (!this.map) return;
    const m = this.map;
    const own = m.b.map((b) => `${b.team ? b.team[0] : 'n'}${b.owner ? '|' + b.owner : ''}`);
    const lv = m.b.map((b) => Math.max(0, Math.floor(b.lv))).join(',');
    const paths = []; m.b.forEach((b) => b.paths.forEach((t) => paths.push(`${b.i}>${t}`)));
    const up = {};
    const ownS = own.join(';'); if (force || ownS !== this.sync.own) { this.sync.own = ownS; up['tw/own'] = own; }
    if (force || lv !== this.sync.lv) { this.sync.lv = lv; up['tw/lv'] = lv; }
    const pS = paths.join(','); if (force || pS !== this.sync.paths) { this.sync.paths = pS; up['tw/p'] = pS; }
    if (Object.keys(up).length) this.onSync(up);
  }

  stateFor(uid) {
    const p = this.players.get(uid); if (!p || !this.map) return null;
    const mine = this.map.b.filter((b) => b.owner === uid && b.k !== 'gold');
    const tot = this.teamTotals();
    return { score: p.score, captures: p.captures, buildings: mine.length, troops: mine.reduce((a, b) => a + Math.floor(b.lv), 0), tc: Math.floor(tot.chicken), tt: Math.floor(tot.turkey), golden: this.effects.golden > 0 ? 1 : 0 };
  }

  // ---------- rendering ----------
  render(dt) {
    if (!this.map) return;
    const m = this.map;
    const names = new Map([...this.players.values()].map((p) => [p.uid, (p.bot ? '🤖' : '') + first(p.name)]));
    m.b.forEach((b, i) => updateBuilding(this.tex, this.views[i], b, { name: b.owner ? names.get(b.owner) || '' : '', time: this.time }));
    // paths
    const g = this.pathG; g.clear();
    for (const b of m.b) {
      for (const ti of b.paths) {
        const t = m.b[ti]; const col = COLORS[b.team];
        g.lineStyle(14, col, 0.28).moveTo(b.x, b.y).lineTo(t.x, t.y);
        const len = Math.hypot(t.x - b.x, t.y - b.y); const ux = (t.x - b.x) / len; const uy = (t.y - b.y) / len;
        const off = (this.time * 60) % 24;
        g.lineStyle(0);
        for (let d = 30 + off; d < len - 30; d += 24) g.beginFill(b.team === 'turkey' ? 0xa8201a : 0x0f4fae, 0.7).drawCircle(b.x + ux * d, b.y + uy * d, 3.5).endFill();
      }
    }
    // troops
    for (const t of this.troops) {
      const hop = Math.abs(Math.sin(this.time * 14 + t.ph)) * (t.tractor ? 1 : 5);
      t.s.position.set(t.x - t.uy * t.off, t.y + t.ux * t.off - hop);
      const fr = t.s.frames; if (fr.length > 1) t.s.texture = fr[Math.floor(this.time * (t.tractor ? 8 : 10) + t.ph) % fr.length];
      t.s.scale.set(t.s.base * (t.ux < 0 ? -1 : 1) * t.s.flip, t.s.base);
    }
    // fx
    this.fx = this.fx.filter((s) => {
      s.life -= dt; if (s.life <= 0) { s.destroy(); return false; }
      const k = 1 - s.life / s.maxLife;
      if (s.isLine) s.alpha = 1 - k;
      else if (s.isWord) { const pop = k < 0.2 ? (k / 0.2) * 1.2 : 1.2 - Math.min(0.2, k - 0.2); s.scale.set(s.base * pop); s.alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; } else if (s.isText) { s.y -= dt * 40; s.alpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1; } else { s.scale.set(s.base * (0.6 + k)); s.alpha = 1 - k; }
      return true;
    });
    // shields
    if (!this.shieldG) { this.shieldG = new PIXI.Graphics(); this.layer.fx.addChild(this.shieldG); }
    this.shieldG.clear();
    for (const b of m.b) if (b.team && this.effects.shield[b.team] > 0) this.shieldG.lineStyle(4, 0x7fe3ff, 0.9).beginFill(0x7fe3ff, 0.15).drawCircle(b.x, b.y - 20, KINDS[b.k].r + 26).endFill();
  }

  burst(name, x, y, scale = 0.5) {
    const alt = { tw_fx_dust: 'puff', tw_fx_wfeath: 'feathers', tw_fx_bfeath: 'feathers', tw_fx_sparkle: 'sparkle', tw_fx_splat: 'impact' };
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

export { tier };
