// =========================================================
// Egg Farm economy (Egg Inc style) — shared by the host, which runs
// it for real, and the phones, which show prices and predictions.
//
//   chickens lay eggs → trucks carry eggs away → eggs × value = $
//   • HOLD the hatch button to hatch chickens (uses hatch charge)
//   • coops hold the chickens (4 plots, 5 levels each)
//   • trucks limit how many eggs/second you can sell (4 slots, 4 tiers)
//   • egg machines make every egg worth more
//   • right answers = STAMPEDE of free chicks + cash + golden eggs + boost
//   • golden eggs buy research
// =========================================================

export const COOP_LV = [
  null,
  { name: 'Little Hut', cap: 20 },
  { name: 'Cosy Coop', cap: 60 },
  { name: 'Big Barn', cap: 180 },
  { name: 'Mega Farm', cap: 500 },
  { name: 'Golden Empire', cap: 1500 },
];
export const TRUCK_LV = [
  null,
  { name: 'Delivery Van', cap: 5, sprite: 'fm_van' },
  { name: 'Big Rig', cap: 20, sprite: 'fm_truck' },
  { name: 'Mega Rig', cap: 80, sprite: 'fm_semi' },
  { name: 'Golden Rig', cap: 300, sprite: 'fm_semi' },
];
export const MACHINE_LV = [
  { name: 'Hand Packing', mult: 1, sprite: null },
  { name: 'Egg Conveyor', mult: 1.6, sprite: 'fm_conveyor' },
  { name: 'Egg Sorter', mult: 2.6, sprite: 'fm_sorter' },
  { name: 'Packing Plant', mult: 4.2, sprite: 'fm_packer' },
  { name: 'Golden Packer', mult: 7, sprite: 'fm_packer' },
];
export const MACHINE_COST = [0, 150, 2500, 30000, 300000];
export const SLOTS = 4;

export const RESEARCH = {
  hatch: { name: 'Speedy Hatchery', icon: 'fm_bolt', desc: 'Bigger hatch charge and faster refill', cost: [2, 3, 5], max: 3 },
  hens: { name: 'Happy Hens', icon: 'chicken_idle', desc: 'Chickens lay 30% more eggs', cost: [2, 4, 6], max: 3 },
  feed: { name: 'Golden Feed', icon: 'fm_goldegg', desc: 'Eggs are worth 40% more', cost: [3, 5, 7], max: 3 },
  stampede: { name: 'Mega Stampede', icon: 'fm_arrow', desc: 'Right answers release 50% more chicks', cost: [2, 4], max: 2 },
  fence: { name: 'Fox Fence', icon: 'fm_fence', desc: 'Foxes steal less', cost: [2, 3], max: 2 },
};

export const LAY_RATE = 0.2;          // eggs per chicken per second
export const HATCH_RATE = 5;          // chicks per second while holding
export const BOOST_MULT = 3;
export const BOOST_SECS = 20;
export const BOOST_MAX = 60;
export const REWARD_SECS = 30;        // cash bonus = this many seconds of income
export const REWARD_MIN = 50;

export const coopCost = (k) => Math.round(70 * 2.3 ** k);   // k = coop upgrades bought so far
export const truckCost = (k) => Math.round(60 * 2.25 ** k);  // k = truck upgrades bought so far

export function newFarm() {
  return {
    cash: 50, earned: 50, gold: 0, chickens: 10, charge: 20,
    coops: [1, 0, 0, 0], trucks: [1, 0, 0, 0], machine: 0,
    research: { hatch: 0, hens: 0, feed: 0, stampede: 0, fence: 0 },
    coopBuys: 0, truckBuys: 0, boostUntil: 0, hatched: 0,
    coopSpent: [0, 0, 0, 0], truckSpent: [0, 0, 0, 0], machineSpent: 0,
  };
}

