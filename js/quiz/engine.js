// Host-side quiz engine. Holds the answer key (phones never see it),
// deals questions to each player, grades answers and logs them.
import { shuffle } from '../core/ui.js?v=20261010183609';

export const MAX_EGGS = 8;

export class QuizEngine {
  /**
   * @param bank normalised bank
   * @param settings { confidence: 'every'|'third'|'off' }
   */
  constructor(bank, settings = {}) {
    this.bank = bank;
    this.settings = settings;
    this.players = new Map(); // uid -> { deck, ptr, n, pending, streak, correct, answered }
    this.log = []; // every graded answer
  }

  player(uid) {
    if (!this.players.has(uid)) this.players.set(uid, { deck: [], ptr: 0, n: 0, pending: null, streak: 0, correct: 0, answered: 0 });
    return this.players.get(uid);
  }

  /** Next question payload for a player (safe to send to the phone). */
  deal(uid) {
    const p = this.player(uid);
    const qs = this.bank.questions;
    if (!qs.length) return null;
    if (p.ptr >= p.deck.length) { p.deck = shuffle(qs.map((_, i) => i)); p.ptr = 0; }
    const qi = p.deck[p.ptr++];
    const q = qs[qi];
    const order = q.type === 'tf' ? [0, 1] : shuffle(q.options.map((_, i) => i));
    p.n += 1;
    const askConf = this.settings.confidence === 'every' || (this.settings.confidence === 'third' && p.n % 3 === 0);
    p.pending = { n: p.n, qi, order, shownAt: Date.now() };
    return { n: p.n, q: q.q, type: q.type, options: order.map((i) => q.options[i]), seconds: q.seconds, conf: askConf };
  }

  /**
   * Grade a submission {n, choice, conf, ms}. Returns null if stale.
   * eggs: change in egg count (can be negative for a confident wrong answer).
   */
  grade(uid, sub, ctx = {}) {
    const p = this.player(uid);
    const pend = p.pending;
    if (!pend || sub.n !== pend.n) return null;
    p.pending = null;
    const q = this.bank.questions[pend.qi];
    const chosen = Number.isInteger(sub.choice) && sub.choice >= 0 ? pend.order[sub.choice] : -1;
    const correct = chosen === q.correct;
    const conf = ['sure', 'think', 'guess'].includes(sub.conf) ? sub.conf : null;
    p.answered += 1;
    let eggs = 0; const bonus = [];
    if (correct) {
      p.correct += 1; p.streak += 1; eggs += 1;
      if (p.streak % 3 === 0) { eggs += 1; bonus.push('streak'); }
      if (conf === 'sure') { eggs += 1; bonus.push('sure'); }
    } else {
      p.streak = 0;
      if (conf === 'sure') { eggs -= 1; bonus.push('sure-wrong'); }
    }
    const entry = {
      uid, n: pend.n, qid: q.id, choice: chosen, correct, conf,
      ms: Math.max(0, Math.round(Number(sub.ms) || Date.now() - pend.shownAt)),
      round: ctx.round || 0, at: Date.now(),
    };
    this.log.push(entry);
    return {
      entry,
      feedback: {
        n: pend.n, correct,
        right: pend.order.indexOf(q.correct),
        rightText: q.options[q.correct],
        explanation: q.explanation,
        eggs, bonus, streak: p.streak,
        lockMs: correct ? 700 : conf === 'sure' ? 3000 : 2200,
      },
    };
  }

  stats(uid) {
    const p = this.player(uid);
    return { correct: p.correct, answered: p.answered, streak: p.streak };
  }
}
