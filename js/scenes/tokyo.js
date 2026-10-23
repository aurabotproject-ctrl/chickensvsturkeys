// AUTO-BUILT by tools/build_tokyo.py from extras/code-characters.html — edit that page, then re-run the script.
// Tokyo Crossing: a code-drawn city crossing full of chickens and turkeys (no images).
// mountTokyo(canvas, { onStatus }) → { press(), destroy() }

export function mountTokyo(canvas, { onStatus = () => {} } = {}) {
let ctx = canvas.getContext('2d');
const INK = '#141414';
const OUT = 7; // outline thickness

// ---------- little drawing helpers ----------
/** Fill a path, then outline it in thick comic-book ink. */
function shape(build, fill, line = OUT) {
  ctx.beginPath(); build(); ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
/**
 * Several shapes that should look like ONE blob with a single outline (e.g. head + body):
 * stroke them all thickly first, then fill them all on top, so the inside lines disappear.
 */
function blob(builders, fill, line = OUT) {
  ctx.lineWidth = line * 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  for (const b of builders) { ctx.beginPath(); b(); ctx.stroke(); }
  ctx.fillStyle = fill;
  for (const b of builders) { ctx.beginPath(); b(); ctx.fill(); }
}
const ell = (x, y, rx, ry, rot = 0) => () => ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
const circ = (x, y, r) => () => ctx.arc(x, y, r, 0, Math.PI * 2);
/** Cel shading: paint `fill` only inside the clip shape. */
function shadeInside(clipBuild, paint) {
  ctx.save(); ctx.beginPath(); clipBuild(); ctx.clip(); paint(); ctx.restore();
}
function line(points, width, color = INK) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

// ---------- parts both birds share ----------
function legs(t) {
  for (const [x, lean] of [[262, -6], [338, 6]]) {
    // leg = an orange stick with an ink outline
    line([[x, 405], [x + lean, 470]], 22); line([[x, 405], [x + lean, 470]], 11, '#f39a1d');
    // three chunky toes
    const fx = x + lean; const fy = 472;
    for (const a of [-2.5, -1.57, -0.6]) {
      const tx = fx + Math.cos(a + Math.PI) * -34 * (a === -1.57 ? 0.2 : 1); const ty = fy + 16 + (a === -1.57 ? 8 : 0);
      const toe = [[fx, fy], [fx + (a < -2 ? -34 : a > -1 ? 34 : 4), ty]];
      line(toe, 22); line(toe, 11, '#f39a1d');
    }
  }
}

/** The angry hero eye. look = which way the pupil points; blink 0..1 closes it. */
function eye(x, y, blink, browTilt = 0.32) {
  const open = 1 - blink;
  if (open > 0.08) {
    shape(ell(x, y, 22, 26 * open), '#fff', 5);
    shadeInside(ell(x, y, 22, 26 * open), () => {
      shape(circ(x + 8, y + 4, 11), INK, 0);
      shape(circ(x + 12, y - 1, 3.6), '#fff', 0);
    });
  } else line([[x - 20, y], [x + 20, y]], 6);
  // the determined brow
  ctx.save(); ctx.translate(x, y - 30); ctx.rotate(browTilt);
  shape(() => ctx.roundRect(-30, -8, 58, 15, 7), INK, 0);
  ctx.restore();
}

function beak(x, y) {
  shape(() => { ctx.moveTo(x, y - 20); ctx.quadraticCurveTo(x + 40, y - 14, x + 62, y + 6); ctx.quadraticCurveTo(x + 36, y + 22, x, y + 24); ctx.closePath(); }, '#ffc72c');
  shadeInside(() => { ctx.moveTo(x, y - 20); ctx.quadraticCurveTo(x + 40, y - 14, x + 62, y + 6); ctx.quadraticCurveTo(x + 36, y + 22, x, y + 24); ctx.closePath(); },
    () => { ctx.fillStyle = '#e8961a'; ctx.fillRect(x - 5, y + 6, 80, 30); });
  line([[x + 6, y + 5], [x + 50, y + 6]], 4);
}

/** Headband across the forehead with its knot and two tails blowing behind. */
function headband(cx, cy, r, color, dark, t) {
  const top = -r * 0.7; const h = r * 0.38; const tilt = -0.1;
  const bandRect = () => { const m = ctx.getTransform(); ctx.translate(cx, cy); ctx.rotate(tilt); ctx.rect(-r - 12, top, r * 2 + 24, h); ctx.setTransform(m); };
  // tails flapping in the wind (behind the head, so draw first)
  const kx = cx - r * 0.86; const ky = cy + top * 0.72 + 6;
  for (const [len, lift, ph] of [[100, -26, 0], [84, 16, 1.7]]) {
    const w = Math.sin(t * 7 + ph) * 10;
    shape(() => {
      ctx.moveTo(kx, ky - 8);
      ctx.bezierCurveTo(kx - len * 0.35, ky - 16 + lift + w, kx - len * 0.7, ky + lift - w, kx - len, ky + lift + w);
      ctx.lineTo(kx - len + 8, ky + lift + 20 + w);
      ctx.bezierCurveTo(kx - len * 0.65, ky + lift + 14 - w, kx - len * 0.35, ky + 6 + lift + w, kx, ky + 12);
      ctx.closePath();
    }, color);
  }
  // the band itself, clipped to the head so it wraps around it
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r + OUT / 2, 0, Math.PI * 2); ctx.clip();
  shape(bandRect, color);
  ctx.save(); ctx.beginPath(); bandRect(); ctx.clip();
  ctx.fillStyle = dark; ctx.translate(cx, cy); ctx.rotate(tilt); ctx.fillRect(-r - 12, top + h * 0.62, r * 2 + 24, h * 0.38); ctx.restore();
  ctx.restore();
  // put the head's outline back where the band covered it
  ctx.save(); ctx.beginPath(); bandRect(); ctx.clip();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = OUT; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  shape(circ(kx, ky + 2, 15), color); // the knot
  shape(circ(kx - 2, ky, 5), dark, 0);
}

function wristband(x, y, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  shape(() => ctx.roundRect(-24, -13, 48, 26, 9), color);
  line([[-18, 0], [18, 0]], 3, 'rgba(255,255,255,.5)');
  ctx.restore();
}


// =====================================================================
//   THE CHICKEN — edit me! Colours are in C at the top. Positions are
//   x (0 = left, 600 = right) and y (0 = top, 600 = bottom).
// =====================================================================
function drawChicken(t, blink) {
  const C = { white: '#fbf8f0', shade: '#dcd5c6', red: '#e53b2a', redDark: '#b02a1c', blue: '#2f7de1', blueDark: '#174f9e' };

  // tail feathers fanning out behind
  for (const [a, len] of [[-2.5, 92], [-2.85, 100], [-3.2, 88], [-3.5, 70]]) {
    const wob = Math.sin(t * 2 + a) * 0.04;
    shape(ell(185 + Math.cos(a + wob) * 40, 300 + Math.sin(a + wob) * 40, len * 0.62, 26, a + wob), C.white);
  }
  legs(t);

  // comb (behind the head)
  blob([circ(330, 140, 26), circ(366, 126, 31), circ(402, 142, 24), ell(366, 160, 50, 22)], C.red);
  shadeInside(() => { circ(366, 126, 31)(); }, () => { ctx.fillStyle = C.redDark; ctx.beginPath(); ctx.arc(352, 140, 28, 0, Math.PI * 2); ctx.fill(); });

  // body + head as one fluffy blob
  const body = ell(292, 335, 122, 104); const head = circ(362, 218, 78); const neck = ell(335, 270, 62, 60);
  blob([body, head, neck], C.white);
  // cel shading along the bottom/back
  shadeInside(body, () => { ctx.fillStyle = C.shade; ctx.beginPath(); ctx.ellipse(270, 410, 150, 70, -0.15, 0, Math.PI * 2); ctx.fill(); });
  // chest fluff scallops
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(368 + i * 6, 305 + i * 22, 16, -0.6, 1.4); ctx.lineWidth = 4; ctx.strokeStyle = C.shade; ctx.stroke(); }

  headband(362, 218, 78, C.blue, C.blueDark, t);
  eye(390, 222, blink);
  beak(424, 236);
  // wattle under the beak
  shape(() => { ctx.moveTo(424, 262); ctx.bezierCurveTo(446, 268, 446, 300, 428, 304); ctx.bezierCurveTo(410, 300, 410, 272, 424, 262); }, C.red);
  // rosy cheek
  shape(ell(360, 250, 14, 9), 'rgba(255,120,110,.45)', 0);

  // wing with a blue wristband, flapping a little
  ctx.save(); ctx.translate(300, 330); ctx.rotate(Math.sin(t * 3) * 0.06);
  shape(() => { ctx.moveTo(-60, -30); ctx.bezierCurveTo(-10, -60, 60, -30, 64, 20); ctx.bezierCurveTo(40, 40, 0, 48, -30, 30); ctx.bezierCurveTo(-60, 10, -70, -14, -60, -30); }, C.white);
  for (const [x, y] of [[-30, 14], [0, 24], [30, 22]]) { ctx.beginPath(); ctx.arc(x, y, 16, 0.2, 2.8); ctx.lineWidth = 4; ctx.strokeStyle = C.shade; ctx.stroke(); }
  wristband(44, 8, -0.9, C.blue);
  ctx.restore();
}

