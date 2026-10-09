// Coop Wars drawing helpers shared by the projector and the phones (PixiJS v7).
/* global PIXI */
import { sprite } from '../../core/assets.js';
import { MAP_W, MAP_H, KINDS, tier, rng } from './map.js';

const T3 = (base) => ['c', 't', 'n'].map((t) => `${base}${t}`);
export const TW_SPRITES = [
  // dedicated Coop Wars art (assets/images/tw-*.png, sliced)
  ...[1, 2, 3, 4, 5].flatMap((i) => ['c', 't', 'n'].map((t) => `tw_coop_${t}${i}`)),
  ...T3('tw_sniper_'), ...T3('tw_shed_'), ...T3('tw_fort_'), 'tw_gold1', 'tw_gold2', 'tw_gold3',
  'tw_chick1', 'tw_chick2', 'tw_chick3', 'tw_chick4', 'tw_chick_hit', 'tw_turk1', 'tw_turk2', 'tw_turk3', 'tw_turk4', 'tw_turk_hit',
  'tw_tractor_c1', 'tw_tractor_c2', 'tw_tractor_t1', 'tw_tractor_t2',
  'tw_fx_dust', 'tw_fx_wfeath', 'tw_fx_bfeath', 'tw_fx_splat', 'tw_fx_sparkle',
  'tw_hay1', 'tw_hay_round', 'tw_mud', 'tw_rocks', 'tw_stump', 'tw_crate', 'tw_fence', 'tw_fence_broken',
  'tw_captured', 'tw_reinforce', 'tw_conquer', 'tw_map_farm', 'tw_map_autumn', 'tw_map_winter',
  // older farm art kept as a backup
  'fm_coop_c3', 'fm_coop_t3', 'fm_tower', 'fm_tractor', 'fm_goldegg', 'fm_hay',
  'chicken_run', 'turkey_run', 'sparkle', 'impact', 'feathers', 'puff', 'word_bok', 'word_gobble',
];
/** Map themes — each game picks one at random (same on every device, from the map seed). */
export const MAP_THEMES = ['tw_map_farm', 'tw_map_autumn', 'tw_map_winter'];
const FALLBACK = { coop: 'fm_coop_c3', sniper: 'fm_tower', shed: 'fm_tractor', fort: 'fm_coop_c3', gold: 'fm_goldegg' };
export const COLORS = { chicken: 0x1e6fe0, turkey: 0xe0402a, null: 0x8a94a8 };

export async function loadTextures() {
  const urls = TW_SPRITES.map(sprite);
  // load one by one so a single missing file never breaks the game
  const res = await Promise.allSettled(urls.map((u) => PIXI.Assets.load(u)));
  const tex = {}; TW_SPRITES.forEach((n, i) => { if (res[i].status === 'fulfilled') tex[n] = res[i].value; });
  return tex;
}

