// =========================================================
// LAND GRAB — the student's screen. The camera follows their own
// character. Put a finger down anywhere and drag the way you want to go
// (like a joystick); arrow keys work too. When out, the whole field shows.
// =========================================================
import { avatar } from '../../core/assets.js?v=20261012133603';
import { GW, GH, decode, paintGrid, makePalette, applyDelta, unpackPos } from './common.js?v=20261012133603';

export class PaintView {
  constructor(el, { uid, onSteer } = {}) {
    this.el = el; this.uid = uid; this.onSteer = onSteer || (() => {});
    this.own = new Uint8Array(GW * GH); this.trail = new Uint8Array(GW * GH); this.blank = new Uint8Array(GW * GH);
    this.players = new Map(); this.palette = []; this.me = 0; this.av = new Map();
    this.canvas = document.createElement('canvas'); this.canvas.className = 'pt-phone';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.gridC = document.createElement('canvas'); this.gridC.width = GW; this.gridC.height = GH;
    this.darkC = document.createElement('canvas'); this.darkC.width = GW; this.darkC.height = GH;
    this.cam = { x: GW / 2, y: GH / 2 };
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.el); this.resize();
    this.setupInput();
    const frame = () => { if (this.dead) return; this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
  }
  setInfo(info) {
    if (!info) return;
    this.players.clear();
    for (const [i, uid, team, k, av, name] of info.players || []) {
      this.players.set(i, { i, uid, team, k, av, name, x: GW / 2, y: GH / 2, tx: GW / 2, ty: GH / 2, alive: true, ang: 0 });
      if (uid === this.uid) this.me = i;
    }
    this.palette = makePalette([...this.players.values()].map((p) => ({ i: p.i, team: p.team, k: p.k })));
    const me = this.players.get(this.me); if (me) this.myColor = this.palette[me.i]?.css;
  }
  // keyframe "seq|rle" + changes "seq|runs" (changes only apply to the keyframe with the same seq)
  setGrid(g) { this.key('g', g); }
  setTrail(t) { this.key('t', t); }
  setGridDelta(d) { this.delta('g', d); }
  setTrailDelta(d) { this.delta('t', d); }
  key(k, v) {
    if (v == null) return;
    const [seq, rle] = String(v).includes('|') ? String(v).split('|') : ['0', String(v)];
    const K = (this.kf ||= {}); K[k] = { seq, base: decode(rle, new Uint8Array(GW * GH)) };
    this.rebuild(k);
  }
  delta(k, v) { const [seq, runs = ''] = String(v || '').split('|'); (this.dl ||= {})[k] = { seq, runs }; this.rebuild(k); }
  rebuild(k) {
    const K = this.kf?.[k]; if (!K) return;
    const into = k === 'g' ? this.own : this.trail; const D = this.dl?.[k];
    applyDelta(D && D.seq === K.seq ? D.runs : '', K.base, into);
  }
  setPos(str) {
    str = String(str || '');
    const list = str.includes(',') // older format "i,x,y,alive,ang;…"
      ? str.split(';').filter(Boolean).map((part) => { const [i, x, y, a, ang] = part.split(','); return { i: +i, x: +x, y: +y, alive: a === '1', ang: +ang }; })
      : unpackPos(str);
    for (const q of list) {
      const p = this.players.get(q.i); if (!p) continue;
      p.tx = q.x; p.ty = q.y; p.alive = q.alive; p.ang = q.ang;
      if (!p.seen) { p.x = p.tx; p.y = p.ty; p.seen = true; }
    }
  }
  avImg(av) { if (!this.av.has(av)) { const im = new Image(); im.src = avatar(av); this.av.set(av, im); } return this.av.get(av); }

