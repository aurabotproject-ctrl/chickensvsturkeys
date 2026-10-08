// Coop Wars drawing helpers shared by the projector and the phones (PixiJS v7).
/* global PIXI */
import { sprite } from '../../core/assets.js';
import { MAP_W, MAP_H, KINDS, tier, rng } from './map.js';

export const TW_SPRITES = [
  'fm_coop_c1', 'fm_coop_c2', 'fm_coop_c3', 'fm_coop_c4', 'fm_coop_c5',
  'fm_coop_t1', 'fm_coop_t2', 'fm_coop_t3', 'fm_coop_t4', 'fm_coop_t5',
  'fm_tower', 'fm_tractor', 'fm_goldegg', 'fm_hay', 'fm_tree', 'fm_tree2', 'fm_pond', 'fm_scarecrow', 'fm_veg', 'fm_silo',
  'chicken_idle', 'chicken_run', 'turkey_idle', 'turkey_run', 'sparkle', 'impact', 'feathers', 'puff', 'word_pow', 'word_bok', 'word_gobble',
];
export const COLORS = { chicken: 0x1e6fe0, turkey: 0xe0402a, null: 0x8a94a8 };

export async function loadTextures() {
  const urls = TW_SPRITES.map(sprite);
  const loaded = await PIXI.Assets.load(urls);
  const tex = {}; TW_SPRITES.forEach((n, i) => { tex[n] = loaded[urls[i]]; });
  return tex;
}

/** Grass field + decorations (same layout on every device thanks to the seed). */
export function drawBackground(tex, seed, buildings, walls, rot = 0) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(0x5f9d2c).drawRoundedRect(-60, -60, MAP_W + 120, MAP_H + 120, 40).endFill();
  g.beginFill(0x7ec850).drawRoundedRect(0, 0, MAP_W, MAP_H, 30).endFill();
  const R = rng(seed + 7);
  for (let i = 0; i < 90; i++) g.beginFill(R() < 0.5 ? 0x8fd45c : 0x71b944, 0.7).drawEllipse(R() * MAP_W, R() * MAP_H, 30 + R() * 90, 14 + R() * 40).endFill();
  for (let i = 0; i < 220; i++) { const x = R() * MAP_W; const y = R() * MAP_H; g.lineStyle(2, 0x4f8a22, 0.6).moveTo(x, y).lineTo(x - 3, y - 7).moveTo(x, y).lineTo(x + 3, y - 8); }
  g.lineStyle(0);
  // team home tints
  g.beginFill(COLORS.chicken, 0.07).drawRoundedRect(0, 0, 380, MAP_H, 30).endFill();
  g.beginFill(COLORS.turkey, 0.07).drawRoundedRect(MAP_W - 380, 0, 380, MAP_H, 30).endFill();
  c.addChild(g);
  const decos = ['fm_tree', 'fm_tree2', 'fm_tree', 'fm_veg', 'fm_scarecrow', 'fm_pond'];
  const clear = (x, y, d) => buildings.every((b) => Math.hypot(b.x - x, b.y - y) > d + KINDS[b.k].r);
  for (let i = 0, tries = 0; i < 26 && tries < 600; tries++) {
    const edge = R() < 0.75;
    const x = edge ? (R() < 0.5 ? R() * 90 : MAP_W - R() * 90) : R() * MAP_W;
    const y = edge ? R() * MAP_H : (R() < 0.5 ? R() * 60 : MAP_H - R() * 60);
    if (!clear(x, y, 50)) continue;
    const name = decos[Math.floor(R() * decos.length)];
    const s = new PIXI.Sprite(tex[name]); s.anchor.set(0.5, 0.85); s.position.set(x, y); s.rotation = -rot;
    s.scale.set((name === 'fm_pond' ? 110 : name === 'fm_tree' || name === 'fm_tree2' ? 60 : 50) / s.texture.width);
    c.addChild(s); i++;
  }
  // hay-bale walls
  for (const w of walls) {
    const len = Math.hypot(w[2] - w[0], w[3] - w[1]); const n = Math.max(2, Math.round(len / 44));
    for (let k = 0; k <= n; k++) {
      const t = k / n; const s = new PIXI.Sprite(tex.fm_hay); s.anchor.set(0.5, 0.7); s.rotation = -rot;
      s.position.set(w[0] + (w[2] - w[0]) * t, w[1] + (w[3] - w[1]) * t); s.scale.set(52 / s.texture.width);
      c.addChild(s);
    }
  }
  return c;
}

const desat = () => { const f = new PIXI.ColorMatrixFilter(); f.desaturate(); f.brightness(1.08, true); return [f]; };

