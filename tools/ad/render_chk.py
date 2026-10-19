# Team Chickens origin story — 40 s Instagram Reel (1080x1920 @ 30 fps). Reuses the toolkit in render.py.
import sys, math, random, functools, subprocess
sys.path.insert(0, '/home/claude/ad')
from render import *  # noqa  (W, H, FPS, easing, Cam, caption, place, put, flash, shake, offset, rays, glow, ...)
from PIL import Image, ImageDraw

DUR = 40.0; C = '/home/claude/ad/chk'
BLUE_T = (140, 195, 255)
@functools.lru_cache(None)
def c(n): return img(f'{C}/c{n}.png', 'RGB')
@functools.lru_cache(None)
def ccut(n): return img(f'{C}/c{n}_cut.png')

def embers(fr, t, n=60, seed=31):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov); r = random.Random(seed)
    for _ in range(n):
        x0 = r.uniform(150, 900); y0 = r.uniform(500, 1200); vx = r.uniform(-260, 260); vy = r.uniform(-380, -80); ph = r.uniform(0, 1.2)
        k = ((t * 1.3 + ph) % 1.2); x = x0 + vx * k; y = y0 + vy * k + 300 * k * k
        a = int(255 * (1 - k / 1.2)); s = r.uniform(2, 5)
        d.line([(x, y), (x - vx * 0.03, y - vy * 0.03)], fill=(255, 190, 80, a), width=int(s))
    fr.alpha_composite(ov)

def clampcam(cam):
    iw, ih = cam.im.size
    cam.c = max(0, min(iw - cam.k * W, cam.c)); cam.f = max(0, min(ih - cam.k * H, cam.f)); return cam
def scam(t, t0, t1, n, z0, z1, u0, v0, u1, v1):
    p = eio(prog(t, t0, t1)); return clampcam(Cam(c(n), max(1.0, lerp(z0, z1, p)), lerp(u0, u1, p), lerp(v0, v1, p)))
def story(t, t0, t1, n, z0, z1, u0, v0, u1, v1): return scam(t, t0, t1, n, z0, z1, u0, v0, u1, v1).render()

def s1(t):  # early risers
    fr = story(t, 0, 4.2, 1, 1.0, 1.12, 0.45, 0.6, 0.38, 0.62)
    sparkles(fr, t, 30, (255, 230, 160), seed=3, area=(0, 300, W, 1500), drift=(10, -15), size=(2, 6))
    caption(fr, t, 0.5, [('Every farm has its', 84, WHITE), ('early risers…', 84, WHITE)], 1330, t1=3.7)
    fr.alpha_composite(vignette(0.55)); return flash(fr, 1 - prog(t, 0, 0.7), (0, 0, 0))

def s2(t):  # just chickens
    fr = story(t, 4, 8.2, 2, 1.05, 1.15, 0.6, 0.45, 0.55, 0.5)
    caption(fr, t, 4.35, [('Everyone thought chickens', 74, WHITE), ('were small…', 74, WHITE)], 300, t1=5.9)
    caption(fr, t, 6.1, [('JUST…', 120, WHITE), ('CHICKENS.', 170, (255, 160, 130))], 300, fpath=F_BANG, style='slam', t1=7.85)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 0.6 * (1 - prog(t, 4.0, 4.15)))
    dx, dy = shake(t, 6.15, 12, 0.35); return offset(fr, dx, dy)

def s3(t):  # clever
    fr = story(t, 8, 13.2, 3, 1.0, 1.18, 0.5, 0.45, 0.62, 0.35)
    sparkles(fr, t, 40, (255, 220, 140), seed=8, area=(0, 200, W, 1500), drift=(0, -25), size=(2, 5))
    caption(fr, t, 8.4, [('But chickens', 84, WHITE), ('had a secret…', 84, WHITE)], 1400, t1=10.3)
    caption(fr, t, 10.5, [('THEY WERE', 120, WHITE), ('CLEVER.', 200, YOLK)], 1400, fpath=F_BANG, style='slam', t1=12.85)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 0.6 * (1 - prog(t, 8.0, 8.2)) + 0.4 * (1 - prog(t, 10.5, 10.65)) * (t >= 10.5))
    dx, dy = shake(t, 10.55, 14, 0.35); return offset(fr, dx, dy)

def s4(t):  # workshop
    fr = story(t, 13, 18.2, 4, 1.02, 1.14, 0.5, 0.42, 0.55, 0.5)
    embers(fr, t)
    fr = flash(fr, 0.18 * max(0, math.sin(t * 37)) * (random.Random(int(t * FPS)).random() > 0.5), (255, 200, 120))
    caption(fr, t, 13.4, [('While others strutted…', 76, WHITE)], 1360, t1=15.2)
    caption(fr, t, 15.4, [('THE CHICKENS', 130, WHITE), ('INVENTED.', 180, (255, 190, 90))], 1380, fpath=F_BANG, style='slam', t1=17.85)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 0.6 * (1 - prog(t, 13.0, 13.2)))
    dx, dy = shake(t, 15.45, 16, 0.4); return offset(fr, dx, dy)

