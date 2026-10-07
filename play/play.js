// =========================================================
// STUDENT PHONE: join → team + avatar → answer & fight → results
// =========================================================
import {
  isConfigured, db, ref, get, update, onValue, onDisconnect, ensureSignedIn, serverNow, explainError,
} from '../js/core/firebase.js';
import { $, $$, html, raw, esc, params } from '../js/core/ui.js';
import { sprite, avatar, AVATARS, TEAM } from '../js/core/assets.js';
import { lookupCode, cleanCode } from '../js/core/games.js';
import { sfx } from '../js/core/sfx.js';
import { EVENTS } from '../js/events/events.js';

let uid; let gameId;
const D = { me: null, state: {}, ps: {}, cur: null, fb: null, teams: {}, standings: [] };
const L = { answeredN: 0, picked: null, shownAt: 0, lockUntil: 0, fbShownN: 0, tab: 'answer', lastEvent: 0, lastPhase: '', prevEggs: 0, unsubs: [] };
const G = (p) => ref(db, `games/${gameId}/${p}`);
const SAVE_KEY = 'cvt-player';

// ---------------- join ----------------
async function boot() {
  if (!isConfigured) { $('#join-err').textContent = 'Game server not set up yet.'; return; }
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } })();
  $('#code').value = cleanCode(params.get('code') || saved?.code || '');
  $('#name').value = saved?.name || '';
  if (params.get('code') && !saved) $('#name').focus();
  $('#code').addEventListener('input', (e) => { e.target.value = cleanCode(e.target.value); });
  $('#join-form').addEventListener('submit', (e) => { e.preventDefault(); join(); });
  try { uid = (await ensureSignedIn()).uid; } catch (e) { $('#join-err').textContent = explainError(e); return; }
  if (saved?.g && saved?.name) join(saved);
}

const BAD = /\b(poo+|bum|fart|idiot|stupid|dumb|sex|fuck|shit|crap|damn|bitch|ass)\b/i;

async function join(saved) {
  const btn = $('#join-btn'); const err = $('#join-err');
  err.textContent = '';
  const code = saved?.code || cleanCode($('#code').value);
  const name = (saved?.name || $('#name').value).trim().replace(/\s+/g, ' ').slice(0, 14);
  if (code.length !== 6) { err.textContent = 'Codes have 6 letters/numbers.'; return; }
  if (!name) { err.textContent = 'Type your name.'; return; }
  if (BAD.test(name)) { err.textContent = 'Please use your real first name.'; return; }
  btn.disabled = true; btn.textContent = 'Joining…';
  try {
    gameId = saved?.g || await lookupCode(code);
    if (!gameId) throw new Error('No game with that code. Check the big screen!');
    const kicked = await get(G(`kicked/${uid}`));
    if (kicked.val()) throw new Error('The teacher removed you from this game.');
    const existing = await get(G(`players/${uid}`));
    const upd = { [`players/${uid}/name`]: existing.val()?.name || name, [`players/${uid}/online`]: true };
    if (!existing.exists()) upd[`players/${uid}/joinedAt`] = Date.now();
    await update(ref(db, `games/${gameId}`), upd);
    onDisconnect(G(`players/${uid}/online`)).set(false);
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ g: gameId, code, name })); } catch { /* ignore */ }
    sfx.join();
    subscribe();
    keepAwake();
  } catch (e) {
    console.error(e);
    try { sessionStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    err.textContent = e.message?.includes('PERMISSION') ? explainError(e) : e.message;
    btn.disabled = false; btn.textContent = 'JOIN!';
  }
}

function subscribe() {
  const on = (p, fn) => L.unsubs.push(onValue(G(p), (s) => fn(s.val())));
  on(`players/${uid}`, (v) => {
    if (!v && D.me) { leave('You were removed from the game.'); return; }
    D.me = v; render();
  });
  on(`kicked/${uid}`, (v) => { if (v) leave('The teacher removed you from this game.'); });
  on('state', (v) => { D.state = v || {}; onState(); render(); });
  on(`pstate/${uid}`, (v) => { D.ps = v || {}; onPstate(); });
  on(`current/${uid}`, (v) => { D.cur = v; drawQuestion(); });
  on(`fb/${uid}`, (v) => { D.fb = v; drawFeedback(); });
  on('teams', (v) => { D.teams = v || {}; });
  on('standings', (v) => { D.standings = v ? Object.values(v) : []; });
  setInterval(tickTimer, 250);
}