// =====================================================================
//   THE TURKEY — edit me! Colours are in T at the top, tail colours in RINGS.
//   x (0 = left, 600 = right) and y (0 = top, 600 = bottom).
// =====================================================================
function drawTurkey(t, blink) {
  const T = { brown: '#8a5328', brownDark: '#5f3618', cream: '#f3d39a', red: '#d8402b', head: '#e5543c', headDark: '#b8361f', band: '#d62828', bandDark: '#8e1414' };
  const RINGS = [
    { len: 205, color: '#d8402b', tip: '#9c2416' },
    { len: 178, color: '#f08a24', tip: '#c45f0e' },
    { len: 150, color: '#f5c242', tip: '#d39a12' },
    { len: 122, color: '#2a9d8f', tip: '#1b6b61' },
  ];
  // the giant fanned tail, swaying slowly
  const cx = 268; const cy = 318; const sway = Math.sin(t * 1.6) * 0.03;
  RINGS.forEach((ring, k) => {
    const n = 11 - k; const from = -Math.PI * 1.04; const to = -Math.PI * -0.02;
    for (let i = 0; i < n; i++) {
      const a = from + ((to - from) * (i + 0.5 + (k % 2) * 0.5)) / (n + (k % 2)) + sway;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      shape(() => ctx.ellipse(ring.len * 0.55, 0, ring.len * 0.5, 30 - k * 2, 0, 0, Math.PI * 2), ring.color);
      // darker band near the tip of each feather
      shadeInside(() => ctx.ellipse(ring.len * 0.55, 0, ring.len * 0.5, 30 - k * 2, 0, 0, Math.PI * 2),
        () => { ctx.fillStyle = ring.tip; ctx.fillRect(ring.len * 0.88, -40, 60, 80); });
      ctx.restore();
    }
  });
  legs(t);

  // body + neck + head as one blob
  const body = ell(292, 340, 126, 108); const neck = ell(352, 262, 50, 64, 0.3); const head = circ(372, 206, 62);
  blob([body, neck], T.brown);
  shadeInside(body, () => { ctx.fillStyle = T.brownDark; ctx.beginPath(); ctx.ellipse(250, 420, 160, 70, -0.1, 0, Math.PI * 2); ctx.fill(); });
  // cream chest bib with feather scallops (the turkey's proud chest)
  shadeInside(body, () => {
    shape(ell(392, 330, 62, 92, -0.2), T.cream, 5);
    shadeInside(ell(392, 330, 62, 92, -0.2), () => {
      for (let row = 0; row < 6; row++) for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(345 + i * 26 + (row % 2) * 13, 262 + row * 26, 14, 0.25, Math.PI - 0.25);
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#c99a55'; ctx.stroke();
      }
    });
  });
  // head (red-orange like the art)
  shape(head, T.head);
  shadeInside(head, () => { ctx.fillStyle = T.headDark; ctx.beginPath(); ctx.arc(340, 240, 52, 0, Math.PI * 2); ctx.fill(); });

  headband(372, 206, 62, T.band, T.bandDark, t);
  eye(398, 212, blink, 0.38);
  beak(430, 226);
  // the snood draping over the beak + a big wattle under the chin
  const sw = Math.sin(t * 4) * 3;
  shape(() => { ctx.moveTo(430, 206); ctx.bezierCurveTo(446, 206, 452 + sw, 236, 444 + sw, 258); ctx.bezierCurveTo(436 + sw, 262, 430, 238, 426, 214); ctx.closePath(); }, T.red, 5);
  shape(() => { ctx.moveTo(420, 250); ctx.bezierCurveTo(456, 262, 452, 318, 426, 322); ctx.bezierCurveTo(398, 318, 396, 272, 420, 250); }, T.red);
  shape(ell(410, 290, 8, 14), 'rgba(255,255,255,.18)', 0);

  // wing with a red wristband
  ctx.save(); ctx.translate(290, 336); ctx.rotate(Math.sin(t * 3) * 0.06);
  shape(() => { ctx.moveTo(-66, -34); ctx.bezierCurveTo(-10, -66, 66, -32, 70, 22); ctx.bezierCurveTo(44, 44, 0, 52, -34, 32); ctx.bezierCurveTo(-66, 12, -76, -16, -66, -34); }, T.brownDark);
  for (const [x, y] of [[-34, 14], [-2, 26], [32, 24]]) { ctx.beginPath(); ctx.arc(x, y, 17, 0.2, 2.8); ctx.lineWidth = 4; ctx.strokeStyle = T.brown; ctx.stroke(); }
  wristband(48, 8, -0.9, T.band);
  ctx.restore();
}

