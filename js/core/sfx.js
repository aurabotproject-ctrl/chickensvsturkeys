// Tiny synthesised sound effects (no audio files to download).
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('cvt-muted') === '1'; } catch { /* storage blocked */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Browsers only allow audio after a tap/click.
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => ac(), { once: true }));

function tone(freq, dur, { type = 'square', vol = 0.15, slide = 0, delay = 0 } = {}) {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, freq = 1200, delay = 0 } = {}) {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination); s.start(t);
}

export const sfx = {
  click: () => tone(660, 0.06, { type: 'triangle', vol: 0.12 }),
  join: () => { tone(520, 0.08, { type: 'triangle' }); tone(780, 0.1, { type: 'triangle', delay: 0.08 }); },
  correct: () => { tone(660, 0.09, { type: 'triangle', vol: 0.18 }); tone(990, 0.16, { type: 'triangle', vol: 0.18, delay: 0.09 }); },
  wrong: () => tone(220, 0.25, { type: 'sawtooth', vol: 0.12, slide: -120 }),
  throw: () => noise(0.12, { vol: 0.12, freq: 2600 }),
  splat: () => { noise(0.22, { vol: 0.35, freq: 900 }); tone(160, 0.18, { type: 'sine', vol: 0.25, slide: -90 }); },
  bok: () => { tone(900, 0.05, { type: 'square', vol: 0.1 }); tone(600, 0.08, { type: 'square', vol: 0.1, delay: 0.05 }); },
  tick: () => tone(1200, 0.03, { type: 'square', vol: 0.06 }),
  go: () => { tone(523, 0.12, { vol: 0.14 }); tone(659, 0.12, { vol: 0.14, delay: 0.12 }); tone(784, 0.3, { vol: 0.16, delay: 0.24 }); },
  whistle: () => tone(2100, 0.5, { type: 'sine', vol: 0.12, slide: 300 }),
  event: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.1, delay: i * 0.07 })); },
  win: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.16, delay: i * 0.13 })); noise(1.2, { vol: 0.08, freq: 3000, delay: 0.3 }); },
  egg: () => tone(1400, 0.07, { type: 'sine', vol: 0.12, slide: 400 }),
};

export function setMuted(m) { muted = m; try { localStorage.setItem('cvt-muted', m ? '1' : '0'); } catch { /* ignore */ } }
export const isMuted = () => muted;