export const capacity = (f) => f.coops.reduce((a, l) => a + (l ? COOP_LV[l].cap : 0), 0);
export const shipCap = (f) => f.trucks.reduce((a, l) => a + (l ? TRUCK_LV[l].cap : 0), 0);
export const chargeMax = (f) => 20 + 15 * f.research.hatch;
export const chargeRefill = (f) => 1.2 * (1 + 0.6 * f.research.hatch);
export const layRate = (f) => f.chickens * LAY_RATE * (1 + 0.3 * f.research.hens);
export const eggValue = (f) => MACHINE_LV[f.machine].mult * (1 + 0.4 * f.research.feed);
/** Eggs actually sold per second (limited by trucks). */
export const shipped = (f) => Math.min(layRate(f), shipCap(f));
export const baseIncome = (f) => shipped(f) * eggValue(f);
export const stampedeSize = (f) => Math.round(Math.max(8, capacity(f) * 0.12) * (1 + 0.5 * f.research.stampede));
export const foxSteal = (f) => [0.2, 0.1, 0.04][f.research.fence];

/** Which slot the next coop / truck purchase upgrades (lowest level first). */
const lowestSlot = (arr, max) => {
  let best = -1;
  arr.forEach((l, i) => { if (l < max && (best < 0 || l < arr[best])) best = i; });
  return best;
};
export const nextCoopSlot = (f) => lowestSlot(f.coops, 5);
export const nextTruckSlot = (f) => lowestSlot(f.trucks, 4);

export function nextCosts(f) {
  const cs = nextCoopSlot(f); const ts = nextTruckSlot(f);
  return {
    coop: cs < 0 ? null : { cash: coopCost(f.coopBuys + 1), slot: cs, level: f.coops[cs] + 1, name: COOP_LV[f.coops[cs] + 1].name },
    truck: ts < 0 ? null : { cash: truckCost(f.truckBuys + 1), slot: ts, level: f.trucks[ts] + 1, name: TRUCK_LV[f.trucks[ts] + 1].name },
    machine: MACHINE_LV[f.machine + 1] ? { cash: MACHINE_COST[f.machine + 1], name: MACHINE_LV[f.machine + 1].name } : null,
  };
}
export function researchCost(f, key) {
  const r = RESEARCH[key]; const lv = f.research[key];
  return lv >= r.max ? null : r.cost[lv];
}

export function fmt(n) {
  n = Math.floor(n || 0);
  if (n < 10000) return '$' + n.toLocaleString('en-NZ');
  const units = [['K', 1e3], ['M', 1e6], ['B', 1e9], ['T', 1e12], ['Q', 1e15]];
  let u = units[0];
  for (const x of units) if (n >= x[1]) u = x;
  const v = n / u[1];
  return '$' + (v >= 100 ? Math.floor(v) : v.toFixed(1)) + u[0];
}
export const fmtN = (n) => (n < 10000 ? Math.floor(n).toLocaleString('en-NZ') : fmt(n).slice(1));

// ---------- actions (run by the host; also used by the balance simulation) ----------
export function step(f, dt, mult = 1) {
  const inc = baseIncome(f) * mult * dt;
  f.cash += inc; f.earned += inc;
  f.charge = Math.min(chargeMax(f), f.charge + chargeRefill(f) * dt);
}
/** Hatch up to n chicks. Returns how many hatched. */
export function hatch(f, n) {
  const k = Math.max(0, Math.min(Math.floor(n), Math.floor(f.charge), capacity(f) - f.chickens));
  f.charge -= k; f.chickens += k; f.hatched += k;
  return k;
}
export function buy(f, kind) {
  const c = nextCosts(f)[kind];
  if (!c || f.cash < c.cash) return null;
  return act(f, { op: 'upgrade', kind, slot: c.slot, level: c.level }) ? c : null;
}

