# Chickens vs Turkeys — 45 s Instagram ad renderer (1080x1920 @ 30 fps).
# usage: python3 render.py <first_frame> <last_frame_exclusive> <out.mp4>   |   python3 render.py still <t> <out.png>
import sys, math, os, random, subprocess, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H, FPS, DUR = 1080, 1920, 30, 45.0
A = '/home/claude/ad'; SP = '/home/claude/chickensvsturkeys/assets/sprites'
INK = (17, 17, 17); YOLK = (255, 199, 44); WHITE = (255, 255, 255); BLUE = (30, 111, 224); RED = (224, 64, 42)
F_BANG = f'{A}/fonts/bangers-latin-400-normal.ttf'; F_LUCK = f'{A}/fonts/luckiest-guy-latin-400-normal.ttf'; F_NUN = f'{A}/fonts/nunito-latin-900-normal.ttf'

# ---------------- easing ----------------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def prog(t, t0, t1): return clamp((t - t0) / (t1 - t0)) if t1 > t0 else float(t >= t0)
def eo_cubic(x): return 1 - (1 - x) ** 3
def ei_cubic(x): return x ** 3
def eio(x): return 3 * x * x - 2 * x ** 3
def eo_back(x, s=1.9): x -= 1; return x * x * ((s + 1) * x + s) + 1
def lerp(a, b, x): return a + (b - a) * x

# ---------------- assets ----------------
@functools.lru_cache(None)
def img(path, mode='RGBA'): return Image.open(path).convert(mode)
def src(n): return img(f'{A}/src/{n}.png', 'RGB')
def cut(n): return img(f'{A}/cut/{n}.png')
def spr(n): return img(f'{SP}/{n}.webp')

@functools.lru_cache(None)
def font(path, size): return ImageFont.truetype(path, size)

@functools.lru_cache(512)
def text_img(text, fpath, size, fill=WHITE, stroke=10, sfill=INK, shadow=(0, 9), shcol=INK, track=0):
    f = font(fpath, size)
    bb = f.getbbox(text, stroke_width=stroke)
    pad = stroke + max(abs(shadow[0]), abs(shadow[1])) + 8
    w = bb[2] - bb[0] + pad * 2; h = bb[3] - bb[1] + pad * 2
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x, y = pad - bb[0], pad - bb[1]
    if shadow != (0, 0): d.text((x + shadow[0], y + shadow[1]), text, font=f, fill=shcol, stroke_width=stroke, stroke_fill=shcol)
    d.text((x, y), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=sfill)
    return im

def place(fr, im, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if alpha <= 0.01 or scale <= 0.01: return
    if abs(scale - 1) > 0.003:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BILINEAR)
    if abs(rot) > 0.05: im = im.rotate(rot, resample=Image.BILINEAR, expand=True)
    if alpha < 0.99:
        a = im.getchannel('A').point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    x = int(cx - im.width / 2); y = int(cy - im.height / 2)
    if x >= W or y >= H or x + im.width <= 0 or y + im.height <= 0: return
    # crop to frame for speed
    cx0, cy0 = max(0, -x), max(0, -y); cx1, cy1 = min(im.width, W - x), min(im.height, H - y)
    fr.alpha_composite(im.crop((cx0, cy0, cx1, cy1)), (x + cx0, y + cy0))

def sprite_h(name_or_img, h):
    im = name_or_img if isinstance(name_or_img, Image.Image) else cut(name_or_img)
    return im, h / im.height

def put(fr, im, cx, cy, h, alpha=1.0, rot=0.0):
    place(fr, im, cx, cy, h / im.height, alpha, rot)

class Cam:
    """cover-fit a background image with zoom / pan (u,v = image point at screen centre)"""
    def __init__(self, im, zoom=1.0, u=0.5, v=0.5, dx=0, dy=0):
        self.im = im; iw, ih = im.size
        self.k = min(iw / W, ih / H) / zoom
        self.c = u * iw - self.k * W / 2 - dx * self.k; self.f = v * ih - self.k * H / 2 - dy * self.k
    def render(self):
        return self.im.transform((W, H), Image.AFFINE, (self.k, 0, self.c, 0, self.k, self.f), resample=Image.BILINEAR).convert('RGBA')
    def to_screen(self, u, v):
        iw, ih = self.im.size
        return ((u * iw - self.c) / self.k, (v * ih - self.f) / self.k)