  setupInput() {
    const c = this.canvas; c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.joy = { x0: e.offsetX, y0: e.offsetY, x: e.offsetX, y: e.offsetY }; });
    c.addEventListener('pointermove', (e) => {
      const j = this.joy; if (!j) return; j.x = e.offsetX; j.y = e.offsetY;
      const dx = j.x - j.x0; const dy = j.y - j.y0;
      if (Math.hypot(dx, dy) > 12) this.steer(Math.atan2(dy, dx));
    });
    const end = () => { this.joy = null; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    this.keyH = (e) => {
      const map = { ArrowRight: 0, ArrowDown: Math.PI / 2, ArrowLeft: Math.PI, ArrowUp: -Math.PI / 2, d: 0, s: Math.PI / 2, a: Math.PI, w: -Math.PI / 2 };
      if (e.key in map) { this.steer(map[e.key]); e.preventDefault(); }
    };
    window.addEventListener('keydown', this.keyH);
  }
  steer(a) {
    if (this.lastA != null && Math.abs(((a - this.lastA + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.06) return;
    this.lastA = a; this.onSteer(Math.round(a * 100) / 100);
  }

  render() {
    const ctx = this.ctx; const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const p of this.players.values()) { p.x += (p.tx - p.x) * 0.25; p.y += (p.ty - p.y) * 0.25; }
    const me = this.players.get(this.me);
    const following = me && me.alive;
    // zoom: about 34 cells across the longer side when playing; whole field when out / watching
    const cell = following ? Math.max(W, H) / 34 : Math.min(W / GW, H / GH);
    const target = following ? { x: me.x, y: me.y } : { x: GW / 2, y: GH / 2 };
    this.cam.x += (target.x - this.cam.x) * 0.2; this.cam.y += (target.y - this.cam.y) * 0.2;
    const ox = W / 2 - this.cam.x * cell; const oy = H / 2 - this.cam.y * cell;
    ctx.fillStyle = '#3f7a1f'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8fd14f'; ctx.fillRect(ox, oy, GW * cell, GH * cell);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (let y = 0; y < GH; y += 6) for (let x = (y / 6) % 2 ? 6 : 0; x < GW; x += 12) ctx.fillRect(ox + x * cell, oy + y * cell, 6 * cell, 6 * cell);
    if (this.palette.length) {
      paintGrid(this.darkC.getContext('2d'), this.own, this.blank, this.palette, { shade: 1 });
      paintGrid(this.gridC.getContext('2d'), this.own, this.trail, this.palette);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.darkC, ox, oy + cell * 0.5, GW * cell, GH * cell);
      ctx.drawImage(this.gridC, ox, oy, GW * cell, GH * cell);
    }
    ctx.strokeStyle = '#2b5a12'; ctx.lineWidth = 6; ctx.strokeRect(ox - 3, oy - 3, GW * cell + 6, GH * cell + 6);
    const sz = Math.max(22, cell * (following ? 2.2 : 3.4));
    for (const p of this.players.values()) {
      if (!p.alive || !p.seen) continue;
      const x = ox + p.x * cell; const y = oy + p.y * cell; const pal = this.palette[p.i];
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
      const im = this.avImg(p.av); if (im.complete && im.naturalWidth) ctx.drawImage(im, x - sz / 2, y - sz / 2, sz, sz);
      ctx.restore();
      ctx.lineWidth = p.i === this.me ? 5 : 3; ctx.strokeStyle = p.i === this.me ? '#ffc72c' : pal?.css || '#fff'; ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.stroke();
      if (following || p.i === this.me) {
        ctx.font = `900 ${Math.max(11, sz * 0.38)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#111';
        const label = p.i === this.me ? 'YOU' : p.name; ctx.strokeText(label, x, y - sz * 0.65); ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - sz * 0.65);
      }
    }
    // joystick ring
    const j = this.joy;
    if (j) {
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(j.x0, j.y0, 44, 0, Math.PI * 2); ctx.stroke();
      const dx = j.x - j.x0; const dy = j.y - j.y0; const d = Math.min(44, Math.hypot(dx, dy)); const a = Math.atan2(dy, dx);
      ctx.fillStyle = this.myColor || '#ffc72c'; ctx.beginPath(); ctx.arc(j.x0 + Math.cos(a) * d, j.y0 + Math.sin(a) * d, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  destroy() { this.dead = true; this.ro?.disconnect(); window.removeEventListener('keydown', this.keyH); this.canvas.remove(); }
}
