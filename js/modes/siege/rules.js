// =========================================================
// COOP SIEGE — shared rules (host + phones)
// Plants-vs-Zombies style: one team DEFENDS its coop by placing
// defences on a 5 × 9 lawn, the other ATTACKS by sending troops
// down the rows. Two halves — the teams swap roles at half time.
// Right answers earn 🌽 corn to spend.
// =========================================================

export const ROWS = 5;
export const COLS = 9;
// world (projector) coordinates
export const W = 1600;
export const H = 820;
export const LAWN = { x: 250, y: 40, cw: 134, ch: 148 }; // 9 × 134 = 1206 → lawn ends at x 1456
export const LAWN_R = LAWN.x + COLS * LAWN.cw;
export const SPAWN_X = W - 40;
export const cellX = (c) => LAWN.x + (c + 0.5) * LAWN.cw;
export const rowY = (r) => LAWN.y + (r + 0.5) * LAWN.ch;
export const colAt = (x) => Math.floor((x - LAWN.x) / LAWN.cw);

export const START_CORN = { def: 150, att: 125 };
export const COOP_HP = 12;
export const CORN_PER_RIGHT = 50;

/**
 * Defences (the defending team places them on a square).
 * hp: how much chewing they take · fire: seconds between shots · dmg per egg
 */
export const DEF = {
  S: { key: 'shooter', name: 'Egg Shooter', cost: 100, hp: 300, fire: 1.4, dmg: 20, info: 'Fires eggs down its row.' },
  C: { key: 'popper', name: 'Corn Popper', cost: 50, hp: 300, corn: 25, every: 12, info: '+25 🌽 for you every 12 s.' },
  W: { key: 'wall', name: 'Hay Wall', cost: 50, hp: 2000, info: 'Tough wall — stops attackers.' },
  D: { key: 'double', name: 'Double Shooter', cost: 200, hp: 300, fire: 1.4, dmg: 20, shots: 2, info: 'Fires 2 eggs at a time.' },
  F: { key: 'frost', name: 'Frost Egger', cost: 175, hp: 300, fire: 1.4, dmg: 20, slow: 3, info: 'Icy eggs slow attackers down.' },
  T: { key: 'spikes', name: 'Rotten Egg Trap', cost: 100, hp: 99999, trap: 30, pop: 140, info: 'SPLAT! Each attacker that steps on it takes a big hit and is slowed. Can\'t be eaten.' },
  B: { key: 'bomb', name: 'Egg Bomb', cost: 150, fuse: 0.7, blast: 1800, info: 'Waits until an attacker comes close, then BOOM — blasts the 3 × 3 squares around it.' },
};
export const DEF_ORDER = ['S', 'C', 'W', 'T', 'F', 'D', 'B'];

/** Attackers (the attacking team sends them down a row). speed in px/s · bite = damage per second */
export const ATT = {
  r: { key: 'raider', name: 'Raider', cost: 50, hp: 200, speed: 28, bite: 60, pts: 10, info: 'Basic attacker.' },
  h: { key: 'helmet', name: 'Helmet Raider', cost: 100, hp: 560, speed: 28, bite: 60, pts: 20, info: 'Bucket helmet = lots more health.' },
  v: { key: 'runner', name: 'Hurdler', cost: 125, hp: 340, speed: 55, bite: 60, pts: 25, jump: true, info: 'Fast! Jumps over the first defence.' },
  b: { key: 'brute', name: 'Tractor Brute', cost: 225, hp: 1400, speed: 36, bite: 110, pts: 45, coop: 2, info: 'Big, tough and fast.' },
  g: { key: 'giant', name: 'Battle Wagon', cost: 400, hp: 3200, speed: 15, bite: 1200, pts: 80, coop: 4, smash: true, info: 'Smashes everything in its way.' },
};
export const ATT_ORDER = ['r', 'h', 'v', 'b', 'g'];

export const PTS = {
  breakthrough: 30,   // attacker reaches the coop
  mower: 15,          // attacker sets off a lane tractor
  defDestroyed: (k) => Math.round(DEF[k].cost / 5),
  raided: 100,        // team bonus: attackers emptied the coop
  // attackers also get +1 for every 3 s each troop survives on the lawn, and +1 per 100 damage chewed
};

/** Round 1: chickens defend · Round 2: turkeys defend (and so on). */
export const defenderFor = (round) => (round % 2 === 1 ? 'chicken' : 'turkey');
export const other = (t) => (t === 'chicken' ? 'turkey' : 'chicken');
export const tc = (team) => (team === 'turkey' ? 't' : 'c');

/**
 * Dedicated Coop Siege sprites that exist in assets/sprites (added when the
 * art from COOP_SIEGE_IMAGE_PROMPTS.md is sliced). Anything not listed here
 * is never requested, so the older stand-in art is used without 404s.
 */
export const SG_ART = new Set([
  'sg_attack', 'sg_bomb_c', 'sg_bomb_t', 'sg_breakin', 'sg_brute_c1', 'sg_brute_c2', 'sg_brute_t1', 'sg_brute_t2', 'sg_coop_c', 'sg_coop_t', 'sg_corn', 'sg_defend', 'sg_double_c', 'sg_double_t', 'sg_frost_c', 'sg_frost_t', 'sg_giant_c1', 'sg_giant_c2', 'sg_giant_t1', 'sg_giant_t2', 'sg_halftime', 'sg_helmet_c1', 'sg_helmet_c2', 'sg_helmet_t1', 'sg_helmet_t2', 'sg_logo', 'sg_mower_c', 'sg_mower_t', 'sg_popper_c', 'sg_popper_t', 'sg_raider_c1', 'sg_raider_c2', 'sg_raider_t1', 'sg_raider_t2', 'sg_runner_c1', 'sg_runner_c2', 'sg_runner_t1', 'sg_runner_t2', 'sg_shooter_c', 'sg_shooter_t', 'sg_sign', 'sg_spikes_c', 'sg_spikes_t', 'sg_wall_c', 'sg_wall_t',
]);
const has = (n) => SG_ART.has(n);

/**
 * Sprite names to try for each thing, best first. The dedicated sg_* art
 * (COOP_SIEGE_IMAGE_PROMPTS.md) is used when it exists; otherwise older art.
 */
export function defArt(k, team) {
  const t = tc(team); const key = DEF[k].key;
  const old = { S: `c_${team}_fire`, C: 'fm_hopper', W: 'tw_hay1', D: `c_${team}_aim`, F: `c_${team}_idle`, T: 'tw_trap', B: 'egg_bomb' }[k];
  return [`sg_${key}_${t}`, `sg_${key}`].filter(has).concat(old);
}
export function attArt(k, team) {
  const t = tc(team); const key = ATT[k].key;
  const bird = team === 'turkey' ? 'turk' : 'chick';
  const old = {
    r: [1, 2, 3, 4].map((i) => `tw_${bird}${i}`),
    h: [`${team}_run`, `${team}_idle`],
    v: [`${team}_throw`, `${team}_run`],
    b: [`tw_tractor_${t}1`, `tw_tractor_${t}2`],
    g: [`tw_shed_${t}`],
  }[k];
  return { frames: [`sg_${key}_${t}1`, `sg_${key}_${t}2`].filter(has), old };
}
export const coopArt = (team) => [`sg_coop_${tc(team)}`].filter(has).concat(`tw_fort_${tc(team)}`);
export const mowerArt = (team) => [`sg_mower_${tc(team)}`].filter(has).concat(`tw_tractor_${tc(team)}1`);