/** One building: ring, sprite, level badge, optional name tag. Returns a view to update. */
export function makeBuilding(tex, b, { counterRotate = 0 } = {}) {
  const root = new PIXI.Container(); root.position.set(b.x, b.y);
  const range = new PIXI.Graphics(); // sniper / neutral defence range
  const ring = new PIXI.Graphics();
  const body = new PIXI.Container(); body.rotation = counterRotate;
  const spr = new PIXI.Sprite(PIXI.Texture.EMPTY); spr.anchor.set(0.5, 0.78);
  const badge = new PIXI.Container();
  const badgeBg = new PIXI.Graphics();
  const lvText = new PIXI.Text('0', { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 26, fill: 0xffffff, stroke: 0x111111, strokeThickness: 5 });
  lvText.anchor.set(0.5);
  const dots = new PIXI.Graphics();
  badge.addChild(badgeBg, lvText, dots);
  const tag = new PIXI.Text('', { fontFamily: 'Nunito, sans-serif', fontWeight: '900', fontSize: 15, fill: 0xffffff, stroke: 0x111111, strokeThickness: 4 });
  tag.anchor.set(0.5, 0);
  body.addChild(ring, spr, badge, tag);
  root.addChild(range, body);
  const v = { root, range, ring, body, spr, badge, badgeBg, lvText, dots, tag, last: {} };
  return v;
}

export function updateBuilding(tex, v, b, { mine = false, name = '', showRange = true, time = 0, big = 1 } = {}) {
  const k = KINDS[b.k]; const team = b.team || null;
  v.root.visible = !(b.k === 'gold' && b.lv <= 0);
  const key = `${b.k}|${team}|${b.k === 'gold' ? 0 : tier(b.lv)}|${mine}`;
  if (v.last.key !== key) {
    v.last.key = key;
    let texName; let size;
    if (b.k === 'sniper') { texName = 'fm_tower'; size = 62; } else if (b.k === 'shed') { texName = 'fm_tractor'; size = 74; } else if (b.k === 'gold') { texName = 'fm_goldegg'; size = 50; } else {
      const t = b.k === 'fort' ? 5 : tier(b.lv);
      texName = `fm_coop_${team === 'turkey' ? 't' : 'c'}${t}`;
      size = b.k === 'fort' ? 150 : 72 + t * 7;
    }
    v.spr.texture = tex[texName];
    v.spr.scale.set((size * big) / v.spr.texture.width);
    v.badge.scale.set(big > 1 ? big * 1.15 : 1); v.tag.scale.set(big > 1 ? big * 1.2 : 1);
    v.spr.filters = team || b.k === 'gold' ? null : desat();
    v.spr.tint = b.k === 'shed' && team ? (team === 'chicken' ? 0xbcd6ff : 0xffc4b8) : 0xffffff;
    v.ring.clear();
    if (b.k !== 'gold') {
      const rr = k.r * big;
      if (mine) v.ring.lineStyle(7 * big, 0xffc72c, 1).drawEllipse(0, 4, rr + 12, (rr + 12) * 0.45);
      v.ring.lineStyle(0).beginFill(COLORS[team], team ? 0.55 : 0.35).drawEllipse(0, 4, rr + 4, (rr + 4) * 0.42).endFill();
    }
    const bw = b.k === 'fort' ? 70 : 52;
    v.badgeBg.clear().lineStyle(4, 0x111111).beginFill(b.k === 'gold' ? 0xffc72c : COLORS[team]).drawRoundedRect(-bw / 2, -17, bw, 34, 12).endFill();
    v.badge.y = -(v.spr.height * 0.78) - 12 * big;
    v.tag.y = (12 + (b.k === 'fort' ? 30 : 6)) * big;
  }
  if (v.last.lv !== b.lv) { v.last.lv = b.lv; v.lvText.text = b.lv >= k.max ? 'MAX' : String(b.lv); v.lvText.style.fill = b.k === 'gold' ? 0x111111 : 0xffffff; v.lvText.style.strokeThickness = b.k === 'gold' ? 0 : 5; }
  // milestone pips (1 per extra path unlocked)
  const pips = k.gen ? (b.lv >= 20 ? 2 : b.lv >= 10 ? 1 : 0) : 0;
  if (v.last.pips !== pips) { v.last.pips = pips; v.dots.clear(); for (let i = 0; i < pips; i++) v.dots.beginFill(0xffffff).lineStyle(2, 0x111111).drawCircle((i - (pips - 1) / 2) * 12, 24, 5).endFill(); }
  if (v.last.name !== name) { v.last.name = name; v.tag.text = name; }
  // defence range circle
  const r = rangeOf(b);
  const showR = showRange && r > 0;
  if (v.last.r !== (showR ? r : 0) || v.last.rt !== team) {
    v.last.r = showR ? r : 0; v.last.rt = team;
    v.range.clear();
    if (showR) v.range.lineStyle(3, 0xffffff, 0.55).beginFill(0xffffff, b.k === 'sniper' ? 0.12 : 0.06).drawCircle(0, 0, r).endFill();
  }
  if (mine) v.ring.alpha = 0.75 + 0.25 * Math.sin(time * 5);
}

/** Defence range: snipers always shoot; neutral buildings defend themselves. */
export function rangeOf(b) {
  if (b.k === 'sniper') return Math.min(240, 140 + b.lv * 2);
  return 0;
}
/** Grey (unclaimed) coops fight back a little against troops attacking them. */
export const guardsSelf = (b) => !b.team && (b.k === 'coop' || b.k === 'fort' || b.k === 'shed');
