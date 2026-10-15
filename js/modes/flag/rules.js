// =========================================================
// CAPTURE THE FLAG — rules shared by the host and the devices.
//   • The field has two halves: Chickens (left) and Turkeys (right).
//   • On your own half you can't be tagged. On the other half you can —
//     except inside their FLAG AREA (the safe circle round their flag).
//   • A tag = an opponent overlapping you for a whole second (½ second if 2+ opponents
//     overlap you) → you're FROZEN on the spot until a teammate overlaps you for a whole
//     second (½ second if 2+ teammates do).
//   • Run into their flag area to grab the flag; get it back over the
//     halfway line = 1 point and the flag goes home. Tagged while carrying
//     it = the flag goes home and you're frozen.
//   • You can't stand in your OWN flag area (no guarding inside the safe zone).
//   • Speed for the 1-minute play comes from right answers in the question round.
// =========================================================

export const FW = 160; export const FH = 90; export const MID = FW / 2;
export const PR = 2.6;                 // runner radius (field units)
export const TAG_D = PR * 1.75;        // centres this close = overlapping
export const TAG_TIME = 1;             // seconds of overlap for a tag (or a rescue)
export const IMMUNE = 2;               // seconds of safety after being freed
export const ZR = 10;                  // flag-area radius
export const ZONE = { chicken: { x: 13, y: FH / 2 }, turkey: { x: FW - 13, y: FH / 2 } };
export const BATTLE_MS = 60000;        // play time per round
export const BASE_SPEED = 9; export const SPEED_PER = 1.2; export const MAX_SPEED = 22;
export const speedFor = (rc) => Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER * (rc || 0));
export const enemyOf = (team) => (team === 'chicken' ? 'turkey' : 'chicken');
export const sideOf = (x) => (x < MID ? 'chicken' : 'turkey');
export const inZone = (p, team) => Math.hypot(p.x - ZONE[team].x, p.y - ZONE[team].y) < ZR;

// ---------- packed positions: 10 characters per runner ----------
// id(2) x·10(3) y·10(3) state(1: bit1 frozen, bit2 carrying, bit4 safe after rescue) progress(1: 0-9 tag/rescue meter)
const B36 = (n, w) => Math.max(0, Math.min(36 ** w - 1, Math.round(n))).toString(36).padStart(w, '0');
export function packRunner(p) {
  const st = (p.frozen ? 1 : 0) + (p.carry ? 2 : 0) + (p.immune > 0 ? 4 : 0);
  const prog = Math.min(9, Math.floor((p.frozen ? p.freeT : p.tagT) * 10 / TAG_TIME));
  return B36(p.i, 2) + B36(p.x * 10, 3) + B36(p.y * 10, 3) + st + prog;
}
export function unpackRunners(str) {
  const out = [];
  for (let k = 0; k + 10 <= str.length; k += 10) {
    const st = +str[k + 8];
    out.push({ i: parseInt(str.slice(k, k + 2), 36), x: parseInt(str.slice(k + 2, k + 5), 36) / 10, y: parseInt(str.slice(k + 5, k + 8), 36) / 10,
      frozen: !!(st & 1), carry: !!(st & 2), immune: !!(st & 4), prog: +str[k + 9] / 9 });
  }
  return out;
}
