// AUTO-BUILT by tools/build_tokyo.py from extras/code-characters.html — edit that page, then re-run the script.
// Auckland Crossing: hop your chicken/turkey over the road and back (5 hops each way); each trip = level up, faster cars.
// mountAuckland(canvas, { team, onStatus }) → { hop(), destroy() }

export function mountAuckland(canvas, { team = 'chicken', onStatus = () => {} } = {}) {
let ctx = canvas.getContext('2d');
const who = team === 'turkey' ? 'turkey' : 'chicken';
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
//   AUCKLAND CROSSING — edit me! This draws the scenery: sky, Sky Tower,
//   harbour, pōhutukawa trees, footpaths and the road. (Cars + bird move by themselves.)
//   x (0 = left, 600 = right) and y (0 = top, 600 = bottom). The road runs from y 245 to 485.
// =====================================================================
function drawAuckland(t) {
  const COL = {
    skyTop: '#4aa8ff', skyBottom: '#bfe6ff', sea: '#1f7fc4', seaDark: '#16639b', hills: '#5c9e3c',
    tower: '#e9edf2', towerShade: '#b9c2cc', road: '#3b3f48', footpath: '#c9c3b6', kerb: '#8f897c', grass: '#62b041',
  };
  // ---- sky + sun ----
  const sky = ctx.createLinearGradient(0, 0, 0, 190);
  sky.addColorStop(0, COL.skyTop); sky.addColorStop(1, COL.skyBottom);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 600, 190);
  ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(520, 46, 26, 0, Math.PI * 2); ctx.fill();
  // fluffy clouds drifting
  const cloud = (x, y, s) => { ctx.fillStyle = 'rgba(255,255,255,.92)'; for (const [dx, dy, r] of [[0, 0, 16], [18, -8, 20], [38, 0, 16], [20, 6, 16]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill(); } };
  cloud(((t * 8) % 760) - 80, 40, 1); cloud(((t * 5 + 300) % 760) - 80, 78, 0.8); cloud(((t * 6 + 560) % 760) - 80, 30, 0.7);

  // ---- harbour with sailboats (the City of Sails!) ----
  ctx.fillStyle = COL.hills; ctx.beginPath(); ctx.moveTo(0, 150); ctx.quadraticCurveTo(90, 118, 190, 146); ctx.quadraticCurveTo(300, 126, 420, 148); ctx.quadraticCurveTo(520, 130, 600, 146); ctx.lineTo(600, 190); ctx.lineTo(0, 190); ctx.fill();
  ctx.fillStyle = COL.sea; ctx.fillRect(0, 150, 600, 40);
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const x = (i * 73 + t * 12) % 620 - 10; ctx.beginPath(); ctx.moveTo(x, 162 + (i % 3) * 9); ctx.lineTo(x + 14, 162 + (i % 3) * 9); ctx.stroke(); }
  const boat = (x, y, c) => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.lineTo(x + 8, y + 5); ctx.lineTo(x - 8, y + 5); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y - 24); ctx.lineTo(x + 11, y - 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 1, y - 2); ctx.lineTo(x - 1, y - 20); ctx.lineTo(x - 9, y - 2); ctx.fill();
  };
  boat((t * 14) % 680 - 40, 172, '#ff5d5d'); boat((t * 9 + 250) % 680 - 40, 166, '#ffd23f'); boat((t * 11 + 470) % 680 - 40, 180, '#2a9d8f');

  // ---- city skyline ----
  const towers = [[18, 120, 36], [58, 98, 30], [92, 112, 26], [122, 86, 34], [160, 104, 28], [380, 96, 30], [414, 110, 26], [444, 84, 36], [484, 104, 28], [516, 92, 32], [552, 112, 30]];
  for (const [x, top, w] of towers) {
    ctx.fillStyle = '#8fa3b8'; ctx.fillRect(x, top, w, 190 - top);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    for (let y = top + 6; y < 182; y += 10) for (let wx = x + 4; wx < x + w - 4; wx += 8) ctx.fillRect(wx, y, 4, 5);
  }

  // ---- the Sky Tower ----
  const cx = 280;
  ctx.fillStyle = COL.tower; ctx.beginPath(); ctx.moveTo(cx - 10, 190); ctx.lineTo(cx - 6, 60); ctx.lineTo(cx + 6, 60); ctx.lineTo(cx + 10, 190); ctx.fill(); // shaft
  ctx.fillStyle = COL.towerShade; ctx.fillRect(cx + 1, 62, 4, 128);
  ctx.fillStyle = COL.tower; ctx.beginPath(); ctx.ellipse(cx, 58, 26, 8, 0, 0, Math.PI * 2); ctx.fill();     // the pod
  ctx.fillStyle = '#5b7fa3'; ctx.fillRect(cx - 24, 50, 48, 8);                                               // windows
  ctx.fillStyle = COL.tower; ctx.beginPath(); ctx.ellipse(cx, 50, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - 14, 36, 28, 10); ctx.beginPath(); ctx.ellipse(cx, 36, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d7dde4'; ctx.beginPath(); ctx.moveTo(cx - 3, 34); ctx.lineTo(cx, 2); ctx.lineTo(cx + 3, 34); ctx.fill(); // spire
  ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ff3b3b' : '#7a1d1d'; ctx.beginPath(); ctx.arc(cx, 4, 2.5, 0, Math.PI * 2); ctx.fill(); // blinking light

  // ---- far footpath (the other side) ----
  ctx.fillStyle = COL.footpath; ctx.fillRect(0, 186, 600, 59);
  ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1;
  for (let x = 0; x < 600; x += 30) { ctx.beginPath(); ctx.moveTo(x, 186); ctx.lineTo(x, 245); ctx.stroke(); }
  ctx.fillStyle = COL.kerb; ctx.fillRect(0, 241, 600, 5);

  // ---- the road: 4 lanes, two each way (we drive on the left!) ----
  ctx.fillStyle = COL.road; ctx.fillRect(0, 245, 600, 240);
  ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]); for (const y of [305, 425]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke(); }
  ctx.setLineDash([]); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
  for (const y of [362, 368]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke(); } // no-passing lines in the middle

  // ---- near footpath + grass ----
  ctx.fillStyle = COL.kerb; ctx.fillRect(0, 485, 600, 5);
  ctx.fillStyle = COL.footpath; ctx.fillRect(0, 490, 600, 62);
  ctx.strokeStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < 600; x += 30) { ctx.beginPath(); ctx.moveTo(x, 490); ctx.lineTo(x, 552); ctx.stroke(); }
  ctx.fillStyle = COL.grass; ctx.fillRect(0, 552, 600, 48);

  // ---- pōhutukawa trees (NZ Christmas trees) with red flowers ----
  const tree = (x, y, s) => {
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 5 * s, y - 10 * s, 10 * s, 26 * s);
    ctx.fillStyle = '#2f6b2a'; for (const [dx, dy, r] of [[-22, -18, 20], [0, -30, 24], [22, -18, 20], [0, -12, 20]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#e0242c'; for (let i = 0; i < 14; i++) { const a = i * 2.4; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 26 * s * ((i % 3) / 3 + 0.4), y - 22 * s + Math.sin(a) * 16 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill(); }
  };
  tree(60, 212, 0.8); tree(545, 212, 0.8); tree(40, 575, 0.9); tree(560, 578, 0.9);

  // ---- a kiwi crossing sign ----
  ctx.save(); ctx.translate(150, 512);
  ctx.fillStyle = '#666'; ctx.fillRect(-2, 0, 4, 34);
  ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-15, -15, 30, 30); ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; ctx.strokeRect(-12, -12, 24, 24);
  ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-2, 1, 7, 5, 0, 0, Math.PI * 2); ctx.fill(); // a little kiwi
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(10, 5); ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillRect(-4, 5, 1.5, 4); ctx.fillRect(0, 5, 1.5, 4);
  ctx.restore();
}