def shake(t, t0, amp, dur=0.7, seed=1):
    if t < t0 or t > t0 + dur: return 0, 0
    k = 1 - (t - t0) / dur; a = amp * k * k
    r = random.Random(int(t * FPS) * 7 + seed)
    return r.uniform(-a, a), r.uniform(-a, a)

def offset(fr, dx, dy):
    if abs(dx) < 0.5 and abs(dy) < 0.5: return fr
    out = Image.new('RGBA', (W, H), (0, 0, 0, 255)); out.paste(fr, (int(dx), int(dy))); return out

def flash(fr, a, col=WHITE):
    if a <= 0.01: return fr
    return Image.blend(fr, Image.new('RGBA', (W, H), col + (255,)), clamp(a))

def tint(fr, col, a):
    if a <= 0.01: return fr
    ov = Image.new('RGBA', (W, H), col + (int(255 * clamp(a)),)); fr.alpha_composite(ov); return fr

@functools.lru_cache(None)
def vignette(strength=0.75):
    y, x = np.mgrid[0:H, 0:W]
    d = np.sqrt(((x - W / 2) / (W * 0.62)) ** 2 + ((y - H / 2) / (H * 0.62)) ** 2)
    a = np.clip((d - 0.55) / 0.6, 0, 1) ** 1.6 * 255 * strength
    v = np.zeros((H, W, 4), np.uint8); v[..., 3] = a.astype(np.uint8)
    return Image.fromarray(v, 'RGBA')

@functools.lru_cache(None)
def rays(col=(255, 210, 90), n=18, size=2400, alpha=110):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = size / 2
    for i in range(n):
        a0 = (i / n) * 2 * math.pi; a1 = a0 + math.pi / n * 0.55
        d.polygon([(c, c), (c + math.cos(a0) * size, c + math.sin(a0) * size), (c + math.cos(a1) * size, c + math.sin(a1) * size)], fill=col + (alpha,))
    m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).ellipse((0, 0, size, size), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(size / 6))
    im.putalpha(ImageChops.multiply(im.getchannel('A'), m))
    return im.filter(ImageFilter.GaussianBlur(3))

@functools.lru_cache(None)
def glow(col, size, strength=230):
    im = Image.new('RGBA', (size, size), col + (0,)); m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).ellipse((size * 0.18, size * 0.18, size * 0.82, size * 0.82), fill=strength)
    im.putalpha(m.filter(ImageFilter.GaussianBlur(size / 7))); return im

@functools.lru_cache(None)
def radial_bg(c_in, c_out):
    y, x = np.mgrid[0:H, 0:W]; d = np.clip(np.sqrt(((x - W / 2) / W) ** 2 + ((y - H * 0.45) / H) ** 2) / 0.75, 0, 1)
    arr = np.zeros((H, W, 4), np.uint8)
    for i in range(3): arr[..., i] = (c_in[i] * (1 - d) + c_out[i] * d).astype(np.uint8)
    arr[..., 3] = 255; return Image.fromarray(arr, 'RGBA')

@functools.lru_cache(None)
def speedlines(col=(255, 255, 255), n=70, alpha=60, size=2600, seed=3):
    r = random.Random(seed); im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = size / 2
    for i in range(n):
        a = r.uniform(0, 2 * math.pi); w = r.uniform(0.004, 0.02); r0 = r.uniform(size * 0.16, size * 0.3)
        d.polygon([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a - w) * size, c + math.sin(a - w) * size), (c + math.cos(a + w) * size, c + math.sin(a + w) * size)], fill=col + (alpha,))
    return im

def rot_center(fr, im, ang, cx=W / 2, cy=H / 2, alpha=1.0):
    r = im.rotate(ang, resample=Image.BILINEAR)
    place(fr, r, cx, cy, 1.0, alpha)

