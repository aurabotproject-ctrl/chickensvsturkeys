// =========================================================
// COOP WARS — the student's map on their phone (PixiJS v7).
// Landscape, exactly like the big screen (chickens left, turkeys right).
//   TAP one of your team's buildings = answer a question to add troops there
//   DRAG from one of your team's buildings → to any building = march
//   swipe across one of your team's lines = cut it
// =========================================================
/* global PIXI */
import { MAP_W, MAP_H, KINDS, maxPaths, pathProblem, segmentsCross, distToSeg } from './map.js?v=20261010195237';
import { loadTextures, drawBackground, makeBuilding, updateBuilding, COLORS } from './draw.js?v=20261010195237';

export class TowerView {
  constructor(el, { team, uid, onCommand, onHint, onTap } = {}) {
    this.el = el; this.team = team; this.uid = uid;
    this.onCommand = onCommand || (() => {});
    this.onHint = onHint || (() => {});
    this.onTap = onTap || (() => {});
    this.map = null; this.views = []; this.time = 0;
  }

  async init() {
    this.app = new PIXI.Application({ resizeTo: this.el, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
    this.el.appendChild(this.app.view);
    this.tex = await loadTextures();
    this.world = new PIXI.Container(); this.app.stage.addChild(this.world);
    this.rot = 0; // same orientation as the projector
    this.layer = {};
    ['bg', 'range', 'paths', 'buildings', 'draw'].forEach((k) => { const c = new PIXI.Container(); this.layer[k] = c; this.world.addChild(c); });
    this.layer.buildings.sortableChildren = true;
    this.pathG = new PIXI.Graphics(); this.layer.paths.addChild(this.pathG);
    this.drawG = new PIXI.Graphics(); this.layer.draw.addChild(this.drawG);
    this.ro = new ResizeObserver(() => { this.app.resize(); this.layout(); }); this.ro.observe(this.el);
    this.layout();
    this.app.ticker.add(() => this.tick(this.app.ticker.deltaMS / 1000));
    this.setupInput();
    window.cvtTw = this; // handy for debugging
    if (this.pending) this.setStatic(this.pending);
  }

  layout() {
    // same landscape map as the big screen, with a little of the painted border showing
    const w = this.el.clientWidth; const h = this.el.clientHeight;
    const PW = MAP_W + 60; const PH = MAP_H + 40;
    const s = Math.min(w / PW, h / PH);
    this.scale = s; this.world.scale.set(s);
    this.big = Math.max(1, Math.min(1.5, 0.55 / s)); // small screens: draw buildings bigger so they're easy to tap
    if (this.views) this.views.forEach((v) => { v.last.key = ''; });
    this.world.position.set((w - MAP_W * s) / 2, (h - MAP_H * s) / 2);
  }

  setStatic(st) {
    if (!this.tex) { this.pending = st; return; }
    this.pending = null;
    const b = (st.b || []).map(([x, y, k], i) => ({ i, x, y, k, team: null, owner: '', lv: 0, paths: [] }));
    this.map = { b, walls: st.walls || [], seed: st.seed || 1 };
    for (const k of ['bg', 'range', 'buildings']) this.layer[k].removeChildren().forEach((c) => c.destroy({ children: true }));
    this.layer.bg.addChild(drawBackground(this.tex, this.map.seed, b, this.map.walls, this.rot));
    this.views = b.map((bb) => {
      const v = makeBuilding(this.tex, bb, { counterRotate: -this.rot });
      v.root.zIndex = bb.y;
      this.layer.buildings.addChild(v.root);
      this.layer.range.addChild(v.range); v.range.position.set(bb.x, bb.y);
      return v;
    });
    if (this.lastOwn) this.setOwn(this.lastOwn);
    if (this.lastLv) this.setLevels(this.lastLv);
    if (this.lastPaths != null) this.setPaths(this.lastPaths);
  }
  setOwn(arr) {
    this.lastOwn = arr; if (!this.map) return;
    (arr || []).forEach((s, i) => {
      const b = this.map.b[i]; if (!b) return;
      const [t, owner] = String(s).split('|');
      b.team = t === 'c' ? 'chicken' : t === 't' ? 'turkey' : null; b.owner = owner || '';
    });
  }
  setLevels(str) {
    this.lastLv = str; if (!this.map) return;
    String(str || '').split(',').forEach((v, i) => { if (this.map.b[i]) this.map.b[i].lv = +v || 0; });
  }
  setPaths(str) {
    this.lastPaths = str; if (!this.map) return;
    for (const b of this.map.b) b.paths = [];
    String(str || '').split(',').filter(Boolean).forEach((p) => { const [a, t] = p.split('>').map(Number); this.map.b[a]?.paths.push(t); });
  }

  mine() { return this.map ? this.map.b.filter((b) => b.team === this.team && b.k !== 'gold') : []; }

  // ---------- input ----------
  setupInput() {
    const st = this.app.stage; st.eventMode = 'static'; st.hitArea = new PIXI.Rectangle(0, 0, 5000, 5000);
    const at = (e) => this.world.toLocal(e.global);
    const near = (p, own) => {
      let best = null; let bd = 1e9;
      for (const b of this.map.b) {
        if (own && (b.team !== this.team || b.k === 'gold')) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < Math.max(80, KINDS[b.k].r * (this.big || 1) + 36) && d < bd) { bd = d; best = b; }
      }
      return best;
    };
    st.on('pointerdown', (e) => {
      if (!this.map) return;
      const p = at(e);
      const own = near(p, true);
      this.drag = own ? { mode: 'send', from: own, cur: p, sx: e.global.x, sy: e.global.y, t0: performance.now(), moved: false } : { mode: 'cut', start: p, cur: p };
    });
    st.on('pointermove', (e) => {
      const d = this.drag; if (!d) return;
      d.cur = at(e);
      if (d.mode === 'send' && Math.hypot(e.global.x - d.sx, e.global.y - d.sy) > 14) d.moved = true;
    });
    const end = (e) => {
      const d = this.drag; this.drag = null;
      if (!d || !this.map) return;
      const p = e ? at(e) : d.cur;
      if (d.mode === 'send') {
        // quick tap (finger didn't move) = answer a question for this building
        if (!d.moved) { this.tapFlash = { b: d.from, t: 0.35 }; this.onTap(d.from); return; }
        const to = near(p, false);
        if (!to || to === d.from) {
          this.onHint('Drag from one of your team\'s buildings and let go on the building you want to attack, help or collect.');
          return;
        }
        const prob = pathProblem(this.map, d.from.i, to.i, this.team);
        if (prob) { this.onHint(prob, true); return; }
        if (d.from.paths.includes(to.i)) return;
        d.from.paths.push(to.i); // optimistic
        this.onCommand({ op: 'path', a: d.from.i, b: to.i });
      } else {
        const swipe = [d.start.x, d.start.y, p.x, p.y];
        if (Math.hypot(p.x - d.start.x, p.y - d.start.y) < 30) {
          const tapped = near(p, false);
          if (tapped && tapped.k !== 'gold') this.onHint('That isn\'t your team\'s building. Tap one of YOUR TEAM\'s buildings to answer for troops, or drag from it to march.', true);
          return;
        }
        let cut = 0;
        for (const b of this.mine()) {
          for (const ti of [...b.paths]) {
            const t = this.map.b[ti];
            if (segmentsCross(swipe, [b.x, b.y, t.x, t.y])) { b.paths = b.paths.filter((x) => x !== ti); this.onCommand({ op: 'cut', a: b.i, b: ti }); cut++; }
          }
        }
        if (cut) this.cutFlash = { seg: swipe, t: 0.4 };
      }
    };
    st.on('pointerup', end); st.on('pointerupoutside', end);
  }

  // ---------- drawing ----------
  tick(dt) {
    this.time += dt;
    if (!this.map) return;
    const m = this.map;
    m.b.forEach((b, i) => updateBuilding(this.tex, this.views[i], b, { mine: b.team === this.team && b.k !== 'gold', name: b.owner === this.uid ? 'YOU' : '', time: this.time, big: this.big, soft: true }));
    const g = this.pathG; g.clear();
    for (const b of m.b) {
      for (const ti of b.paths) {
        const t = m.b[ti]; if (!t) continue;
        const mine = b.team === this.team;
        g.lineStyle(mine ? 22 : 14, COLORS[b.team], mine ? 0.55 : 0.32).moveTo(b.x, b.y).lineTo(t.x, t.y);
        const len = Math.hypot(t.x - b.x, t.y - b.y); const ux = (t.x - b.x) / len; const uy = (t.y - b.y) / len;
        const off = (this.time * 90) % 28; g.lineStyle(0);
        for (let d = 34 + off; d < len - 34; d += 28) g.beginFill(b.team === 'turkey' ? 0xa8201a : 0x0f4fae, 0.85).drawCircle(b.x + ux * d, b.y + uy * d, mine ? 6 : 4).endFill();
      }
    }
    const dg = this.drawG; dg.clear();
    const d = this.drag;
    if (d && d.mode === 'send') {
      const ok = maxPaths(d.from) > d.from.paths.length;
      dg.lineStyle(16, ok ? 0xffc72c : 0xff5a3c, 0.85).moveTo(d.from.x, d.from.y).lineTo(d.cur.x, d.cur.y);
      dg.lineStyle(0).beginFill(ok ? 0xffc72c : 0xff5a3c).drawCircle(d.cur.x, d.cur.y, 16).endFill();
    } else if (d && d.mode === 'cut') {
      dg.lineStyle(8, 0xffffff, 0.9).moveTo(d.start.x, d.start.y).lineTo(d.cur.x, d.cur.y);
    }
    if (this.tapFlash) {
      this.tapFlash.t -= dt; const b = this.tapFlash.b; const k = 1 - this.tapFlash.t / 0.35;
      dg.lineStyle(6, 0xffc72c, Math.max(0, 1 - k)).drawCircle(b.x, b.y - 10, (50 + k * 50) * (this.big || 1));
      if (this.tapFlash.t <= 0) this.tapFlash = null;
    }
    if (this.cutFlash) {
      this.cutFlash.t -= dt; const s = this.cutFlash.seg;
      dg.lineStyle(10, 0xff5a3c, Math.max(0, this.cutFlash.t / 0.4)).moveTo(s[0], s[1]).lineTo(s[2], s[3]);
      if (this.cutFlash.t <= 0) this.cutFlash = null;
    }
  }

  destroy() { this.ro?.disconnect(); this.app?.destroy(true, { children: true }); }
}

export { distToSeg };
