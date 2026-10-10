// Test bots: let a teacher try the game (or pad out a small class)
// without real phones. They live only on the host screen.
import { COURT_W, COURT_H } from './arena.js?v=20261010145254';

const NAMES = ['Robo Rooster', 'Byte Bird', 'Chip', 'Gizmo', 'Sprocket', 'Widget', 'Pixel', 'Bolt', 'Nugget', 'Turbo', 'Zippy', 'Cluck-3000'];
let n = 0;

export function makeBot() {
  n += 1;
  return { uid: `bot-${Date.now().toString(36)}-${n}`, name: `${NAMES[(n - 1) % NAMES.length]}`, bot: true, av: Math.floor(Math.random() * 12), think: 0, answer: 1 + Math.random() * 3, tx: 0, ty: 0 };
}

/** Called every frame for each bot while a round is running. */
export function botTick(arena, bot, dt, { onAnswer } = {}) {
  const p = arena.players.get(bot.uid);
  if (!p) return;
  // "Answer questions" now and then.
  bot.answer -= dt;
  if (bot.answer <= 0) {
    bot.answer = 2.5 + Math.random() * 3.5;
    const correct = Math.random() < 0.7;
    if (correct) arena.addEggs(bot.uid, 1);
    onAnswer?.(bot, correct);
  }
  if (p.ko) { arena.setMove(bot.uid, 0, 0); return; }
  bot.think -= dt;
  const left = p.team === 'chicken';
  // Dodge: an enemy egg heading my way?
  let dodge = null;
  bot.seen ||= new WeakMap();
  for (const e of arena.eggs) {
    if (!e.team || e.team === p.team) continue;
    if (!bot.seen.has(e)) bot.seen.set(e, Math.random() < 0.4); // only reacts to some eggs
    if (!bot.seen.get(e)) continue;
    const dx = p.x - e.x; const dy = p.y - e.y; const d = Math.hypot(dx, dy);
    const vd = Math.hypot(e.vx, e.vy) || 1;
    const along = (dx * e.vx + dy * e.vy) / vd;
    if (along > 0 && d < 340) {
      const perp = (dx * e.vy - dy * e.vx) / vd;
      if (Math.abs(perp) < 70) { dodge = perp >= 0 ? 1 : -1; break; }
    }
  }
  if (dodge !== null) {
    arena.setMove(bot.uid, 0, dodge > 0 ? 1 : -1);
    bot.think = 0.25;
  } else if (bot.think <= 0) {
    bot.think = 0.6 + Math.random() * 1.4;
    bot.tx = left ? 80 + Math.random() * (COURT_W / 2 - 160) : COURT_W / 2 + 80 + Math.random() * (COURT_W / 2 - 160);
    bot.ty = 80 + Math.random() * (COURT_H - 160);
  }
  if (dodge === null) {
    const dx = bot.tx - p.x; const dy = bot.ty - p.y; const d = Math.hypot(dx, dy);
    arena.setMove(bot.uid, d > 30 ? dx / d : 0, d > 30 ? dy / d : 0);
  }
  // Throw at a random enemy.
  if (p.eggs > 0 && p.cd <= 0 && Math.random() < dt * 0.9) {
    const enemies = [...arena.players.values()].filter((e) => e.team !== p.team && !e.ko);
    if (enemies.length) {
      const t = enemies[Math.floor(Math.random() * enemies.length)];
      const ang = Math.atan2(t.y - p.y, t.x - p.x) + (Math.random() - 0.5) * 0.35;
      arena.throwEgg(bot.uid, Math.cos(ang), Math.sin(ang));
    }
  }
}
