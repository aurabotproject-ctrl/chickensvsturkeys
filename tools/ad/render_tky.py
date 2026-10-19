# Team Turkeys origin story — 40 s Instagram Reel (1080x1920 @ 30 fps). Mirrors render_chk.py.
import sys, math, random, functools, subprocess
sys.path.insert(0, '/home/claude/ad')
from render import *  # noqa
from render_chk import embers, clampcam
from PIL import Image, ImageDraw

DUR = 40.0; T = '/home/claude/ad/tky'
RED_T = (255, 160, 130)
@functools.lru_cache(None)
def t_(n): return img(f'{T}/t{n}.png', 'RGB')
@functools.lru_cache(None)
def tcut(n): return img(f'{T}/t{n}_cut.png')
def scam(t, t0, t1, n, z0, z1, u0, v0, u1, v1):
    p = eio(prog(t, t0, t1)); return clampcam(Cam(t_(n), max(1.0, lerp(z0, z1, p)), lerp(u0, u1, p), lerp(v0, v1, p)))
def story(t, *a): return scam(t, *a).render()

def leaves(fr, t, n=40, seed=41):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov); r = random.Random(seed)
    for _ in range(n):
        y0 = r.uniform(0, H); sp = r.uniform(300, 700); ph = r.uniform(0, 10)
        x = (r.uniform(0, W) + sp * t) % (W + 200) - 100; y = y0 + math.sin(t * 2 + ph) * 60 + 80 * t % H
        y = y % H; s = r.uniform(6, 13); a = r.uniform(0, 6.28) + t * 4
        pts = [(x + math.cos(a) * s * 1.6, y + math.sin(a) * s * 1.6), (x + math.cos(a + 1.6) * s * 0.6, y + math.sin(a + 1.6) * s * 0.6), (x - math.cos(a) * s * 1.6, y - math.sin(a) * s * 1.6), (x + math.cos(a - 1.6) * s * 0.6, y + math.sin(a - 1.6) * s * 0.6)]
        d.polygon(pts, fill=(r.randint(200, 240), r.randint(90, 140), 40, 200))
    fr.alpha_composite(ov)

def s1(t):  # standing guard
    fr = story(t, 0, 4.2, 1, 1.0, 1.12, 0.5, 0.55, 0.5, 0.62)
    leaves(fr, t, 30)
    caption(fr, t, 0.5, [('When storms came,', 80, WHITE), ('someone had to', 80, WHITE), ('stand guard…', 80, WHITE)], 300, t1=3.7)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 1 - prog(t, 0, 0.7), (0, 0, 0))
    dx, dy = shake(t, 0.2, 4, 3.8, 2); return offset(fr, dx, dy)

def s2(t):  # big clumsy turkeys
    fr = story(t, 4, 8.2, 2, 1.05, 1.15, 0.5, 0.55, 0.5, 0.45)
    caption(fr, t, 4.35, [('Everyone thought turkeys', 74, WHITE), ('were slow…', 74, WHITE)], 300, t1=5.9)
    caption(fr, t, 6.1, [('BIG. CLUMSY.', 130, WHITE), ('TURKEYS.', 180, (140, 195, 255))], 300, fpath=F_BANG, style='slam', t1=7.85)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 0.6 * (1 - prog(t, 4.0, 4.15)))
    dx, dy = shake(t, 6.15, 14, 0.35); return offset(fr, dx, dy)

def s3(t):  # strong
    fr = story(t, 8, 13.2, 3, 1.0, 1.16, 0.5, 0.55, 0.5, 0.4)
    sparkles(fr, t, 40, (255, 220, 140), seed=8, area=(0, 200, W, 1600), drift=(0, -25), size=(2, 5))
    caption(fr, t, 8.4, [('But turkeys', 84, WHITE), ('had a secret…', 84, WHITE)], 1460, t1=10.3)
    caption(fr, t, 10.5, [('THEY WERE', 120, WHITE), ('STRONG.', 210, YOLK)], 1440, fpath=F_BANG, style='slam', t1=12.85)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 0.6 * (1 - prog(t, 8.0, 8.2)) + 0.4 * (1 - prog(t, 10.5, 10.65)) * (t >= 10.5))
    dx, dy = shake(t, 10.55, 22, 0.5); return offset(fr, dx, dy)

def s4(t):  # fortress
    fr = story(t, 13, 18.2, 4, 1.12, 1.0, 0.5, 0.75, 0.5, 0.45)
    leaves(fr, t, 18, 43)
    caption(fr, t, 13.4, [('While others tinkered…', 76, WHITE)], 1420, t1=15.2)
    caption(fr, t, 15.4, [('THE TURKEYS', 130, WHITE), ('BUILT.', 210, (255, 190, 90))], 1420, fpath=F_BANG, style='slam', t1=17.85)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 0.6 * (1 - prog(t, 13.0, 13.2)))
    dx, dy = shake(t, 15.45, 20, 0.45); return offset(fr, dx, dy)