const good = { chicken: drawChicken, turkey: drawTurkey, nz: drawAuckland };
function drawBird(kind, t, bk) { good[kind](t, bk); }

// =====================================================================
//     AUCKLAND CROSSING — a crossy-road game: hop over and back again
// =====================================================================
// Rows: 0 = near footpath, 1–4 = the four lanes, 5 = far footpath. 5 hops over, 5 hops back.
const NZ_ROW_Y = [530, 469, 409, 349, 289, 228];        // where the bird's feet go on each row (lanes: centre + 14)
const NZ_LANES = [null,                                  // (lane 1 is the nearest)
  { d: -1, base: 95, kinds: ['car', 'ute', 'car', 'bus'] },   // ← (keep left: near side drives left)
  { d: -1, base: 130, kinds: ['car', 'car', 'ute'] },
  { d: 1, base: 120, kinds: ['car', 'ute', 'van'] },          // → far side drives right
  { d: 1, base: 85, kinds: ['car', 'bus', 'camper'] }];
const NZ_KIND = { car: [64, 30], ute: [76, 32], van: [80, 34], bus: [140, 38], camper: [96, 36] };
const NZ_COLOURS = ['#e63946', '#1d70b8', '#2a9d8f', '#f4a261', '#ffffff', '#6a4c93', '#111111', '#8ab17d'];
const NZ = { level: 1, best: 1, row: 0, dir: 1, hop: null, cars: [], spawn: [0, 0, 0, 0, 0], dead: 0, banner: { text: 'Tap HOP to cross the road!', t: 0 }, trips: 0, fx: [] };
const nzSpeed = (lane) => NZ_LANES[lane].base * (1 + 0.2 * (NZ.level - 1));
function nzBanner(text) { NZ.banner = { text, t: performance.now() / 1000 }; }

