// =========================================================
// EGG FARM — host side. Runs every student's farm economy (so
// nobody can cheat from a phone) and draws the live race board
// on the projector.
// =========================================================
import { sprite, avatar, AVATARS } from '../../core/assets.js?v=20261009140635';
import { esc } from '../../core/ui.js?v=20261009140635';
import * as E from './economy.js?v=20261009140635';

const coopSprite = (team, lvl) => `fm_coop_${team === 'chicken' ? 'c' : 't'}${Math.max(1, lvl)}`;
const article = (w) => (/^[AEIOU]/i.test(w) ? 'an' : 'a');

export class FarmBoard {
  constructor(el, { onChange } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
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
    const p = { uid, name, team, bot, av, farm: E.newFarm(), think: 2 + Math.random() * 4, last: {}, balloonAt: 0 };
    p.score = p.farm.earned;
    this.players.set(uid, p);
    return p;
  }
  removePlayer(uid) { this.players.delete(uid); this.cards.get(uid)?.remove(); this.cards.delete(uid); }
  setTeam(uid, team) { const p = this.players.get(uid); if (p) { p.team = team; this.cards.get(uid)?.remove(); this.cards.delete(uid); } }

  mult(p) {
    let m = 1;
    if (p.farm.boostUntil > this.now()) m *= E.BOOST_MULT;
    if (this.effects.golden > 0) m *= 2;
    if (this.effects.catchup > 0 && this.effects.catchupTeam === p.team) m *= 3;
    return m;
  }
  rate(p) { return E.baseIncome(p.farm) * this.mult(p); }

  /** Everything the phone needs to draw the farm. */
  stateFor(uid) {
    const p = this.players.get(uid); if (!p) return null;
    const f = p.farm; const fx = this.effects.fox;
    return {
      cash: Math.floor(f.cash), earned: Math.floor(f.earned), score: Math.floor(f.earned), gold: f.gold,
      chickens: f.chickens, cap: E.capacity(f), charge: +f.charge.toFixed(2), chargeMax: E.chargeMax(f), refill: +E.chargeRefill(f).toFixed(2),
      lay: +E.layRate(f).toFixed(2), ship: E.shipCap(f), value: +E.eggValue(f).toFixed(2),
      rate: +this.rate(p).toFixed(2), mult: this.mult(p),
      coops: [...f.coops], trucks: [...f.trucks], machine: f.machine, research: { ...f.research },
      coopBuys: f.coopBuys, truckBuys: f.truckBuys, boostUntil: f.boostUntil, hatched: f.hatched, t: this.now(),
      golden: this.effects.golden > 0 ? 1 : 0, catchup: this.effects.catchup > 0 && this.effects.catchupTeam === p.team ? 1 : 0,
      fox: fx && fx.team === p.team ? (fx.safe.has(uid) ? 'safe' : 'danger') : '',
    };
  }

  // ---------- actions from phones ----------
  /** inp: { hatch, buySeq, buy, rsSeq, rs, balloonSeq, balloon, foxSeq, foxAte } */
  handleInput(uid, inp) {
    const p = this.players.get(uid); if (!p || !this.running || this.paused) return;
    const L = p.last; const f = p.farm;
    const seen = (k) => { const v = +inp[k] || 0; if (L[k] === undefined) { L[k] = v; return 0; } const d = v - L[k]; if (d > 0) L[k] = v; return Math.max(0, d); };
    const h = seen('hatch'); if (h) { E.hatch(f, h); this.onChange(p); }
    if (seen('buySeq')) { const c = E.buy(f, inp.buy); if (c && inp.buy !== 'truck') this.announce(p, inp.buy, c); this.onChange(p); }
    if (seen('rsSeq')) { if (E.research(f, inp.rs)) this.feedItem(p, `researched <b>${esc(E.RESEARCH[inp.rs]?.name || '')}</b> 🔬`, E.RESEARCH[inp.rs]?.icon); this.onChange(p); }
    if (seen('balloonSeq') && this.now() - p.balloonAt > 6000) {
      p.balloonAt = this.now();
      if (inp.balloon === 'gold') f.gold += 1;
      else { const c = Math.max(30, E.baseIncome(f) * 20); f.cash += c; f.earned += c; }
      this.onChange(p);
    }
    if (seen('foxSeq') && inp.foxAte) { f.chickens = Math.max(0, f.chickens - Math.round(f.chickens * E.foxSteal(f) * 0.5)); this.onChange(p); }
  }

