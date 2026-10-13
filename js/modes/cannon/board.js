// =========================================================
// EGG CANNON — the big screen (scoreboard only).
// Every student plays their OWN cannon game on their device: just their
// bird and the other team's fort. Each target knocked over = 1 point.
// The big screen ranks who has hit the most targets, and the team score
// is everyone's targets added together.
// (Same interface the host uses for the other game boards.)
// =========================================================
import { sprite, avatar, AVATARS } from '../../core/assets.js?v=20261013204328';
import { sfx } from '../../core/sfx.js?v=20261013204328';
import { FORTS, PIECES } from './forts.js?v=20261013204328';
import { esc } from '../../core/ui.js?v=20261013204328';

/** How many targets are in each fort (every target = 1 point). */
export const targetsIn = (fortIndex) => FORTS[fortIndex % FORTS.length].pieces.filter(([type]) => PIECES[type].target).length;
export const MAX_EGGS = 8;
const rnd = (a, b) => a + Math.random() * (b - a);

export class CannonBoard {
  constructor(el) {
    this.el = el;
    this.players = new Map();
    this.running = false; this.paused = false;
    this.wind = 0; this.fortIndex = 0; this.round = 0; this.lastRound = null;
    this.pending = true;
    // the host drives bots from a ticker — a tiny stand-in for the PixiJS one
    const fns = [];
    this.app = { ticker: { deltaMS: 16, add: (fn) => fns.push(fn) } };
    let last = performance.now();
    const frame = (t) => {
      this.app.ticker.deltaMS = Math.min(100, t - last); last = t;
      fns.forEach((fn) => fn());
      if (this.pending) this.draw();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  async init() {
    this.el.classList.add('cb');
    this.el.innerHTML = `<div class="cb-bg"></div>
      <div class="cb-wrap">
        <div class="cb-head"><span class="cb-title">🎯 TARGETS HIT</span><span class="cb-sub" id="cb-sub"></span></div>
        <div class="cb-list" id="cb-list"></div>
        <div class="cb-empty hidden" id="cb-empty">Waiting for players…</div>
      </div>`;
    this.list = this.el.querySelector('#cb-list');
    this.sub = this.el.querySelector('#cb-sub');
    this.ro = new ResizeObserver(() => { this.pending = true; }); this.ro.observe(this.el);
  }

  get total() { return targetsIn(this.fortIndex); }

  // ---------------- players ----------------
  addPlayer({ uid, name, team, bot = false, av }) {
    let p = this.players.get(uid);
    if (p) { Object.assign(p, { name, team, av: av ?? p.av }); this.pending = true; return p; }
    p = { uid, name, team, bot, av, score: 0, eggs: 0, earned: 0, shots: 0, hits: 0, idle: true, row: null };
    this.players.set(uid, p);
    this.pending = true;
    return p;
  }
  removePlayer(uid) { const p = this.players.get(uid); if (!p) return; p.row?.remove(); this.players.delete(uid); this.pending = true; }
  setTeam(uid, team) { const p = this.players.get(uid); if (p && p.team !== team) { p.team = team; p.row?.remove(); p.row = null; this.pending = true; } }
  updateTag(p) { if (p) { p.row?.remove(); p.row = null; } this.pending = true; }

  /** Eggs earned by answering (this round). Returns how many were actually added. */
  addEggs(uid, n) {
    const p = this.players.get(uid); if (!p || !n) return 0;
    const add = Math.max(0, Math.min(n, MAX_EGGS - p.earned));
    p.earned += add; p.eggs = Math.max(0, p.earned - p.shots);
    if (add) p.idle = false;
    this.pending = true;
    return add;
  }

  /** A device reports what happened in its own game: { cr: round, cs: shots, ch: hits, ci: idle }. */
  report(uid, r) {
    const p = this.players.get(uid); if (!p || +r.cr !== this.round) return false;
    const shots = Math.max(0, Math.min(+r.cs || 0, p.earned));
    const hits = Math.max(0, Math.min(+r.ch || 0, this.total));
    const gained = hits - p.hits;
    p.shots = shots; p.eggs = Math.max(0, p.earned - shots); p.idle = !!r.ci;
    if (gained) { p.hits = hits; p.score += gained; if (gained > 0) { p.flash = true; sfx.splat(); } }
    this.pending = true;
    return gained !== 0;
  }

  // ---------------- rounds ----------------
  startRound(round) {
    this.round = round;
    this.fortIndex = (round - 1) % FORTS.length;
    this.running = false;
    this.wind = Math.round(rnd(-2, 2) * 2) / 2;
    for (const p of this.players.values()) { p.eggs = 0; p.earned = 0; p.shots = 0; p.hits = 0; p.idle = true; p.win = null; }
    this.pending = true;
  }
  startBattle() { this.running = true; this.paused = false; this.pending = true; }
  stopRound() {
    this.running = false;
    const t = { chicken: 0, turkey: 0 };
    for (const p of this.players.values()) t[p.team] += p.hits;
    this.lastRound = { ...t, of: this.total };
    this.pending = true;
  }
  resetScores() { for (const p of this.players.values()) { p.score = 0; p.hits = 0; p.eggs = 0; p.earned = 0; p.shots = 0; } this.pending = true; }
  celebrate(team) { for (const p of this.players.values()) p.win = team === 'tie' || p.team === team; this.pending = true; }
  targetsLeft() { return 1; }

  /** Everyone (who's still connected) has used their eggs and their game has settled. */
  isSettled(isOnline = () => true) {
    for (const p of this.players.values()) {
      if (!p.bot && !isOnline(p.uid)) continue;
      const cleared = p.hits >= this.total;
      if (!p.idle) return false;
      if (p.eggs > 0 && !cleared) return false;
    }
    return true;
  }

  // Events: only "double eggs" changes anything here (the fog happens on the devices).
  startEvent(type) {
    if (type === 'double') for (const p of this.players.values()) this.addEggs(p.uid, 2);
  }

  // ---------------- drawing ----------------
  draw() {
    this.pending = false;
    if (!this.list) return;
    const all = [...this.players.values()];
    this.el.querySelector('#cb-empty').classList.toggle('hidden', all.length > 0);
    const sorted = all.sort((a, b) => b.score - a.score || b.hits - a.hits || a.name.localeCompare(b.name));
    const n = sorted.length; const total = this.total;
    const t = { chicken: 0, turkey: 0 }; const tn = { chicken: 0, turkey: 0 };
    for (const p of sorted) { t[p.team] += p.hits; tn[p.team] += 1; }
    this.sub.innerHTML = this.round
      ? `ROUND ${this.round} · ${total} targets each · this round: <b class="c">🐔 ${t.chicken}</b> <i>/ ${tn.chicken * total}</i> · <b class="t">🦃 ${t.turkey}</b> <i>/ ${tn.turkey * total}</i>`
      : '';
    // layout: 1 column up to 8 players, then 2, then 3
    const cols = n > 16 ? 3 : n > 8 ? 2 : 1;
    const perCol = Math.max(1, Math.ceil(n / cols));
    const H = this.list.clientHeight || 1;
    const rowH = Math.min(H / perCol, cols === 1 ? 92 : 80);
    this.list.style.setProperty('--rowh', `${rowH}px`);
    this.list.style.setProperty('--cols', cols);
    sorted.forEach((p, i) => {
      if (!p.row) {
        p.row = document.createElement('div');
        p.row.className = `cb-row ${p.team}`;
        const avi = Number.isInteger(p.av) ? p.av : AVATARS[p.team][0];
        p.row.innerHTML = `<span class="cb-rk"></span><img class="cb-av" src="${avatar(avi)}" alt=""><span class="cb-nm">${esc(p.name || '?')}${p.bot ? ' 🤖' : ''}</span><span class="cb-tg"></span><span class="cb-eg"></span><b class="cb-sc"></b>`;
        this.list.appendChild(p.row);
      }
      const col = Math.floor(i / perCol); const r = i % perCol;
      p.row.style.transform = `translate(${col * 100}%, ${r * rowH}px)`;
      p.row.querySelector('.cb-rk').textContent = i + 1;
      p.row.classList.toggle('top', i === 0 && p.score > 0);
      const enemy = p.team === 'chicken' ? 'turkey' : 'chicken';
      const key = `${p.hits}/${total}/${enemy}`;
      if (p.row.dataset.tg !== key) {
        p.row.dataset.tg = key;
        p.row.querySelector('.cb-tg').innerHTML = Array.from({ length: total }, (_, k) => `<img src="${sprite(k < p.hits ? `t_${enemy}_ko` : `t_${enemy}`)}" class="${k < p.hits ? 'hit' : ''}" alt="">`).join('');
      }
      p.row.querySelector('.cb-eg').textContent = this.running && p.eggs > 0 ? `🥚${p.eggs}` : this.running && !p.idle ? '💨' : '';
      const sc = p.row.querySelector('.cb-sc');
      if (sc.textContent !== String(p.score)) sc.textContent = p.score;
      if (p.flash) { p.flash = false; p.row.classList.remove('flash'); void p.row.offsetWidth; p.row.classList.add('flash'); }
    });
  }

  destroy() { cancelAnimationFrame(this.raf); this.ro?.disconnect(); this.el.innerHTML = ''; }
}
