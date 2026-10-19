# Synthesised sound-effects track for the ad (44.1 kHz stereo WAV). All sounds are generated here — no samples, no licences.
import numpy as np, wave
from scipy import signal

SR = 44100; DUR = 45.0; N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def env(n, a=0.005, d=0.3, curve=4):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * np.maximum(0, t - a) / max(d, 1e-4)); return e
def noise(n): return rng.standard_normal(n)
def bp(x, lo, hi, order=2): b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band'); return signal.lfilter(b, a, x)
def lp(x, f, order=2): b, a = signal.butter(order, f / (SR / 2), 'low'); return signal.lfilter(b, a, x)
def hp(x, f, order=2): b, a = signal.butter(order, f / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def sweep(f0, f1, n, curve='exp'):
    t = np.linspace(0, 1, n); f = f0 * (f1 / f0) ** t if curve == 'exp' else f0 + (f1 - f0) * t
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def add(t, x, gain=1.0, pan=0.0):
    i = int(t * SR); x = x[: max(0, N - i)]
    l = gain * np.sqrt(0.5 * (1 - pan)); r = gain * np.sqrt(0.5 * (1 + pan))
    L[i:i + len(x)] += x * l; R[i:i + len(x)] += x * r

def impact(big=1.0):
    n = int(SR * (1.2 + big)); body = sweep(110, 32, n) * env(n, 0.002, 0.35 + 0.4 * big, 3)
    crunch = lp(noise(n), 2500) * env(n, 0.001, 0.08, 5) * 0.6
    sub = np.sin(2 * np.pi * 45 * np.arange(n) / SR) * env(n, 0.01, 0.6 * big, 3) * 0.6
    return np.tanh((body + crunch + sub) * 1.6) * 0.9
def hit():  # punchy cinematic hit
    n = int(SR * 0.9); return np.tanh((sweep(160, 45, n) * env(n, 0.001, 0.18, 4) + bp(noise(n), 800, 5000) * env(n, 0.001, 0.03, 6) * 0.5) * 1.8) * 0.8
def whoosh(dur=0.45, f0=300, f1=3000):
    n = int(SR * dur); x = noise(n); out = np.zeros(n); k = 12
    for j in range(k):  # band sweeping up
        a, b = j * n // k, (j + 1) * n // k; fc = f0 * (f1 / f0) ** (j / k)
        out[a:b] = bp(x, fc * 0.6, fc * 1.6)[a:b]
    e = np.sin(np.linspace(0, np.pi, n)) ** 2; return out * e * 1.4
def thunder(dur=3.5):
    n = int(SR * dur); crack = hp(noise(n), 1500) * env(n, 0.001, 0.12, 6) * 0.9
    rum = lp(np.cumsum(noise(n)) * 0.02, 180, 4); rum = rum / (np.abs(rum).max() + 1e-9)
    mod = 0.6 + 0.4 * np.abs(lp(noise(n), 4)) / 0.5; rum *= env(n, 0.05, dur * 0.45, 2.2) * np.clip(mod, 0, 1.4)
    return crack + rum * 0.9
def rainloop(dur):
    n = int(SR * dur); x = hp(bp(noise(n), 1500, 9000), 1200) * 0.12
    f = np.ones(n); fi = int(0.4 * SR); f[:fi] = np.linspace(0, 1, fi); f[-fi:] = np.linspace(1, 0, fi); return x * f
def chirp():
    n = int(SR * 0.12); t = np.arange(n) / SR; f = 3200 + 1600 * np.sin(2 * np.pi * 25 * t) + 2500 * t / 0.12
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.01, 0.06, 3) * 0.12
def whistle(dur):
    n = int(SR * dur); s = sweep(2400, 380, n) * np.linspace(0.2, 1, n) * 0.25
    return s + whoosh(dur, 600, 200) * 0.5
def shimmer(dur=1.6, gain=0.18):
    n = int(SR * dur); t = np.arange(n) / SR; out = np.zeros(n)
    for f in [1568, 2093, 2637, 3136, 3951, 4186]:
        out += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(4, 9) * t))
    return out / 6 * env(n, 0.05, dur * 0.5, 2.5) * gain * 4
def crack():
    n = int(SR * 0.7); out = np.zeros(n)
    for k in range(9):
        i = int(rng.uniform(0, 0.25) * SR); m = int(SR * 0.04); out[i:i + m] += hp(noise(m), 2000) * env(m, 0.0005, 0.01, 6) * rng.uniform(0.4, 1)
    return out * 1.2 + impact(0.4)[:n] * 0.6
def riser(dur):
    n = int(SR * dur); return (whoosh(dur, 200, 6000) * np.linspace(0.1, 1, n) + sweep(80, 400, n) * np.linspace(0, 0.25, n)) * 0.8
def drum():
    n = int(SR * 0.8); return np.tanh((sweep(95, 50, n) * env(n, 0.002, 0.22, 3.5) + lp(noise(n), 600) * env(n, 0.001, 0.05, 5) * 0.4) * 2) * 0.85
