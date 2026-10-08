// Egg Farm economy — shared by the host (which runs it for real) and
// the phones (which use it to show prices and predict cash between updates).

export const COOP = [ // level 1..5
  { name: 'Little Hut', cap: 8, cash: 0, gold: 0 },
  { name: 'Cosy Coop', cap: 20, cash: 300, gold: 2 },
  { name: 'Big Barn', cap: 45, cash: 2500, gold: 4 },
  { name: 'Mega Farm', cap: 100, cash: 20000, gold: 6 },
  { name: 'Golden Empire', cap: 250, cash: 150000, gold: 9 },
];
export const MACHINE = [ // level 0..3
  { name: 'Hand picking', mult: 1, cash: 0, sprite: null },
  { name: 'Egg Conveyor', mult: 1.5, cash: 120, sprite: 'fm_conveyor' },
  { name: 'Egg Sorter', mult: 2.25, cash: 1500, sprite: 'fm_sorter' },
  { name: 'Packing Plant', mult: 3.4, cash: 14000, sprite: 'fm_packer' },
];
export const TRUCK = [ // level 0..2
  { name: 'Wheelbarrow', mult: 1, cash: 0, sprite: null },
  { name: 'Delivery Van', mult: 2, cash: 700, sprite: 'fm_van' },
  { name: 'Big Rig', mult: 4, cash: 9000, sprite: 'fm_truck' },
];
export const START_BIRDS = 3;
export const EGGS_PER_BIRD = 0.5; // per second
export const BOOST_MULT = 3;
export const BOOST_SECS = 20;
export const BOOST_MAX = 60;

export const birdCost = (birds) => Math.round(12 * 1.16 ** (birds - START_BIRDS));

/** What the next level of each upgrade costs (null = maxed / blocked). */
export function nextCosts(f) {
  const coop = COOP[f.coop]; // next coop (index = current level since levels start at 1)
  return {
    birds: f.birds >= COOP[f.coop - 1].cap ? null : { cash: birdCost(f.birds), gold: 0, full: false },
    coop: coop ? { cash: coop.cash, gold: coop.gold } : null,
    machine: MACHINE[f.machine + 1] ? { cash: MACHINE[f.machine + 1].cash, gold: 0 } : null,
    truck: TRUCK[f.truck + 1] ? { cash: TRUCK[f.truck + 1].cash, gold: 0 } : null,
  };
}

/** Base income per second (without boosts). */
export const baseRate = (f) => f.birds * EGGS_PER_BIRD * MACHINE[f.machine].mult * TRUCK[f.truck].mult;

export function newFarm() {
  return { cash: 25, earned: 25, gold: 0, birds: START_BIRDS, coop: 1, machine: 0, truck: 0, boostUntil: 0 };
}

export function fmt(n) {
  n = Math.floor(n || 0);
  if (n < 10000) return '$' + n.toLocaleString('en-NZ');
  const units = [['K', 1e3], ['M', 1e6], ['B', 1e9], ['T', 1e12]];
  let u = units[0];
  for (const x of units) if (n >= x[1]) u = x;
  const v = n / u[1];
  return '$' + (v >= 100 ? Math.floor(v) : v.toFixed(1)) + u[0];
}

export const UPGRADES = ['birds', 'coop', 'machine', 'truck'];
export const UPGRADE_INFO = {
  birds: { label: 'Bird', icon: 'egg', desc: '+1 egg-layer' },
  coop: { label: 'Coop', icon: 'fm_arrow', desc: 'more room' },
  machine: { label: 'Machine', icon: 'fm_conveyor', desc: 'eggs worth more' },
  truck: { label: 'Truck', icon: 'fm_van', desc: 'sell for more' },
};

export const REWARD_SECS = 40;   // a correct answer pays this many seconds of income
export const REWARD_MIN = 25;
export const TAP_FRAC = 0.05;    // each tap pays this fraction of a second's income
export const TAPS_PER_SEC = 6;   // tap rate limit
export const answerReward = (f) => Math.max(REWARD_MIN, Math.round(baseRate(f) * REWARD_SECS));
export const tapValue = (f) => Math.max(1, baseRate(f) * TAP_FRAC);
