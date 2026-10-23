// AUTO-BUILT by tools/build_tokyo.py from extras/code-characters.html — edit that page, then re-run the script.
// Egypt Crossing: walk your chicken/turkey around the pyramids, souk, oasis and Nile; camels stop if you stand in front of them.
// mountEgypt(canvas, { team, onStatus }) → { key(dir, down), tap(clientX, clientY), destroy() }

export function mountEgypt(canvas, { team = 'chicken', onStatus = () => {} } = {}) {
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
//   EGYPT CROSSING — edit me! This draws the scenery: pyramids, Sphinx,
//   the camel road, the souk market, the oasis and the Nile.
//   (The camels and your bird move by themselves.)
//   x (0 = left, 600 = right) and y (0 = top, 600 = bottom). The camel road runs from y 280 to 400.
// =====================================================================
function drawEgypt(t) {
  const COL = {
    skyTop: '#ffb35c', skyBottom: '#ffe2a8', sand: '#e9c58a', sandDark: '#d9ad6a', road: '#c99a5c',
    stone: '#e3c27f', stoneShade: '#b88f4f', nile: '#2f8fc7', palm: '#3f8a2f',
  };
  // ---- sky + sun ----
  const sky = ctx.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, COL.skyTop); sky.addColorStop(1, COL.skyBottom);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 600, 160);
  const sun = ctx.createRadialGradient(520, 50, 4, 520, 50, 60); sun.addColorStop(0, '#fffbe0'); sun.addColorStop(0.4, '#ffe066'); sun.addColorStop(1, 'rgba(255,224,102,0)');
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(520, 50, 60, 0, Math.PI * 2); ctx.fill();
  // birds in the sky
  ctx.strokeStyle = '#7a4b2a'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const x = (t * 18 + i * 140) % 700 - 50; const y = 40 + i * 14 + Math.sin(t * 2 + i) * 4; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x - 3, y - 5, x, y); ctx.quadraticCurveTo(x + 3, y - 5, x + 7, y); ctx.stroke(); }

  // ---- desert sand ----
  ctx.fillStyle = COL.sand; ctx.fillRect(0, 150, 600, 450);
  ctx.fillStyle = COL.sandDark; ctx.beginPath(); ctx.moveTo(0, 165); ctx.quadraticCurveTo(150, 140, 300, 162); ctx.quadraticCurveTo(450, 182, 600, 158); ctx.lineTo(600, 180); ctx.lineTo(0, 180); ctx.fill();

  // ---- the pyramids of Giza (lit from the right, shaded on the left) ----
  const pyramid = (x0, x1, apexX, apexY, baseY) => {
    ctx.fillStyle = COL.stone; ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(apexX, apexY); ctx.lineTo(x1, baseY); ctx.fill();
    ctx.fillStyle = COL.stoneShade; ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(apexX, apexY); ctx.lineTo(apexX - (apexX - x0) * 0.15, baseY); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,30,.25)'; ctx.lineWidth = 1;
    for (let k = 1; k < 9; k++) { const y = apexY + (baseY - apexY) * (k / 9); const f = (y - apexY) / (baseY - apexY); ctx.beginPath(); ctx.moveTo(apexX - (apexX - x0) * f, y); ctx.lineTo(apexX + (x1 - apexX) * f, y); ctx.stroke(); }
    ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(apexX, apexY); ctx.lineTo(x1, baseY); ctx.stroke();
  };
  pyramid(360, 460, 410, 118, 182);   // the small one at the back
  pyramid(200, 380, 290, 72, 186);    // the middle one
  pyramid(30, 270, 150, 46, 190);     // the Great Pyramid

  // ---- the Sphinx (a lion's body with a human head) ----
  ctx.save(); ctx.translate(505, 168);
  ctx.fillStyle = '#d8b26e'; ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-48, 22); ctx.lineTo(-48, 6); ctx.quadraticCurveTo(-40, -6, -10, -4); ctx.lineTo(20, -4); ctx.lineTo(22, -30); ctx.lineTo(44, -30); ctx.lineTo(46, 22); ctx.closePath(); ctx.fill(); ctx.stroke(); // body + head block
  ctx.fillStyle = '#c99a4f'; ctx.beginPath(); ctx.moveTo(18, -30); ctx.lineTo(48, -30); ctx.lineTo(52, -6); ctx.lineTo(14, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); // headdress
  ctx.fillStyle = '#d8b26e'; ctx.fillRect(25, -26, 16, 18); ctx.strokeRect(25, -26, 16, 18); // face
  ctx.fillStyle = '#5a3d1a'; ctx.fillRect(34, -20, 4, 2); ctx.fillRect(28, -12, 8, 1.5);
  ctx.fillStyle = '#d8b26e'; ctx.fillRect(28, 14, 30, 8); ctx.strokeRect(28, 14, 30, 8); // paws
  ctx.restore();

  // ---- the camel road ----
  ctx.fillStyle = COL.road; ctx.fillRect(0, 280, 600, 120);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, 280, 600, 4); ctx.fillRect(0, 396, 600, 4);
  ctx.strokeStyle = 'rgba(120,80,30,.35)'; ctx.setLineDash([10, 14]); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 356); ctx.lineTo(600, 356); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(120,80,30,.25)'; // hoof prints
  for (let i = 0; i < 26; i++) { const x = (i * 47) % 600; const y = 300 + (i % 2) * 12 + (i % 3 ? 60 : 0); ctx.beginPath(); ctx.ellipse(x, y, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
  // stone marker posts along the road
  for (const x of [20, 580]) for (const y of [276, 404]) { ctx.fillStyle = '#b88f4f'; ctx.fillRect(x - 5, y - 10, 10, 14); }

  // ---- the souk (market) ----
  const stall = (x, c1, c2, goods) => {
    ctx.fillStyle = '#7a4b2a'; ctx.fillRect(x + 4, 430, 4, 40); ctx.fillRect(x + 52, 430, 4, 40); // poles
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? c1 : c2; ctx.fillRect(x + i * 10, 420, 10, 16); } // striped awning
    ctx.strokeStyle = '#5a3d1a'; ctx.lineWidth = 2; ctx.strokeRect(x, 420, 60, 16);
    ctx.fillStyle = '#9c6a3c'; ctx.fillRect(x, 458, 60, 16); ctx.strokeRect(x, 458, 60, 16); // table
    goods(x);
  };
  stall(24, '#e63946', '#fff1d0', (x) => { for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#c1440e', '#e9a23b', '#2a9d8f'][i]; ctx.beginPath(); ctx.ellipse(x + 12 + i * 18, 452, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); } });          // pots
  stall(102, '#2a9d8f', '#fff1d0', (x) => { for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#e63946', '#6a4c93', '#f4a261'][i]; ctx.fillRect(x + 4 + i * 18, 446, 16, 12); } });                               // carpets
  stall(180, '#f4a261', '#fff1d0', (x) => { for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#ffd166', '#ef476f', '#06d6a0', '#ffd166'][i]; ctx.beginPath(); ctx.arc(x + 10 + i * 13, 452, 6, 0, Math.PI * 2); ctx.fill(); } }); // fruit

  // ---- the oasis ----
  ctx.fillStyle = '#7cc46a'; ctx.beginPath(); ctx.ellipse(450, 472, 96, 46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4fb3e8'; ctx.beginPath(); ctx.ellipse(450, 474, 66, 26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(450, 474, 20 + ((t * 12 + i * 15) % 45), 8 + ((t * 5 + i * 6) % 17), 0, 0, Math.PI * 2); ctx.stroke(); }
  const palm = (x, y) => {
    ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 30, x + 2, y - 56); ctx.stroke();
    ctx.fillStyle = COL.palm;
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.55 + Math.sin(t * 1.5 + x) * 0.05; ctx.save(); ctx.translate(x + 2, y - 56); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(18, 0, 20, 5, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#6b3e1e'; ctx.beginPath(); ctx.arc(x, y - 54, 3.5, 0, Math.PI * 2); ctx.arc(x + 5, y - 52, 3.5, 0, Math.PI * 2); ctx.fill(); // dates
  };
  palm(372, 470); palm(530, 468); palm(500, 440);

  // ---- the River Nile with felucca boats ----
  ctx.fillStyle = '#c9a76a'; ctx.fillRect(0, 528, 600, 10);
  ctx.fillStyle = COL.nile; ctx.fillRect(0, 536, 600, 64);
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) { const x = (i * 67 + t * 15) % 640 - 20; ctx.beginPath(); ctx.moveTo(x, 552 + (i % 3) * 14); ctx.lineTo(x + 16, 552 + (i % 3) * 14); ctx.stroke(); }
  const felucca = (x, y) => {
    ctx.fillStyle = '#7a4b2a'; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x + 20, y); ctx.lineTo(x + 14, y + 7); ctx.lineTo(x - 14, y + 7); ctx.fill();
    ctx.strokeStyle = '#5a3d1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30); ctx.stroke();
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.moveTo(x - 2, y - 32); ctx.lineTo(x + 22, y - 4); ctx.lineTo(x - 2, y - 6); ctx.fill();
  };
  felucca((t * 16) % 680 - 40, 566); felucca((t * 10 + 330) % 680 - 40, 588);
}

const good = { chicken: drawChicken, turkey: drawTurkey, eg: drawEgypt };
function drawBird(kind, t, bk) { good[kind](t, bk); }

// =====================================================================
//    EGYPT CROSSING — walk anywhere; camels stop if you're in front
// =====================================================================
const EG_LANES = [{ y: 334, d: 1 }, { y: 390, d: -1 }];          // camel lanes: top walks right, bottom walks left
const EG_BOUNDS = { x0: 10, x1: 590, y0: 192, y1: 526 };          // where you can walk (not up the pyramids or into the Nile!)
const EG_SOLID = [[24, 456, 84, 476], [102, 456, 162, 476], [180, 456, 240, 476]]; // market tables
const EG_POOL = { x: 450, y: 474, rx: 66, ry: 26 };               // the oasis pool
const EG_PLACES = [
  { id: 'pyr', name: '🔺 The Pyramids', fact: 'The Great Pyramid is about 4,500 years old!', x0: 20, x1: 380, y0: 190, y1: 272 },
  { id: 'sph', name: '🦁 The Sphinx', fact: 'The Sphinx has a lion’s body and a human head.', x0: 400, x1: 600, y0: 190, y1: 272 },
  { id: 'souk', name: '🛍️ The Souk', fact: 'A souk is a busy Egyptian market — pots, carpets and fruit!', x0: 10, x1: 260, y0: 408, y1: 508 },
  { id: 'oasis', name: '🌴 The Oasis', fact: 'An oasis is a spot in the desert with water and palm trees.', x0: 330, x1: 600, y0: 408, y1: 508 },
  { id: 'nile', name: '⛵ The Nile', fact: 'The Nile is one of the longest rivers in the world!', x0: 0, x1: 600, y0: 512, y1: 530 },
];
const EG = { x: 290, y: 470, face: 1, moving: false, keys: new Set(), target: null, camels: [], spawn: [0.5, 2], visited: new Set(), crossings: 0, side: 'bottom', banner: null, hopT: 0 };
const EG_SPEED = 95;
const egFoot = (x, y) => [x - 8, y - 6, x + 8, y + 4];            // the bird's footprint
const egCamelBox = (c) => { const L = EG_LANES[c.lane]; return [c.x - 34, L.y - 13, c.x + 34, L.y + 9]; }; // a camel's footprint
const hitRect = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
function egBlocked(x, y) {
  if (x < EG_BOUNDS.x0 || x > EG_BOUNDS.x1 || y < EG_BOUNDS.y0 || y > EG_BOUNDS.y1) return true;
  const f = egFoot(x, y);
  if (EG_SOLID.some((r) => hitRect(f, r))) return true;
  if (((x - EG_POOL.x) / EG_POOL.rx) ** 2 + ((y - EG_POOL.y) / EG_POOL.ry) ** 2 < 1) return true;
  return EG.camels.some((c) => hitRect(f, egCamelBox(c)));        // you can't walk through a camel!
}
function egBanner(title, sub) { EG.banner = { title, sub, t: performance.now() / 1000 }; }

function egStep(dt) {
  // ---- your bird: arrows / keys, or walking to where you tapped ----
  let dx = 0; let dy = 0;
  for (const k of EG.keys) { if (k === 'l') dx -= 1; if (k === 'r') dx += 1; if (k === 'u') dy -= 1; if (k === 'd') dy += 1; }
  if (dx || dy) EG.target = null;
  else if (EG.target) { const tx = EG.target[0] - EG.x; const ty = EG.target[1] - EG.y; const d = Math.hypot(tx, ty); if (d < 3) EG.target = null; else { dx = tx / d; dy = ty / d; } }
  const len = Math.hypot(dx, dy); EG.moving = len > 0;
  if (len) {
    const sx = (dx / len) * EG_SPEED * dt; const sy = (dy / len) * EG_SPEED * dt;
    let moved = false;
    if (!egBlocked(EG.x + sx, EG.y)) { EG.x += sx; moved = true; }   // slide along things you bump into
    if (!egBlocked(EG.x, EG.y + sy)) { EG.y += sy; moved = true; }
    if (Math.abs(dx) > 0.1) EG.face = dx > 0 ? 1 : -1;
    if (!moved && EG.target) EG.target = null;
    EG.hopT += dt;
  }
  // crossings + places
  const side = EG.y < 280 ? 'top' : EG.y > 400 ? 'bottom' : EG.side;
  if (side !== EG.side) { EG.side = side; EG.crossings += 1; egBanner('🐪 Made it across!', `Crossings: ${EG.crossings}`); report(); }
  for (const p of EG_PLACES) {
    if (!EG.visited.has(p.id) && EG.x > p.x0 && EG.x < p.x1 && EG.y > p.y0 && EG.y < p.y1) {
      EG.visited.add(p.id); egBanner(p.name, p.fact); report();
      if (EG.visited.size === EG_PLACES.length) setTimeout(() => egBanner('🏆 You visited every place!', 'You’re a true Egypt explorer!'), 2600);
    }
  }

  // ---- camels: walk in caravans; stop for anything in front (you, or the camel ahead) ----
  for (let i = 0; i < 2; i++) {
    EG.spawn[i] -= dt;
    if (EG.spawn[i] > 0) continue;
    const L = EG_LANES[i]; const n = 1 + Math.floor(Math.random() * 3); // a caravan of 1–3
    const startX = L.d > 0 ? -50 : 650;
    const lastIn = EG.camels.filter((c) => c.lane === i).some((c) => Math.abs(c.x - startX) < 110);
    if (lastIn) { EG.spawn[i] = 0.8; continue; }
    for (let k = 0; k < n; k++) EG.camels.push({ lane: i, x: startX - L.d * k * 82, v: 0, vmax: 34 + Math.random() * 10, step: Math.random() * 6, colour: ['#e63946', '#2a9d8f', '#6a4c93', '#f4a261'][Math.floor(Math.random() * 4)] });
    EG.spawn[i] = 4 + Math.random() * 5;
  }
  for (let i = 0; i < 2; i++) {
    const L = EG_LANES[i];
    const lane = EG.camels.filter((c) => c.lane === i).sort((a, b) => L.d * (b.x - a.x)); // front-most first
    lane.forEach((c, k) => {
      const front = c.x + L.d * 34;
      let room = Infinity;
      const ahead = lane[k - 1]; if (ahead) room = Math.min(room, L.d * ((ahead.x - L.d * 34) - front) - 10);
      // is the bird standing in front of this camel?
      const f = egFoot(EG.x, EG.y);
      if (f[3] > L.y - 18 && f[1] < L.y + 14) { const gap = L.d > 0 ? f[0] - front : front - f[2]; if (gap > -6) room = Math.min(room, gap - 8); }
      const want = room <= 0 ? 0 : Math.min(c.vmax, room * 2);
      c.v += Math.max(-120 * dt, Math.min(60 * dt, want - c.v)); c.v = Math.max(0, c.v);
      c.x += L.d * c.v * dt; c.step += c.v * dt * 0.12;
      c.waiting = c.v < 4;
    });
  }
  EG.camels = EG.camels.filter((c) => c.x > -200 && c.x < 800);
}

function drawCamel(c) {
  const L = EG_LANES[c.lane]; const walk = c.waiting ? 0 : Math.sin(c.step * 2);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(c.x, L.y + 4, 34, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(c.x, L.y); if (L.d < 0) ctx.scale(-1, 1); // camel faces the way it walks (head on the right)
  const body = '#c8955a'; const dark = '#a8763f';
  // legs (back pair then front pair, swinging)
  const leg = (x, sw) => { ctx.save(); ctx.translate(x, -22); ctx.rotate(sw * 0.35); shape(() => ctx.roundRect(-3.5, 0, 7, 24, 3), dark, 2.5); ctx.restore(); };
  leg(-20, walk); leg(-12, -walk); leg(14, -walk); leg(22, walk);
  // body with a big hump
  shape(() => { ctx.moveTo(-30, -24); ctx.quadraticCurveTo(-30, -40, -14, -42); ctx.quadraticCurveTo(-4, -64, 10, -44); ctx.quadraticCurveTo(28, -42, 28, -26); ctx.quadraticCurveTo(10, -16, -30, -24); }, body, 3);
  // saddle blanket
  shape(() => ctx.roundRect(-14, -44, 26, 14, 4), c.colour, 2);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(-12, -34, 22, 2.5);
  // neck + head
  shape(() => { ctx.moveTo(22, -36); ctx.quadraticCurveTo(34, -40, 34, -56); ctx.lineTo(42, -60); ctx.quadraticCurveTo(52, -58, 50, -50); ctx.lineTo(40, -50); ctx.quadraticCurveTo(40, -36, 28, -26); ctx.closePath(); }, body, 3);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(42, -56, 1.8, 0, Math.PI * 2); ctx.fill();
  shape(() => ctx.ellipse(36, -62, 3, 5, -0.4, 0, Math.PI * 2), dark, 2); // ear
  // tail
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-29, -30); ctx.quadraticCurveTo(-36, -24 + walk * 2, -34, -16); ctx.stroke();
  ctx.restore();
  if (c.waiting) { ctx.font = '13px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💤', c.x + (L.d > 0 ? 30 : -30), L.y - 66); }
}

const egPics = {};
function egBirdPic(kind, t) {
  let p = egPics[kind];
  if (!p) { const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300; p = egPics[kind] = { cv, at: -1 }; }
  if (t - p.at > 0.1 && good[kind]) {
    p.at = t; const keep = ctx; const c2 = p.cv.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, 300, 300); c2.setTransform(0.5, 0, 0, 0.5, 0, 0);
    ctx = c2; try { good[kind](t, 0); } catch (e) { /* editor shows the problem */ } ctx = keep;
  }
  return p.cv;
}
function drawEgBird(t) {
  const hop = EG.moving ? Math.abs(Math.sin(EG.hopT * 14)) * 4 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(EG.x, EG.y, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(EG.x, EG.y - hop); ctx.scale(EG.face, 1);
  const BS = 0.16; ctx.drawImage(egBirdPic(who, t), -150 * BS, -247.5 * BS, 300 * BS, 300 * BS);
  ctx.restore();
}

function drawEgyptGame(t, dt) {
  for (let left = Math.min(dt, 0.5); left > 0; left -= 0.05) egStep(Math.min(left, 0.05));
  drawBird('eg', t, 0);
  // camels and your bird, back to front
  const things = [...EG.camels.map((c) => ({ y: EG_LANES[c.lane].y, draw: () => drawCamel(c) })), { y: EG.y, draw: () => drawEgBird(t) }];
  things.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
  if (EG.target) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(EG.target[0], EG.target[1], 8, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  // HUD
  const pill = (x, text, bg) => { ctx.font = '20px Bangers, Impact, sans-serif'; const w = ctx.measureText(text).width + 24; const px = x === 'r' ? 586 - w : 14; ctx.textAlign = 'left'; shape(() => ctx.roundRect(px, 12, w, 32, 16), bg, 3); ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(text, px + 12, 35); ctx.fillText(text, px + 12, 35); };
  pill('l', `PLACES ${EG.visited.size}/${EG_PLACES.length}`, '#c1440e'); pill('r', `CROSSINGS ${EG.crossings}`, '#2a9d8f');
  const bn = EG.banner; const age = bn ? performance.now() / 1000 - bn.t : 99;
  if (age < 3.2) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (3.2 - age) * 2);
    ctx.font = '26px Bangers, Impact, sans-serif'; const w1 = ctx.measureText(bn.title).width; ctx.font = 'bold 14px Nunito, sans-serif'; const w2 = ctx.measureText(bn.sub).width;
    const w = Math.min(560, Math.max(w1, w2) + 36);
    shape(() => ctx.roundRect(300 - w / 2, 58, w, 62, 16), 'rgba(60,30,8,.88)', 3);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166'; ctx.font = '26px Bangers, Impact, sans-serif'; ctx.fillText(bn.title, 300, 86);
    ctx.fillStyle = '#fff3dc'; ctx.font = 'bold 14px Nunito, sans-serif'; ctx.fillText(bn.sub, 300, 108, 540);
    ctx.restore();
  }
}


function report() {
  onStatus({ msg: `Hold the arrows or tap where to go. Places: ${EG.visited.size}/${EG_PLACES.length} · Crossings: ${EG.crossings} · Camels stop if you stand in front of them!` });
}

let raf = 0; let lastT = 0; let dead = false;
function frame(ms) {
  if (dead) return;
  if (!canvas.isConnected) { dead = true; return; }
  const t = ms / 1000; const dt = lastT ? t - lastT : 0; lastT = t;
  const k = canvas.width / 600; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, 600, 600);
  if (canvas.offsetParent !== null) drawEgyptGame(t, dt);
  raf = requestAnimationFrame(frame);
}
raf = requestAnimationFrame(frame);
report();
return {
  key(dir, down) { if (down) EG.keys.add(dir); else EG.keys.delete(dir); },
  tap(clientX, clientY) { const r = canvas.getBoundingClientRect(); EG.target = [((clientX - r.left) / r.width) * 600, ((clientY - r.top) / r.height) * 600]; },
  destroy() { dead = true; cancelAnimationFrame(raf); },
};
}