// ---------- tap-a-building actions: build / upgrade / destroy ----------
export const REFUND = 0.5; // destroying gives back half of what was spent on it
export const MAXLV = { coop: 5, truck: 4, machine: 4 };
const ensureSpent = (f) => { f.coopSpent ||= [0, 0, 0, 0]; f.truckSpent ||= [0, 0, 0, 0]; f.machineSpent ||= 0; };
export const levelOf = (f, kind, slot) => (kind === 'coop' ? f.coops[slot] : kind === 'truck' ? f.trucks[slot] : f.machine) || 0;
export const infoOf = (kind, lv) => (kind === 'coop' ? COOP_LV : kind === 'truck' ? TRUCK_LV : MACHINE_LV)[lv];
/** Cost to take a building from its current level up to level `to`. */
export function costTo(f, kind, slot, to) {
  const cur = levelOf(f, kind, slot); let c = 0;
  for (let k = 1; k <= to - cur; k++) c += kind === 'coop' ? coopCost(f.coopBuys + k) : kind === 'truck' ? truckCost(f.truckBuys + k) : MACHINE_COST[cur + k];
  return c;
}
export function refundOf(f, kind, slot) {
  ensureSpent(f);
  const spent = kind === 'coop' ? f.coopSpent[slot] : kind === 'truck' ? f.truckSpent[slot] : f.machineSpent;
  return Math.floor((spent || 0) * REFUND);
}
/** Why a destroy isn't allowed ('' = allowed). */
export function destroyProblem(f, kind, slot) {
  if (!levelOf(f, kind, slot)) return 'Nothing to destroy.';
  if (kind === 'coop' && f.coops.filter(Boolean).length <= 1) return 'You need at least one coop.';
  if (kind === 'truck' && f.trucks.filter(Boolean).length <= 1) return 'You need at least one truck.';
  return '';
}
/** a = { op: 'build'|'upgrade'|'destroy', kind: 'coop'|'truck'|'machine', slot, level } */
export function act(f, a) {
  ensureSpent(f);
  const kind = a.kind; const slot = kind === 'machine' ? 0 : Math.max(0, Math.min(SLOTS - 1, Math.floor(+a.slot || 0)));
  if (!MAXLV[kind]) return null;
  const cur = levelOf(f, kind, slot);
  if (a.op === 'destroy') {
    if (destroyProblem(f, kind, slot)) return null;
    const back = refundOf(f, kind, slot);
    const name = infoOf(kind, cur).name;
    f.cash += back;
    if (kind === 'coop') { f.coops[slot] = 0; f.coopSpent[slot] = 0; f.chickens = Math.min(f.chickens, capacity(f)); }
    else if (kind === 'truck') { f.trucks[slot] = 0; f.truckSpent[slot] = 0; }
    else { f.machine = 0; f.machineSpent = 0; }
    return { op: 'destroy', kind, slot, level: 0, cash: -back, name };
  }
  const to = a.op === 'upgrade' ? cur + 1 : Math.floor(+a.level || 0);
  if (to <= cur || to > MAXLV[kind]) return null;
  const cost = costTo(f, kind, slot, to);
  if (f.cash < cost) return null;
  f.cash -= cost;
  if (kind === 'coop') { f.coops[slot] = to; f.coopBuys += to - cur; f.coopSpent[slot] += cost; }
  else if (kind === 'truck') { f.trucks[slot] = to; f.truckBuys += to - cur; f.truckSpent[slot] += cost; }
  else { f.machine = to; f.machineSpent += cost; }
  return { op: cur ? 'upgrade' : 'build', kind, slot, level: to, cash: cost, name: infoOf(kind, to).name };
}
export function research(f, key) {
  const c = researchCost(f, key);
  if (c == null || f.gold < c) return false;
  f.gold -= c; f.research[key] += 1;
  return true;
}
/** Reward for a correct answer (now = ms clock used for the boost). */
export function answerReward(f, { conf, streak }, now) {
  const free = capacity(f) - f.chickens;
  const want = stampedeSize(f);
  const chicks = Math.max(0, Math.min(want, free));
  f.chickens += chicks; f.hatched += chicks;
  let cash = Math.max(REWARD_MIN, baseIncome(f) * REWARD_SECS) + (want - chicks) * eggValue(f) * 5; // no room? the extra chicks are sold
  let gold = 1;
  if (conf === 'sure') gold += 1;
  if (streak && streak % 3 === 0) { gold += 1; cash *= 2; }
  f.cash += cash; f.earned += cash; f.gold += gold;
  f.charge = chargeMax(f);
  f.boostUntil = Math.min(now + BOOST_MAX * 1000, Math.max(f.boostUntil, now) + BOOST_SECS * 1000);
  return { chicks, cash: Math.round(cash), gold, boost: Math.round((f.boostUntil - now) / 1000) };
}