function nzHop() {
  if (NZ.hop || NZ.dead) return;
  const to = NZ.row + NZ.dir; if (to < 0 || to > 5) return;
  NZ.hop = { from: NZ.row, to, t0: performance.now() / 1000 };
}
function nzLand() {
  NZ.row = NZ.hop.to; NZ.hop = null;
  if (NZ.row === 5 && NZ.dir === 1) { NZ.dir = -1; nzBanner('Made it! Now hop back ⬇'); }
  else if (NZ.row === 0 && NZ.dir === -1) {
    NZ.level += 1; NZ.best = Math.max(NZ.best, NZ.level); NZ.dir = 1; NZ.trips += 1;
    nzBanner(`LEVEL ${NZ.level}! The cars are faster 🚗💨`);
    nzBurst(300, NZ_ROW_Y[0] - 20, ['#ffd23f', '#3dab2b', '#2f7de1', '#e0402a']);
  }
  report();
}
function nzBurst(x, y, colours) {
  const now = performance.now() / 1000;
  for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2; const v = 80 + Math.random() * 180; NZ.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, c: colours[i % colours.length], t0: now, r: Math.random() * 6 }); }
}

function nzStep(dt) {
  const now = performance.now() / 1000;
  // spawn + drive cars
  for (let lane = 1; lane <= 4; lane++) {
    NZ.spawn[lane] -= dt;
    if (NZ.spawn[lane] > 0) continue;
    const L = NZ_LANES[lane]; const kind = L.kinds[Math.floor(Math.random() * L.kinds.length)]; const [len, wid] = NZ_KIND[kind];
    const v = nzSpeed(lane);
    // always leave gaps big enough to get through
    NZ.spawn[lane] = (len + 150 + Math.random() * 230) / v;
    NZ.cars.push({ lane, kind, len, wid, x: L.d > 0 ? -len - 10 : 610, colour: NZ_COLOURS[Math.floor(Math.random() * NZ_COLOURS.length)] });
  }
  for (const c of NZ.cars) c.x += NZ_LANES[c.lane].d * nzSpeed(c.lane) * dt;
  NZ.cars = NZ.cars.filter((c) => c.x > -200 && c.x < 800);
  // hopping
  if (NZ.hop && now - NZ.hop.t0 > 0.16) nzLand();
  // splat?
  if (!NZ.dead) {
    const r = NZ.hop ? (now - NZ.hop.t0 > 0.08 ? NZ.hop.to : NZ.hop.from) : NZ.row;
    if (r >= 1 && r <= 4) {
      const hit = NZ.cars.find((c) => c.lane === r && c.x < 300 + 7 && c.x + c.len > 300 - 7);
      if (hit) {
        NZ.dead = now; NZ.deadRow = r; NZ.hop = null;
        nzBurst(300, NZ_ROW_Y[r] - 12, who === 'turkey' ? ['#d8402b', '#f08a24', '#f5c242', '#2a9d8f', '#8a5328'] : ['#fbf8f0', '#2f7de1', '#e53b2a', '#fbf8f0']);
        nzBanner('💥 SPLAT! Back to the start of this level');
      }
    }
  } else if (now - NZ.dead > 1.3) { NZ.dead = 0; NZ.row = 0; NZ.dir = 1; report(); }
  NZ.fx = NZ.fx.filter((f) => now - f.t0 < 1.2);
}