def s5(t):  # saw it first
    fr = story(t, 18, 23.2, 5, 1.0, 1.16, 0.55, 0.42, 0.62, 0.3)
    place(fr, glow((255, 210, 110), 700), *scam(t, 18, 23.2, 5, 1.0, 1.16, 0.55, 0.42, 0.62, 0.3).to_screen(0.75, 0.31), 1.0, 0.45 + 0.25 * math.sin(t * 5))
    sparkles(fr, t, 40, (255, 230, 160), seed=12, area=(0, 0, W, 900), drift=(-60, 40), size=(2, 6))
    caption(fr, t, 18.4, [('Then the Golden Egg fell…', 76, WHITE)], 1420, t1=20.3)
    caption(fr, t, 20.5, [('…AND THE CHICKENS', 104, WHITE), ('SAW IT FIRST.', 150, YOLK)], 1420, fpath=F_BANG, style='slam', t1=22.85)
    fr.alpha_composite(vignette(0.65)); fr = flash(fr, 0.6 * (1 - prog(t, 18.0, 18.2)) + 0.35 * (1 - prog(t, 20.5, 20.7)) * (t >= 20.5))
    dx, dy = shake(t, 20.55, 14, 0.4); return offset(fr, dx, dy)

def s6(t):  # tying on the blue
    fr = radial_bg((60, 140, 255), (6, 22, 70)).copy()
    rot_center(fr, speedlines(), (t - 23) * 10, W / 2, H * 0.42)
    p = eo_back(prog(t, 23.0, 23.35), 1.4); z = lerp(1.0, 1.08, prog(t, 23, 27))
    put(fr, ccut(6), W / 2, H * 0.43, H * 1.0 * z * lerp(1.25, 1.0, p))
    sparkles(fr, t, 30, (200, 225, 255), seed=14, drift=(30, -80), size=(2, 6))
    caption(fr, t, 23.45, [('THEY TIED ON', 140, WHITE), ('THE BLUE.', 210, BLUE_T)], 1420, fpath=F_BANG, style='slam', gap=0.95)
    fr.alpha_composite(vignette(0.6)); fr = flash(fr, 1 - prog(t, 23.0, 23.2))
    dx, dy = shake(t, 23.5, 26, 0.5); return offset(fr, dx, dy)

TRAIN = [(29.0, 30.5, 'flag', ['THEY', 'PLANNED.'], 'Capture the Flag'), (30.5, 32.0, 'dodge', ['AS ONE', 'FLOCK!'], 'Dodge Egg')]
def s7a(t):  # training ground (illustration)
    fr = story(t, 27, 29.1, 9, 1.0, 1.14, 0.5, 0.5, 0.6, 0.62)
    sparkles(fr, t, 30, (255, 225, 150), seed=19, drift=(40, -30), size=(2, 6))
    caption(fr, t, 27.15, [('THEY', 120, WHITE), ('TRAINED.', 190, BLUE_T)], 330, fpath=F_BANG, style='slam', gap=0.95)
    fr.alpha_composite(vignette(0.55)); fr = flash(fr, 0.7 * (1 - prog(t, 27.0, 27.2)))
    dx, dy = shake(t, 27.2, 18, 0.4); dx2, dy2 = shake(t, 28.1, 12, 0.3, 3); return offset(fr, dx + dx2, dy + dy2)

def s7(t):  # training montage (real gameplay)
    if t < 29.0: return s7a(t)
    fr = radial_bg((40, 110, 230), (5, 15, 50)).copy()
    rot_center(fr, speedlines((255, 255, 255), 60, 35), t * 12, W / 2, 960)
    for k, (t0, t1, name, title, sub) in enumerate(TRAIN):
        if not (t0 <= t < t1): continue
        e = eo_cubic(prog(t, t0, t0 + 0.2)); i = int((t - t0) * FPS)
        cx = W / 2 + (1 - e) * (1100 if k % 2 == 0 else -1100); rot = 1.4 if k % 2 else -1.4
        if e < 1:
            for g in (3, 2, 1): clip_card(fr, name, i, cx + g * 70 * (1 - e) * (1 if k % 2 == 0 else -1), 1000, lerp(1, 1.04, prog(t, t0, t1)), rot, 0.18)
        clip_card(fr, name, i, cx, 1000, lerp(1, 1.04, prog(t, t0, t1)), rot)
        caption(fr, t, t0 + 0.06, [(title[0], 120, WHITE), (title[1], 170, BLUE_T)], 340, fpath=F_BANG, style='slam', gap=0.95)
        caption(fr, t, t0 + 0.25, [(sub, 66, WHITE)], 1440, fpath=F_LUCK)
        fr = flash(fr, 0.5 * (1 - prog(t, t0, t0 + 0.12)))
        dx, dy = shake(t, t0 + 0.12, 14, 0.3, k); fr = offset(fr, dx, dy)
    sparkles(fr, t, 30, (200, 225, 255), seed=16, drift=(0, -90), size=(2, 6))
    fr.alpha_composite(vignette(0.55)); return fr

