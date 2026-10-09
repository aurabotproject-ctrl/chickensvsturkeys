// Test bots for Egg Cannon: they "answer" during the answer phase (handled by the host)
// and lob eggs at the enemy fort during the battle.
import { speedFor, VMAX } from './arena.js?v=20261009153050';

export function cannonBotTick(arena, bot, dt) {
  const p = arena.players.get(bot.uid);
  if (!p || !arena.running || p.eggs <= 0) return;
  bot.fireIn = (bot.fireIn ?? 1 + Math.random() * 3) - dt;
  if (bot.fireIn > 0 || p.cd > 0) return;
  bot.fireIn = 1.5 + Math.random() * 2.5;
  const targets = arena.pieces.filter((pc) => pc.alive && pc.team !== p.team);
  if (!targets.length) return;
  const tgt = targets.filter((pc) => pc.def.target)[0] && Math.random() < 0.7
    ? targets.filter((pc) => pc.def.target)[Math.floor(Math.random() * targets.filter((pc) => pc.def.target).length)]
    : targets[Math.floor(Math.random() * targets.length)];
  const m = arena.mouth(p);
  const dx = Math.abs(tgt.body.position.x - m.x);
  const dy = m.y - tgt.body.position.y;
  const angleDeg = 38 + Math.random() * 22;
  const v = speedFor(dx, dy, (angleDeg * Math.PI) / 180);
  if (!v) return;
  const power = Math.min(1, (v / VMAX) * (1 + (Math.random() - 0.5) * 0.12));
  arena.fire(bot.uid, angleDeg + (Math.random() - 0.5) * 4, power);
}

/** Bots "answer" 5 questions at ~70% to load their cannon. */
export function botLoadEggs(arena, bot) {
  let eggs = 0;
  for (let i = 0; i < 5; i++) if (Math.random() < 0.7) eggs += 1;
  arena.addEggs(bot.uid, eggs);
  return eggs;
}
