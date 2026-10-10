// =========================================================
// ADVANCE — host game logic + projector drawing.
// =========================================================
import { sfx } from '../../core/sfx.js?v=20261010183146';
import {
  boardSize, BLOCK_QUESTIONS, MAX_BLOCKS, allCombos, startRow, goalRow, progressOf, legalMoves, blockSpots, pushTargets, isFree,
} from './rules.js?v=20261010183146';
import { drawBoard } from './draw.js?v=20261010183146';

const rnd = (a, b) => a + Math.random() * (b - a);
const first = (name) => String(name || '').split(' ')[0].slice(0, 10);

export class AdvanceArena {
  constructor(el, { onChange, onSync, onWin } = {}) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.onSync = onSync || (() => {});
    this.onWin = onWin || (() => {});
    this.players = new Map();
    this.board = null; this.round = 0;
    this.wins = { chicken: 0, turkey: 0 }; this.advTotal = { chicken: 0, turkey: 0 };
    this.running = false; this.paused = false; this.fx = [];
    this.lastCmd = new Map(); this.sync = {};
  }

  async init() {
    await document.fonts?.load?.('32px Bangers').catch(() => {});
    this.canvas = document.createElement('canvas'); this.canvas.className = 'pt-canvas';
    this.el.appendChild(this.canvas); this.ctx = this.canvas.getContext('2d');
    this.resize(); new ResizeObserver(() => this.resize()).observe(this.el);
    const frame = () => { this.render(); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    setInterval(() => this.pushSync(), 300);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = this.el.clientWidth; const h = this.el.clientHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`; this.dpr = dpr;
  }

  // ---------- players ----------
  addPlayer({ uid, name, team, bot = false, av, pc }) {
    if (this.players.has(uid)) { const p = this.players.get(uid); p.name = name; if (pc) p.pc = pc; return p; }
    const p = { uid, name, team, bot, av, pc, score: 0, moves: 0, r: 0, c: 0, home: false, answers: 0, think: rnd(2, 5) };
    this.players.set(uid, p);
    if (this.board && this.round) this.placeLate(p);
    return p;
  }
  removePlayer(uid) {
    this.players.delete(uid);
    if (this.board) { this.board.pieces = this.board.pieces.filter((q) => q.uid !== uid); this.board.blocks = this.board.blocks.filter((b) => b.owner !== uid); }
  }
  setTeam(uid, team) { const p = this.players.get(uid); if (p) p.team = team; }
  setPiece(uid, pc) { const p = this.players.get(uid); if (p && pc) { p.pc = pc; this.sync.info = ''; } }
  updateTag() {}

  /** Bots (and anyone who didn't choose) get a free piece + colour. */
  freePiece(team, uid) {
    const taken = new Set([...this.players.values()].filter((q) => q.team === team && q.uid !== uid && q.pc).map((q) => q.pc));
    const free = allCombos(team).filter((c) => !taken.has(c));
    return free[Math.floor(Math.random() * free.length)] || 'pw';
  }

  // ---------- rounds ----------
  startRound() {
    this.round += 1;
    const teams = { chicken: [], turkey: [] };
    for (const p of this.players.values()) if (teams[p.team]) teams[p.team].push(p);
    const N = boardSize(teams.chicken.length, teams.turkey.length);
    this.board = { W: N, L: N, pieces: [], blocks: [] };
    for (const team of ['chicken', 'turkey']) {
      // spread the team across its start row, in a new random order every round
      const list = teams[team].sort(() => Math.random() - 0.5);
      const cols = spread(list.length, N);
      list.forEach((p, k) => {
        if (!p.pc) p.pc = this.freePiece(team, p.uid);
        p.r = startRow(team, N); p.c = cols[k]; p.home = false; p.moves = 0; p.score = 0; p.answers = 0;
        this.board.pieces.push(p);
      });
    }
    this.result = null; this.running = false; this.fx = [];
    this.sync = {};
    this.pushSync(true);
    for (const p of this.players.values()) this.onChange(p);
  }
  /** Late joiner: first free square on their start row (or the nearest row to it). */
  placeLate(p) {
    if (!p.pc) p.pc = this.freePiece(p.team, p.uid);
    const B = this.board; const dir = p.team === 'turkey' ? 1 : -1;
    for (let k = 0; k < B.L; k++) {
      const r = startRow(p.team, B.L) + dir * k;
      for (let c = 0; c < B.W; c++) if (isFree(B, r, c)) { p.r = r; p.c = c; p.home = false; B.pieces.push(p); this.sync.info = ''; return; }
    }
  }
  startBattle() { this.running = true; this.paused = false; }
  /** Time's up (or a team got everyone home): work out the round winner. */
  stopRound() {
    if (!this.board || this.result) { this.running = false; return; }
    this.running = false;
    const avg = this.averages();
    const allHome = (t) => { const ps = this.board.pieces.filter((q) => q.team === t); return ps.length > 0 && ps.every((q) => q.home); };
    let winner = allHome('chicken') ? 'chicken' : allHome('turkey') ? 'turkey' : null;
    let how = 'home';
    if (!winner) { how = 'further'; winner = avg.chicken > avg.turkey + 1e-9 ? 'chicken' : avg.turkey > avg.chicken + 1e-9 ? 'turkey' : 'tie'; }
    if (winner !== 'tie') this.wins[winner] += 1;
    this.advTotal.chicken += avg.chicken; this.advTotal.turkey += avg.turkey;
    this.result = { winner, how, avg };
    this.pushSync(true);
    for (const p of this.players.values()) this.onChange(p);
  }
  resetScores() { this.wins = { chicken: 0, turkey: 0 }; this.advTotal = { chicken: 0, turkey: 0 }; this.round = 0; for (const p of this.players.values()) p.score = 0; }
  celebrate() {}
  addEggs() { return 0; }

  /** Average % of the way across, per team. */
  averages() {
    const out = { chicken: 0, turkey: 0 }; if (!this.board) return out;
    for (const t of ['chicken', 'turkey']) {
      const ps = this.board.pieces.filter((q) => q.team === t); if (!ps.length) continue;
      out[t] = (ps.reduce((a, q) => a + progressOf(t, q.r, this.board.L), 0) / ps.length / (this.board.L - 1)) * 100;
    }
    return out;
  }
  /** Big scoreboard = rounds won (tiny tie-breaker from total advancement, invisible when rounded). */
  teamTotals() { return { chicken: this.wins.chicken + this.advTotal.chicken / 1e6, turkey: this.wins.turkey + this.advTotal.turkey / 1e6 }; }

  // ---------- answers + moves ----------
  reward(uid, { correct }) {
    const p = this.players.get(uid); if (!p || !this.board) return null;
    // blocks this player placed count down with each of their answers
    for (const b of this.board.blocks) if (b.owner === uid) b.left -= 1;
    const gone = this.board.blocks.filter((b) => b.left <= 0); if (gone.length) this.board.blocks = this.board.blocks.filter((b) => b.left > 0);
    if (correct && !p.home) {
      p.moves = Math.min(2, p.moves + 1);
      if (!legalMoves(this.board, p).length && !this.canBlock(p) && !pushTargets(this.board, p).length) { p.moves = 0; this.onChange(p); return { move: false, stuck: true }; }
    }
    this.onChange(p);
    return { move: correct && !p.home, home: p.home };
  }
  canBlock(p) { return this.board.blocks.filter((b) => b.owner === p.uid).length < MAX_BLOCKS && blockSpots(this.board, p).length > 0; }
  teamSize(t) { return this.board ? this.board.pieces.filter((q) => q.team === t).length : 0; }

  /** inp.q = [{ s, op: 'move'|'block', r, c }] */
  handleInput(uid, inp) {
    if (!this.running || this.paused) return;
    const last = this.lastCmd.get(uid) || 0;
    const q = Object.values(inp?.q || {}).filter((c) => c && c.s > last).sort((a, b) => a.s - b.s);
    for (const c of q) { this.lastCmd.set(uid, c.s); this.act(uid, c.op, +c.r, +c.c); }
  }
  act(uid, op, r, c) {
    const p = this.players.get(uid); if (!p || p.moves <= 0 || p.home) return false;
    const B = this.board;
    if (op === 'block') {
      if (!this.canBlock(p) || !blockSpots(B, p).some(([rr, cc]) => rr === r && cc === c)) return false;
      B.blocks.push({ r, c, owner: uid, left: BLOCK_QUESTIONS, team: p.team });
      p.moves -= 1; this.pop('🧱', r, c); sfx.click?.();
    } else if (op === 'push') {
      const t = pushTargets(B, p).find((x) => x.r === r && x.c === c); if (!t) return false;
      const q = B.pieces.find((x) => x.uid === t.uid); if (!q) return false;
      q.r = t.to[0]; q.c = t.to[1]; p.moves -= 1; this.pushCount = (this.pushCount || 0) + 1;
      const qp = this.players.get(q.uid); if (qp) { qp.r = q.r; qp.c = q.c; qp.score = progressOf(qp.team, qp.r, B.L); this.onChange(qp); }
      this.pop(`💥 ${first(p.name)} pushed ${first(q.name)} back!`, q.r, q.c, true); sfx.splat?.();
    } else {
      if (!legalMoves(B, p).some(([rr, cc]) => rr === r && cc === c)) return false;
      p.r = r; p.c = c; p.moves -= 1;
      p.score = progressOf(p.team, p.r, B.L);
      if (p.r === goalRow(p.team, B.L)) { p.home = true; p.moves = 0; this.pop(`${first(p.name)} made it!`, r, c, true); sfx.correct?.(); }
    }
    this.onChange(p);
    this.pushSync();
    this.checkWin();
    return true;
  }
  checkWin() {
    for (const t of ['chicken', 'turkey']) {
      const ps = this.board.pieces.filter((q) => q.team === t);
      if (ps.length && ps.every((q) => q.home) && this.running) { this.running = false; setTimeout(() => this.onWin(t), 900); return; }
    }
  }

  // ---------- bots ----------
  botTick(dt) {
    if (!this.running || this.paused || !this.board) return;
    for (const p of this.players.values()) {
      if (!p.bot || p.home) continue;
      p.think -= dt; if (p.think > 0) continue;
      p.think = rnd(3, 7);
      const ok = Math.random() < 0.65;
      p.answered = (p.answered || 0) + 1; p.correct = (p.correct || 0) + (ok ? 1 : 0);
      this.reward(p.uid, { correct: ok });
      if (p.moves <= 0) continue;
      const moves = legalMoves(this.board, p);
      // sometimes block an enemy that is right next to us
      if (this.canBlock(p) && Math.random() < 0.2) {
        const spot = blockSpots(this.board, p).find(([r, c]) => this.board.pieces.some((q) => q.team !== p.team && Math.abs(q.r - r) <= 1 && Math.abs(q.c - c) <= 1));
        if (spot) { this.act(p.uid, 'block', spot[0], spot[1]); continue; }
      }
      const pushes = pushTargets(this.board, p);
      if (pushes.length && Math.random() < 0.35) { const t = pushes[0]; this.act(p.uid, 'push', t.r, t.c); continue; }
      if (!moves.length) { if (pushes.length) { this.act(p.uid, 'push', pushes[0].r, pushes[0].c); continue; } p.moves = 0; continue; }
      const fwd = moves.filter(([r]) => r !== p.r);
      const pick = (fwd.length ? fwd : moves)[Math.floor(Math.random() * (fwd.length || moves.length))];
      this.act(p.uid, 'move', pick[0], pick[1]);
    }
  }

  // ---------- phone sync ----------
  pushSync(force = false) {
    if (!this.board) return;
    const B = this.board;
    const info = { W: B.W, L: B.L, round: this.round, players: B.pieces.map((p) => [p.uid, p.team, p.pc || 'pw', first(p.name)]) };
    const infoS = JSON.stringify(info);
    const s = `${B.pieces.map((p) => `${p.uid}.${p.r}.${p.c}.${p.home ? 1 : 0}`).join(';')}|${B.blocks.map((b) => `${b.r}.${b.c}.${b.left}.${b.owner}`).join(';')}`;
    const up = {};
    if (force || infoS !== this.sync.info) { this.sync.info = infoS; up['adv/info'] = info; }
    if (force || s !== this.sync.s) { this.sync.s = s; up['adv/s'] = s; }
    if (this.result && (force || this.sync.res !== this.round)) { this.sync.res = this.round; up['adv/res'] = { round: this.round, ...this.result }; }
    if (Object.keys(up).length) this.onSync(up);
  }
  stateFor(uid) {
    const p = this.players.get(uid); if (!p || !this.board) return null;
    const avg = this.averages();
    return {
      score: p.score, moves: p.moves, home: p.home ? 1 : 0, r: p.r, c: p.c, pc: p.pc || '',
      canBlock: this.canBlock(p) ? 1 : 0, blockSmall: 1,
      ac: Math.round(avg.chicken), at: Math.round(avg.turkey), wc: this.wins.chicken, wt: this.wins.turkey,
    };
  }

  // ---------- drawing ----------
  render() {
    const ctx = this.ctx; if (!ctx || !this.board) return;
    const dpr = this.dpr; const W = this.canvas.width / dpr; const H = this.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const top = H * 0.2; const bottom = H * 0.11;
    // team progress bars on the left (chickens) and right (turkeys)
    const L = drawBoard(ctx, this.board, W * 0.16, top, W * 0.68, H - top - bottom, { tiles: true });
    const avg = this.averages();
    bar(ctx, L.ox - L.cell * 1.1 - 46, top, 46, H - top - bottom, avg.chicken, '#1e6fe0', 'CHICKENS', true);
    bar(ctx, L.ox + L.cell * (L.W + 1.1), top, 46, H - top - bottom, avg.turkey, '#e0402a', 'TURKEYS', false);
    // pop-up texts
    const now = performance.now();
    this.fx = this.fx.filter((f) => {
      const k = (now - f.t0) / 1300; if (k >= 1) return false;
      const x = L.ox + (f.c + 0.5) * L.cell; const y = L.oy + (f.r + 0.2 - k) * L.cell;
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.font = `normal ${f.big ? L.cell * 0.6 : L.cell * 0.45}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.strokeText(f.text, x, y); ctx.fillStyle = '#ffc72c'; ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1; return true;
    });
  }
  pop(text, r, c, big = false) { this.fx.push({ text, r, c, big, t0: performance.now() }); }
  startEvent() {}
  destroy() { this.canvas?.remove(); }
}

/** n players spread evenly across a row of N squares. */
function spread(n, N) {
  if (!n) return [];
  const out = []; const gap = N / n;
  for (let k = 0; k < n; k++) out.push(Math.min(N - 1, Math.floor(gap * k + gap / 2)));
  return out;
}
function bar(ctx, x, y, w, h, pct, color, label, left) {
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y, w, h);
  const fh = (h * Math.max(0, Math.min(100, pct))) / 100;
  ctx.fillStyle = color; ctx.fillRect(x, left ? y + h - fh : y, w, fh);
  ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.strokeRect(x, y, w, h);
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(left ? -Math.PI / 2 : Math.PI / 2);
  ctx.font = 'normal 26px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeText(`${label} ${Math.round(pct)}%`, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(`${label} ${Math.round(pct)}%`, 0, 0);
  ctx.restore();
}