def s8(t):  # the Blue Flock
    fr = story(t, 32, 35.2, 7, 1.12, 1.0, 0.5, 0.45, 0.5, 0.45)
    sparkles(fr, t, 50, (220, 235, 255), seed=18, drift=(25, -50), size=(2, 6))
    caption(fr, t, 32.3, [('CAPTAIN CLUCK', 140, WHITE), ('& THE BLUE FLOCK', 110, BLUE_T)], 300, fpath=F_BANG, style='slam', gap=0.95)
    caption(fr, t, 33.2, [('Fast. Clever. Fearless.', 74, YOLK)], 1560, fpath=F_LUCK)
    fr.alpha_composite(vignette(0.5)); fr = flash(fr, 1 - prog(t, 32.0, 32.3))
    dx, dy = shake(t, 32.35, 22, 0.5); return offset(fr, dx, dy)

def s9(t):  # end card
    fr = radial_bg((40, 110, 230), (4, 10, 40)).copy()
    rot_center(fr, rays((170, 210, 255), 24, 2600, 80), t * 10, W / 2, 700)
    place(fr, glow((150, 200, 255), 1500), W / 2, 700, 1.0, 0.55)
    sparkles(fr, t, 60, (210, 230, 255), seed=21, area=(0, 150, W, 1800), drift=(0, -70), size=(2, 7))
    p = eo_back(prog(t, 35.15, 35.55), 1.6); lg = spr('logo')
    place(fr, lg, W / 2, 470, lerp(2.3, 1.0, p) * (880 / lg.width) * (1 + 0.012 * math.sin(t * 3)), min(1, prog(t, 35.15, 35.3) * 3))
    pc = eo_back(prog(t, 35.9, 36.3), 1.3)
    put(fr, ccut(8), lerp(-400, 260, pc), 1180, 720)
    if t >= 36.1:
        for j, (w_, col) in enumerate([('JOIN', WHITE), ('TEAM', WHITE), ('CHICKENS!', BLUE_T)]):
            tj = 36.1 + j * 0.15
            if t < tj: continue
            q = eo_back(prog(t, tj, tj + 0.2), 2.4); im = text_img(w_, F_BANG, 128, col, 13, shadow=(0, 11))
            place(fr, im, 760, 960 + j * 125, lerp(1.7, 1.0, q) if q < 1 else 1.0, min(1, q * 3))
    if t >= 36.8:
        q = eo_back(prog(t, 36.8, 37.15), 1.5)
        pill = Image.new('RGBA', (1000, 260), (0, 0, 0, 0)); d = ImageDraw.Draw(pill)
        d.rounded_rectangle((8, 14, 999, 259), 50, fill=(0, 0, 0, 140)); d.rounded_rectangle((0, 0, 990, 246), 48, fill=INK + (255,)); d.rounded_rectangle((8, 8, 982, 238), 42, fill=(255, 255, 255, 255))
        l0 = text_img('FREE FOR CLASSROOMS', F_BANG, 54, (30, 90, 200), 0, shadow=(0, 0))
        l1 = text_img('aurabotproject-ctrl.github.io/', F_NUN, 48, INK, 0, shadow=(0, 0)); l2 = text_img('chickensvsturkeys', F_NUN, 78, (200, 40, 25), 0, shadow=(0, 0))
        pill.alpha_composite(l0, (int(495 - l0.width / 2), 14)); pill.alpha_composite(l1, (int(495 - l1.width / 2), 78)); pill.alpha_composite(l2, (int(495 - l2.width / 2), 132))
        place(fr, pill, W / 2, lerp(1760, 1520, q), 1 + 0.02 * math.sin(t * 5), min(1, q * 2))
    fr.alpha_composite(vignette(0.6))
    fr = flash(fr, (1 - prog(t, 35.15, 35.5)) * (t >= 35.15))
    fr = flash(fr, prog(t, 39.6, 40.0), (0, 0, 0))
    dx, dy = shake(t, 35.3, 30, 0.7); return offset(fr, dx, dy)

def frame_c(t):
    for t1, f in [(4, s1), (8, s2), (13, s3), (18, s4), (23, s5), (27, s6), (32, s7), (35, s8)]:
        if t < t1: return f(t)
    return s9(t)

if __name__ == '__main__':
    if sys.argv[1] == 'still':
        frame_c(float(sys.argv[2])).convert('RGB').save(sys.argv[3]); sys.exit()
    f0, f1, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', str(FPS), out], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        p.stdin.write(frame_c(f / FPS).convert('RGB').tobytes())
        if f % 60 == 0: print(out, f, flush=True)
    p.stdin.close(); p.wait()