function nzCar(c) {
  const y = NZ_ROW_Y[c.lane] - 14; const d = NZ_LANES[c.lane].d;
  ctx.save(); ctx.translate(c.x + c.len / 2, y); if (d < 0) ctx.scale(-1, 1); // cars face the way they drive
  const L = c.len; const W = c.wid;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.roundRect(-L / 2 + 4, -W / 2 + 5, L, W, 8); ctx.fill();
  shape(() => ctx.roundRect(-L / 2, -W / 2, L, W, 8), c.kind === 'bus' ? '#ffd23f' : c.kind === 'camper' ? '#f1faee' : c.colour, 2.5);
  if (c.kind === 'bus') { ctx.fillStyle = '#1d3557'; for (let x = -L / 2 + 10; x < L / 2 - 20; x += 18) ctx.fillRect(x, -W / 2 + 4, 12, W - 8); }
  else if (c.kind === 'ute') { shape(() => ctx.roundRect(-L / 2 + 4, -W / 2 + 4, L * 0.42, W - 8, 3), 'rgba(0,0,0,.18)', 1.5); ctx.fillStyle = '#9fd3ff'; ctx.fillRect(L * 0.08, -W / 2 + 5, 6, W - 10); }
  else if (c.kind === 'camper') { ctx.fillStyle = '#2a9d8f'; ctx.fillRect(-L / 2 + 2, -4, L - 4, 8); ctx.fillStyle = '#9fd3ff'; ctx.fillRect(L * 0.22, -W / 2 + 5, 7, W - 10); }
  else { shape(() => ctx.roundRect(-L * 0.25, -W / 2 + 4, L * 0.45, W - 8, 5), 'rgba(0,0,0,.25)', 0); ctx.fillStyle = '#9fd3ff'; ctx.fillRect(L * 0.16, -W / 2 + 5, 6, W - 10); ctx.fillRect(-L * 0.3, -W / 2 + 5, 4, W - 10); }
  ctx.fillStyle = '#fff6c8'; ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 6); ctx.fillRect(L / 2 - 3, W / 2 - 9, 3, 6);
  ctx.fillStyle = '#c1121f'; ctx.fillRect(-L / 2, -W / 2 + 3, 3, 6); ctx.fillRect(-L / 2, W / 2 - 9, 3, 6);
  ctx.restore();
}

// a sharper bird picture for this bigger scene
const nzPics = {};
function nzBirdPic(kind, t) {
  let p = nzPics[kind];
  if (!p) { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300; p = nzPics[kind] = { cv, at: -1 }; }
  if (t - p.at > 0.1 && good[kind]) {
    p.at = t; const keep = ctx; const c2 = p.cv.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, 300, 300); c2.setTransform(0.5, 0, 0, 0.5, 0, 0);
    ctx = c2; try { good[kind](t, 0); } catch (e) { /* editor shows the problem */ } ctx = keep;
  }
  return p.cv;
}