def s5(t):  # protected the egg
    cam = scam(t, 18, 23.2, 5, 1.0, 1.14, 0.5, 0.5, 0.52, 0.45); fr = cam.render()
    place(fr, glow((255, 210, 110), 800), *cam.to_screen(0.6, 0.47), 1.0, 0.45 + 0.25 * math.sin(t * 5))
    rain(fr, t, 0.9)
    lf = (random.Random(int(t * 4)).random() > 0.8) * 0.35
    fr = flash(fr, lf + 0.8 * (1 - prog(t, 18.0, 18.25)), (220, 230, 255))
    caption(fr, t, 18.4, [('When the Golden Egg fell…', 76, WHITE)], 1520, t1=20.3)
    caption(fr, t, 20.5, [('…THE TURKEYS', 120, WHITE), ('PROTECTED IT.', 150, YOLK)], 1500, fpath=F_BANG, style='slam', t1=22.85)
    fr.alpha_composite(vignette(0.65))
    dx, dy = shake(t, 18.05, 24, 0.6); dx2, dy2 = shake(t, 20.55, 16, 0.4, 3); return offset(fr, dx + dx2, dy + dy2)

def s6(t):  # tie on the red
    fr = radial_bg((255, 110, 60), (70, 10, 6)).copy()
    rot_center(fr, speedlines(), -(t - 23) * 10, W / 2, H * 0.42)
    p = eo_back(prog(t, 23.0, 23.35), 1.4); z = lerp(1.0, 1.08, prog(t, 23, 27))
    put(fr, tcut(6), W / 2, H * 0.43, H * 1.0 * z * lerp(1.25, 1.0, p))
    sparkles(fr, t, 30, (255, 200, 150), seed=14, drift=(-30, -80), size=(2, 6))
    caption(fr, t, 23.45, [('THEY TIED ON', 140, WHITE), ('THE RED.', 220, RED_T)], 1420, fpath=F_BANG, style='slam', gap=0.95)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 1 - prog(t, 23.0, 23.2))
    dx, dy = shake(t, 23.5, 26, 0.5); return offset(fr, dx, dy)

def s7a(t):  # training ground
    fr = story(t, 27, 29.1, 7, 1.0, 1.14, 0.5, 0.55, 0.45, 0.62)
    leaves(fr, t, 15, 47)
    caption(fr, t, 27.15, [('THEY', 120, WHITE), ('TRAINED.', 190, RED_T)], 330, fpath=F_BANG, style='slam', gap=0.95)
    fr.alpha_composite(vignette(0.55)); fr = flash(fr, 0.7 * (1 - prog(t, 27.0, 27.2)))
    dx, dy = shake(t, 27.2, 18, 0.4); dx2, dy2 = shake(t, 28.1, 12, 0.3, 3); return offset(fr, dx + dx2, dy + dy2)

TRAIN = [(29.0, 30.5, 'stack', ['THEY', 'BUILT.'], 'Stack Attack'), (30.5, 32.0, 'towers', ['THEY STOOD', 'TOGETHER!'], 'Coop Wars')]
def s7(t):
    if t < 29.0: return s7a(t)
    fr = radial_bg((230, 80, 40), (50, 8, 4)).copy()
    rot_center(fr, speedlines((255, 255, 255), 60, 35), -t * 12, W / 2, 960)
    for k, (t0, t1, name, title, sub) in enumerate(TRAIN):
        if not (t0 <= t < t1): continue
        e = eo_cubic(prog(t, t0, t0 + 0.2)); i = int((t - t0) * FPS)
        cx = W / 2 + (1 - e) * (-1100 if k % 2 == 0 else 1100); rot = -1.4 if k % 2 else 1.4
        if e < 1:
            for g in (3, 2, 1): clip_card(fr, name, i, cx - g * 70 * (1 - e) * (1 if k % 2 == 0 else -1), 1000, lerp(1, 1.04, prog(t, t0, t1)), rot, 0.18)
        clip_card(fr, name, i, cx, 1000, lerp(1, 1.04, prog(t, t0, t1)), rot)
        caption(fr, t, t0 + 0.06, [(title[0], 120, WHITE), (title[1], 160, RED_T)], 340, fpath=F_BANG, style='slam', gap=0.95)
        caption(fr, t, t0 + 0.25, [(sub, 66, WHITE)], 1440, fpath=F_LUCK)
        fr = flash(fr, 0.5 * (1 - prog(t, t0, t0 + 0.12)))
        dx, dy = shake(t, t0 + 0.12, 14, 0.3, k); fr = offset(fr, dx, dy)
    sparkles(fr, t, 30, (255, 210, 170), seed=16, drift=(0, -90), size=(2, 6))
    fr.alpha_composite(vignette(0.55)); return fr

