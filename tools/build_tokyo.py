#!/usr/bin/env python3
"""Build js/scenes/tokyo.js (the Tokyo Crossing scene for the student waiting screen)
from extras/code-characters.html, so the two always draw the same city.
Run: python3 tools/build_tokyo.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'extras/code-characters.html').read_text()

def block(tag):
    m = re.search(rf'<script type="text/plain" id="{tag}">(.*?)</script>', html, re.S)
    return m.group(1).strip().replace('<\\/script', '</script')
main = html.split('<script>\n', 1)[1].rsplit('</script>', 1)[0]
helpers = main[main.index('const INK'):main.index('// =====================================================================\n//                        animation + the swap button')]
_end = main.index('// =====================================================================\n//     AUCKLAND CROSSING') if 'AUCKLAND CROSSING — a crossy-road game' in main else main.index('// ---- switching between the birds and the city ----')
sim = main[main.index('// =====================================================================\n//         TOKYO CROSSING — cars'):_end]
sim = sim.replace("  updateWalkUI();\n", "  report();\n")
status = main[main.index('function updateWalkUI() {'):]
status = status[:status.index('\n}\n') + 3]
status = status.replace('function updateWalkUI() {', 'function walkStatus() {')
status = re.sub(r"  if \(walkMsg\.textContent.*?walkBtn\.disabled = !can;\n", "  return { msg, label, can };\n", status, flags=re.S)

out = f'''// AUTO-BUILT by tools/build_tokyo.py from extras/code-characters.html — edit that page, then re-run the script.
// Tokyo Crossing: a code-drawn city crossing full of chickens and turkeys (no images).
// mountTokyo(canvas, {{ onStatus }}) → {{ press(), destroy() }}

export function mountTokyo(canvas, {{ onStatus = () => {{}} }} = {{}}) {{
let ctx = canvas.getContext('2d');
{helpers}
{block('src-chicken')}

{block('src-turkey')}

{block('src-city')}

const good = {{ chicken: drawChicken, turkey: drawTurkey, city: drawCity }};
function drawBird(kind, t, bk) {{ good[kind](t, bk); }}

{sim}
{status}
let lastKey = '';
function report() {{ const s = walkStatus(); const k = s.msg + s.label + s.can; if (k !== lastKey) {{ lastKey = k; onStatus(s); }} }}

let raf = 0; let lastT = 0; let dead = false;
function frame(ms) {{
  if (dead) return;
  if (!canvas.isConnected) {{ dead = true; return; }} // the waiting screen was replaced
  const t = ms / 1000; const dt = lastT ? t - lastT : 0; lastT = t;
  const k = canvas.width / 600; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, 600, 600);
  if (canvas.offsetParent !== null) drawTokyo(t, dt); // skip drawing while hidden
  raf = requestAnimationFrame(frame);
}}
raf = requestAnimationFrame(frame);
return {{
  press() {{ if (CITY.phase !== 'WALK' && !CITY.walkReq) CITY.walkReq = true; }},
  destroy() {{ dead = true; cancelAnimationFrame(raf); }},
}};
}}
'''
(root / 'js/scenes/tokyo.js').write_text(out)
print('wrote js/scenes/tokyo.js', len(out))