function drawAucklandGame(t, dt) {
  for (let left = Math.min(dt, 0.5); left > 0; left -= 0.05) nzStep(Math.min(left, 0.05));
  drawBird('nz', t, 0);
  const now = performance.now() / 1000;
  // far lanes first, so nearer cars overlap them
  for (let lane = 4; lane >= 1; lane--) for (const c of NZ.cars) if (c.lane === lane) nzCar(c);

  // the bird (hopping, or squashed flat)
  let y = NZ_ROW_Y[NZ.row]; let lift = 0;
  if (NZ.hop) { const k = Math.min(1, (now - NZ.hop.t0) / 0.16); y = NZ_ROW_Y[NZ.hop.from] + (NZ_ROW_Y[NZ.hop.to] - NZ_ROW_Y[NZ.hop.from]) * k; lift = Math.sin(k * Math.PI) * 8; }
  if (NZ.dead) y = NZ_ROW_Y[NZ.deadRow];
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(300, y, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(300, y - lift);
  if (NZ.dead) ctx.scale(1.5, 0.25); else ctx.scale(NZ.dir > 0 ? 1 : -1, 1);
  const BS = 0.4 / 3; // bird size (a third of the first version)
  ctx.drawImage(nzBirdPic(who, t), -300 * 0.5 * BS, -495 * 0.5 * BS, 300 * BS, 300 * BS); // ~27 units tall
  ctx.restore();
  if (NZ.dead) { ctx.font = '40px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.strokeText('SPLAT!', 300, y - 24); ctx.fillStyle = '#ffd23f'; ctx.fillText('SPLAT!', 300, y - 24); }

  // confetti / feathers
  for (const f of NZ.fx) { const a = now - f.t0; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - a / 1.2); ctx.translate(f.x + f.vx * a, f.y + f.vy * a + 220 * a * a); ctx.rotate(f.r + a * 6); ctx.fillStyle = f.c; ctx.fillRect(-6, -3, 12, 6); ctx.restore(); }

  // HUD: level, best, and a message banner
  const pill = (x, text, bg) => { ctx.font = '22px Bangers, Impact, sans-serif'; const w = ctx.measureText(text).width + 26; ctx.textAlign = 'left'; shape(() => ctx.roundRect(x === 'r' ? 586 - w : 14, 12, w, 34, 17), bg, 3); ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(text, (x === 'r' ? 586 - w : 14) + 13, 37); ctx.fillText(text, (x === 'r' ? 586 - w : 14) + 13, 37); };
  pill('l', `LEVEL ${NZ.level}`, '#2f7de1'); pill('r', `BEST ${NZ.best}`, '#3dab2b');
  const age = now - NZ.banner.t;
  if (age < 2.6) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (2.6 - age) * 2); ctx.font = '30px Bangers, Impact, sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(NZ.banner.text).width + 40; shape(() => ctx.roundRect(300 - w / 2, 74, w, 46, 16), 'rgba(6,18,46,.85)', 3);
    ctx.fillStyle = '#ffd23f'; ctx.fillText(NZ.banner.text, 300, 107); ctx.restore();
  }
}


function report() {
  const hops = NZ.dir > 0 ? NZ.row : 5 - NZ.row;
  onStatus({ label: NZ.dir > 0 ? '⬆ HOP!' : '⬇ HOP BACK!', msg: NZ.dir > 0 ? `Level ${NZ.level}: hop across (${hops}/5) — watch the cars!` : `Level ${NZ.level}: now hop back home (${hops}/5)!` });
}

let raf = 0; let lastT = 0; let dead = false;
function frame(ms) {
  if (dead) return;
  if (!canvas.isConnected) { dead = true; return; }
  const t = ms / 1000; const dt = lastT ? t - lastT : 0; lastT = t;
  const k = canvas.width / 600; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, 600, 600);
  if (canvas.offsetParent !== null) drawAucklandGame(t, dt);
  raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
report();
return {
  hop() { nzHop(); },
  destroy() { dead = true; cancelAnimationFrame(raf); },
};
}