function leave(msg) {
  L.unsubs.forEach((f) => f()); L.unsubs = [];
  try { sessionStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  show('wait');
  $('#wait').innerHTML = html`<div class="panel light wait-card"><h2>${msg}</h2><a class="btn" href="./">Join again</a></div>`;
}

async function keepAwake() {
  try {
    let lock = await navigator.wakeLock?.request('screen');
    document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen'); });
  } catch { /* not supported */ }
}

function show(id) {
  ['join', 'wait', 'play'].forEach((s) => $(`#${s}`).classList.toggle('hidden', s !== id));
}

// ---------------- screens ----------------
function render() {
  const me = D.me; if (!me) return;
  document.body.classList.toggle('team-chicken', me.team === 'chicken');
  document.body.classList.toggle('team-turkey', me.team === 'turkey');
  const phase = D.state.phase || 'lobby';
  if (!me.team) { show('wait'); $('#wait').innerHTML = waitHtml('Sorting teams…', 'Hang tight!'); return; }
  if (!Number.isInteger(me.av)) { renderAvatarPick(); return; }
  if (phase === 'lobby') {
    show('wait');
    $('#wait').innerHTML = html`<div class="panel light wait-card stack center">
      <img class="av" src="${avatar(me.av)}" alt="" style="margin:auto">
      <h2 style="margin:0">${me.name}</h2>
      <span class="tag ${me.team}" style="justify-self:center">TEAM ${TEAM[me.team].name.toUpperCase()}</span>
      <p style="margin:0">You're in! Watch the big screen — the game starts soon.</p>
      <button class="btn sm grey" id="re-av" style="justify-self:center">Change avatar</button></div>`;
    $('#re-av').onclick = () => update(G(`players/${uid}`), { av: null });
    return;
  }
  show('play');
  $('#me-av').src = avatar(me.av);
  $('#me-name').textContent = me.name;
  $('#me-team').textContent = TEAM[me.team].name.toUpperCase();
}

const waitHtml = (title, sub) => html`<div class="panel light wait-card"><div class="spin-egg" style="margin:0 auto 10px"></div><h2 style="margin:0">${title}</h2><p>${sub}</p></div>`;

let lastRevealTeam = null;
function renderAvatarPick() {
  const me = D.me;
  show('wait');
  const t = TEAM[me.team];
  const first = lastRevealTeam !== me.team;
  lastRevealTeam = me.team;
  $('#wait').innerHTML = html`
    <img class="reveal-bird" src="${sprite(me.team + '_idle')}" alt="">
    <h1 class="comic-title reveal-title ${me.team === 'chicken' ? 'blue' : 'red'} slant">YOU'RE A ${t.one.toUpperCase()}!</h1>
    <p style="margin:0">Pick your avatar:</p>
    <div class="av-grid">${raw(AVATARS[me.team].map((i) => `<button data-av="${i}"><img src="${avatar(i)}" alt="avatar ${i}"></button>`).join(''))}</div>`;
  if (first) sfx.correct();
  $$('[data-av]').forEach((b) => { b.onclick = () => { sfx.click(); update(G(`players/${uid}`), { av: +b.dataset.av }); }; });
}

// ---------------- state changes ----------------
function onState() {
  const s = D.state; const phase = s.phase;
  const ov = $('#overlay');
  if (phase !== L.lastPhase) {
    L.lastPhase = phase;
    if (phase === 'countdown') {
      ov.className = 'overlay'; ov.innerHTML = '<div class="box"><div class="count">GET READY!</div></div>';
      ov.querySelector('.count').style.fontSize = '3.6rem';
      setTab('answer');
    } else if (phase === 'playing') { ov.className = 'overlay hidden'; sfx.go(); } else if (phase === 'roundEnd') { setTimeout(showRoundEnd, 400); } else if (phase === 'final') { setTimeout(showFinal, 600); } else if (phase === 'lobby') { ov.className = 'overlay hidden'; L.answeredN = 0; L.fbShownN = 0; }
  }
  if (phase === 'playing') {
    if (s.paused) { ov.className = 'overlay'; ov.innerHTML = '<div class="box"><h1 class="comic-title">PAUSED</h1><p>Eyes on the teacher!</p></div>'; } else if (ov.innerHTML.includes('PAUSED')) ov.className = 'overlay hidden';
  }
  const ev = s.event;
  if (ev && ev.at && ev.at !== L.lastEvent && phase === 'playing') {
    L.lastEvent = ev.at;
    const E = EVENTS[ev.type];
    if (E) {
      const t = document.createElement('div');
      t.className = 'event-toast';
      t.innerHTML = `<img src="${sprite(E.banner)}" alt="${esc(E.name)}"><p>${esc(E.phone)}</p>`;
      document.body.appendChild(t); sfx.event();
      navigator.vibrate?.(200);
      setTimeout(() => t.remove(), 3500);
    }
  }
}

function showRoundEnd() {
  if (D.state.phase !== 'roundEnd') return;
  const ps = D.ps; const me = D.me;
  const ov = $('#overlay'); ov.className = 'overlay';
  ov.innerHTML = html`<div class="box">
    <h1 class="comic-title slant">ROUND ${D.state.round} OVER!</h1>
    ${raw(ps.rank ? `<div>You're</div><div class="rank">#${ps.rank}</div><div>out of ${ps.of}</div>` : '')}
    <div class="scores"><div style="background:var(--chicken)">🐔 ${D.teams.chicken ?? 0}</div><div style="background:var(--turkey)">🦃 ${D.teams.turkey ?? 0}</div></div>
    <p>💥 ${ps.score || 0} KO points · ✅ ${ps.correct || 0}/${ps.answered || 0} correct</p>
    <img src="${sprite(me.team + '_idle')}" alt="" style="width:120px">
    <p>Next round soon — watch the big screen!</p></div>`;
}

function showFinal() {
  const ps = D.ps; const me = D.me; const w = D.state.winner;
  const won = w === me.team; const tie = w === 'tie';
  const ov = $('#overlay'); ov.className = 'overlay';
  ov.innerHTML = html`<div class="box">
    <img class="banner" src="${sprite(w === 'chicken' ? 'win_chicken' : w === 'turkey' ? 'win_turkey' : 'win_tie')}" alt="">
    <img src="${sprite(tie || won ? me.team + '_win' : me.team + '_dizzy')}" alt="" style="width:150px">
    <h2 class="comic-title">${tie ? 'IT\'S A DRAW!' : won ? 'YOUR TEAM WON!' : 'SO CLOSE!'}</h2>
    ${raw(ps.rank ? `<div class="rank">#${ps.rank}</div><div>out of ${ps.of} players</div>` : '')}
    <div class="scores"><div style="background:var(--chicken)">🐔 ${D.teams.chicken ?? 0}</div><div style="background:var(--turkey)">🦃 ${D.teams.turkey ?? 0}</div></div>
    <p>💥 ${ps.score || 0} KO points · ✅ ${ps.correct || 0}/${ps.answered || 0} questions right</p></div>`;
  if (won || tie) sfx.win();
}

function onPstate() {
  const ps = D.ps;
  $('#me-score').textContent = ps.score || 0;
  const eggs = ps.eggs || 0;
  $('#egg-count').textContent = eggs;
  $('#egg-bar').innerHTML = Array.from({ length: 8 }, (_, i) => (i < eggs ? `<img src="${sprite(D.me?.team === 'turkey' ? 'egg_red' : 'egg_blue')}" alt="">` : '<span class="empty"></span>')).join('');
  $('#pad').classList.toggle('no-eggs', eggs === 0);
  if (eggs > L.prevEggs && L.tab === 'answer') $('#tab-fight').classList.add('nudge');
  if (eggs === 0) $('#tab-fight').classList.remove('nudge');
  L.prevEggs = eggs;
  const ko = $('#ko');
  if (ps.ko) {
    ko.classList.remove('hidden');
    ko.innerHTML = html`<img src="${sprite('word_splat')}" alt=""><div class="big">${ps.koLeft ? ps.koLeft + 's' : 'OUT!'}</div>
      <p>${ps.koLeft ? 'You got egged! Back in a moment…' : 'You\'re out until next round.'}<br>Answer questions to earn more eggs!</p>
      <button class="btn yellow" id="ko-answer">❓ Answer questions</button>`;
    $('#ko-answer').onclick = () => setTab('answer');
    if (!L.wasKo) { navigator.vibrate?.([80, 40, 80]); sfx.splat(); }
  } else ko.classList.add('hidden');
  L.wasKo = !!ps.ko;
}

function tickTimer() {
  const s = D.state;
  const el = $('#me-timer');
  if (s.phase === 'playing') {
    const left = s.paused ? s.remaining : s.endsAt - serverNow();
    const secs = Math.max(0, Math.ceil(left / 1000));
    el.textContent = secs;
    el.parentElement.classList.toggle('hurry', secs <= 10);
  } else el.textContent = '--';
  if (L.lockUntil && Date.now() >= L.lockUntil) { L.lockUntil = 0; hideFeedback(); }
}

// ---------------- tabs ----------------
function setTab(t) {
  L.tab = t;
  $('#tab-answer').classList.toggle('on', t === 'answer');
  $('#tab-fight').classList.toggle('on', t === 'fight');
  $('#view-answer').classList.toggle('hidden', t !== 'answer');
  $('#view-fight').classList.toggle('hidden', t !== 'fight');
  if (t === 'fight') $('#tab-fight').classList.remove('nudge');
  sfx.click();
}
$('#tab-answer').onclick = () => setTab('answer');
$('#tab-fight').onclick = () => setTab('fight');

// ---------------- questions ----------------
function drawQuestion() {
  const c = D.cur;
  if (!c) { $('#question').textContent = D.state.phase === 'playing' ? 'Loading question…' : 'Get ready…'; $('#answers').innerHTML = ''; return; }
  if (L.lockUntil) return; // feedback still showing; will redraw after
  if (c.n === L.answeredN) return; // already answered, waiting for result
  // The next question can arrive a moment before the result of the last one — wait for the result first.
  if (L.answeredN && L.fbShownN < L.answeredN && Date.now() - L.submittedAt < 3000) { setTimeout(drawQuestion, 300); return; }
  L.picked = null; L.shownAt = Date.now();
  $('#conf').classList.add('hidden');
  $('#question').textContent = c.q;
  const box = $('#answers');
  box.className = `answers ${c.type === 'tf' ? 'tf' : ''}`;
  const opts = Object.values(c.options || {});
  box.innerHTML = opts.map((o, i) => `<button class="ans a${i}" data-i="${i}"><span class="l">${c.type === 'tf' ? (i ? '✗' : '✓') : 'ABCD'[i]}</span><span>${esc(o)}</span></button>`).join('');
  $$('.ans', box).forEach((b) => { b.onclick = () => pick(+b.dataset.i); });
}

function pick(i) {
  const c = D.cur; if (!c || L.picked !== null || L.lockUntil) return;
  L.picked = i; sfx.click();
  $$('.ans').forEach((b) => b.classList.toggle('picked', +b.dataset.i === i));
  $('#answers').classList.add('locked');
  if (c.conf) { $('#conf').classList.remove('hidden'); return; }
  submit(null);
}
$$('#conf [data-conf]').forEach((b) => { b.onclick = () => { if (L.picked !== null) { sfx.click(); submit(b.dataset.conf); } }; });

function submit(conf) {
  const c = D.cur;
  $('#conf').classList.add('hidden');
  L.answeredN = c.n; L.submittedAt = Date.now();
  update(G(`sub/${uid}`), { n: c.n, choice: L.picked, conf: conf || '', ms: Date.now() - L.shownAt }).catch((e) => console.error(e));
}

function drawFeedback() {
  const f = D.fb;
  if (!f || f.n !== L.answeredN || f.n === L.fbShownN) return;
  L.fbShownN = f.n;
  const box = $('#fb');
  const bonus = Object.values(f.bonus || {});
  const tags = [];
  if (bonus.includes('streak')) tags.push('🔥 Streak bonus +1');
  if (bonus.includes('sure')) tags.push('🎯 Confident & right +1');
  if (bonus.includes('sure-wrong')) tags.push('😬 Confident but wrong −1 egg');
  if (f.full) tags.push('🧺 Egg basket full — go throw!');
  box.className = `fb ${f.correct ? 'right' : 'wrong'}`;
  const lock = f.lockMs || 1500;
  const readMs = f.correct ? lock : Math.max(lock, 2600);
  box.innerHTML = f.correct
    ? html`<div class="big">CORRECT!</div><div class="gain">+${Math.max(0, f.eggs)} 🥚</div><div class="bonus">${raw(tags.map((t) => `<span>${esc(t)}</span>`).join(''))}</div>${raw(f.explanation ? `<div class="why">💡 ${esc(f.explanation)}</div>` : '')}<div class="lockbar"><i style="animation-duration:${readMs}ms"></i></div>`
    : html`<div class="big">NOPE!</div><div class="ans-was">Answer: <b>${f.rightText}</b></div>${raw(f.explanation ? `<div class="why">💡 ${esc(f.explanation)}</div>` : '')}<div class="bonus">${raw(tags.map((t) => `<span>${esc(t)}</span>`).join(''))}</div><div class="lockbar"><i style="animation-duration:${readMs}ms"></i></div>`;
  L.lockUntil = Date.now() + readMs;
  if (f.correct) { sfx.correct(); navigator.vibrate?.(40); } else { sfx.wrong(); navigator.vibrate?.([60, 40, 60]); }
}

function hideFeedback() {
  $('#fb').className = 'fb hidden';
  $('#answers').classList.remove('locked');
  drawQuestion();
}

// ---------------- fight controls ----------------
const input = { mx: 0, my: 0, tx: 0, ty: 0, throws: 0 };
let lastSent = 0; let sendTimer = null; let lastPayload = '';
function sendInput(force = false) {
  const now = Date.now();
  const payload = JSON.stringify(input);
  if (!force && payload === lastPayload) return;
  if (!force && now - lastSent < 90) { clearTimeout(sendTimer); sendTimer = setTimeout(() => sendInput(), 95 - (now - lastSent)); return; }
  lastSent = now; lastPayload = payload;
  update(G(`inputs/${uid}`), { ...input }).catch(() => {});
}

function setupPad() {
  const move = $('.pad-half.move'); const aim = $('.pad-half.aim');
  const knob = $('#stick-knob'); const base = $('#stick-base');
  const arrow = $('#aim-arrow'); const abase = $('#aim-base');
  const R = 56;
  let moveId = null; let mo = null; let aimId = null; let ao = null; let av = null;

  const place = (el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; };
  move.addEventListener('pointerdown', (e) => {
    moveId = e.pointerId; move.setPointerCapture(e.pointerId);
    const r = move.getBoundingClientRect(); mo = { x: e.clientX - r.left, y: e.clientY - r.top };
    place(base, mo.x, mo.y); place(knob, mo.x, mo.y);
  });
  move.addEventListener('pointermove', (e) => {
    if (e.pointerId !== moveId) return;
    const r = move.getBoundingClientRect();
    let dx = e.clientX - r.left - mo.x; let dy = e.clientY - r.top - mo.y;
    const d = Math.hypot(dx, dy); if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    place(knob, mo.x + dx, mo.y + dy);
    input.mx = +(dx / R).toFixed(2); input.my = +(dy / R).toFixed(2);
    sendInput();
  });
  const endMove = (e) => {
    if (e.pointerId !== moveId) return;
    moveId = null; input.mx = 0; input.my = 0; sendInput(true);
    knob.style.left = ''; knob.style.top = ''; base.style.left = ''; base.style.top = '';
  };
  move.addEventListener('pointerup', endMove); move.addEventListener('pointercancel', endMove);

  aim.addEventListener('pointerdown', (e) => {
    aimId = e.pointerId; aim.setPointerCapture(e.pointerId);
    const r = aim.getBoundingClientRect(); ao = { x: e.clientX - r.left, y: e.clientY - r.top }; av = null;
    place(abase, ao.x, ao.y); place(arrow, ao.x, ao.y); arrow.style.width = '0px';
  });
  aim.addEventListener('pointermove', (e) => {
    if (e.pointerId !== aimId) return;
    const r = aim.getBoundingClientRect();
    const dx = e.clientX - r.left - ao.x; const dy = e.clientY - r.top - ao.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      av = { x: dx / d, y: dy / d };
      arrow.style.width = `${Math.min(d, 110)}px`;
      arrow.style.transform = `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`;
    }
  });
  const endAim = (e) => {
    if (e.pointerId !== aimId) return;
    aimId = null;
    const dir = av || { x: D.me?.team === 'turkey' ? -1 : 1, y: 0 }; // a quick tap throws straight ahead
    if ((D.ps.eggs || 0) > 0 && !D.ps.ko) {
      input.tx = +dir.x.toFixed(3); input.ty = +dir.y.toFixed(3); input.throws += 1;
      sendInput(true); sfx.egg(); navigator.vibrate?.(25);
    } else if (!D.ps.ko) {
      setTab('answer');
    }
    arrow.style.width = '0px'; abase.style.left = ''; abase.style.top = ''; arrow.style.left = ''; arrow.style.top = '';
  };
  aim.addEventListener('pointerup', endAim); aim.addEventListener('pointercancel', endAim);
}

setupPad();
boot();
