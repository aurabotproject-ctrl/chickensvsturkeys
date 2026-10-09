// =========================================================
// COOP SIEGE — the student's board (plain DOM, no canvas).
// Tall screens: the lawn stands upright (rows become columns,
// attackers come down from the top, the coop is at the bottom).
// Wide screens: same layout as the big screen.
// =========================================================
import { sprite } from '../../core/assets.js?v=20261009144451';
import { ROWS, COLS, W, LAWN, DEF, ATT, DEF_ORDER, ATT_ORDER, defArt, attArt, coopArt, mowerArt } from './rules.js?v=20261009144451';

const X0 = LAWN.x - 120;          // world x at the coop edge of the board
const SPAN = W - X0;              // world x range shown
const COOP_F = 120 / SPAN;        // fraction of the board that is coop
const LAWN_F = (COLS * LAWN.cw) / SPAN;

/** <img> that tries several sprite names in turn. */
function chainImg(names, cls = '') {
  const img = document.createElement('img');
  img.className = cls; img.alt = ''; img.draggable = false;
  let i = 0;
  img.onerror = () => { i += 1; if (i < names.length) img.src = sprite(names[i]); else img.onerror = null; };
  img.src = sprite(names[0]);
  return img;
}

export class SiegeView {
  constructor(el, { uid, onCommand, onHint } = {}) {
    this.el = el; this.uid = uid;
    this.onCommand = onCommand || (() => {});
    this.onHint = onHint || (() => {});
    this.info = null; this.grid = []; this.units = new Map(); this.mowers = '11111';
    this.team = null; this.role = null; this.corn = 0; this.sel = null;
    this.build();
  }