  announce(p, kind, c) {
    if (kind === 'coop' && c.level >= 2) this.feedItem(p, `built ${article(c.name)} <b>${esc(c.name)}</b>!`, coopSprite(p.team, c.level));
    if (kind === 'machine') this.feedItem(p, `built ${article(c.name)} <b>${esc(c.name)}</b>!`, E.MACHINE_LV[p.farm.machine].sprite);
  }

  /** Called by the host when a quiz answer is graded. */
  reward(uid, { correct, conf, streak }) {
    const p = this.players.get(uid); if (!p) return null;
    if (this.effects.fox && this.effects.fox.team === p.team && correct) this.effects.fox.safe.add(uid);
    if (!correct) { this.onChange(p); return { chicks: 0, cash: 0, gold: 0, boost: 0 }; }
    const r = E.answerReward(p.farm, { conf, streak }, this.now());
    if (streak && streak % 3 === 0) this.feedItem(p, `is on a <b>${streak}-answer streak</b>! 🔥`, 'fm_bolt');
    this.onChange(p);
    return r;
  }

  // ---------- loop ----------
  tick(dt) {
    const fx = this.effects;
    if (fx.golden > 0) fx.golden -= dt;
    if (fx.catchup > 0) fx.catchup -= dt;
    if (fx.fox) { fx.fox.t -= dt; if (fx.fox.t <= 0) this.endFox(); }
    for (const p of this.players.values()) {
      E.step(p.farm, dt, this.mult(p));
      p.score = p.farm.earned;
      if (p.bot) this.botTick(p, dt);
    }
  }

  botTick(p, dt) {
    const f = p.farm;
    E.hatch(f, E.HATCH_RATE * dt * 0.7);
    p.think -= dt;
    if (p.think > 0) return;
    p.think = 5 + Math.random() * 7;
    const correct = Math.random() < 0.65;
    p.answered = (p.answered || 0) + 1; p.correct = (p.correct || 0) + (correct ? 1 : 0);
    p.botStreak = correct ? (p.botStreak || 0) + 1 : 0;
    this.reward(p.uid, { correct, conf: Math.random() < 0.4 ? 'sure' : 'think', streak: p.botStreak });
    for (const k of Object.keys(E.RESEARCH)) if (E.research(f, k)) break;
    for (let i = 0; i < 4; i++) {
      const order = E.layRate(f) > E.shipCap(f) ? ['truck', 'coop', 'machine'] : f.chickens >= E.capacity(f) * 0.9 ? ['coop', 'truck', 'machine'] : ['machine', 'coop', 'truck'];
      let done = false;
      for (const k of order) { const c = E.buy(f, k); if (c) { this.announce(p, k, c); done = true; break; } }
      if (!done) break;
    }
  }

  startRound() {
    for (const p of this.players.values()) { p.farm = E.newFarm(); p.score = p.farm.earned; p.last = {}; }
    this.effects = { golden: 0, catchup: 0, catchupTeam: null, fox: null };
    this.feed = []; this.renderFeed();
    this.el.querySelector('#fb-fox')?.classList.add('hidden');
  }
  startBattle() { this.running = true; this.paused = false; this.last = performance.now(); }
  stopRound() { this.running = false; if (this.effects.fox) this.endFox(); }
  resetScores() { for (const p of this.players.values()) { p.farm = E.newFarm(); p.score = p.farm.earned; } }
  celebrate() {}
  addEggs() { return 0; }

