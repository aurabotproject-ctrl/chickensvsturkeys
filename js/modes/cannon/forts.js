// Fort designs for Egg Cannon. Coordinates are for the CHICKEN fort
// (lx = 0 at the back, 320 at the front facing the enemy; ly = height of
// the piece's bottom above the ground). Turkey forts are mirrored.
// Pieces: [type, lx, ly]
export const FORTS = [
  { name: 'Twin Towers', pieces: [
    ['pillar', 30, 0], ['pillar', 150, 0], ['dummy', 90, 0],
    ['plank', 90, 120],
    ['block', 30, 144], ['block', 150, 144], ['bullseye', 90, 144],
    ['glass', 30, 204], ['glass', 150, 204],
    ['plank', 90, 252], ['roof', 90, 276],
    ['tnt', 196, 0],
    ['stone', 262, 0], ['stone', 262, 54], ['dummy', 262, 108],
    ['hay', 326, 0], ['hay', 326, 52],
  ] },
  { name: 'Castle Keep', pieces: [
    ['metal', 20, 0], ['metal', 20, 50], ['metal', 170, 0], ['metal', 170, 50],
    ['pumpkin', 95, 0],
    ['plank', 95, 100],
    ['window', 30, 124], ['window', 160, 124], ['dummy', 95, 124],
    ['glass', 30, 184], ['glass', 160, 184],
    ['log', 232, 0], ['barrel', 300, 0], ['glass', 300, 58], ['glass', 300, 106], ['bullseye', 300, 154],
  ] },
  { name: 'Hay Fortress', pieces: [
    ['crate', 30, 0], ['crate', 30, 54], ['crate', 140, 0], ['crate', 140, 54],
    ['dummy', 85, 0],
    ['plank', 85, 108], ['bullseye', 85, 132],
    ['tnt', 220, 0],
    ['hay', 300, 0], ['hay', 300, 52], ['hay', 300, 104], ['dummy', 300, 156],
  ] },
];

// Size, material, health and art for each piece.
export const PIECES = {
  pillar: { w: 24, h: 120, mat: 'wood', hp: 60, tex: (t) => `f_${t}_plank`, rotTex: true },
  plank: { w: 210, h: 24, mat: 'wood', hp: 70, tex: (t) => `f_${t}_plank` },
  short: { w: 110, h: 24, mat: 'wood', hp: 60, tex: (t) => `f_${t}_short` },
  block: { w: 60, h: 60, mat: 'wood', hp: 80, tex: (t) => `f_${t}_block` },
  crate: { w: 54, h: 54, mat: 'wood', hp: 60, tex: (t) => `f_${t}_crate` },
  window: { w: 60, h: 60, mat: 'wood', hp: 70, tex: (t) => `f_${t}_window` },
  tri: { w: 120, h: 62, mat: 'wood', hp: 70, tex: (t) => `f_${t}_tri`, shape: 'tri' },
  roof: { w: 170, h: 84, mat: 'wood', hp: 80, tex: (t) => `f_${t}_roof`, shape: 'roof' },
  log: { r: 28, mat: 'wood', hp: 90, tex: (t) => `f_${t}_log`, shape: 'circle' },
  stone: { w: 54, h: 54, mat: 'stone', hp: 160, tex: () => 'f_stone', cracked: 'f_stone2', broken: 'f_stone3' },
  glass: { w: 48, h: 48, mat: 'glass', hp: 30, tex: () => 'f_glass', cracked: 'f_glass2', broken: 'f_glass3' },
  metal: { w: 50, h: 50, mat: 'metal', hp: 260, tex: () => 'f_metal', cracked: 'f_metal2', broken: 'f_metal3' },
  hay: { w: 70, h: 52, mat: 'hay', hp: 50, tex: () => 'f_hay', cracked: 'f_hay2', broken: 'f_hay3' },
  // targets (worth points)
  dummy: { w: 54, h: 104, target: 1, hp: 35, tex: (t) => `t_${t}`, cracked: (t) => `t_${t}_scared`, broken: (t) => `t_${t}_ko` },
  bullseye: { w: 56, h: 80, target: 2, hp: 35, tex: () => 't_bullseye' },
  pumpkin: { r: 30, target: 1, hp: 35, tex: () => 't_pumpkin', shape: 'circle' },
  barrel: { w: 46, h: 58, target: 1, hp: 40, tex: () => 't_barrel' },
  tnt: { w: 54, h: 54, target: 1, hp: 22, tex: () => 't_tnt', explode: true },
};

export const DENSITY = { wood: 0.0012, stone: 0.0035, glass: 0.0010, metal: 0.0045, hay: 0.0008 };