def ding():
    n = int(SR * 0.6); t = np.arange(n) / SR; return (np.sin(2 * np.pi * 1318.5 * t) + 0.7 * np.sin(2 * np.pi * 1975.5 * t)) * env(n, 0.002, 0.25, 3) * 0.22
def pop():
    n = int(SR * 0.18); return sweep(300, 900, n) * env(n, 0.002, 0.06, 4) * 0.35
def roll(dur):
    n = int(SR * dur); out = np.zeros(n); k = 0
    while True:
        i = int(k * SR * 0.07); k += 1
        if i >= n: break
        d = drum()[:n - i] * (0.25 + 0.6 * i / n); out[i:i + len(d)] += d
    return out

# ---------------- timeline ----------------
# 0–4 peaceful farm: wind + birds
wind = lp(noise(int(SR * 4.2)), 500) * 0.08; wind *= np.minimum(1, np.linspace(0, 3, len(wind))); add(0, wind)
for tt in [0.5, 0.65, 1.4, 2.1, 2.25, 2.4, 3.0]: add(tt, chirp(), 1.0, rng.uniform(-0.6, 0.6))
add(3.3, riser(0.7), 0.35)
# 4–8 storm + falling egg
add(4.0, thunder(3.8), 0.9); add(4.0, rainloop(4.0), 1.0); add(4.9, thunder(2.5), 0.55, -0.3)
add(4.9, whistle(1.25), 0.9); add(6.15, impact(1.3), 1.0); add(6.2, shimmer(1.8), 1.0)
add(6.45, hit(), 0.5)
# 8–12 eyes
add(7.85, whoosh(0.3), 0.7, -0.5); add(8.32, hit(), 0.9); add(8.32, drum(), 0.6)
add(9.75, whoosh(0.3), 0.7, 0.5); add(10.22, hit(), 0.9); add(10.22, drum(), 0.6)
add(11.4, riser(0.6), 0.5)
# 12–16 armies + standoff
add(11.95, whoosh(0.3), 0.6, -0.6); add(12.0, drum(), 0.9); add(12.25, impact(0.5), 0.7, -0.3)
add(12.3, whoosh(0.3), 0.6, 0.6); add(12.6, impact(0.5), 0.7, 0.3); add(12.95, drum(), 0.8); add(13.3, drum(), 0.8)
add(13.7, impact(1.4), 1.0); add(13.7, thunder(2.2), 0.5); add(14.1, hit(), 0.9); add(14.6, thunder(1.4), 0.35, 0.4)
add(15.0, roll(1.0), 0.45)
# 16–19 the egg cracks
add(16.0, riser(1.2), 0.6); add(16.0, lp(noise(int(SR * 1.2)), 120) * np.linspace(0, 0.9, int(SR * 1.2)), 0.6)
add(17.2, crack(), 1.0); add(17.2, shimmer(2.0), 1.3); add(17.25, hit(), 0.6)
for i in range(3): add(18.0 + i * 0.32, hit(), 0.85); add(18.0 + i * 0.32, drum(), 0.5)
# 19–34 gameplay: a whoosh + hit on every cut
cuts = [19.0, 21.4, 23.6, 25.8, 27.6, 29.4, 31.0, 32.4]
for i, c in enumerate(cuts): add(c - 0.1, whoosh(0.28, 400, 4000), 0.7, (-0.5 if i % 2 else 0.5)); add(c + 0.08, hit(), 0.75)
add(20.6, ding(), 1.0); add(22.95, impact(0.4), 0.6); add(23.0, pop(), 1.0)
for c in [32.4 + k * 0.08 for k in range(6)]: add(c, pop(), 0.8, rng.uniform(-0.5, 0.5))
add(32.95, impact(0.8), 0.9); add(33.3, riser(0.7), 0.4)
# 34–40 pick a side
add(33.95, whoosh(0.3), 0.7, -0.6); add(34.2, hit(), 0.8); add(34.4, whoosh(0.3), 0.7, 0.6); add(34.65, hit(), 0.8)
add(35.0, impact(1.0), 1.0); add(35.0, shimmer(1.0), 0.6)
add(37.3, whoosh(0.3), 0.6); add(37.4, hit(), 0.9); add(37.4, drum(), 0.7)
add(39.0, riser(1.1), 0.55)
# 40–45 end card
add(40.15, impact(1.6), 1.1); add(40.2, shimmer(2.6, 0.22), 1.0); add(41.2, hit(), 0.6); add(41.8, pop(), 1.0); add(41.85, ding(), 0.8)
add(43.2, shimmer(1.6, 0.12), 0.8)

# light room reverb for weight, then master
ir_n = int(SR * 1.1); ir = noise(ir_n) * np.exp(-np.linspace(0, 7, ir_n)) * 0.02; ir[0] = 1
L = signal.fftconvolve(L, ir)[:N]; R = signal.fftconvolve(R, ir * np.roll(np.ones(1), 0))[:N]
st = np.stack([L, R], 1); st = np.tanh(st * 1.3) / np.tanh(1.3)
st *= 0.89 / np.abs(st).max()
fade = int(SR * 0.4); st[-fade:] *= np.linspace(1, 0, fade)[:, None]
with wave.open('/home/claude/ad/sfx.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print('sfx ok', st.shape)