  // ---------- events ----------
  startEvent(type, losingTeam) {
    const fx = this.effects;
    if (type === 'golden') fx.golden = 20;
    else if (type === 'double') for (const p of this.players.values()) p.farm.gold += 2;
    else if (type === 'shield') { fx.catchup = 15; fx.catchupTeam = losingTeam || (Math.random() < 0.5 ? 'chicken' : 'turkey'); }
    else if (type === 'fox') {
      const leading = losingTeam === 'chicken' ? 'turkey' : losingTeam === 'turkey' ? 'chicken' : (Math.random() < 0.5 ? 'chicken' : 'turkey');
      fx.fox = { team: leading, t: 15, safe: new Set() };
      this.el.querySelector('#fb-fox').className = `fb-fox run-${leading}`;
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
      if (!safe) { const l = Math.floor(p.farm.cash * E.foxSteal(p.farm)); p.farm.cash -= l; lost += l; caught += 1; }
      this.onChange(p);
    }
    this.el.querySelector('#fb-fox')?.classList.add('hidden');
    this.feedItem({ team: fx.team, name: 'The fox' }, caught ? `stole <b>${E.fmt(lost)}</b> from ${caught} ${fx.team} farm${caught === 1 ? '' : 's'}!` : 'went home hungry — every farm was protected! 🛡️', 'fox');
  }

  // ---------- drawing ----------
  feedItem(p, htmlText, icon) {
    this.feed.unshift({ html: `<b>${esc(p.name)}</b> ${htmlText}`, team: p.team, icon, at: Date.now() });
    this.feed = this.feed.slice(0, 4);
    this.renderFeed();
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
        const f = p.farm;
        totals[team] += f.earned; rates[team] += this.rate(p);
        let card = this.cards.get(p.uid);
        if (!card || card.parentElement !== box) {
          card?.remove();
          card = document.createElement('div'); card.className = 'fb-card'; card.dataset.uid = p.uid;
          card.innerHTML = '<span class="rk"></span><img class="av" alt=""><div class="nm"><b></b><small></small></div><img class="coop" alt=""><div class="money"><b></b><small></small></div>';
          this.cards.set(p.uid, card);
        }
        if (box.children[i] !== card) box.insertBefore(card, box.children[i] || null);
        const boosting = f.boostUntil > now;
        card.classList.toggle('boost', boosting);
        card.classList.toggle('leader', i === 0);
        card.querySelector('.rk').textContent = i === 0 ? '👑' : i + 1;
        const avSrc = avatar(Number.isInteger(p.av) ? p.av : AVATARS[team][0]);
        const avEl = card.querySelector('.av'); if (avEl.getAttribute('src') !== avSrc) avEl.src = avSrc;
        card.querySelector('.nm b').textContent = (p.bot ? '🤖 ' : '') + p.name;
        const top = Math.max(...f.coops);
        card.querySelector('.nm small').textContent = `🐔 ${E.fmtN(f.chickens)} · ${f.coops.filter(Boolean).length} coops${boosting ? ' · ⚡BOOST' : ''}`;
        const cs = sprite(coopSprite(team, top)); const cEl = card.querySelector('.coop');
        if (cEl.getAttribute('src') !== cs) { cEl.src = cs; cEl.classList.remove('anim-pop'); void cEl.offsetWidth; cEl.classList.add('anim-pop'); }
        card.querySelector('.money b').textContent = E.fmt(f.earned);
        card.querySelector('.money small').textContent = `+${E.fmt(this.rate(p))}/s`;
      });
      for (const c of box.children) {
        const before = first.get(c.dataset.uid); if (before === undefined) continue;
        const dy = before - c.getBoundingClientRect().top;
        if (Math.abs(dy) > 2) c.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
      const r = this.el.querySelector(`#fb-rate-${team}`); if (r) r.textContent = `+${E.fmt(rates[team])}/s`;
    }
    const sum = totals.chicken + totals.turkey || 1;
    const tug = this.el.querySelector('.fb-tug');
    tug.querySelector('.c').style.width = `${(totals.chicken / sum) * 100}%`;
    tug.querySelector('.t').style.width = `${(totals.turkey / sum) * 100}%`;
  }

  destroy() { clearInterval(this.timer); clearInterval(this.renderTimer); }
}

export const fmt = E.fmt;
