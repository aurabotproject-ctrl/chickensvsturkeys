// Test bots for Egg Cannon. They "answer" during the answer phase, then
// pretend to play their own cannon game: one shot every couple of seconds,
// about half of them knock a target over.
export function cannonBotTick(board, bot, dt) {
  const p = board.players.get(bot.uid);
  if (!p || !board.running) return;
  bot.fireIn = (bot.fireIn ?? 1 + Math.random() * 3) - dt;
  if (bot.fireIn > 0) return;
  bot.fireIn = 1.8 + Math.random() * 2.5;
  if (p.eggs <= 0 || p.hits >= board.total) { if (!p.idle) board.report(bot.uid, { cr: board.round, cs: p.shots, ch: p.hits, ci: true }); return; }
  const hit = Math.random() < 0.5 ? 1 + (Math.random() < 0.15 ? 1 : 0) : 0; // sometimes a TNT takes two
  board.report(bot.uid, { cr: board.round, cs: p.shots + 1, ch: p.hits + hit, ci: false });
}

/** Bots "answer" 5 questions at ~70% to load their cannon. */
export function botLoadEggs(board, bot) {
  let eggs = 0;
  for (let i = 0; i < 5; i++) if (Math.random() < 0.7) eggs += 1;
  board.addEggs(bot.uid, eggs);
  return eggs;
}
