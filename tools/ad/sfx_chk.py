# Sound effects for the Team Chickens origin video (40 s). Reuses the generators in sfx.py.
import numpy as np, wave
from scipy import signal
code = open('/home/claude/ad/sfx.py').read().split('# ---------------- timeline')[0]
code = code.replace('DUR = 45.0', 'DUR = 40.0')
exec(code)
# 0–4 dawn
add(0, lp(noise(int(SR * 4.2)), 500) * 0.07)
for tt in [0.4, 0.55, 1.2, 1.9, 2.05, 2.8, 3.3]: add(tt, chirp(), 1.0, rng.uniform(-0.6, 0.6))
add(0.3, ding() * 0.5, 0.6)
# 4–8 turkeys laugh (bassy stomps + comic slide)
add(3.95, whoosh(0.3), 0.6); add(4.05, drum(), 0.7)
for tt in [4.6, 5.2, 5.8]: add(tt, drum(), 0.45)
n = int(SR * 0.5); add(6.1, sweep(500, 140, n) * env(n, 0.01, 0.3, 2) * 0.35, 1.0); add(6.12, hit(), 0.8)
# 8–13 the secret
add(7.95, whoosh(0.3), 0.5); add(8.2, shimmer(1.4, 0.12), 0.8); add(10.2, riser(0.35), 0.5); add(10.52, hit(), 0.9); add(10.55, shimmer(1.6), 1.0)
# 13–18 workshop sparks
add(12.95, whoosh(0.3), 0.5)
for k in range(14): m = int(SR * 0.08); add(13.2 + k * 0.32 + rng.uniform(0, 0.1), hp(noise(m), 3000) * env(m, 0.001, 0.03, 5) * 0.5, 0.8, rng.uniform(-0.5, 0.5))
add(13.3, lp(noise(int(SR * 4.6)), 300) * 0.05)
add(15.15, riser(0.3), 0.5); add(15.42, impact(0.5), 0.9)
# 18–23 the golden egg
add(17.95, whoosh(0.4), 0.5); add(18.1, whistle(1.8), 0.6); add(18.3, shimmer(2.2), 1.0); add(20.5, hit(), 0.9); add(20.55, thunder(2.0), 0.4)
# 23–27 tying on the blue
add(22.6, riser(0.45), 0.6); add(23.0, impact(1.0), 1.0); add(23.45, drum(), 0.9); add(23.45, hit(), 0.8); add(25.0, roll(1.8), 0.4)
# 27–32 training
for i, ct in enumerate([27.0, 29.0, 30.5]): add(ct - 0.1, whoosh(0.28, 400, 4000), 0.7, (-0.5 if i % 2 else 0.5)); add(ct + 0.08, hit(), 0.8); add(ct + 0.08, drum(), 0.5)
add(27.6, impact(0.6), 0.7); add(28.1, impact(0.5), 0.6); add(29.6, pop(), 0.9); add(31.1, pop(), 0.9); add(31.4, riser(0.6), 0.5)
# 32–35 the blue flock
add(32.0, impact(1.2), 1.0); add(32.05, shimmer(2.0), 0.9); add(33.2, ding(), 0.7)
for tt in [32.6, 33.1, 33.6, 34.1]: add(tt, drum(), 0.5)
add(34.4, riser(0.6), 0.55)
# 35–40 end card
add(35.15, impact(1.6), 1.1); add(35.2, shimmer(2.6, 0.22), 1.0)
add(35.9, whoosh(0.3), 0.6, -0.5)
for j in range(3): add(36.1 + j * 0.15, hit(), 0.6)
add(36.8, pop(), 1.0); add(36.85, ding(), 0.8); add(38.2, shimmer(1.6, 0.12), 0.8)
ir_n = int(SR * 1.1); ir = noise(ir_n) * np.exp(-np.linspace(0, 7, ir_n)) * 0.02; ir[0] = 1
L = signal.fftconvolve(L, ir)[:N]; R = signal.fftconvolve(R, ir)[:N]
st = np.stack([L, R], 1); st = np.tanh(st * 1.3) / np.tanh(1.3); st *= 0.89 / np.abs(st).max()
fade = int(SR * 0.4); st[-fade:] *= np.linspace(1, 0, fade)[:, None]
with wave.open('/home/claude/ad/sfx_chk.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print('sfx ok', st.shape)
