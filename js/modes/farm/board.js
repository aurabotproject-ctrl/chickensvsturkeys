// =========================================================
// EGG FARM — host side. Runs every student's farm economy (so
// nobody can cheat from their phone) and draws the live race
// board on the projector. Each phone is its own little farm.
// =========================================================
import { sprite, avatar, AVATARS } from '../../core/assets.js';
import { esc } from '../../core/ui.js';
import { sfx } from '../../core/sfx.js';
import {
  COOP, MACHINE, TRUCK, newFarm, nextCosts, baseRate, birdCost, fmt, answerReward, tapValue,
  BOOST_MULT, BOOST_SECS, BOOST_MAX, TAPS_PER_SEC,
} from './economy.js';

const coopSprite = (team, lvl) => `fm_coop_${team === 'chicken' ? 'c' : 't'}${lvl}`;

export class FarmBoard {
  constructor(el, { onChange, onFeed } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onFeed = onFeed || (() => {});
    this.players = new Map();
    this.running = false; this.paused = false;
    this.effects = { golden: 0, catchup: 0, catchupTeam: null, fox: null };
    this.feed = [];
    this.now = () => Date.now();
  }

  async init() {
    this.el.innerHTML = `<div class="farm-board">
      <div class="fb-tug"><i class="c"></i><i class="t"></i></div>
      <div class="fb-cols">
        <div class="fb-col chicken"><div class="fb-head"><img src="${sprite('fm_coop_c3')}" alt=""><span>CHICKEN FARMS</span><b class="fb-rate" id="fb-rate-chicken"></b></div><div class="fb-list" id="fb-list-chicken"></div></div>
        <div class="fb-col turkey"><div class="fb-head"><img src="${sprite('fm_coop_t3')}" alt=""><span>TURKEY FARMS</span><b class="fb-rate" id="fb-rate-turkey"></b></div><div class="fb-list" id="fb-list-turkey"></div></div>
      </div>
      <div class="fb-feed" id="fb-feed"></div>
      <img class="fb-fox hidden" id="fb-fox" src="${sprite('fox')}" alt="">
    </div>`;
    this.lists = { chicken: this.el.querySelector('#fb-list-chicken'), turkey: this.el.querySelector('#fb-list-turkey') };
    this.cards = new Map();
    this.last = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now(); const dt = Math.min(1, (t - this.last) / 1000); this.last = t;
      if (this.running && !this.paused) this.tick(dt);
    }, 250);
    this.renderTimer = setInterval(() => this.render(), 500);
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false, av }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; p.av = av ?? p.av; return p; }
    const p = { uid, name, team, bot, av, score: 0, farm: newFarm(), tapT: 0, tapCredit: TAPS_PER_SEC, lastTaps: null, lastBuy: null, think: 2 + Math.random() * 4 };
    p.score = p.farm.earned;
    this.players.set(uid, p);
    return p;
  }
  removePlayer(uid) { this.players.delete(uid); const c = this.cards.get(uid); c?.remove(); this.cards.delete(uid); }
  setTeam(uid, team) { const p = this.players.get(uid); if (p) { p.team = team; this.cards.get(uid)?.remove(); this.cards.delete(uid); } }

  rate(p) {
    const now = this.now();
    let m = baseRate(p.farm);
    if (p.farm.boostUntil > now) m *= BOOST_MULT;
    if (this.effects.golden > 0) m *= 2;
    if (this.effects.catchup > 0 && this.effects.catchupTeam === p.team) m *= 3;
    return m;
  }

  /** Small object the phone needs to draw the farm. */
  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    const f = p.farm;
    return {
      cash: Math.floor(f.cash), earned: Math.floor(f.earned), gold: f.gold, rate: +this.rate(p).toFixed(2), base: +baseRate(f).toFixed(2),
      birds: f.birds, coop: f.coop, machine: f.machine, truck: f.truck, boostUntil: f.boostUntil, t: this.now(), score: Math.floor(f.earned),
      golden: this.effects.golden > 0 ? 1 : 0, catchup: this.effects.catchup > 0 && this.effects.catchupTeam === p.team ? 1 : 0,
      fox: this.effects.fox && this.effects.fox.team === p.team ? (this.effects.fox.safe.has(uid) ? 'safe' : 'danger') : '',
    };
  }

  // ---------- actions from phones ----------
  /** inp: { buy, buySeq, taps } */
  handleInput(uid, inp) {
    const p = this.players.get(uid); if (!p || !this.running || this.paused) return;
    const taps = +inp.taps || 0;
    if (p.lastTaps === null) p.lastTaps = taps;
    else if (taps > p.lastTaps) {
      const n = Math.min(taps - p.lastTaps, Math.floor(p.tapCredit));
      p.lastTaps = taps;
      if (n > 0) { p.tapCredit -= n; this.earn(p, tapValue(p.farm) * n * (p.farm.boostUntil > this.now() ? BOOST_MULT : 1)); }
    }
    const seq = +inp.buySeq || 0;
    if (p.lastBuy === null) p.lastBuy = 0;
    if (seq > p.lastBuy) { p.lastBuy = seq; this.buy(p, inp.buy); }
  }

  buy(p, what) {
    const f = p.farm; const c = nextCosts(f)[what];
    if (!c || f.cash < c.cash || f.gold < c.gold) return false;
    f.cash -= c.cash; f.gold -= c.gold;
    if (what === 'birds') f.birds += 1;
    else {
      f[what] += 1;
      const nm = what === 'coop' ? COOP[f.coop - 1].name : what === 'machine' ? MACHINE[f.machine].name : TRUCK[f.truck].name;
      this.feedItem(p, `built ${/^[AEIOU]/i.test(nm) ? 'an' : 'a'} <b>${esc(nm)}</b>!`, what === 'coop' ? coopSprite(p.team, f.coop) : what === 'machine' ? MACHINE[f.machine].sprite : TRUCK[f.truck].sprite);
      if (!p.bot) sfx.join();
    }
    this.onChange(p);
    return true;
  }

  /** Called by the host when a quiz answer is graded. Returns what the phone should show. */
  reward(uid, { correct, conf, streak }) {
    const p = this.players.get(uid); if (!p) return null;
    const f = p.farm; const now = this.now();
    if (this.effects.fox && this.effects.fox.team === p.team && correct) this.effects.fox.safe.add(uid);
    if (!correct) { this.onChange(p); return { cash: 0, gold: 0, boost: 0 }; }
    let cash = answerReward(f);
    let gold = 1;
    if (conf === 'sure') gold += 1;
    if (streak && streak % 3 === 0) { gold += 1; cash *= 2; this.feedItem(p, `is on a <b>${streak}-answer streak</b>! 🔥`, 'fm_bolt'); }
    this.earn(p, cash);
    f.gold += gold;
    f.boostUntil = Math.min(now + BOOST_MAX * 1000, Math.max(f.boostUntil, now) + BOOST_SECS * 1000);
    this.onChange(p);
    return { cash: Math.round(cash), gold, boost: Math.round((f.boostUntil - now) / 1000) };
  }

  earn(p, amount) { p.farm.cash += amount; p.farm.earned += amount; p.score = p.farm.earned; }

  // ---------- loop ----------
  tick(dt) {
    const E = this.effects;
    if (E.golden > 0) E.golden -= dt;
    if (E.catchup > 0) E.catchup -= dt;
    if (E.fox) { E.fox.t -= dt; if (E.fox.t <= 0) this.endFox(); }
    for (const p of this.players.values()) {
      this.earn(p, this.rate(p) * dt);
      p.tapCredit = Math.min(TAPS_PER_SEC * 2, p.tapCredit + TAPS_PER_SEC * dt);
      if (p.bot) this.botTick(p, dt);
    }
  }

  botTick(p, dt) {
    p.think -= dt;
    if (p.think > 0) return;
    p.think = 3 + Math.random() * 5;
    const correct = Math.random() < 0.7;
    p.answered = (p.answered || 0) + 1; p.correct = (p.correct || 0) + (correct ? 1 : 0);
    p.botStreak = correct ? (p.botStreak || 0) + 1 : 0;
    this.reward(p.uid, { correct, conf: Math.random() < 0.4 ? 'sure' : 'think', streak: p.botStreak });
    this.earn(p, tapValue(p.farm) * 10);
    for (let i = 0; i < 4; i++) {
      const c = nextCosts(p.farm);
      const opts = Object.entries(c).filter(([, v]) => v && v.cash <= p.farm.cash && v.gold <= p.farm.gold).sort((a, b) => a[1].cash - b[1].cash);
      if (!opts.length) break;
      this.buy(p, opts[0][0]);
    }
  }

  startRound() {
    for (const p of this.players.values()) { p.farm = newFarm(); p.score = p.farm.earned; p.lastTaps = null; p.lastBuy = null; }
    this.effects = { golden: 0, catchup: 0, catchupTeam: null, fox: null };
    this.feed = []; this.renderFeed();
    this.el.querySelector('#fb-fox')?.classList.add('hidden');
  }
  startBattle() { this.running = true; this.paused = false; this.last = performance.now(); }
  stopRound() { this.running = false; if (this.effects.fox) this.endFox(); }
  resetScores() { for (const p of this.players.values()) { p.farm = newFarm(); p.score = p.farm.earned; } }
  celebrate() {}
  addEggs() { return 0; }

  // ---------- events ----------
  startEvent(type, losingTeam) {
    const E = this.effects;
    if (type === 'golden') E.golden = 20;
    else if (type === 'double') for (const p of this.players.values()) { p.farm.gold += 2; this.onChange(p); }
    else if (type === 'shield') { E.catchup = 15; E.catchupTeam = losingTeam || (Math.random() < 0.5 ? 'chicken' : 'turkey'); }
    else if (type === 'fox') {
      const leading = losingTeam === 'chicken' ? 'turkey' : losingTeam === 'turkey' ? 'chicken' : (Math.random() < 0.5 ? 'chicken' : 'turkey');
      E.fox = { team: leading, t: 15, safe: new Set() };
      const fox = this.el.querySelector('#fb-fox');
      fox.className = `fb-fox run-${leading}`;
    }
    for (const p of this.players.values()) this.onChange(p);
  }

  endFox() {
    const fx = this.effects.fox; if (!fx) return;
    this.effects.fox = null;
    let lost = 0; let caught = 0;
    for (const p of this.players.values()) {
      if (p.team !== fx.team) continue;
      const safe = fx.safe.has(p.uid) || (p.bot && Math.random() < 0.6);
      if (!safe) { const l = Math.floor(p.farm.cash * 0.2); p.farm.cash -= l; lost += l; caught += 1; }
      this.onChange(p);
    }
    this.el.querySelector('#fb-fox')?.classList.add('hidden');
    this.feedItem({ team: fx.team, name: 'The fox' }, caught ? `stole <b>${fmt(lost)}</b> from ${caught} ${fx.team} farm${caught === 1 ? '' : 's'}!` : 'went home hungry — every farm was protected! 🛡️', 'fox');
  }

  // ---------- drawing ----------
  feedItem(p, htmlText, icon) {
    this.feed.unshift({ html: `<b>${esc(p.name)}</b> ${htmlText}`, team: p.team, icon, at: Date.now() });
    this.feed = this.feed.slice(0, 4);
    this.renderFeed();
    this.onFeed(this.feed[0]);
  }
  renderFeed() {
    const el = this.el.querySelector('#fb-feed'); if (!el) return;
    el.innerHTML = this.feed.map((f, i) => `<div class="fb-item ${f.team || ''} ${i === 0 ? 'new' : ''}">${f.icon ? `<img src="${sprite(f.icon)}" alt="">` : ''}<span>${f.html}</span></div>`).join('');
  }

  render() {
    if (!this.lists) return;
    const now = this.now();
    const totals = { chicken: 0, turkey: 0 }; const rates = { chicken: 0, turkey: 0 };
    for (const team of ['chicken', 'turkey']) {
      const list = [...this.players.values()].filter((p) => p.team === team).sort((a, b) => b.farm.earned - a.farm.earned);
      const box = this.lists[team];
      const first = new Map([...box.children].map((c) => [c.dataset.uid, c.getBoundingClientRect().top]));
      list.forEach((p, i) => {
        totals[team] += p.farm.earned; rates[team] += this.rate(p);
        let card = this.cards.get(p.uid);
        if (!card || card.parentElement !== box) {
          card?.remove();
          card = document.createElement('div'); card.className = 'fb-card'; card.dataset.uid = p.uid;
          card.innerHTML = '<span class="rk"></span><img class="av" alt=""><div class="nm"><b></b><small></small></div><img class="coop" alt=""><div class="money"><b></b><small></small></div>';
          this.cards.set(p.uid, card);
        }
        if (box.children[i] !== card) box.insertBefore(card, box.children[i] || null);
        const boosting = p.farm.boostUntil > now;
        card.classList.toggle('boost', boosting);
        card.querySelector('.rk').textContent = i + 1;
        const avSrc = avatar(Number.isInteger(p.av) ? p.av : AVATARS[team][0]);
        const avEl = card.querySelector('.av'); if (avEl.getAttribute('src') !== avSrc) avEl.src = avSrc;
        card.querySelector('.nm b').textContent = (p.bot ? '🤖 ' : '') + p.name;
        card.querySelector('.nm small').textContent = `${p.farm.birds} birds · ${COOP[p.farm.coop - 1].name}${boosting ? ' · ⚡BOOST' : ''}`;
        const cs = sprite(coopSprite(team, p.farm.coop)); const cEl = card.querySelector('.coop'); if (cEl.getAttribute('src') !== cs) { cEl.src = cs; cEl.classList.remove('anim-pop'); void cEl.offsetWidth; cEl.classList.add('anim-pop'); }
        card.querySelector('.money b').textContent = fmt(p.farm.earned);
        card.querySelector('.money small').textContent = `+${fmt(this.rate(p))}/s`;
      });
      // FLIP: slide cards to their new spots
      for (const c of box.children) {
        const before = first.get(c.dataset.uid); if (before === undefined) continue;
        const dy = before - c.getBoundingClientRect().top;
        if (Math.abs(dy) > 2) { c.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' }); }
      }
      const r = this.el.querySelector(`#fb-rate-${team}`); if (r) r.textContent = `+${fmt(rates[team])}/s`;
    }
    const sum = totals.chicken + totals.turkey || 1;
    const tug = this.el.querySelector('.fb-tug');
    tug.querySelector('.c').style.width = `${(totals.chicken / sum) * 100}%`;
    tug.querySelector('.t').style.width = `${(totals.turkey / sum) * 100}%`;
  }

  destroy() { clearInterval(this.timer); clearInterval(this.renderTimer); }
}

export { fmt, birdCost };