// =====================================================================
//   TOKYO CROSSING — edit me! This draws the city: roads, crossings,
//   buildings and neon signs. (The cars, lights and birds move by themselves.)
//   x (0 = left, 600 = right) and y (0 = top, 600 = bottom). Roads run from 225 to 375.
// =====================================================================
function drawCity(t) {
  const COL = {
    sidewalk: '#585e70', tile: '#4e5466', road: '#262a35', paint: '#e8ecf4', kerb: '#9aa0b2',
    roofs: ['#2c3350', '#3a2f4d', '#273f4a', '#45354a', '#30384f', '#3d4459'],
  };
  const A = 225, B = 375; // the edges of the roads

  // ---- pavement with tiles ----
  ctx.fillStyle = COL.sidewalk; ctx.fillRect(0, 0, 600, 600);
  ctx.strokeStyle = COL.tile; ctx.lineWidth = 1;
  for (let i = 0; i <= 600; i += 18) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 600); ctx.moveTo(0, i); ctx.lineTo(600, i); ctx.stroke(); }

  // ---- the two roads ----
  ctx.fillStyle = COL.road; ctx.fillRect(0, A, 600, B - A); ctx.fillRect(A, 0, B - A, 600);
  // kerbs
  ctx.strokeStyle = COL.kerb; ctx.lineWidth = 3;
  for (const [x1, y1, x2, y2] of [[0, A, A, A], [B, A, 600, A], [0, B, A, B], [B, B, 600, B], [A, 0, A, A], [B, 0, B, A], [A, B, A, 600], [B, B, B, 600]]) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  // lane lines: dashed between lanes, solid in the middle
  ctx.strokeStyle = COL.paint; ctx.lineWidth = 2;
  for (const [x1, y1, x2, y2] of [[0, 300, 180, 300], [420, 300, 600, 300], [300, 0, 300, 180], [300, 420, 300, 600]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  ctx.setLineDash([14, 12]);
  for (const v of [265, 335]) {
    for (const [x1, y1, x2, y2] of [[0, v, 180, v], [420, v, 600, v], [v, 0, v, 180], [v, 420, v, 600]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  }
  ctx.setLineDash([]);
  // stop lines (cars wait behind these)
  ctx.fillStyle = COL.paint;
  ctx.fillRect(176, A, 5, 75); ctx.fillRect(419, 300, 5, 75); ctx.fillRect(300, 176, 75, 5); ctx.fillRect(A, 419, 75, 5);

  // ---- zebra crossings on all four sides ----
  for (let i = A + 4; i < B - 4; i += 14) {
    ctx.fillRect(i, 188, 8, 32); ctx.fillRect(i, 380, 8, 32);   // north + south
    ctx.fillRect(188, i, 32, 8); ctx.fillRect(380, i, 32, 8);   // west + east
  }
  // ---- the famous diagonal "scramble" stripes across the middle ----
  for (const ang of [Math.PI / 4, -Math.PI / 4]) {
    ctx.save(); ctx.translate(300, 300); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(232,236,244,.85)';
    for (let i = -96; i < 96; i += 14) ctx.fillRect(i, -14, 8, 28);
    ctx.restore();
  }

  // ---- buildings: 2 in each corner block (mirrored), with footpaths along every road ----
  const blocks = [[1, 1], [-1, 1], [-1, -1], [1, -1]]; // which way to mirror each block
  const mx = (sx, x) => (sx > 0 ? x : 600 - x);
  blocks.forEach(([sx, sy], k) => {
    const rects = [[6, 6, 160, 86], [6, 92, 160, 160]];
    rects.forEach(([x0, y0, x1, y1], j) => {
      const X0 = Math.min(mx(sx, x0), mx(sx, x1)); const X1 = Math.max(mx(sx, x0), mx(sx, x1));
      const Y0 = Math.min(mx(sy, y0), mx(sy, y1)); const Y1 = Math.max(mx(sy, y0), mx(sy, y1));
      const roof = COL.roofs[(k * 2 + j) % COL.roofs.length];
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(X0 + 6, Y0 + 6, X1 - X0, Y1 - Y0); // shadow
      ctx.fillStyle = roof; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
      ctx.strokeStyle = '#11131c'; ctx.lineWidth = 3; ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 6; ctx.strokeRect(X0 + 8, Y0 + 8, X1 - X0 - 16, Y1 - Y0 - 16);
      // rooftop air-conditioning boxes
      for (let n = 0; n < 3; n++) {
        const ax = X0 + 18 + ((k * 37 + j * 53 + n * 29) % Math.max(10, X1 - X0 - 44));
        const ay = Y0 + 18 + ((k * 23 + j * 41 + n * 47) % Math.max(10, Y1 - Y0 - 44));
        ctx.fillStyle = '#8a90a3'; ctx.fillRect(ax, ay, 16, 12);
        ctx.fillStyle = '#5c6274'; ctx.beginPath(); ctx.arc(ax + 8, ay + 6, 4, 0, Math.PI * 2); ctx.fill();
      }
    });
  });

  // ---- neon signs on the rooftops ----
  const neon = (x, y, w, h, color, text, size, flick = 0) => {
    const on = flick ? (Math.sin(t * 9 + flick) > -0.85 ? 1 : 0.35) : 1;
    ctx.save(); ctx.globalAlpha = on;
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.fillStyle = '#0b0d16'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = color; ctx.font = `bold ${size}px "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  };
  neon(446, 26, 136, 40, '#ff4d6d', 'ラーメン', 24, 1);     // ramen
  neon(22, 470, 124, 36, '#c77dff', 'カラオケ', 22, 2);     // karaoke
  neon(446, 520, 136, 36, '#4cc9f0', 'コーヒー', 22);       // coffee
  neon(540, 96, 34, 62, '#ffd60a', '', 1); ctx.save(); ctx.fillStyle = '#ffd60a'; ctx.shadowColor = '#ffd60a'; ctx.shadowBlur = 12;
  ctx.font = 'bold 22px "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif'; ctx.textAlign = 'center';
  ['寿', '司'].forEach((ch, i) => ctx.fillText(ch, 557, 122 + i * 26)); ctx.restore(); // sushi (written top to bottom)

  // ---- the giant video screen ----
  const sx0 = 22; const sy0 = 24; const sw = 104; const sh = 70;
  ctx.fillStyle = '#05060b'; ctx.fillRect(sx0 - 4, sy0 - 4, sw + 8, sh + 8);
  const slide = Math.floor(t / 1.6) % 3;
  const g = ctx.createLinearGradient(sx0, sy0, sx0 + sw, sy0 + sh);
  g.addColorStop(0, ['#2f7de1', '#ffc72c', '#e0402a'][slide]); g.addColorStop(1, ['#174f9e', '#e29a00', '#8e1414'][slide]);
  ctx.fillStyle = g; ctx.fillRect(sx0, sy0, sw, sh);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 19px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = '#111';
  const word = ['CHICKENS', 'VS', 'TURKEYS'][slide];
  ctx.strokeText(word, sx0 + sw / 2, sy0 + sh / 2); ctx.fillText(word, sx0 + sw / 2, sy0 + sh / 2);
  // scan lines
  ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = sy0; y < sy0 + sh; y += 4) ctx.fillRect(sx0, y, sw, 1);

  // ---- street lamps glowing at the corners ----
  for (const [x, y] of [[214, 110], [110, 214], [486, 214], [390, 110], [490, 386], [386, 490], [214, 490], [110, 386]]) {
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 55);
    glow.addColorStop(0, 'rgba(255,220,150,.35)'); glow.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe8b0'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  }
}

const good = { chicken: drawChicken, turkey: drawTurkey, city: drawCity };
function drawBird(kind, t, bk) { good[kind](t, bk); }

// =====================================================================
//         TOKYO CROSSING — cars, traffic lights and the birds
// =====================================================================
// Japan drives on the LEFT. Each lane: which way it goes, where it sits, and its stop line.
// s = how far along the lane a car's FRONT is (always counts up the way the car drives).
const STOP = 178;                  // every lane's stop line is at s = 178
const CLEAR_END = 428;             // past here a car has left the crossing
const LANES = [
  { axis: 'h', d: 1, at: 247 }, { axis: 'h', d: 1, at: 282 },   // eastbound →
  { axis: 'h', d: -1, at: 318 }, { axis: 'h', d: -1, at: 353 }, // westbound ←
  { axis: 'v', d: 1, at: 318 }, { axis: 'v', d: 1, at: 353 },   // southbound ↓
  { axis: 'v', d: -1, at: 247 }, { axis: 'v', d: -1, at: 282 }, // northbound ↑
];
const CAR_COLOURS = ['#e63946', '#f1faee', '#457b9d', '#2a9d8f', '#e9c46a', '#8d99ae', '#111111', '#ff7f11', '#6a4c93'];
const CITY = { cars: [], birds: [], phase: 'H', phaseT: 0, lastGreen: 'H', walkReq: false, spawnT: LANES.map(() => Math.random() * 2) };

// ---------------------------------------------------------------------
// The birds: a normal busy day. They walk in from the edges and out of
// shops, then head off the screen, into a shop, or over the crossing.
// Anyone who needs to cross waits at the lights, so a crowd builds up.
// Every block is drawn the same way, mirrored; "local" points are worked
// out for the top-left block (footpaths run 165–225 from the roads).
// ---------------------------------------------------------------------
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];          // NW, NE, SE, SW
const toWorld = (c, [lx, ly]) => [CORNERS[c][0] < 0 ? lx : 600 - lx, CORNERS[c][1] < 0 ? ly : 600 - ly];
const toLocal = (c, [x, y]) => toWorld(c, [x, y]); // mirroring works both ways
const DOORS = [[163, 62], [163, 128], [62, 163], [128, 163]];   // shop doors along the footpaths (local)
const rnd = (a, b) => a + Math.random() * (b - a);
/** Waiting spots at each corner, nearest the kerb first — the crowd fills up from the front. */
const SPOTS = (() => {
  const seen = new Set(); const out = [];
  for (let i = 0; i < 8; i++) for (const k of [214, 198, 182]) {
    for (const p of [[k, 214 - i * 14], [214 - i * 14, k]]) { const key = p.join(); if (!seen.has(key) && !(p[0] > 206 && p[1] > 206)) { seen.add(key); out.push(p); } }
  }
  return out.sort((a, b) => Math.hypot(225 - a[0], 225 - a[1]) - Math.hypot(225 - b[0], 225 - b[1])).slice(0, 26);
})();
CITY.taken = CORNERS.map(() => new Set());
CITY.spawnBird = 0;

const armOf = ([lx, ly]) => (ly < 160 ? 'v' : lx < 160 ? 'h' : 'c'); // which footpath a point is on
/** A walking route between two local points in the same block (round the corner if needed). */
function routeIn(c, from, to) {
  if (armOf(from) === armOf(to) || armOf(from) === 'c' || armOf(to) === 'c') return [toWorld(c, to)];
  return [toWorld(c, [rnd(186, 212), rnd(186, 212)]), toWorld(c, to)];
}
/** Somewhere to go in block c: off the edge of the screen, or into a shop. */
function placeIn(c) {
  if (Math.random() < 0.55) {
    const lane = rnd(176, 216);
    return Math.random() < 0.5 ? { p: [lane, -16], kind: 'edge' } : { p: [-16, lane], kind: 'edge' };
  }
  const d = DOORS[Math.floor(Math.random() * DOORS.length)];
  return { p: d, kind: 'door', step: d[0] === 163 ? [180, d[1]] : [d[0], 180] }; // step = just outside the door
}

function newBird() {
  const C = CITY;
  const from = Math.floor(Math.random() * 4);
  const start = placeIn(from);
  // most birds want to get to another block (they'll need to cross), the rest stay on this side
  let to = Math.random() < 0.7 ? [0, 1, 2, 3].filter((k) => k !== from)[Math.floor(Math.random() * 3)] : from;
  if (to !== from && C.taken[from].size >= SPOTS.length - 2) to = from; // the corner's packed — stay this side
  const goal = placeIn(to);
  const b = { kind: Math.random() < 0.5 ? 'chicken' : 'turkey', block: from, to, goal, speed: rnd(28, 46), ph: rnd(0, 6), face: 1, alpha: start.kind === 'door' ? 0 : 1, spot: -1 };
  [b.x, b.y] = toWorld(from, start.p);
  const firstStep = start.kind === 'door' ? [toWorld(from, start.step)] : [];
  const here = start.kind === 'door' ? start.step : start.p;
  if (to === from) { b.state = 'walk'; b.path = [...firstStep, ...routeIn(from, here, goal.step || goal.p), ...(goal.step ? [toWorld(from, goal.p)] : [])]; b.then = goal.kind; }
  else { b.state = 'walk'; b.path = [...firstStep, ...routeIn(from, here, [rnd(188, 210), rnd(188, 210)])]; b.then = 'queue'; }
  C.birds.push(b);
}

const walkOpen = () => CITY.phase === 'WALK' && CITY.phaseT < 4; // new birds may still step out
function joinQueue(b) {
  if (walkOpen()) { startCross(b); return; }
  const taken = CITY.taken[b.block]; let i = 0; while (taken.has(i) && i < SPOTS.length) i += 1;
  if (i >= SPOTS.length) i = SPOTS.length - 1;
  taken.add(i); b.spot = i;
  b.path = [toWorld(b.block, SPOTS[i])]; b.state = 'walk'; b.then = 'wait';
}
/** Over the road — straight across, or diagonally over the scramble — then on to where it's going. */
function startCross(b) {
  if (b.spot >= 0) { CITY.taken[b.block].delete(b.spot); b.spot = -1; }
  const [fx, fy] = CORNERS[b.block]; const [tx, ty] = CORNERS[b.to];
  const j = rnd(-12, 12); let a; let z;
  if (fy === ty) { const y = 300 + fy * 96 + j; a = [300 + fx * 84, y]; z = [300 + tx * 84, y]; }
  else if (fx === tx) { const x = 300 + fx * 96 + j; a = [x, 300 + fy * 84]; z = [x, 300 + ty * 84]; }
  else { a = [300 + fx * 82 + j, 300 + fy * 82 - j]; z = [300 + tx * 82 + j, 300 + ty * 82 - j]; }
  const g = b.goal; const zl = toLocal(b.to, z);
  b.path = [a, z, ...routeIn(b.to, zl, g.step || g.p), ...(g.step ? [toWorld(b.to, g.p)] : [])];
  b.state = 'cross'; b.crossing = true; b.then = g.kind; b.delay = rnd(0, 0.9); b.speed *= 1.15;
  b.block = b.to;
}

function stepBirds(dt) {
  const C = CITY;
  // new birds arrive all the time (but not too many at once)
  C.spawnBird -= dt;
  if (C.spawnBird <= 0 && C.birds.length < 70) { newBird(); C.spawnBird = rnd(0.25, 0.7); }
  if (C.phase === 'WALK' && C.phaseT < 4) for (const b of C.birds) if (b.state === 'wait') startCross(b);

  for (const b of C.birds) {
    if (b.alpha < 1 && b.then !== 'gone' && b.state !== 'leaving') b.alpha = Math.min(1, b.alpha + dt * 2.5); // stepping out of a shop
    if (b.state === 'leaving') { b.alpha -= dt * 2.5; if (b.alpha <= 0) b.done = true; continue; }
    if (b.state === 'wait') { b.face = CORNERS[b.block][0] < 0 ? 1 : -1; continue; }
    if (b.delay > 0) { b.delay -= dt; continue; }
    let step = b.speed * dt;
    while (step > 0 && b.path.length) {
      const [tx, ty] = b.path[0]; const dx = tx - b.x; const dy = ty - b.y; const d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.5) b.face = dx > 0 ? 1 : -1;
      if (d <= step) { b.x = tx; b.y = ty; b.path.shift(); step -= d; } else { b.x += (dx / d) * step; b.y += (dy / d) * step; step = 0; }
    }
    if (b.path.length) continue;
    // reached the end of this bit of the journey
    if (b.crossing) b.crossing = false;
    if (b.then === 'queue') joinQueue(b);
    else if (b.then === 'wait') b.state = 'wait';
    else if (b.then === 'door') b.state = 'leaving';     // into the shop
    else b.done = true;                                   // walked off the screen
  }
  C.birds = C.birds.filter((b) => !b.done);
}
/** Fast-forward so the street is already busy when the scene opens. */
function warmUp() { for (let i = 0; i < 500; i++) citySim(0.05); }

const carLight = (axis) => {
  const p = CITY.phase;
  if (p === (axis === 'h' ? 'H' : 'V')) return 'green';
  if (p === (axis === 'h' ? 'Hy' : 'Vy')) return 'yellow';
  return 'red';
};
const walkLight = () => (CITY.phase !== 'WALK' ? 'red' : CITY.phaseT < 4 || Math.floor(CITY.phaseT * 4) % 2 ? 'green' : 'off'); // flashes when it's about to end
const carXY = (lane, s) => (lane.axis === 'h' ? [lane.d > 0 ? s : 600 - s, lane.at] : [lane.at, lane.d > 0 ? s : 600 - s]);

function citySim(dt) {
  const C = CITY; C.phaseT += dt;
  // ---- the traffic-light cycle ----
  const next = (p) => { C.phase = p; C.phaseT = 0; };
  if (C.phase === 'H' || C.phase === 'V') {
    if (C.phaseT > 7 || (C.walkReq && C.phaseT > 1)) { C.lastGreen = C.phase; next(C.phase + 'y'); }
  } else if (C.phase === 'Hy' || C.phase === 'Vy') {
    if (C.phaseT > 1.6) next('R');
  } else if (C.phase === 'R') {
    if (C.phaseT > 0.8) next(C.walkReq ? 'CLEAR' : C.lastGreen === 'H' ? 'V' : 'H');
  } else if (C.phase === 'CLEAR') {
    // wait until no car is still out in the middle of the crossing
    if (!C.cars.some((c) => c.s > STOP + 2 && c.s - c.len < CLEAR_END)) next('WALK');
  } else if (C.phase === 'WALK') {
    if (C.phaseT > 4 && !C.birds.some((b) => b.crossing)) { C.walkReq = false; next('R2'); } // nobody left on the road
  } else if (C.phase === 'R2') {
    if (C.phaseT > 1) next(C.lastGreen === 'H' ? 'V' : 'H');
  }

  // ---- spawn cars at the edges ----
  LANES.forEach((lane, i) => {
    C.spawnT[i] -= dt;
    if (C.spawnT[i] > 0) return;
    C.spawnT[i] = 1.4 + Math.random() * 2.8;
    const last = C.cars.filter((c) => c.lane === lane).sort((a, b) => a.s - b.s)[0];
    if (last && last.s - last.len < 30) return; // no room yet
    const bus = Math.random() < 0.1; const taxi = !bus && Math.random() < 0.25;
    C.cars.push({ lane, s: -10, v: 60 + Math.random() * 20, vmax: bus ? 62 : 75 + Math.random() * 25, len: bus ? 76 : 44, wid: bus ? 26 : 22,
      colour: bus ? '#2a9d8f' : taxi ? '#ffd166' : CAR_COLOURS[Math.floor(Math.random() * CAR_COLOURS.length)], bus, taxi });
  });

  // ---- drive: follow the car in front, stop at red lights ----
  for (const lane of LANES) {
    const cars = C.cars.filter((c) => c.lane === lane).sort((a, b) => b.s - a.s); // front-most first
    cars.forEach((car, i) => {
      let limit = Infinity;
      const ahead = cars[i - 1]; if (ahead) limit = ahead.s - ahead.len - 12;
      if (car.s <= STOP + 1) {
        const light = carLight(lane.axis);
        const mayGo = light === 'green' || (light === 'yellow' && car.s > STOP - 22 && car.v > 30);
        if (!mayGo) limit = Math.min(limit, STOP);
      }
      const gap = limit - car.s;
      const want = gap <= 0 ? 0 : Math.min(car.vmax, gap * 2.4);
      car.v += Math.max(-320 * dt, Math.min(150 * dt, want - car.v));
      car.v = Math.max(0, car.v); car.s += car.v * dt;
    });
  }
  C.cars = C.cars.filter((c) => c.s - c.len < 640);

  stepBirds(dt);
}

// ---- drawing the moving things ----
function drawCar(car) {
  const [x, y] = carXY(car.lane, car.s);
  const ang = car.lane.axis === 'h' ? (car.lane.d > 0 ? 0 : Math.PI) : (car.lane.d > 0 ? Math.PI / 2 : -Math.PI / 2);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); // car faces +x, front at 0
  const L = car.len; const W = car.wid;
  // headlight beams
  const beam = ctx.createLinearGradient(0, 0, 60, 0); beam.addColorStop(0, 'rgba(255,240,180,.35)'); beam.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(0, -W / 2 + 2); ctx.lineTo(60, -W / 2 - 12); ctx.lineTo(60, W / 2 + 12); ctx.lineTo(0, W / 2 - 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect(-L + 3, -W / 2 + 3, L, W, 7); ctx.fill(); // shadow
  shape(() => ctx.roundRect(-L, -W / 2, L, W, 7), car.colour, 2.5);
  if (car.bus) {
    ctx.fillStyle = '#bde0fe'; for (let i = -L + 8; i < -10; i += 12) ctx.fillRect(i, -W / 2 + 3, 8, 4), ctx.fillRect(i, W / 2 - 7, 8, 4);
    ctx.fillStyle = '#1d6f66'; ctx.fillRect(-L + 6, -3, L - 16, 6);
  } else {
    shape(() => ctx.roundRect(-L * 0.68, -W / 2 + 3, L * 0.42, W - 6, 4), 'rgba(0,0,0,.28)', 0); // roof
    ctx.fillStyle = '#9fd3ff'; ctx.fillRect(-L * 0.26, -W / 2 + 4, 6, W - 8); ctx.fillRect(-L * 0.78, -W / 2 + 4, 4, W - 8); // windows
    if (car.taxi) { shape(() => ctx.roundRect(-L * 0.52, -4, 10, 8, 2), '#fff', 1.5); }
  }
  ctx.fillStyle = '#fff6c8'; ctx.fillRect(-3, -W / 2 + 2, 3, 5); ctx.fillRect(-3, W / 2 - 7, 3, 5);       // headlights
  ctx.fillStyle = car.v < 15 ? '#ff2b2b' : '#a3161a'; ctx.fillRect(-L, -W / 2 + 2, 3, 5); ctx.fillRect(-L, W / 2 - 7, 3, 5); // brake lights
  ctx.restore();
}

function drawSignals(t) {
  // car lights — Japanese style: a sideways row of green, yellow, red
  const lamp = (x, y, vertical, axis) => {
    const on = carLight(axis);
    ctx.save(); ctx.translate(x, y); if (vertical) ctx.rotate(Math.PI / 2);
    shape(() => ctx.roundRect(-20, -7, 40, 14, 5), '#1b1e27', 2);
    [['green', '#2dff7a'], ['yellow', '#ffd23f'], ['red', '#ff3b3b']].forEach(([n, c], i) => {
      ctx.fillStyle = on === n ? c : '#3b3f4c'; if (on === n) { ctx.shadowColor = c; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(-12 + i * 12, 0, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    });
    ctx.restore();
  };
  lamp(160, 216, false, 'h'); lamp(440, 384, false, 'h'); lamp(384, 160, true, 'v'); lamp(216, 440, true, 'v');
  // walk lights on each corner: red standing bird / green walking bird
  const wl = walkLight(); const go = wl !== 'red';
  for (const [x, y] of [[214, 214], [386, 214], [386, 386], [214, 386]]) {
    ctx.save(); ctx.translate(x, y);
    shape(() => ctx.roundRect(-8, -11, 16, 22, 3), '#1b1e27', 2);
    const c = wl === 'off' ? '#244d33' : go ? '#2dff7a' : '#ff3b3b'; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, -5, 2.6, 0, Math.PI * 2); ctx.fill(); // head
    ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.beginPath();
    if (go) { const w = Math.sin(t * 10) * 3; ctx.moveTo(0, -2); ctx.lineTo(0, 3); ctx.lineTo(-3 + w, 8); ctx.moveTo(0, 3); ctx.lineTo(3 - w, 8); ctx.moveTo(-3, 0); ctx.lineTo(3, 1); }
    else { ctx.moveTo(0, -2); ctx.lineTo(0, 3); ctx.lineTo(-2, 8); ctx.moveTo(0, 3); ctx.lineTo(2, 8); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); }
    ctx.stroke(); ctx.restore();
  }
}

// little birds: each kind is drawn once into a small picture (redrawn a few times a second, so code edits show up)
const birdPics = {};
function birdPic(kind, t) {
  let p = birdPics[kind];
  if (!p) { const cv = document.createElement('canvas'); cv.width = 132; cv.height = 132; p = birdPics[kind] = { cv, at: -1 }; }
  if (t - p.at > 0.15 && good[kind]) {
    p.at = t;
    const keep = ctx; const c2 = p.cv.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, 132, 132); c2.setTransform(0.22, 0, 0, 0.22, 0, 0); c2.translate(0, 0);
    ctx = c2;
    try { good[kind](t, 0); } catch (e) { /* the editor already shows the problem */ }
    ctx = keep;
  }
  return p.cv;
}
function drawCityBirds(t) {
  const list = [...CITY.birds].sort((a, b) => a.y - b.y);
  for (const b of list) {
    const walking = (b.state === 'walk' || b.state === 'cross' || b.state === 'leaving') && !(b.delay > 0);
    ctx.globalAlpha = Math.max(0, Math.min(1, b.alpha));
    const hop = walking ? Math.abs(Math.sin(t * 13 + b.ph)) * 4 : Math.abs(Math.sin(t * 2 + b.ph)) * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(b.x, b.y - hop); ctx.scale(b.face, 1);
    // the picture is 600 units × 0.22; feet are at (300, 495) → draw it ~42 units tall with the feet on the spot
    const S = 0.075 / 0.22; ctx.drawImage(birdPic(b.kind, t), -300 * 0.22 * S, -495 * 0.22 * S, 132 * S, 132 * S);
    ctx.restore(); ctx.globalAlpha = 1;
  }
}

/** Shop doorways along the footpaths, with little noren curtains. */
function drawDoors(t) {
  const curtains = ['#c1121f', '#1d3557', '#6a4c93', '#2a9d8f'];
  for (let c = 0; c < 4; c++) DOORS.forEach((d, i) => {
    const [x, y] = toWorld(c, d); const across = d[0] === 163; // door faces sideways (on an up-down footpath)
    ctx.save(); ctx.translate(x, y); if (!across) ctx.rotate(Math.PI / 2); if (toWorld(c, [0, 0])[0] > 300 && across) ctx.scale(-1, 1); if (toWorld(c, [0, 0])[1] > 300 && !across) ctx.scale(-1, 1);
    const glow = ctx.createLinearGradient(0, 0, 18, 0); glow.addColorStop(0, 'rgba(255,214,140,.55)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, -12, 18, 24);
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(-4, -11, 5, 22);
    ctx.fillStyle = curtains[(c + i) % 4]; for (let k = 0; k < 3; k++) ctx.fillRect(-4, -11 + k * 7.5, 6, 6);
    ctx.restore();
  });
}
let warmed = false;
function drawTokyo(t, dt) {
  if (!warmed) { warmed = true; warmUp(); }
  // keep real time even if the screen is slow: catch up in small steps (up to half a second)
  for (let left = Math.min(dt, 0.5); left > 0; left -= 0.05) citySim(Math.min(left, 0.05));
  drawBird('city', t, 0);                 // the editable city
  drawDoors(t);
  for (const c of CITY.cars) drawCar(c);
  drawSignals(t);
  drawCityBirds(t);
  report();
}


function walkStatus() {
  const C = CITY; const left = C.birds.filter((b) => b.crossing).length; const waiting = C.birds.filter((b) => b.state === 'wait' || b.then === 'wait').length;
  let msg; let can = false; let label = '🚶 Press to cross';
  if (C.phase === 'WALK') { msg = C.phaseT < 4 ? `🟢 WALK! ${left} crossing — the cars wait until everyone is over.` : `🟢 Hurry up! ${left} still crossing — the cars wait for them.`; label = '🚶 Crossing…'; }
  else if (C.walkReq) { msg = C.phase === 'CLEAR' ? '⏳ Waiting for the last cars to get through…' : '🟡 Lights changing — cars are stopping…'; label = '⏳ Wait…'; }
  else if (C.phase === 'R2') msg = '✅ Everyone made it across! Cars can go again.';
  else { msg = `🚗 Cars going ${C.phase.startsWith('H') ? 'left and right' : 'up and down'} have a green light. ${waiting ? `${waiting} bird${waiting === 1 ? ' is' : 's are'} waiting to cross.` : ''}`; can = true; }
  return { msg, label, can };
}

let lastKey = '';
function report() { const s = walkStatus(); const k = s.msg + s.label + s.can; if (k !== lastKey) { lastKey = k; onStatus(s); } }

let raf = 0; let lastT = 0; let dead = false;
function frame(ms) {
  if (dead) return;
  if (!canvas.isConnected) { dead = true; return; } // the waiting screen was replaced
  const t = ms / 1000; const dt = lastT ? t - lastT : 0; lastT = t;
  const k = canvas.width / 600; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, 600, 600);
  if (canvas.offsetParent !== null) drawTokyo(t, dt); // skip drawing while hidden
  raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
return {
  press() { if (CITY.phase !== 'WALK' && !CITY.walkReq) CITY.walkReq = true; },
  destroy() { dead = true; cancelAnimationFrame(raf); },
};
}