def s8(t):  # the Red Rumble
    fr = story(t, 32, 35.2, 8, 1.12, 1.0, 0.5, 0.5, 0.5, 0.5)
    sparkles(fr, t, 50, (255, 220, 170), seed=18, drift=(-25, -50), size=(2, 6))
    caption(fr, t, 32.3, [('GENERAL GOBBLE', 136, WHITE), ('& THE RED RUMBLE', 110, RED_T)], 300, fpath=F_BANG, style='slam', gap=0.95)
    caption(fr, t, 33.2, [('Big. Bold. Unstoppable.', 74, YOLK)], 1600, fpath=F_LUCK)
    fr.alpha_composite(vignette(0.5)); fr = flash(fr, 1 - prog(t, 32.0, 32.3))
    dx, dy = shake(t, 32.35, 22, 0.5); return offset(fr, dx, dy)

def s9(t):  # end card
    fr = radial_bg((220, 70, 35), (40, 6, 4)).copy()
    rot_center(fr, rays((255, 190, 140), 24, 2600, 80), -t * 10, W / 2, 700)
    place(fr, glow((255, 170, 110), 1500), W / 2, 700, 1.0, 0.55)
    sparkles(fr, t, 60, (255, 220, 190), seed=21, area=(0, 150, W, 1800), drift=(0, -70), size=(2, 7))
    p = eo_back(prog(t, 35.15, 35.55), 1.6); lg = spr('logo')
    place(fr, lg, W / 2, 470, lerp(2.3, 1.0, p) * (880 / lg.width) * (1 + 0.012 * math.sin(t * 3)), min(1, prog(t, 35.15, 35.3) * 3))
    pc = eo_back(prog(t, 35.9, 36.3), 1.3)
    put(fr, tcut(9), lerp(W + 400, 800, pc), 1180, 720)
    if t >= 36.1:
        for j, (w_, col) in enumerate([('JOIN', WHITE), ('TEAM', WHITE), ('TURKEYS!', RED_T)]):
            tj = 36.1 + j * 0.15
            if t < tj: continue
            q = eo_back(prog(t, tj, tj + 0.2), 2.4); im = text_img(w_, F_BANG, 128, col, 13, shadow=(0, 11))
            place(fr, im, 320, 960 + j * 125, lerp(1.7, 1.0, q) if q < 1 else 1.0, min(1, q * 3))
    if t >= 36.8:
        q = eo_back(prog(t, 36.8, 37.15), 1.5)
        pill = Image.new('RGBA', (1000, 260), (0, 0, 0, 0)); d = ImageDraw.Draw(pill)
        d.rounded_rectangle((8, 14, 999, 259), 50, fill=(0, 0, 0, 140)); d.rounded_rectangle((0, 0, 990, 246), 48, fill=INK + (255,)); d.rounded_rectangle((8, 8, 982, 238), 42, fill=(255, 255, 255, 255))
        l0 = text_img('FREE FOR CLASSROOMS', F_BANG, 54, (200, 50, 25), 0, shadow=(0, 0))
        l1 = text_img('aurabotproject-ctrl.github.io/', F_NUN, 48, INK, 0, shadow=(0, 0)); l2 = text_img('chickensvsturkeys', F_NUN, 78, (200, 40, 25), 0, shadow=(0, 0))
        pill.alpha_composite(l0, (int(495 - l0.width / 2), 14)); pill.alpha_composite(l1, (int(495 - l1.width / 2), 78)); pill.alpha_composite(l2, (int(495 - l2.width / 2), 132))
        place(fr, pill, W / 2, lerp(1760, 1520, q), 1 + 0.02 * math.sin(t * 5), min(1, q * 2))
    fr.alpha_composite(vignette(0.6))
    fr = flash(fr, (1 - prog(t, 35.15, 35.5)) * (t >= 35.15))
    fr = flash(fr, prog(t, 39.6, 40.0), (0, 0, 0))
    dx, dy = shake(t, 35.3, 30, 0.7); return offset(fr, dx, dy)

def frame_t(t):
    for t1, f in [(4, s1), (8, s2), (13, s3), (18, s4), (23, s5), (27, s6), (32, s7), (35, s8)]:
        if t < t1: return f(t)
    return s9(t)

if __name__ == '__main__':
    if sys.argv[1] == 'still':
        frame_t(float(sys.argv[2])).convert('RGB').save(sys.argv[3]); sys.exit()
    f0, f1, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', str(FPS), out], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        p.stdin.write(frame_t(f / FPS).convert('RGB').tobytes())
        if f % 60 == 0: print(out, f, flush=True)
    p.stdin.close(); p.wait()