  build() {
    this.el.innerHTML = `<div class="sg-shop" id="sg-shop"></div>
      <div class="sg-board"><div class="sg-field"></div><div class="sg-units"></div></div>`;
    this.shopEl = this.el.querySelector('.sg-shop');
    this.board = this.el.querySelector('.sg-board');
    this.field = this.el.querySelector('.sg-field');
    this.unitsEl = this.el.querySelector('.sg-units');
    this.shopEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      const info = this.role === 'def' ? DEF[k] : ATT[k];
      this.sel = k; this.drawShop();
      this.onHint(`${info.name} (${info.cost} 🌽): ${info.info} ${this.role === 'def' ? 'Now tap an empty square.' : 'Now tap a row to send it.'}`, info.cost > this.corn ? 'bad' : '');
    });
    this.board.addEventListener('pointerdown', (e) => this.tap(e));
    this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(this.board);
  }

  get vertical() { return this.board.clientHeight > this.board.clientWidth * 0.9; }

  /** world (row, x) → % position on the board */
  pos(r, x) {
    const f = Math.max(0, Math.min(1, (x - X0) / SPAN));
    return this.vertical ? { left: ((r + 0.5) / ROWS) * 100, top: (1 - f) * 100 } : { left: f * 100, top: ((r + 0.5) / ROWS) * 100 };
  }

  setRole({ team, role, corn }) {
    const changed = team !== this.team || role !== this.role;
    this.team = team; this.role = role; this.corn = corn;
    if (changed) { this.sel = role === 'def' ? 'S' : 'r'; this.layout(); }
    this.drawShop();
  }
  setInfo(info) { const changed = info?.def !== this.info?.def; this.info = info; if (changed) this.layout(); }
  setGrid(str) { this.grid = String(str || '').split(','); this.drawGrid(); }
  setMowers(m) { this.mowers = String(m || '11111'); this.drawMowers(); }
  setUnits(str) {
    const seen = new Set();
    for (const tok of String(str || '').split(';').filter(Boolean)) {
      const [id, r, x, k, own] = tok.split('.');
      seen.add(id);
      let u = this.units.get(id);
      if (!u) {
        const team = this.info ? (this.info.def === 'chicken' ? 'turkey' : 'chicken') : 'turkey';
        const a = attArt(k, team);
        const el = document.createElement('div'); el.className = `sg-unit k-${k}`;
        el.appendChild(chainImg([...a.frames, ...a.old]));
        if (own && this.uid && this.uid.startsWith(own)) el.classList.add('mine');
        this.unitsEl.appendChild(el);
        u = { el }; this.units.set(id, u);
        const p = this.pos(+r, +x); el.style.left = `${p.left}%`; el.style.top = `${p.top}%`;
        void el.offsetWidth;
      }
      u.r = +r; u.x = +x;
      const p = this.pos(+r, +x); u.el.style.left = `${p.left}%`; u.el.style.top = `${p.top}%`;
    }
    for (const [id, u] of this.units) if (!seen.has(id)) { u.el.classList.add('gone'); setTimeout(() => u.el.remove(), 300); this.units.delete(id); }
  }

  layout() {
    if (!this.info) return;
    const v = this.vertical;
    this.board.classList.toggle('vertical', v);
    const def = this.info.def;
    this.field.innerHTML = '';
    // coop strip, lawn squares, road
    const coop = document.createElement('div'); coop.className = 'sg-coop';
    coop.appendChild(chainImg(coopArt(def)));
    const road = document.createElement('div'); road.className = 'sg-road';
    if (v) { coop.style.cssText = `left:0;right:0;bottom:0;height:${COOP_F * 100}%`; road.style.cssText = `left:0;right:0;top:0;height:${(1 - COOP_F - LAWN_F) * 100}%`; } else { coop.style.cssText = `top:0;bottom:0;left:0;width:${COOP_F * 100}%`; road.style.cssText = `top:0;bottom:0;right:0;width:${(1 - COOP_F - LAWN_F) * 100}%`; }
    this.field.append(coop, road);
    for (let r = 0; r < ROWS; r++) {
      const n = document.createElement('div'); n.className = 'sg-rownum'; n.textContent = r + 1; n.dataset.r = r;
      const p = this.pos(r, W - 30); n.style.left = `${p.left}%`; n.style.top = `${p.top}%`;
      this.field.appendChild(n);
    }
    this.cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = document.createElement('div');
        d.className = `sg-cell ${(r + c) % 2 ? 'dk' : ''}`; d.dataset.r = r; d.dataset.c = c;
        const a = (COOP_F + (c / COLS) * LAWN_F) * 100; const b = (LAWN_F / COLS) * 100;
        if (v) d.style.cssText = `left:${(r / ROWS) * 100}%;width:${100 / ROWS}%;top:${100 - a - b}%;height:${b}%`;
        else d.style.cssText = `top:${(r / ROWS) * 100}%;height:${100 / ROWS}%;left:${a}%;width:${b}%`;
        this.field.appendChild(d); this.cells.push(d);
      }
    }
    this.mowerEls = [];
    for (let r = 0; r < ROWS; r++) {
      const m = chainImg(mowerArt(def), 'sg-mower');
      const p = this.pos(r, LAWN.x - 30); m.style.left = `${p.left}%`; m.style.top = `${p.top}%`;
      this.field.appendChild(m); this.mowerEls.push(m);
    }
    this.lastGrid = null;
    this.drawGrid(); this.drawMowers();
    for (const u of this.units.values()) { const p = this.pos(u.r, u.x); u.el.style.left = `${p.left}%`; u.el.style.top = `${p.top}%`; }
    this.el.classList.toggle('role-def', this.role === 'def');
    this.el.classList.toggle('role-att', this.role === 'att');
  }

  drawGrid() {
    if (!this.cells || !this.info) return;
    const def = this.info.def;
    const key = this.grid.join(',');
    if (key === this.lastGrid) return;
    this.lastGrid = key;
    this.cells.forEach((cell, i) => {
      const [k, owner] = (this.grid[i] || '').split('|');
      if (cell.dataset.k === (k || '') && cell.dataset.o === (owner || '')) return;
      cell.dataset.k = k || ''; cell.dataset.o = owner || '';
      cell.innerHTML = '';
      cell.classList.toggle('mine', !!owner && owner === this.uid);
      cell.classList.toggle('full', !!k);
      if (k && DEF[k]) cell.appendChild(chainImg(defArt(k, def)));
    });
  }
  drawMowers() { (this.mowerEls || []).forEach((m, i) => m.classList.toggle('used', this.mowers[i] !== '1')); }

  drawShop() {
    const order = this.role === 'def' ? DEF_ORDER : ATT_ORDER;
    const T = this.role === 'def' ? DEF : ATT;
    const team = this.team;
    const key = `${this.role}|${team}|${this.sel}|${order.map((k) => (T[k].cost <= this.corn ? 1 : 0)).join('')}`;
    if (key === this.shopKey) return;
    this.shopKey = key;
    this.shopEl.innerHTML = '';
    for (const k of order) {
      const b = document.createElement('button');
      b.className = `sg-card ${k === this.sel ? 'on' : ''} ${T[k].cost <= this.corn ? 'can' : ''}`; b.dataset.k = k;
      const names = this.role === 'def' ? defArt(k, team) : (() => { const a = attArt(k, team); return [...a.frames, ...a.old]; })();
      b.appendChild(chainImg(names));
      const n = document.createElement('b'); n.textContent = T[k].name; b.appendChild(n);
      const c = document.createElement('span'); c.textContent = `🌽${T[k].cost}`; b.appendChild(c);
      this.shopEl.appendChild(b);
    }
  }

  /** Which (row, col) did the student tap? */
  hit(e) {
    const rect = this.board.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width; const fy = (e.clientY - rect.top) / rect.height;
    const v = this.vertical;
    const r = Math.min(ROWS - 1, Math.max(0, Math.floor((v ? fx : fy) * ROWS)));
    const along = v ? 1 - fy : fx; // 0 at the coop, 1 at the road
    const c = Math.floor(((along - COOP_F) / LAWN_F) * COLS);
    return { r, c: c >= 0 && c < COLS ? c : null, along };
  }

  tap(e) {
    if (!this.info || !this.role) return;
    const { r, c } = this.hit(e);
    const T = this.role === 'def' ? DEF : ATT;
    const k = this.sel; const info = T[k];
    if (!info) { this.onHint('Pick something from the shop first.', 'bad'); return; }
    if (info.cost > this.corn) { this.onHint(`Not enough corn — ${info.name} costs ${info.cost} 🌽. Answer questions to earn more!`, 'bad'); this.flashLane(r, true); return; }
    if (this.role === 'def') {
      if (c == null) { this.onHint('Tap a square on the grass to place it.', 'bad'); return; }
      const i = r * COLS + c;
      if (this.grid[i]) { const [kk] = this.grid[i].split('|'); this.onHint(`That square already has a ${DEF[kk]?.name || 'defence'}. Pick an empty one.`, 'bad'); return; }
      this.grid[i] = `${k}|${this.uid}`; this.drawGrid(); // optimistic
      this.onCommand({ op: 'def', k, r, c }, info);
    } else {
      this.onCommand({ op: 'att', k, r }, info);
      this.flashLane(r);
    }
  }

  flashLane(r, bad = false) {
    const f = document.createElement('div'); f.className = `sg-flash ${bad ? 'bad' : ''}`;
    if (this.vertical) f.style.cssText = `left:${(r / ROWS) * 100}%;width:${100 / ROWS}%;top:0;bottom:0`;
    else f.style.cssText = `top:${(r / ROWS) * 100}%;height:${100 / ROWS}%;left:0;right:0`;
    this.unitsEl.appendChild(f); setTimeout(() => f.remove(), 450);
  }

  destroy() { this.ro?.disconnect(); this.el.innerHTML = ''; }
}
