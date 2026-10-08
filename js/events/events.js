// Random events — shown as a full-screen comic banner on the host screen
// and as a short message on every phone. Effects live in the game mode.
export const EVENTS = {
  golden: { name: 'Golden Egg Rush!', banner: 'ev_golden', secs: 20, phone: 'Every hit is worth DOUBLE for 20 seconds! 🥇' },
  double: { name: 'Double Trouble!', banner: 'ev_double', secs: 0, phone: 'Everyone gets +2 eggs! 🥚🥚' },
  shield: { name: 'Shield Up!', banner: 'ev_shield', secs: 8, phone: 'The team that\'s behind is shielded for 8 seconds! 🛡️' },
  storm: { name: 'Egg Storm!', banner: 'ev_storm', secs: 12, phone: 'Eggs are raining from the sky — keep moving! ⛈️' },
  fog: { name: 'Fog of Feathers!', banner: 'ev_fog', secs: 15, phone: 'Feathers everywhere — it\'s hard to see! 🪶' },
  fox: { name: 'Fox Raid!', banner: 'ev_fox', secs: 12, phone: 'A fox is raiding the team in the lead — RUN! 🦊' },
  sweep: { name: 'Clean Sweep!', banner: 'ev_sweep', secs: 0, phone: 'A whole team got knocked out — +5 bonus! 🧹' },
};

/** Events that can be picked at random (Clean Sweep happens on its own). */
/** Phone messages for Egg Farm (effects work differently there). */
export const FARM_PHONE = {
  golden: 'Every farm earns DOUBLE for 20 seconds! 🥇',
  double: 'Everyone gets +2 golden eggs! 🥚🥚',
  shield: 'Catch-up time! The team that\'s behind earns ×3 for 15 seconds! 🚀',
  fox: 'A fox is raiding the leading team! Answer a question correctly to protect your cash! 🦊',
};

export const RANDOM_POOL = ['golden', 'double', 'shield', 'storm', 'fog', 'fox'];
export const randomEvent = (exclude, mode = 'dodge') => {
  const pool = RANDOM_POOL.filter((e) => e !== exclude && !(mode === 'cannon' && e === 'fox') && !(mode === 'farm' && (e === 'storm' || e === 'fog')));
  return pool[Math.floor(Math.random() * pool.length)];
};