def rain(fr, t, amount=1.0):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov); r = random.Random(int(t * FPS))
    for _ in range(int(160 * amount)):
        x = r.uniform(-200, W); y = r.uniform(-100, H); L = r.uniform(40, 110)
        d.line([(x, y), (x + L * 0.28, y + L)], fill=(190, 210, 255, r.randint(50, 120)), width=2)
    fr.alpha_composite(ov)

def sparkles(fr, t, n=40, col=(255, 225, 120), seed=5, area=(0, 0, W, H), drift=(0, -40), size=(3, 9)):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov); r = random.Random(seed)
    for i in range(n):
        x0 = r.uniform(area[0], area[2]); y0 = r.uniform(area[1], area[3]); ph = r.uniform(0, 6.28); sp = r.uniform(0.6, 1.4)
        x = (x0 + drift[0] * t * sp) % W; y = area[1] + ((y0 - area[1] + drift[1] * t * sp) % (area[3] - area[1]))
        tw = 0.5 + 0.5 * math.sin(t * 5 * sp + ph); s = r.uniform(*size) * (0.5 + tw)
        a = int(220 * tw)
        d.ellipse((x - s, y - s, x + s, y + s), fill=col + (a // 3,)); d.line([(x - s * 2, y), (x + s * 2, y)], fill=col + (a,), width=2); d.line([(x, y - s * 2), (x, y + s * 2)], fill=col + (a,), width=2)
    fr.alpha_composite(ov)

def caption(fr, t, t0, lines, y, fpath=F_LUCK, size=80, fill=WHITE, t1=None, style='rise', gap=1.08, sfill=INK):
    """lines: list of (text, size, fill) or str"""
    if t < t0 or (t1 is not None and t > t1 + 0.25): return
    p = prog(t, t0, t0 + (0.35 if style == 'rise' else 0.22))
    out = 1 - prog(t, t1, t1 + 0.25) if t1 is not None else 1
    cy = y; prev = None
    for i, ln in enumerate(lines):
        txt, sz, col = (ln, size, fill) if isinstance(ln, str) else ln
        if prev is not None: cy += (prev + sz) / 2 * gap
        prev = sz
        im = text_img(txt, fpath, sz, col, stroke=max(6, sz // 9), sfill=sfill, shadow=(0, max(5, sz // 12)))
        pi = prog(t, t0 + i * 0.12, t0 + i * 0.12 + (0.35 if style == 'rise' else 0.2))
        if style == 'rise': place(fr, im, W / 2, cy + (1 - eo_cubic(pi)) * 50, 1.0, eo_cubic(pi) * out)
        else: place(fr, im, W / 2, cy, lerp(1.7, 1.0, eo_back(pi, 2.4)) if pi < 1 else 1.0, min(1, pi * 3) * out)
    return

# ---------------- gameplay ----------------
@functools.lru_cache(maxsize=40)
def gframe(name, i):
    d = f'{A}/frames/{name}'; fs = sorted(os.listdir(d)); i = max(0, min(len(fs) - 1, i))
    return Image.open(f'{d}/{fs[i]}').convert('RGBA')

@functools.lru_cache(None)
def framed(w, h, r=34, border=10):
    """rounded white+ink frame mask for a clip of size w,h"""
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    fr = Image.new('RGBA', (w + border * 4, h + border * 4), (0, 0, 0, 0)); d = ImageDraw.Draw(fr)
    d.rounded_rectangle((0, 0, fr.width - 1, fr.height - 1), r + border * 2, fill=INK + (255,))
    d.rounded_rectangle((border, border, fr.width - 1 - border, fr.height - 1 - border), r + border, fill=WHITE + (255,))
    return m, fr

def clip_card(fr, name, i, cx, cy, scale=1.0, rot=0.0, alpha=1.0):
    g = gframe(name, i); w, h = g.size; m, frame = framed(w, h)
    card = frame.copy(); gg = g.copy(); gg.putalpha(m); card.alpha_composite(gg, (20, 20))
    sh = Image.new('RGBA', card.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((0, 0, card.width - 1, card.height - 1), 60, fill=(0, 0, 0, 150))
    place(fr, sh, cx + 16, cy + 22, scale, alpha * 0.8, rot)
    place(fr, card, cx, cy, scale, alpha, rot)

GAME = [  # start, end, frames-dir, title lines, subtitle, accent
    (19.0, 21.4, 'answer', ['ANSWER', 'QUESTIONS'], 'Right answers = POWER', YOLK),
    (21.4, 23.6, 'cannon', ['BLAST THEIR', 'FORT!'], 'Egg Cannon', YOLK),
    (23.6, 25.8, 'flag', ['FREEZE THEM.', 'STEAL THE FLAG!'], 'Capture the Flag', (150, 225, 255)),
    (25.8, 27.6, 'paint', ['GRAB THE', 'LAND!'], 'Land Grab', (140, 255, 120)),
    (27.6, 29.4, 'gates', ['WORK AS', 'A TEAM!'], 'Gates', YOLK),
    (29.4, 31.0, 'cross', ['CROSS THE', 'ROAD!'], 'Cross the Road', WHITE),
    (31.0, 32.4, 'dodge', ['DODGE THE', 'EGGS!'], 'Dodge Egg', YOLK),
]

# ---------------- scenes ----------------
def s_farm(t):
    z = lerp(1.0, 1.12, eio(prog(t, 0, 4.2))); cam = Cam(src('01'), z, lerp(0.56, 0.6, prog(t, 0, 4)), lerp(0.56, 0.6, prog(t, 0, 4)))
    fr = cam.render()
    sparkles(fr, t, 34, (255, 230, 150), seed=7, area=(0, 500, W, 1500), drift=(14, -18), size=(2, 6))
    fr = tint(fr, (10, 12, 40), prog(t, 3.3, 4.0) * 0.55)
    caption(fr, t, 0.6, [('Once, the farm', 92, WHITE), ('was peaceful…', 92, WHITE)], 1300, t1=3.65)
    fr.alpha_composite(vignette(0.6))
    return flash(fr, 1 - prog(t, 0, 0.8), (0, 0, 0))

def s_storm(t):
    z = lerp(1.04, 1.16, eio(prog(t, 4, 8.2))); cam = Cam(src('02'), z, 0.6, 0.48)
    fr = cam.render()
    # glow in the clouds
    gx, gy = cam.to_screen(0.68, 0.085)
    place(fr, glow((255, 220, 120), 700), gx, gy, 1.0, 0.5 + 0.3 * math.sin(t * 6))
    hx, hy = cam.to_screen(0.625, 0.535)
    tf0, tf1 = 4.9, 6.15
    if t >= tf0:
        p = prog(t, tf0, tf1); e = ei_cubic(p) if t < tf1 else 1
        ex, ey = lerp(gx, hx, e), lerp(gy, hy - 110, e); eh = lerp(70, 230, e)
        if t >= tf1:
            ex, ey = hx, hy - 110 + math.sin((t - tf1) * 3) * 4
            rot_center(fr, rays((255, 205, 90), 20, 2200, 130), (t - tf1) * 22, ex, ey, clamp((t - tf1) * 2.5))
            place(fr, glow((255, 210, 90), 900), ex, ey, 1.0, 0.85)
            # dust ring
            pr = prog(t, tf1, tf1 + 0.8)
            if pr < 1:
                ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov); rr = 60 + 520 * eo_cubic(pr)
                d.ellipse((ex - rr, ey + 100 - rr * 0.22, ex + rr, ey + 100 + rr * 0.22), outline=(255, 235, 180, int(220 * (1 - pr))), width=int(16 * (1 - pr)) + 2)
                fr.alpha_composite(ov)
        else:
            for k in range(1, 6):  # glowing trail
                ek = ei_cubic(max(0, p - k * 0.035)); put(fr, cut('03'), lerp(gx, hx, ek), lerp(gy, hy - 110, ek), lerp(70, 230, ek) * (1 - k * 0.08), 0.35 - k * 0.05)
        put(fr, cut('03'), ex, ey, eh, 1.0, (1 - min(1, p)) * 25)
    rain(fr, t, 1.0)
    fr = flash(fr, max(1 - prog(t, 4.0, 4.3), 0.75 * (1 - prog(t, 4.9, 5.1)) * (t >= 4.9), 1 - prog(t, 6.15, 6.5) if t >= 6.15 else 0), (235, 240, 255))
    caption(fr, t, 6.45, [('…until the night', 82, WHITE), ('THE GOLDEN EGG', 128, YOLK), ('FELL!', 150, YOLK)], 1220, t1=7.85)
    fr.alpha_composite(vignette(0.7))
    dx, dy = shake(t, 6.15, 34, 0.9); dx2, dy2 = shake(t, 4.0, 10, 0.4, 2)
    return offset(fr, dx + dx2, dy + dy2)

def eye_scene(t, t0, t1, n, bg_in, bg_out, side, words, col):
    fr = radial_bg(bg_in, bg_out).copy()
    rot_center(fr, speedlines(), (t - t0) * 9 * side, W / 2, H * 0.42)
    p = eo_cubic(prog(t, t0, t0 + 0.28)); z = lerp(1.0, 1.08, prog(t, t0, t1))
    im = cut(n); h = H * 1.0 * z; s = h / im.height
    cx = W / 2 + (1 - p) * -side * 700 + (40 if side < 0 else -40)
    place(fr, im, cx, H * 0.43, s, 1.0)
    caption(fr, t, t0 + 0.32, [(words[0], 175, WHITE), (words[1], 175, col)], 1360, fpath=F_BANG, style='slam', gap=0.98)
    fr.alpha_composite(vignette(0.65))
    fr = flash(fr, 1 - prog(t, t0, t0 + 0.18))
    dx, dy = shake(t, t0 + 0.32, 22, 0.45, 3)
    return offset(fr, dx, dy)

def s_eyes(t):
    if t < 9.9: return eye_scene(t, 8.0, 9.9, '04', (60, 140, 255), (6, 22, 70), 1, ('WE LAY', 'THE EGGS.'), (130, 185, 255))
    return eye_scene(t, 9.9, 12.0, '05', (255, 110, 70), (70, 10, 6), -1, ('WE RULE', 'THE FARM.'), (255, 160, 130))

@functools.lru_cache(None)
def split_bg(y_left, y_right, jag=True):
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(170, 30, 20, 255))
    pts = [(0, 0), (W, 0), (W, y_right)]
    n = 14; r = random.Random(9); line = []
    for i in range(n, -1, -1):
        x = W * i / n; y = lerp(y_left, y_right, i / n) + (r.uniform(-40, 40) if 0 < i < n else 0); line.append((x, y))
    d.polygon(pts + line, fill=(20, 70, 190, 255))
    # gradient-ish shading
    top = radial_bg((80, 150, 255), (10, 30, 100)); bot = radial_bg((255, 110, 60), (90, 10, 5))
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts + line, fill=255)
    out = Image.composite(top, bot, m)
    d = ImageDraw.Draw(out); d.line(line, fill=(255, 255, 255, 255), width=14, joint='curve'); d.line(line, fill=(255, 240, 160, 255), width=6, joint='curve')
    return out

def s_armies(t):
    if t < 13.7:
        fr = split_bg(1250, 750).copy()
        rot_center(fr, speedlines((255, 255, 255), 60, 40), t * 6, W / 2, H / 2)
        pc = eo_back(prog(t, 12.0, 12.35), 1.3); pt = eo_back(prog(t, 12.35, 12.7), 1.3)
        put(fr, cut('06'), lerp(-500, 400, pc), 600, 1120, 1.0)
        put(fr, cut('07'), lerp(W + 500, 680, pt), 1330, 1120, 1.0)
        fr.alpha_composite(vignette(0.5))
        fr = flash(fr, 0.7 * (1 - prog(t, 12.0, 12.15)) + 0.6 * (1 - prog(t, 12.35, 12.5)) * (t >= 12.35))
        dx, dy = shake(t, 12.25, 26, 0.4); dx2, dy2 = shake(t, 12.6, 26, 0.5, 4)
        return offset(fr, dx + dx2, dy + dy2)
    z = lerp(1.0, 1.13, eio(prog(t, 13.7, 16.1))); cam = Cam(src('08'), z, 0.5, 0.55)
    fr = cam.render()
    sparkles(fr, t, 40, (255, 220, 140), seed=11, area=(0, 300, W, 1700), drift=(0, -60), size=(2, 6))
    fr = flash(fr, 0.35 * max(0, math.sin((t - 14.6) * 18)) * (14.6 < t < 14.8) + 0.3 * (15.3 < t < 15.42))
    caption(fr, t, 14.1, [('THERE CAN ONLY BE', 104, WHITE), ('ONE TEAM!', 210, YOLK)], 330, fpath=F_BANG, style='slam', gap=1.0)
    fr.alpha_composite(vignette(0.65))
    fr = flash(fr, 1 - prog(t, 13.7, 14.0))
    dx, dy = shake(t, 13.7, 30, 0.8); dx2, dy2 = shake(t, 14.15, 24, 0.5, 5)
    return offset(fr, dx + dx2, dy + dy2)

def s_crack(t):
    fr = radial_bg((60, 40, 10), (8, 5, 20)).copy()
    sp = 14 if t < 17.2 else 40
    rot_center(fr, rays((255, 200, 80), 22, 2400, 120 if t < 17.2 else 170), t * sp, W / 2, 880)
    place(fr, glow((255, 200, 80), 1400), W / 2, 880, 1.0, 0.7 + 0.25 * math.sin(t * 9))
    if t < 17.2:
        amp = 18 * prog(t, 16.0, 17.2) ** 2; r = random.Random(int(t * FPS))
        put(fr, cut('03'), W / 2 + r.uniform(-amp, amp), 880 + r.uniform(-amp, amp), 820, 1.0, r.uniform(-amp, amp) * 0.25)
        caption(fr, t, 16.15, [('THE GOLDEN EGG', 92, WHITE), ('BELONGS TO…', 92, WHITE)], 1420, t1=17.1)
    else:
        p = eo_back(prog(t, 17.2, 17.5), 1.5); put(fr, cut('09'), W / 2, 860, lerp(1300, 1150, p), 1.0)
        sparkles(fr, t, 60, (255, 230, 140), seed=13, area=(100, 300, W - 100, 1400), drift=(0, -120), size=(3, 9))
        if t < 18.0:
            caption(fr, t, 17.25, [('THE SMARTEST!', 175, YOLK)], 1520, fpath=F_BANG, style='slam', t1=17.9)
        else:
            for i, (w, c) in enumerate([('ANSWER.', WHITE), ('ATTACK.', YOLK), ('SURVIVE.', WHITE)]):
                if t >= 18.0 + i * 0.32: caption(fr, t, 18.0 + i * 0.32, [(w, 150, c)], 1290 + i * 150, fpath=F_BANG, style='slam')
    fr.alpha_composite(vignette(0.7))
    fr = flash(fr, (1 - prog(t, 17.2, 17.55)) * (t >= 17.2) + 0.5 * (1 - prog(t, 16.0, 16.2)))
    dx, dy = shake(t, 17.2, 34, 0.7); d2 = (0, 0)
    for i in range(3):
        a = shake(t, 18.0 + i * 0.32, 14, 0.25, 6 + i); d2 = (d2[0] + a[0], d2[1] + a[1])
    return offset(fr, dx + d2[0], dy + d2[1])

def s_game(t):
    z = lerp(1.0, 1.1, prog(t, 19, 34)); fr = Cam(src('10'), z, 0.5, 0.5).render()
    fr = tint(fr, (5, 5, 20), 0.32)
    rot_center(fr, speedlines((255, 255, 255), 50, 30), t * 10, W / 2, 960)
    if t < 32.4:
        for (t0, t1, name, title, sub, acc) in GAME:
            if not (t0 <= t < t1): continue
            p = prog(t, t0, t0 + 0.2); e = eo_cubic(p)
            i = int((t - t0) * FPS)
            sc = lerp(1.0, 1.04, prog(t, t0, t1))
            cx = W / 2 + (1 - e) * 1100
            rot = lerp(-1.2, 1.2, (GAME.index((t0, t1, name, title, sub, acc)) % 2))
            if p < 1:  # motion ghosts
                for k in (3, 2, 1): clip_card(fr, name, i, cx + k * 70 * (1 - e), 1000, sc, rot, 0.18)
            clip_card(fr, name, i, cx, 1000, sc, rot, 1.0)
            caption(fr, t, t0 + 0.06, [(title[0], 118, WHITE), (title[1], 118, acc)], 330, fpath=F_BANG, style='slam', gap=0.95)
            caption(fr, t, t0 + 0.25, [(sub, 66, WHITE)], 1500, fpath=F_LUCK, style='rise')
            fr = flash(fr, 0.55 * (1 - prog(t, t0, t0 + 0.12)))
            dx, dy = shake(t, t0 + 0.12, 14, 0.3, int(t0 * 10))
            fr = offset(fr, dx, dy)
    else:
        names = ['g_stack', 'g_paint', 'g_flag', 'g_gates', 'g_cross', 'g_dodge']
        for k, n in enumerate(names):
            t0 = 32.4 + k * 0.08; p = eo_back(prog(t, t0, t0 + 0.25), 1.6)
            if t < t0: continue
            col, row = k % 2, k // 2
            clip_card(fr, n, int((t - 32.4) * FPS), 290 + col * 500, 700 + row * 360, p * 0.98, (-2 if (k % 3) else 2), 1.0)
        caption(fr, t, 32.55, [('12 GAMES.', 150, WHITE)], 300, fpath=F_BANG, style='slam')
        caption(fr, t, 32.95, [('ONE WAR.', 170, YOLK)], 1640, fpath=F_BANG, style='slam')
        fr = flash(fr, 0.5 * (1 - prog(t, 32.4, 32.55)))
        dx, dy = shake(t, 32.95, 20, 0.4, 8); fr = offset(fr, dx, dy)
    fr.alpha_composite(vignette(0.55))
    return fr

def s_sides(t):
    fr = split_bg(1080, 840).copy()
    rot_center(fr, speedlines((255, 255, 255), 60, 35), t * 8, W / 2, H / 2)
    pc = eo_back(prog(t, 34.0, 34.35), 1.4); pt = eo_back(prog(t, 34.45, 34.8), 1.4)
    bob = math.sin(t * 4) * 8
    put(fr, cut('11'), lerp(-500, 330, pc), 520 + bob, 900)
    put(fr, cut('12'), lerp(W + 500, 750, pt), 1400 - bob, 900)
    if t >= 34.15:
        caption(fr, t, 34.15, [('TEAM', 84, WHITE), ('CHICKENS', 128, (140, 195, 255))], 300, fpath=F_BANG, style='slam', gap=0.9)
        im = text_img('Fast. Clever.', F_LUCK, 52, WHITE, 6); im2 = text_img('Fearless.', F_LUCK, 52, WHITE, 6)
        a = prog(t, 34.4, 34.7); place(fr, im, 790, 560, 1, a); place(fr, im2, 790, 620, 1, a)
    if t >= 34.6:
        im = text_img('TEAM', F_BANG, 84, WHITE, 9); im2 = text_img('TURKEYS', F_BANG, 128, (255, 170, 140), 12, shadow=(0, 10))
        p = eo_back(prog(t, 34.6, 34.8), 2.4); s = lerp(1.7, 1.0, p) if p < 1 else 1
        place(fr, im, 300, 1200, s, min(1, p * 3)); place(fr, im2, 300, 1290, s, min(1, p * 3))
        a = prog(t, 34.85, 35.15)
        place(fr, text_img('Big. Bold.', F_LUCK, 52, WHITE, 6), 300, 1400, 1, a); place(fr, text_img('Unstoppable.', F_LUCK, 52, WHITE, 6), 300, 1460, 1, a)
    if 35.0 <= t < 37.3:
        p = eo_back(prog(t, 35.0, 35.25), 2.0)
        place(fr, spr('burst_gold'), W / 2, 960, 0.55 * p, 1.0, (t - 35) * 20)
        place(fr, text_img('VS', F_BANG, 170, WHITE, 14), W / 2, 965, p, 1.0)
    if t >= 37.3:
        band = Image.new('RGBA', (W, 420), (6, 10, 30, 215)); p = eo_cubic(prog(t, 37.3, 37.55))
        place(fr, band, W / 2, 960, 1.0, p)
        caption(fr, t, 37.4, [('WHICH SIDE', 150, WHITE), ('ARE YOU ON?', 150, YOLK)], 890, fpath=F_BANG, style='slam', gap=0.95)
        pul = 1 + 0.08 * math.sin(t * 7)
        if t >= 37.8:
            place(fr, spr('ico_chicken'), 110, 960, 0.5 * pul); place(fr, spr('ico_turkey'), W - 110, 960, 0.5 * (2.08 - pul))
    fr.alpha_composite(vignette(0.5))
    fr = flash(fr, 0.6 * (1 - prog(t, 34.0, 34.15)) + 0.8 * (1 - prog(t, 35.0, 35.2)) * (t >= 35) + 0.5 * (1 - prog(t, 37.3, 37.45)) * (t >= 37.3))
    dx, dy = shake(t, 35.0, 30, 0.6); dx2, dy2 = shake(t, 37.4, 16, 0.4, 9)
    return offset(fr, dx + dx2, dy + dy2)

def s_end(t):
    fr = radial_bg((70, 45, 10), (5, 6, 22)).copy()
    rot_center(fr, rays((255, 200, 80), 24, 2600, 90), t * 10, W / 2, 760)
    place(fr, glow((255, 190, 70), 1500), W / 2, 760, 1.0, 0.65)
    sparkles(fr, t, 70, (255, 225, 140), seed=21, area=(0, 200, W, 1800), drift=(0, -70), size=(2, 7))
    p = eo_back(prog(t, 40.15, 40.55), 1.6); lg = spr('logo')
    place(fr, lg, W / 2, 760, lerp(2.4, 1.0, p) * (960 / lg.width) * (1 + 0.012 * math.sin(t * 3)), min(1, prog(t, 40.15, 40.3) * 3))
    caption(fr, t, 41.2, [('FREE FOR CLASSROOMS', 104, WHITE)], 1250, fpath=F_BANG, style='slam')
    if t >= 41.8:
        p = eo_back(prog(t, 41.8, 42.15), 1.5)
        pill = Image.new('RGBA', (1000, 210), (0, 0, 0, 0)); d = ImageDraw.Draw(pill)
        d.rounded_rectangle((8, 14, 999, 209), 50, fill=(0, 0, 0, 140)); d.rounded_rectangle((0, 0, 990, 196), 48, fill=INK + (255,)); d.rounded_rectangle((8, 8, 982, 188), 42, fill=(255, 255, 255, 255))
        l1 = text_img('aurabotproject-ctrl.github.io/', F_NUN, 50, INK, 0, shadow=(0, 0)); l2 = text_img('chickensvsturkeys', F_NUN, 80, (200, 40, 25), 0, shadow=(0, 0))
        pill.alpha_composite(l1, (int(495 - l1.width / 2), 22)); pill.alpha_composite(l2, (int(495 - l2.width / 2), 82))
        place(fr, pill, W / 2, lerp(1700, 1440, p), 1 + 0.02 * math.sin(t * 5), min(1, p * 2))
    fr.alpha_composite(vignette(0.6))
    fr = flash(fr, (1 - prog(t, 40.15, 40.5)) * (t >= 40.15) + (1 - prog(t, 40.0, 40.15)) * 0.0)
    fr = flash(fr, prog(t, 44.55, 45.0), (0, 0, 0))
    dx, dy = shake(t, 40.3, 32, 0.7)
    return offset(fr, dx, dy)

def frame_at(t):
    if t < 4.0: return s_farm(t)
    if t < 8.0: return s_storm(t)
    if t < 12.0: return s_eyes(t)
    if t < 16.0: return s_armies(t)
    if t < 19.0: return s_crack(t)
    if t < 34.0: return s_game(t)
    if t < 40.0: return s_sides(t)
    return s_end(t)

if __name__ == '__main__':
    if sys.argv[1] == 'still':
        frame_at(float(sys.argv[2])).convert('RGB').save(sys.argv[3]); sys.exit()
    f0, f1, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', str(FPS), out], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        p.stdin.write(frame_at(f / FPS).convert('RGB').tobytes())
        if f % 60 == 0: print(out, f, flush=True)
    p.stdin.close(); p.wait()