/** Farm field (painted map) + a few props + hay-bale walls. Same on every device thanks to the seed. */
export function drawBackground(tex, seed, buildings, walls, rot = 0) {
  const c = new PIXI.Container();
  const R = rng(seed + 7);
  const pick = MAP_THEMES[Math.floor(R() * MAP_THEMES.length)];
  const theme = (typeof window !== 'undefined' && window.cvtTheme) || pick; // cvtTheme: testing override
  if (tex[theme]) {
    // the painted map has scenery round its border, so stretch it a little past the playing field
    const g0 = new PIXI.Graphics(); g0.beginFill(0x3f7a1f).drawRoundedRect(-118, -88, MAP_W + 236, MAP_H + 176, 46).endFill(); c.addChild(g0);
    const bg = new PIXI.Sprite(tex[theme]); bg.position.set(-110, -80); bg.width = MAP_W + 220; bg.height = MAP_H + 160;
    const mask = new PIXI.Graphics(); mask.beginFill(0xffffff).drawRoundedRect(-110, -80, MAP_W + 220, MAP_H + 160, 40).endFill();
    bg.mask = mask; c.addChild(bg, mask);
  } else {
    const g = new PIXI.Graphics();
    g.beginFill(0x5f9d2c).drawRoundedRect(-60, -60, MAP_W + 120, MAP_H + 120, 40).endFill();
    g.beginFill(0x7ec850).drawRoundedRect(0, 0, MAP_W, MAP_H, 30).endFill();
    for (let i = 0; i < 90; i++) g.beginFill(R() < 0.5 ? 0x8fd45c : 0x71b944, 0.7).drawEllipse(R() * MAP_W, R() * MAP_H, 30 + R() * 90, 14 + R() * 40).endFill();
    g.beginFill(COLORS.chicken, 0.07).drawRoundedRect(0, 0, 380, MAP_H, 30).endFill();
    g.beginFill(COLORS.turkey, 0.07).drawRoundedRect(MAP_W - 380, 0, 380, MAP_H, 30).endFill();
    c.addChild(g);
  }
  // a few props in empty spots (mirrored so both sides look the same)
  const props = [['tw_mud', 110], ['tw_rocks', 80], ['tw_stump', 62], ['tw_crate', 52], ['tw_fence_broken', 84], ['tw_hay_round', 56]].filter(([n]) => tex[n]);
  const clear = (x, y, d) => buildings.every((b) => Math.hypot(b.x - x, b.y - y) > d + KINDS[b.k].r + 30)
    && walls.every((w) => Math.hypot((w[0] + w[2]) / 2 - x, (w[1] + w[3]) / 2 - y) > d + 90);
  const placed = [];
  for (let i = 0, tries = 0; props.length && i < 4 && tries < 400; tries++) {
    const x = 120 + R() * (MAP_W / 2 - 180); const y = 70 + R() * (MAP_H - 140);
    if (!clear(x, y, 46) || !clear(MAP_W - x, MAP_H - y, 46) || placed.some((p) => Math.hypot(p[0] - x, p[1] - y) < 160)) continue;
    placed.push([x, y]);
    const [name, w] = props[Math.floor(R() * props.length)];
    for (const [px, py] of [[x, y], [MAP_W - x, MAP_H - y]]) {
      const s = new PIXI.Sprite(tex[name]); s.anchor.set(0.5, 0.7); s.position.set(px, py); s.rotation = -rot;
      s.scale.set(w / s.texture.width); s.alpha = 0.95; c.addChild(s);
    }
    i++;
  }
  // hay-bale walls
  const hay = tex.tw_hay1 || tex.fm_hay;
  for (const w of walls) {
    const len = Math.hypot(w[2] - w[0], w[3] - w[1]); const n = Math.max(2, Math.round(len / 40));
    for (let k = 0; k <= n; k++) {
      const t = k / n; const s = new PIXI.Sprite(k % 3 === 1 && tex.tw_hay_round ? tex.tw_hay_round : hay); s.anchor.set(0.5, 0.7); s.rotation = -rot;
      s.position.set(w[0] + (w[2] - w[0]) * t, w[1] + (w[3] - w[1]) * t); s.scale.set(50 / s.texture.width);
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

export function updateBuilding(tex, v, b, { mine = false, name = '', showRange = true, time = 0, big = 1, soft = false } = {}) {
  const k = KINDS[b.k]; const team = b.team || null;
  v.root.visible = !(b.k === 'gold' && b.lv <= 0);
  const key = `${b.k}|${team}|${b.k === 'gold' ? goldSize(b.lv) : tier(b.lv)}|${mine}`;
  if (v.last.key !== key) {
    v.last.key = key;
    const t = team === 'chicken' ? 'c' : team === 'turkey' ? 't' : 'n';
    const tr = b.k === 'fort' ? 5 : tier(b.lv);
    let texName; let size; let plate; // plate = where the blank badge plate sits (fraction from the top)
    if (b.k === 'sniper') { texName = `tw_sniper_${t}`; size = 90; plate = 0.33; }
    else if (b.k === 'shed') { texName = `tw_shed_${t}`; size = 110; plate = 0.12; }
    else if (b.k === 'gold') { texName = `tw_gold${goldSize(b.lv)}`; size = 58 + goldSize(b.lv) * 8; plate = -0.25; }
    else if (b.k === 'fort') { texName = `tw_fort_${t}`; size = 196; plate = 0.27; }
    else { texName = `tw_coop_${t}${tr}`; size = 84 + tr * 5; plate = 0.11; }
    let tx = tex[texName]; let old = false;
    if (!tx) { // backup art
      old = true;
      tx = b.k === 'coop' || b.k === 'fort' ? tex[`fm_coop_${team === 'turkey' ? 't' : 'c'}3`] : tex[FALLBACK[b.k]];
      plate = -0.15;
    }
    v.spr.texture = tx || PIXI.Texture.WHITE;
    v.spr.scale.set((size * big) / v.spr.texture.width);
    v.badge.scale.set(big > 1 ? big * 1.15 : 1); v.tag.scale.set(big > 1 ? big * 1.2 : 1);
    v.spr.filters = old && !team && b.k !== 'gold' ? desat() : null;
    v.spr.tint = 0xffffff;
    v.ring.clear();
    if (b.k !== 'gold') {
      const rr = k.r * big;
      if (mine) v.ring.lineStyle((soft ? 4 : 7) * big, 0xffc72c, 1).drawEllipse(0, 4, rr + 12, (rr + 12) * 0.45);
      v.ring.lineStyle(0).beginFill(COLORS[team], team ? 0.55 : 0.35).drawEllipse(0, 4, rr + 4, (rr + 4) * 0.42).endFill();
    }
    const bw = b.k === 'fort' ? 70 : 52;
    v.badgeBg.clear().lineStyle(4, 0x111111).beginFill(b.k === 'gold' ? 0xffc72c : COLORS[team]).drawRoundedRect(-bw / 2, -17, bw, 34, 12).endFill();
    v.badge.y = -(v.spr.height * 0.78) + v.spr.height * plate;
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
  if (mine) v.ring.alpha = soft ? 0.85 : 0.75 + 0.25 * Math.sin(time * 5);
}

const goldSize = (lv) => (lv >= 14 ? 3 : lv >= 7 ? 2 : 1);

/** Defence range: snipers always shoot; neutral buildings defend themselves. */
export function rangeOf(b) {
  if (b.k === 'sniper') return Math.min(240, 140 + b.lv * 2);
  return 0;
}
/** Grey (unclaimed) coops fight back a little against troops attacking them. */
export const guardsSelf = (b) => !b.team && (b.k === 'coop' || b.k === 'fort' || b.k === 'shed');
