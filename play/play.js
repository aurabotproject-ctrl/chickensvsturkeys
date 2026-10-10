// =========================================================
// STUDENT PHONE: join → team + avatar → answer & fight → results
// =========================================================
import {
  isConfigured, db, ref, get, update, onValue, onDisconnect, ensureSignedIn, serverNow, explainError,
} from '../js/core/firebase.js?v=20261010133712';
import { $, $$, html, raw, esc, params, showLoading } from '../js/core/ui.js?v=20261010133712';
import { sprite, avatar, AVATARS, TEAM, teamIco } from '../js/core/assets.js?v=20261010133712';
import { lookupCode, cleanCode } from '../js/core/games.js?v=20261010133712';
import { sfx } from '../js/core/sfx.js?v=20261010133712';
import { EVENTS, FARM_PHONE, TOWER_PHONE, SIEGE_PHONE } from '../js/events/events.js?v=20261010133712';
import { drawBoard, hitSquare } from '../js/modes/advance/draw.js?v=20261010133712';
import { PIECES, COLOURS, legalMoves, blockSpots, pieceSprite, ADV_ART } from '../js/modes/advance/rules.js?v=20261010133712';
import { PaintView } from '../js/modes/paint/view.js?v=20261010133712';
import { SiegeView } from '../js/modes/siege/view.js?v=20261010133712';
import { TowerView } from '../js/modes/towers/view.js?v=20261010133712';
import * as FE from '../js/modes/farm/economy.js?v=20261010133712';
import { FarmScene } from '../js/modes/farm/scene.js?v=20261010133712';
const { fmt, BOOST_MULT } = FE;

let uid; let gameId;
const D = { me: null, state: {}, ps: {}, cur: null, fb: null, teams: {}, standings: [] };
const L = { answeredN: 0, picked: null, shownAt: 0, lockUntil: 0, fbShownN: 0, tab: 'answer', lastEvent: 0, lastPhase: '', prevEggs: 0, unsubs: [] };
const G = (p) => ref(db, `games/${gameId}/${p}`);
const SAVE_KEY = 'cvt-player';
const isCannon = () => D.state.mode === 'cannon';
const isFarm = () => D.state.mode === 'farm';
const isTowers = () => D.state.mode === 'towers';
const isSiege = () => D.state.mode === 'siege';
const isPaint = () => D.state.mode === 'paint';
const isAdv = () => D.state.mode === 'advance';
const hasMap = () => isFarm() || isTowers() || isSiege() || isAdv();
const UNIT = () => (isPaint() ? 'of the field' : isCannon() ? 'target points' : isFarm() ? 'earned' : isTowers() || isSiege() ? 'battle points' : 'KO points');
const SCORE = (n) => (isFarm() ? fmt(n) : isPaint() ? `${Math.round((n || 0) * 10) / 10}%` : Math.floor(n || 0));

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
  const on = (p, fn) => L.unsubs.push(onValue(G(p), (s) => fn(s.val()), (e) => {
    console.error(p, e);
    // The map lives under tw/ (Coop Wars) and sg/ (Coop Siege). If Firebase blocks it, the teacher hasn't published the latest rules.
    if (/^(tw|sg)\//.test(p) && !L.mapBlocked) { L.mapBlocked = true; mapBlocked(); }
  }));
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
  on('tw/static', (v) => { if (v) { ensureTw(); TW.view?.setStatic(v); TW.static = v; } });
  on('tw/own', (v) => { TW.own = v; TW.view?.setOwn(v); });
  on('tw/lv', (v) => { TW.lv = v; TW.view?.setLevels(v); });
  on('tw/p', (v) => { TW.p = v || ''; TW.view?.setPaths(v || ''); });
  on('players', (v) => { D.all = v || {}; if (isAdv() && D.me && !D.me.pc) renderPiecePick(true); });
  on('adv/info', (v) => { ADV.info = v; advBuild(); });
  on('adv/s', (v) => { ADV.s = v || ''; advBuild(); });
  on('pt/info', (v) => { PT.info = v; PT.view?.setInfo(v); });
  on('pt/s/g', (v) => { PT.g = v; PT.view?.setGrid(v || ''); });
  on('pt/s/t', (v) => { PT.t = v; PT.view?.setTrail(v || ''); });
  on('pt/s/p', (v) => { PT.p = v; PT.view?.setPos(v || ''); });
  on('sg/info', (v) => { SG.info = v; if (v) { ensureSg(); SG.view?.setInfo(v); drawSgHud(); } });
  on('sg/g', (v) => { SG.g = v || ''; SG.view?.setGrid(SG.g); });
  on('sg/u', (v) => { SG.u = v || ''; SG.view?.setUnits(SG.u); });
  on('sg/m', (v) => { SG.m = v || '11111'; SG.view?.setMowers(SG.m); });
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
  if (!me.team) {
    if (D.state.teamPick && (D.state.phase || 'lobby') === 'lobby') { renderTeamPick(); return; }
    show('wait'); $('#wait').innerHTML = waitHtml('Sorting teams…', 'Hang tight!'); return;
  }
  if (!Number.isInteger(me.av)) { renderAvatarPick(); return; }
  if (isAdv() && !me.pc) { renderPiecePick(); return; }
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

const waitHtml = (title, sub) => html`<div class="panel light wait-card"><img class="spin-img" src="${sprite('egg')}" alt=""><h2 style="margin:0">${title}</h2><p>${sub}</p></div>`;

function renderTeamPick() {
  if ($('#wait .team-pick') && !$('#wait').classList.contains('hidden')) return;
  show('wait');
  $('#wait').innerHTML = html`<div class="team-pick">
    <h1 class="comic-title slant">PICK YOUR TEAM!</h1>
    <p style="margin:0">Choose the team you're in for this class.</p>
    <div class="team-pick-btns">
      <button class="team-btn chicken" data-team="chicken"><img src="${sprite('chicken_idle')}" alt=""><span>CHICKENS</span></button>
      <button class="team-btn turkey" data-team="turkey"><img src="${sprite('turkey_idle')}" alt=""><span>TURKEYS</span></button>
    </div></div>`;
  $$('[data-team]').forEach((b) => {
    b.onclick = () => {
      sfx.click(); $$('[data-team]').forEach((x) => { x.disabled = true; });
      update(G(`players/${uid}`), { team: b.dataset.team }).catch((e) => { console.error(e); $$('[data-team]').forEach((x) => { x.disabled = false; }); });
    };
  });
}

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
    } else if (phase === 'answer') { ov.className = 'overlay hidden'; showView('answer'); sfx.go(); } else if (phase === 'playing') { ov.className = 'overlay hidden'; sfx.go(); if (isCannon()) { showView('cannon'); startMeter(); } else if (isPaint()) { showView('paint'); ensurePt(); } else if (isAdv()) setTab('answer'); else if (hasMap()) setTab('fight'); } else if (phase === 'roundEnd') { setTimeout(showRoundEnd, 400); } else if (phase === 'final') { setTimeout(showFinal, 600); } else if (phase === 'lobby') { ov.className = 'overlay hidden'; L.answeredN = 0; L.fbShownN = 0; }
  }
  document.body.classList.toggle('mode-cannon', isCannon());
  document.body.classList.toggle('mode-paint', isPaint());
  if (isAdv() !== document.body.classList.contains('mode-advance') || isFarm() !== document.body.classList.contains('mode-farm') || isTowers() !== document.body.classList.contains('mode-towers') || isSiege() !== document.body.classList.contains('mode-siege')) {
    document.body.classList.toggle('mode-farm', isFarm());
    document.body.classList.toggle('mode-towers', isTowers());
    document.body.classList.toggle('mode-siege', isSiege());
    document.body.classList.toggle('mode-advance', isAdv());
    $('#tab-answer').firstChild.textContent = hasMap() ? '❓ QUIZ ⚡' : '❓ ANSWER';
    $('#tab-fight').firstChild.textContent = isFarm() ? '🏡 FARM ' : isTowers() ? '🗺️ MAP ' : isSiege() ? '🏰 BATTLE ' : isAdv() ? '♟ BOARD ' : '🥚 FIGHT ';
  }
  if (phase === 'playing' || phase === 'answer') {
    if (s.paused) { ov.className = 'overlay'; ov.innerHTML = '<div class="box"><h1 class="comic-title">PAUSED</h1><p>Eyes on the teacher!</p></div>'; } else if (ov.innerHTML.includes('PAUSED')) ov.className = 'overlay hidden';
  }
  const ev = s.event;
  if (ev && ev.at && ev.at !== L.lastEvent && phase === 'playing') {
    L.lastEvent = ev.at;
    const E = EVENTS[ev.type];
    if (E) {
      const t = document.createElement('div');
      t.className = 'event-toast';
      t.innerHTML = `<img src="${sprite(E.banner)}" alt="${esc(E.name)}"><p>${esc(isFarm() ? FARM_PHONE[ev.type] || E.phone : isTowers() ? TOWER_PHONE[ev.type] || E.phone : isSiege() ? SIEGE_PHONE[ev.type] || E.phone : E.phone)}</p>`;
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
    <div class="scores"><div style="background:var(--chicken)">${raw(teamIco('chicken'))} ${SCORE(D.teams.chicken)}</div><div style="background:var(--turkey)">${raw(teamIco('turkey'))} ${SCORE(D.teams.turkey)}</div></div>
    <p>💥 ${SCORE(ps.score)} ${UNIT()} · ✅ ${ps.correct || 0}/${ps.answered || 0} correct</p>
    <img src="${sprite(isFarm() ? `fm_coop_${me.team === 'chicken' ? 'c' : 't'}${ps.coop || 1}` : (isCannon() ? 'c_' : '') + me.team + '_idle')}" alt="" style="width:${isFarm() ? 200 : 120}px">
    <p>${isSiege() ? `HALF TIME! Teams swap — next half you ${ps.role === 'def' ? 'ATTACK ⚔️' : 'DEFEND 🛡️'}.` : 'Next round soon — watch the big screen!'}</p></div>`;
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
    <div class="scores"><div style="background:var(--chicken)">${raw(teamIco('chicken'))} ${SCORE(D.teams.chicken)}</div><div style="background:var(--turkey)">${raw(teamIco('turkey'))} ${SCORE(D.teams.turkey)}</div></div>
    <p>💥 ${SCORE(ps.score)} ${UNIT()} · ✅ ${ps.correct || 0}/${ps.answered || 0} questions right</p></div>`;
  if (won || tie) sfx.win();
}

function onPstate() {
  const ps = D.ps;
  $('#me-score').textContent = SCORE(ps.score);
  if (isTowers()) drawTwHud();
  if (isSiege()) drawSgHud();
  if (isPaint()) drawPtHud();
  if (isAdv()) advHud();
  if (isFarm()) {
    farmState();
    if (ps.fox === 'danger' && !L.foxPrompted) { L.foxPrompted = true; setTab('answer'); navigator.vibrate?.([100, 50, 100]); } else if (!ps.fox) L.foxPrompted = false;
  }
  const eggs = ps.eggs || 0;
  $('#egg-count').textContent = eggs;
  $('#egg-bar').innerHTML = Array.from({ length: 8 }, (_, i) => (i < eggs ? `<img src="${sprite(D.me?.team === 'turkey' ? 'egg_red' : 'egg_blue')}" alt="">` : '<span class="empty"></span>')).join('');
  $('#pad').classList.toggle('no-eggs', eggs === 0);
  if (eggs > L.prevEggs && L.tab === 'answer') $('#tab-fight').classList.add('nudge');
  if (eggs === 0) $('#tab-fight').classList.remove('nudge');
  L.prevEggs = eggs;
  $('#cn-eggs').textContent = `🥚 ${eggs} egg${eggs === 1 ? '' : 's'}`;
  $('#cn-fire').disabled = eggs === 0;
  drawProgress();
  if (!D.cur && isCannon()) drawQuestion();
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
  if (s.phase === 'playing' || s.phase === 'answer') {
    const left = s.paused ? s.remaining : s.endsAt - serverNow();
    const secs = Math.max(0, Math.ceil(left / 1000));
    el.textContent = secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : secs;
    el.parentElement.classList.toggle('hurry', secs <= 10);
  } else el.textContent = '--';
  if (L.lockUntil && Date.now() >= L.lockUntil) { L.lockUntil = 0; hideFeedback(); }
}

// ---------------- tabs ----------------
function showView(v) {
  $('#view-answer').classList.toggle('hidden', v !== 'answer');
  $('#view-fight').classList.toggle('hidden', v !== 'fight');
  $('#view-cannon').classList.toggle('hidden', v !== 'cannon');
  $('#view-pt').classList.toggle('hidden', v !== 'paint');
}

function setTab(t) {
  if (isCannon() || isPaint()) { if (isPaint() && D.state.phase !== 'playing') showView('answer'); return; }
  if (TW.quiz) { TW.quiz = false; document.body.classList.remove('tw-quiz'); }
  L.tab = t;
  $('#tab-answer').classList.toggle('on', t === 'answer');
  $('#tab-fight').classList.toggle('on', t === 'fight');
  $('#view-answer').classList.toggle('hidden', t !== 'answer');
  $('#view-fight').classList.toggle('hidden', t !== 'fight' || hasMap());
  $('#view-farm').classList.toggle('hidden', t !== 'fight' || !isFarm());
  $('#view-tw').classList.toggle('hidden', t !== 'fight' || !isTowers());
  $('#view-sg').classList.toggle('hidden', t !== 'fight' || !isSiege());
  $('#view-adv').classList.toggle('hidden', t !== 'fight' || !isAdv());
  if (isAdv() && t === 'fight') advResize();
  if (isSiege() && t === 'fight') { ensureSg(); SG.view?.layout(); }
  if (isTowers() && t === 'fight') ensureTw();
  if (isFarm() && t === 'fight') { ensureScene(); drawFarm(); if (FM.offscreen && FM.scene?.tex) { FM.scene.stampede(FM.offscreen); FM.offscreen = 0; } }
  if (t === 'fight') $('#tab-fight').classList.remove('nudge');
  sfx.click();
}
$('#tab-answer').onclick = () => setTab('answer');
$('#tab-fight').onclick = () => setTab('fight');

// ---------------- questions ----------------
function drawQuestion() {
  const c = D.cur;
  drawProgress();
  if (!c) {
    const loaded = isCannon() && D.state.phase === 'answer' && (D.ps.rq || 0) >= (D.state.quota || 5);
    $('#question').innerHTML = loaded ? `🎉 Cannon loaded with <b>${D.ps.eggs || 0}</b> egg${D.ps.eggs === 1 ? '' : 's'}!<br><small>Get ready to FIRE…</small>` : D.state.phase === 'playing' && !isCannon() ? 'Loading question…' : 'Get ready…';
    $('#answers').innerHTML = ''; return;
  }
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
  const tgt = isTowers() && TW.quiz ? TW.target : null; // Coop Wars: the building the student tapped
  update(G(`sub/${uid}`), { n: c.n, choice: L.picked, conf: conf || '', ms: Date.now() - L.shownAt, tgt }).catch((e) => console.error(e));
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
  const fg = f.farm; const tw = f.tw; const sg = f.sg; const pt = f.pt;
  const av = f.adv;
  const gain = av ? `<div class="farm-gain"><span>♟ +1 move!</span><span>${av.stuck ? 'but you are blocked in…' : 'go to the BOARD'}</span></div>` : pt ? `<div class="farm-gain"><span>⚡ +1 speed</span><span>now speed ${pt.speed}</span></div>` : sg ? `<div class="farm-gain"><span>🌽 +${sg.corn} corn</span><span>${sg.role === 'def' ? 'build defences!' : 'send attackers!'}</span></div>` : tw ? `<div class="farm-gain"><span>🪖 +${tw.troops} troops</span><span>${tw.helper ? 'sent to your team\'s weakest building!' : 'sent to the building you tapped!'}</span></div>` : fg ? `<div class="farm-gain">${fg.chicks ? `<span>${teamIco('chicken')} +${fg.chicks} STAMPEDE!</span>` : ''}<span>+${esc(fmt(fg.cash))} 💰</span><span>+${fg.gold} 🥇</span><span>⚡×${BOOST_MULT} ${fg.boost}s</span></div>` : `<div class="gain">+${Math.max(0, f.eggs)} 🥚</div>`;
  box.innerHTML = f.correct
    ? html`<div class="big">CORRECT!</div>${raw(gain)}<div class="bonus">${raw(tags.map((t) => `<span>${esc(t)}</span>`).join(''))}</div>${raw(f.explanation ? `<div class="why">💡 ${esc(f.explanation)}</div>` : '')}<div class="lockbar"><i style="animation-duration:${readMs}ms"></i></div>`
    : html`<div class="big">NOPE!</div><div class="ans-was">Answer: <b>${f.rightText}</b></div>${raw(f.explanation ? `<div class="why">💡 ${esc(f.explanation)}</div>` : '')}<div class="bonus">${raw(tags.map((t) => `<span>${esc(t)}</span>`).join(''))}</div><div class="lockbar"><i style="animation-duration:${readMs}ms"></i></div>`;
  L.lockUntil = Date.now() + readMs;
  if (f.correct) { sfx.correct(); navigator.vibrate?.(40); } else { sfx.wrong(); navigator.vibrate?.([60, 40, 60]); }
}

function hideFeedback() {
  $('#fb').className = 'fb hidden';
  if (isAdv() && (D.ps.moves || 0) > 0 && D.state.phase === 'playing') setTimeout(() => { if ((D.ps.moves || 0) > 0 && L.tab === 'answer') setTab('fight'); }, 50);
  $('#answers').classList.remove('locked');
  drawQuestion();
  if (TW.quiz) closeTwQuiz(); // Coop Wars: back to the map after each answer
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

// ---------------- Egg Cannon controller ----------------
function drawProgress() {
  const el = $('#qprog');
  if (isPaint() && D.state.phase === 'answer') {
    el.classList.remove('hidden');
    el.textContent = `⚡ Your speed: ${D.ps.speed || 5} · ${D.ps.rc || 0} right this round — keep going!`;
    return;
  }
  const on = isCannon() && D.state.phase === 'answer';
  el.classList.toggle('hidden', !on);
  if (on) {
    const done = D.ps.rq || 0; const q = D.state.quota || 5;
    el.textContent = done >= q ? `All ${q} answered · 🥚 ${D.ps.eggs || 0}` : `Question ${Math.min(done + 1, q)} of ${q} · 🥚 ${D.ps.eggs || 0} loaded`;
  }
}

const CN = { angle: 45, power: 0, t0: performance.now(), raf: 0, lastSent: 0 };
function cnGeom() {
  const dir = D.me?.team === 'turkey' ? -1 : 1;
  return { dir, px: dir > 0 ? 24 : 196, py: 118, r: 92 };
}
function drawDial() {
  const { dir, px, py, r } = cnGeom();
  const a = (CN.angle * Math.PI) / 180;
  const ex = px + dir * Math.cos(a) * r; const ey = py - Math.sin(a) * r;
  const pts = []; for (let d = 5; d <= 85; d += 5) { const t = (d * Math.PI) / 180; pts.push(`${(px + dir * Math.cos(t) * r).toFixed(1)} ${(py - Math.sin(t) * r).toFixed(1)}`); }
  $('#cn-arc').setAttribute('d', `M ${pts.join(' L ')}`);
  const arrow = $('#cn-arrow');
  arrow.setAttribute('x1', px); arrow.setAttribute('y1', py); arrow.setAttribute('x2', ex); arrow.setAttribute('y2', ey);
  $('#cn-tip').setAttribute('cx', ex); $('#cn-tip').setAttribute('cy', ey);
  $('#cn-pivot').setAttribute('cx', px); $('#cn-pivot').setAttribute('cy', py);
  $('#cn-angle').textContent = `${Math.round(CN.angle)}°`;
  const w = D.state.wind || 0;
  $('#cn-wind').textContent = w ? `WIND ${w > 0 ? '→' : '←'} ${Math.abs(w)}` : 'NO WIND';
}
function sendAim(force = false) {
  const now = Date.now();
  if (!force && now - CN.lastSent < 150) return;
  CN.lastSent = now;
  input.angle = Math.round(CN.angle); input.power = +CN.power.toFixed(3);
  update(G(`inputs/${uid}`), { ...input }).catch(() => {});
}
function startMeter() {
  drawDial();
  cancelAnimationFrame(CN.raf);
  const loop = (t) => {
    // power sweeps up and down every 1.6 s
    const k = ((t - CN.t0) / 800) % 2;
    CN.power = k < 1 ? k : 2 - k;
    $('#cn-fill').style.width = `${(1 - CN.power) * 100}%`;
    if (!$('#view-cannon').classList.contains('hidden')) CN.raf = requestAnimationFrame(loop);
  };
  CN.raf = requestAnimationFrame(loop);
}
(function setupCannon() {
  const dial = $('#cn-dial');
  const svg = dial.querySelector('svg');
  const aimAt = (e) => {
    const r = svg.getBoundingClientRect();
    const sx = 220 / r.width; const sy = 130 / r.height; const s = Math.max(sx, sy);
    const ox = (r.width * s - 220) / 2; const oy = (r.height * s - 130) / 2;
    const x = (e.clientX - r.left) * s - ox; const y = (e.clientY - r.top) * s - oy;
    const { dir, px, py } = cnGeom();
    const ang = (Math.atan2(py - y, dir * (x - px)) * 180) / Math.PI;
    CN.angle = Math.max(5, Math.min(85, ang));
    drawDial(); sendAim();
  };
  let dragging = false;
  dial.addEventListener('pointerdown', (e) => { dragging = true; dial.setPointerCapture(e.pointerId); aimAt(e); });
  dial.addEventListener('pointermove', (e) => { if (dragging) aimAt(e); });
  dial.addEventListener('pointerup', () => { dragging = false; sendAim(true); });
  $('#cn-fire').addEventListener('click', () => {
    if ((D.ps.eggs || 0) <= 0 || D.state.phase !== 'playing') return;
    input.throws += 1;
    sendAim(true);
    const last = $('#cn-last'); last.classList.remove('hidden'); last.style.left = `calc(${CN.power * 100}% - 3px)`;
    sfx.egg(); navigator.vibrate?.(30);
  });
  drawDial();
})();

// ---------------- Egg Farm ----------------
// action counters start from the clock so they keep going up even if the page is reloaded mid-game
const SEQ0 = Date.now();
const FM = { scene: null, hatchReq: 0, hatchLocal: 0, holding: false, buySeq: SEQ0, rsSeq: SEQ0, balloonSeq: SEQ0, foxSeq: SEQ0, adjCash: 0, shopHtml: '', rsHtml: '', lastHatched: 0, lastChicks: 0, sendT: null };

function ensureScene() {
  if (!isFarm() || !D.me?.team) return;
  if (FM.scene && FM.scene.team !== D.me.team) { FM.scene.destroy(); FM.scene = null; $('#fm-scene').innerHTML = ''; }
  if (FM.scene) return;
  FM.scene = new FarmScene($('#fm-scene'), {
    team: D.me?.team,
    onBalloon: (kind, x, y) => {
      FM.balloonSeq += 1; sfx.correct();
      FM.scene.floatText(kind === 'gold' ? '+1 🥇' : `+${fmt(Math.max(30, (D.ps.lay ? Math.min(D.ps.lay, D.ps.ship) * D.ps.value : 1) * 20))}`, x, y);
      sendFarm({ balloonSeq: FM.balloonSeq, balloon: kind });
    },
    onTap: (hit) => { if (D.state.phase === 'playing') openAct(hit.kind, hit.kind === 'coop' ? hit.slot : null); },
    onFox: (ate) => {
      if (ate) { FM.foxSeq += 1; sfx.wrong(); navigator.vibrate?.([100, 60, 100]); sendFarm({ foxSeq: FM.foxSeq, foxAte: true }); } else { sfx.correct(); }
    },
  });
  $('#fm-chick-ico').src = sprite(`${D.me?.team || 'chicken'}_idle`);
  const doneFm = showLoading('Building your farm…', $('#fm-wrap'));
  FM.scene.init().then(() => { doneFm(); if (D.ps.coops) FM.scene.update(D.ps); }).catch((e) => { doneFm(); console.error(e); });
}

function sendFarm(extra = {}) {
  Object.assign(FM.pending ||= {}, extra);
  clearTimeout(FM.sendT);
  FM.sendT = setTimeout(() => {
    const payload = { hatch: FM.hatchReq, buySeq: FM.buySeq, rsSeq: FM.rsSeq, balloonSeq: FM.balloonSeq, foxSeq: FM.foxSeq, ...FM.pending };
    FM.pending = {};
    update(G(`inputs/${uid}`), payload).catch(() => {});
  }, 150);
}

/** New farm state from the host. */
function farmState() {
  const ps = D.ps;
  FM.adjCash = 0; FM.hatchLocal = 0;
  ensureScene();
  if (FM.scene?.tex) {
    FM.scene.update(ps);
    // chicks that arrived from the host that we didn't already animate (bots, stampedes)
    const extra = (ps.hatched || 0) - FM.lastHatched - FM.animatedSinceLast;
    const visible = !$('#view-farm').classList.contains('hidden');
    if (FM.lastHatched && extra > 0) {
      if (!visible) FM.offscreen = (FM.offscreen || 0) + extra;
      else if (extra >= 6) FM.scene.stampede(extra); else FM.scene.hatchRun(extra);
    }
  }
  FM.lastHatched = ps.hatched || 0; FM.animatedSinceLast = 0;
  drawFarm();
  if (ps.fox === 'danger' && !L.foxPrompted) { L.foxPrompted = true; setTab('answer'); navigator.vibrate?.([100, 50, 100]); } else if (!ps.fox) L.foxPrompted = false;
}
FM.animatedSinceLast = 0;

function predicted() {
  const ps = D.ps;
  const dt = ps.t ? Math.max(0, Math.min(5000, serverNow() - ps.t)) / 1000 : 0;
  return {
    cash: (ps.cash || 0) + (ps.rate || 0) * dt + FM.adjCash,
    charge: Math.min(ps.chargeMax || 20, (ps.charge || 0) + (ps.refill || 1) * dt - FM.hatchLocal),
    chickens: Math.min(ps.cap || 20, (ps.chickens || 0) + FM.hatchLocal),
  };
}

function drawFarm() {
  if (!isFarm() || $('#view-farm').classList.contains('hidden')) return;
  const ps = D.ps; const team = D.me?.team || 'chicken';
  const pr = predicted();
  $('#fm-cash').textContent = fmt(pr.cash);
  const boosting = ps.boostUntil > serverNow();
  $('#fm-rate').textContent = `+${fmt(ps.rate || 0)}/s${ps.mult > 1 ? ` ×${ps.mult}` : ''}`;
  $('#fm-cash').parentElement.classList.toggle('boost', ps.mult > 1);
  $('#fm-chickens').textContent = FE.fmtN(pr.chickens);
  $('#fm-cap').textContent = `/${FE.fmtN(ps.cap || 20)}`;
  $('#fm-chickens').parentElement.classList.toggle('full', pr.chickens >= (ps.cap || 20));
  $('#fm-ship').textContent = FE.fmtN(ps.ship || 0);
  $('#fm-ship').parentElement.classList.toggle('full', (ps.lay || 0) > (ps.ship || 0));
  $('#fm-gold').textContent = ps.gold || 0;
  // hatch ring
  const frac = Math.max(0, pr.charge) / (ps.chargeMax || 20);
  $('#fm-ring').style.strokeDashoffset = `${276.5 * (1 - frac)}`;
  $('#fm-hatch').classList.toggle('empty', pr.charge < 1);
  // alert strip: most important message first
  const al = $('#fm-alert');
  const shipFull = (ps.lay || 0) > (ps.ship || 0) + 0.01;
  const coopsFull = pr.chickens >= (ps.cap || 20);
  if (ps.fox === 'danger') { al.className = 'fm-alert danger'; al.textContent = '🦊 FOX RAID! Answer a question correctly NOW to protect your cash!'; } else if (ps.fox === 'safe') { al.className = 'fm-alert safe'; al.textContent = '🛡️ Your farm is safe from the fox!'; } else if (boosting) { al.className = 'fm-alert boost'; al.textContent = `⚡ BOOST ×${BOOST_MULT} — ${Math.ceil((ps.boostUntil - serverNow()) / 1000)}s left · answer again to add more!`; } else if (shipFull) { al.className = 'fm-alert warn'; al.textContent = '📦 Your trucks are full — eggs are going to waste! Tap 🚚 TRUCKS to add or upgrade one.'; } else if (coopsFull) { al.className = 'fm-alert warn'; al.textContent = '🏠 Your coops are full! Tap a coop to upgrade it, or tap 🔨 BUILD.'; } else { al.className = 'fm-alert'; al.textContent = '👆 Tap any coop, truck or machine to upgrade it · tap 🔨 BUILD to build · green ⬆ = you can afford it'; }
  // bottom buttons: open the build / upgrade sheets
  const fm = farmNow(ps);
  const afford = (kind, slot) => { const lv = FE.levelOf(fm, kind, slot); return lv < FE.MAXLV[kind] && pr.cash >= FE.costTo(fm, kind, slot, lv + 1); };
  const aff = { machine: afford('machine', 0), truck: [0, 1, 2, 3].some((i) => afford('truck', i)) };
  [0, 1, 2, 3].forEach((i) => { aff[`coop${i}`] = afford('coop', i); });
  FM.scene?.setAffordable?.(aff);
  const anyCoop = [0, 1, 2, 3].some((i) => aff[`coop${i}`]);
  const anyRs = Object.keys(FE.RESEARCH).some((k) => { const rc = FE.researchCost({ research: ps.research || {} }, k); return rc != null && (ps.gold || 0) >= rc; });
  const t = team === 'chicken' ? 'c' : 't';
  const btn = (k, icon, title, sub, can, need) => `<button class="fm-buy ${can ? 'can' : need ? 'need no' : 'no'}" data-open="${k}"><img src="${sprite(icon)}" alt=""><b>${title}</b><small>${sub}</small>${can ? '<span class="price">⬆ ready</span>' : ''}</button>`;
  let html2 = btn('coop', `fm_coop_${t}3`, 'Coops', 'build · upgrade', anyCoop, coopsFull)
    + btn('truck', 'fm_truck', 'Trucks', 'sell more eggs', aff.truck, shipFull)
    + btn('machine', FE.MACHINE_LV[Math.max(1, ps.machine || 0)].sprite, 'Egg Machine', 'eggs worth more', aff.machine, false);
  html2 += `<button class="fm-buy ${anyRs ? 'can' : ''}" data-buy="research"><img src="${sprite('fm_goldegg')}" alt=""><b>Research</b><small>golden eggs</small><span class="price" style="color:#b8860b">🔬 ${ps.gold || 0}</span></button>`;
  if (FM.shopHtml !== html2) { FM.shopHtml = html2; $('#fm-shop').innerHTML = html2; }
  if (!$('#fm-act').classList.contains('hidden')) drawAct();
  if (!$('#fm-research').classList.contains('hidden')) drawResearch();
}

function drawResearch() {
  const ps = D.ps;
  const html2 = Object.entries(FE.RESEARCH).map(([k, r]) => {
    const lv = ps.research?.[k] || 0; const cost = lv >= r.max ? null : r.cost[lv];
    const can = cost != null && (ps.gold || 0) >= cost;
    return `<button class="fm-rs ${cost == null ? 'max' : can ? 'can' : ''}" data-rs="${k}"><img src="${sprite(k === 'hens' ? `${D.me?.team || 'chicken'}_idle` : r.icon)}" alt=""><span><b>${esc(r.name)}</b><small>${esc(r.desc)}</small><br><span class="lv">Level ${lv}/${r.max}</span></span><span class="cost">${cost == null ? 'MAX' : `${cost} 🥇`}</span></button>`;
  }).join('');
  if (FM.rsHtml !== html2) { FM.rsHtml = html2; $('#fm-rs-list').innerHTML = html2; }
}

// hold-to-hatch
function hatchTick() {
  if (!FM.holding || D.state.phase !== 'playing' || D.state.paused) return;
  const pr = predicted();
  if (pr.charge >= 1 && pr.chickens < (D.ps.cap || 20)) {
    FM.hatchReq += 1; FM.hatchLocal += 1; FM.animatedSinceLast += 1;
    FM.scene?.hatchRun(1);
    if (FM.hatchReq % 3 === 0) sfx.bok();
    sendFarm();
  } else if (pr.chickens >= (D.ps.cap || 20)) { FM.holding = false; $('#fm-hatch').classList.remove('on'); sfx.wrong(); }
  drawFarm();
}
setInterval(hatchTick, 1000 / FE.HATCH_RATE);
const hatchBtn = $('#fm-hatch');
hatchBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); hatchBtn.setPointerCapture(e.pointerId); FM.holding = true; hatchBtn.classList.add('on'); hatchTick(); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => hatchBtn.addEventListener(ev, () => { FM.holding = false; hatchBtn.classList.remove('on'); }));
hatchBtn.addEventListener('contextmenu', (e) => e.preventDefault());

setInterval(() => { if (isFarm() && D.state.phase === 'playing') drawFarm(); }, 250);
$('#fm-crate').addEventListener('click', () => { sfx.click(); setTab('answer'); });
$('#fm-shop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-buy], [data-open]'); if (!b || b.disabled || D.state.phase !== 'playing') return;
  if (b.dataset.open) { openAct(b.dataset.open, null); return; }
  const k = b.dataset.buy;
  if (k === 'research') { $('#fm-research').classList.remove('hidden'); FM.rsHtml = ''; drawResearch(); sfx.click(); return; }
  if (!b.classList.contains('can')) { sfx.wrong(); b.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200 }); return; }
  const ps = D.ps;
  const c = FE.nextCosts({ ...ps, coops: ps.coops, trucks: ps.trucks })[k];
  FM.buySeq += 1;
  if (c) FM.adjCash -= c.cash;
  sfx.join(); navigator.vibrate?.(30);
  sendFarm({ buy: k });
  drawFarm();
});
$('#fm-rs-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rs]'); if (!b) return;
  if (!b.classList.contains('can')) { sfx.wrong(); return; }
  FM.rsSeq += 1; sfx.correct();
  sendFarm({ rs: b.dataset.rs });
});
$('#fm-rs-close').addEventListener('click', () => $('#fm-research').classList.add('hidden'));

// ---------------- Coop Wars ----------------
const TW = { view: null, seq: 0, q: [], static: null, own: null, lv: null, p: '' };
function ensureTw() {
  if (!isTowers() || !D.me?.team || !uid) return;
  if (TW.view && TW.view.team !== D.me.team) { TW.view.destroy(); TW.view = null; $('#tw-scene').innerHTML = ''; }
  if (TW.view) return;
  $('#tw-ico').src = sprite(`tw_coop_${D.me.team === 'turkey' ? 't' : 'c'}2`);
  $('#tw-troop-ico').src = sprite(D.me.team === 'turkey' ? 'tw_turk1' : 'tw_chick1');
  TW.view = new TowerView($('#tw-scene'), {
    team: D.me.team, uid,
    onCommand: (c) => {
      TW.seq += 1; TW.q.push({ s: TW.seq, ...c }); TW.q = TW.q.slice(-8);
      update(G(`inputs/${uid}`), { q: TW.q }).catch(() => {});
      twHint(c.op === 'path' ? 'Troops marching! 🐾' : 'Line cut ✂️', 'good');
      sfx.click(); navigator.vibrate?.(25);
    },
    onHint: (msg, bad) => { twHint(msg, bad ? 'bad' : ''); if (bad) sfx.wrong(); },
    onTap: (b) => openTwQuiz(b.i),
  });
  const doneTw = showLoading('Loading the map…', $('#tw-scene').parentElement);
  TW.view.init().then(() => {
    doneTw();
    if (TW.static) TW.view.setStatic(TW.static);
    if (TW.own) TW.view.setOwn(TW.own);
    if (TW.lv) TW.view.setLevels(TW.lv);
    TW.view.setPaths(TW.p || '');
  }).catch((e) => { doneTw(); console.error(e); });
}
let twHintT = null;
function twHint(msg, cls = '') {
  const h = $('#tw-hint'); h.textContent = msg; h.className = `tw-hint ${cls}`;
  clearTimeout(twHintT);
  twHintT = setTimeout(() => { drawTwHud(); }, 2600);
}
function drawTwHud() {
  const ps = D.ps;
  $('#tw-own').textContent = ps.buildings ?? 0;
  $('#tw-troops').textContent = ps.troops ?? 0;
  $('#tw-tc').textContent = ps.tc ?? 0; $('#tw-tt').textContent = ps.tt ?? 0;
  if (L.mapBlocked) return;
  const h = $('#tw-hint');
  if (h.classList.contains('bad') || h.classList.contains('good')) { if (twHintT) return; }
  if (D.state.phase === 'playing' && ps.buildings === 0) { h.className = 'tw-hint bad'; h.textContent = 'Your team has no buildings left!'; } else if (ps.golden) { h.className = 'tw-hint good'; h.textContent = '🥇 Golden Egg Rush — right answers give DOUBLE troops!'; } else { h.className = 'tw-hint'; h.textContent = 'TAP a team building (gold ring) to answer for troops · HOLD & DRAG from it to march · Swipe across a line to cut it'; }
}
setInterval(() => { if (isTowers()) { twHintT = null; drawTwHud(); } }, 4000);
$('#tw-crate').addEventListener('click', () => { sfx.click(); setTab('answer'); });

// ---------------- Coop Siege ----------------
const SG = { view: null, seq: 0, q: [], info: null, g: '', u: '', m: '11111', spent: 0, lastCorn: null };
function ensureSg() {
  if (!isSiege() || !D.me?.team || !uid) return;
  if (SG.view) return;
  SG.view = new SiegeView($('#sg-view'), {
    uid,
    onCommand: (c, info) => {
      SG.seq += 1; SG.q.push({ s: SG.seq, ...c }); SG.q = SG.q.slice(-8);
      SG.spent += info.cost;
      update(G(`inputs/${uid}`), { q: SG.q }).catch(() => {});
      sgHint(c.op === 'def' ? `${info.name} placed! 🛡️` : `${info.name} sent down row ${c.r + 1}! ⚔️`, 'good');
      sfx.click(); navigator.vibrate?.(25);
      drawSgHud();
    },
    onHint: (msg, cls) => { sgHint(msg, cls); if (cls === 'bad') sfx.wrong(); },
  });
  if (SG.info) SG.view.setInfo(SG.info);
  SG.view.setGrid(SG.g); SG.view.setUnits(SG.u); SG.view.setMowers(SG.m);
  drawSgHud();
}
let sgHintT = null;
function sgHint(msg, cls = '') {
  const h = $('#sg-hint'); h.textContent = msg; h.className = `tw-hint ${cls}`;
  clearTimeout(sgHintT); sgHintT = setTimeout(() => { sgHintT = null; drawSgHud(); }, 2600);
}
function drawSgHud() {
  if (!isSiege()) return;
  const ps = D.ps; const info = SG.info;
  if (ps.corn !== SG.lastCorn) { SG.lastCorn = ps.corn; SG.spent = 0; } // fresh number from the big screen
  const corn = Math.max(0, (ps.corn || 0) - SG.spent);
  const role = ps.role || (info && D.me?.team === info.def ? 'def' : 'att');
  $('#sg-corn').textContent = corn;
  $('#sg-tc').textContent = ps.tc ?? 0; $('#sg-tt').textContent = ps.tt ?? 0;
  const r = $('#sg-role'); r.textContent = role === 'def' ? '🛡️ DEFEND' : '⚔️ ATTACK'; r.classList.toggle('att', role === 'att');
  if (info) {
    const pct = Math.round((info.hp / info.max) * 100);
    $('#sg-hp').innerHTML = `${info.def === 'chicken' ? `${teamIco('chicken')} Chicken coop` : `${teamIco('turkey')} Turkey barn`}: ${info.hp}/${info.max} 🥚<i style="--hp:${pct}%"></i>`;
  }
  SG.view?.setRole({ team: D.me?.team, role, corn });
  if (sgHintT || L.mapBlocked) return;
  const h = $('#sg-hint');
  h.className = ps.golden ? 'tw-hint good' : 'tw-hint';
  h.textContent = ps.golden ? '🥇 Golden Egg Rush — right answers give DOUBLE corn!'
    : role === 'def' ? 'DEFEND your coop! Pick a defence, then tap an empty square. Answer questions for more 🌽.'
      : 'ATTACK! Pick an attacker, then tap a row to send it. Answer questions for more 🌽.';
}
$('#sg-quiz').addEventListener('click', () => { sfx.click(); setTab('answer'); });

/** Shown when Firebase refuses to send the map (database rules not published yet). */
function mapBlocked() {
  const msg = 'The map is blocked by Firebase. TEACHER: open Firebase → Realtime Database → Rules, paste in database.rules.json from the project and click Publish, then refresh this page.';
  for (const id of ['#tw-hint', '#sg-hint']) { const h = $(id); if (h) { h.className = 'tw-hint bad'; h.textContent = msg; } }
  for (const id of ['#tw-scene', '#sg-view']) {
    const el = $(id); if (!el) continue;
    const box = document.createElement('div'); box.className = 'map-blocked';
    box.innerHTML = '<b>🔒 Map blocked</b><span>Ask your teacher to publish the new database rules in Firebase, then refresh.</span>';
    el.appendChild(box);
  }
  twHintT = 1; sgHintT = 1; // keep the message up
}

// Coop Wars: tapping one of your team's buildings opens a question over the map.
TW.quiz = false; TW.target = null;
function openTwQuiz(i) {
  if (D.state.phase !== 'playing' || D.state.paused) return;
  TW.target = i; TW.quiz = true;
  document.body.classList.add('tw-quiz');
  $('#view-answer').classList.remove('hidden');
  sfx.click(); navigator.vibrate?.(20);
  drawQuestion();
}
function closeTwQuiz() {
  TW.quiz = false;
  document.body.classList.remove('tw-quiz');
  if (L.tab !== 'answer') $('#view-answer').classList.add('hidden');
}
{
  const x = document.createElement('button');
  x.className = 'tw-quiz-close'; x.textContent = '✕ Back to map';
  x.onclick = () => { closeTwQuiz(); sfx.click(); };
  $('#view-answer').prepend(x);
}

// ---------- Egg Farm: tap a building → build / upgrade / destroy ----------
/** The farm numbers the phone needs for prices (from the host's last update). */
function farmNow(ps = D.ps) {
  return {
    coops: [...(ps.coops || [1, 0, 0, 0])], trucks: [...(ps.trucks || [1, 0, 0, 0])], machine: ps.machine || 0,
    coopBuys: ps.coopBuys || 0, truckBuys: ps.truckBuys || 0,
    coopSpent: [...(ps.coopSpent || [0, 0, 0, 0])], truckSpent: [...(ps.truckSpent || [0, 0, 0, 0])], machineSpent: ps.machineSpent || 0,
  };
}
FM.act = null; FM.confirm = '';
function openAct(kind, slot) {
  FM.act = { kind, slot }; FM.confirm = ''; FM.actHtml = '';
  $('#fm-act').classList.remove('hidden');
  sfx.click(); drawAct();
}
function closeAct() { FM.act = null; $('#fm-act').classList.add('hidden'); }
const KIND_TXT = {
  coop: { title: 'Coop', icon: (lv, t) => `fm_coop_${t}${Math.max(1, lv)}`, stat: (lv) => `🐔 room for ${FE.fmtN(FE.COOP_LV[lv].cap)} chickens` },
  truck: { title: 'Truck', icon: (lv) => FE.TRUCK_LV[Math.max(1, lv)].sprite, stat: (lv) => `📦 sells ${FE.fmtN(FE.TRUCK_LV[lv].cap)} eggs a second` },
  machine: { title: 'Egg Machine', icon: (lv) => FE.MACHINE_LV[Math.max(1, lv)].sprite, stat: (lv) => `🥚 eggs worth ×${FE.MACHINE_LV[lv].mult}` },
};
function actCard(kind, slot) {
  const f = farmNow(); const cash = predicted().cash; const T = KIND_TXT[kind]; const t = D.me?.team === 'turkey' ? 't' : 'c';
  const lv = FE.levelOf(f, kind, slot); const max = FE.MAXLV[kind];
  const where = kind === 'coop' ? `Plot ${slot + 1}` : kind === 'truck' ? `Truck spot ${slot + 1}` : 'Machine spot';
  if (!lv) { // empty → choose what to build
    const opts = [];
    for (let to = 1; to <= max; to++) {
      const cost = FE.costTo(f, kind, slot, to); const can = cash >= cost;
      opts.push(`<button class="fm-opt ${can ? 'can' : ''}" data-act="build" data-kind="${kind}" data-slot="${slot}" data-level="${to}"><img src="${sprite(T.icon(to, t))}" alt=""><span><b>${esc(FE.infoOf(kind, to).name)}</b><small>${T.stat(to)}</small></span><span class="cost">${esc(FE.fmt(cost))}${can ? '' : `<small>need ${esc(FE.fmt(cost - cash))} more</small>`}</span></button>`);
    }
    return `<div class="fm-card"><h3>🔨 Build — ${where}</h3><p class="hint">Choose what to build. Bigger ones cost more but do more.</p><div class="fm-opts">${opts.join('')}</div></div>`;
  }
  const info = FE.infoOf(kind, lv);
  const up = lv < max ? { cost: FE.costTo(f, kind, slot, lv + 1), next: FE.infoOf(kind, lv + 1) } : null;
  const back = FE.refundOf(f, kind, slot); const prob = FE.destroyProblem(f, kind, slot);
  const confirming = FM.confirm === `${kind}${slot}`;
  return `<div class="fm-card"><div class="fm-card-head"><img src="${sprite(T.icon(lv, t))}" alt=""><div><h3>${esc(info.name)}</h3><small>${where} · Level ${lv}/${max}</small><div class="stat">${T.stat(lv)}</div></div></div>
    <div class="fm-acts">
      ${up ? `<button class="fm-act-btn up ${cash >= up.cost ? 'can' : ''}" data-act="upgrade" data-kind="${kind}" data-slot="${slot}"><b>⬆ Upgrade to ${esc(up.next.name)}</b><small>${T.stat(lv + 1)}</small><span class="cost">${esc(FE.fmt(up.cost))}${cash >= up.cost ? '' : ` · need ${esc(FE.fmt(up.cost - cash))} more`}</span></button>` : '<div class="fm-max">⭐ Fully upgraded!</div>'}
      <button class="fm-act-btn del ${prob ? 'off' : ''} ${confirming ? 'confirm' : ''}" data-act="destroy" data-kind="${kind}" data-slot="${slot}"><b>${confirming ? '⚠️ Tap again to destroy' : '💥 Destroy'}</b><small>${prob ? esc(prob) : `get ${esc(FE.fmt(back))} back (half what you paid)`}</small></button>
    </div></div>`;
}
function drawAct() {
  if (!FM.act) return;
  const { kind, slot } = FM.act;
  const slots = slot != null || kind === 'machine' ? [slot || 0] : [0, 1, 2, 3];
  const title = { coop: '🏠 Coops', truck: '🚚 Trucks', machine: '⚙️ Egg Machine' }[kind];
  const html2 = `<h2>${title} <small>💰 ${esc(fmt(predicted().cash))}</small></h2><div class="fm-cards">${slots.map((i) => actCard(kind, i)).join('')}</div>`;
  if (FM.actHtml !== html2) { FM.actHtml = html2; $('#fm-act-body').innerHTML = html2; }
}
$('#fm-act-close').addEventListener('click', () => { closeAct(); sfx.click(); });
$('#fm-act').addEventListener('click', (e) => {
  if (e.target.id === 'fm-act') { closeAct(); return; } // tapped outside the box
  const b = e.target.closest('[data-act]'); if (!b || D.state.phase !== 'playing') return;
  const a = { op: b.dataset.act, kind: b.dataset.kind, slot: +b.dataset.slot || 0, level: +b.dataset.level || 0 };
  const shake = () => { sfx.wrong(); b.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 220 }); };
  const f = farmNow();
  if (a.op === 'destroy') {
    if (FE.destroyProblem(f, a.kind, a.slot)) { shake(); return; }
    if (FM.confirm !== `${a.kind}${a.slot}`) { FM.confirm = `${a.kind}${a.slot}`; sfx.click(); drawAct(); return; }
    FM.adjCash += FE.refundOf(f, a.kind, a.slot);
  } else {
    const lv = FE.levelOf(f, a.kind, a.slot);
    const cost = FE.costTo(f, a.kind, a.slot, a.op === 'upgrade' ? lv + 1 : a.level);
    if (predicted().cash < cost) { shake(); return; }
    FM.adjCash -= cost;
  }
  FM.confirm = '';
  FM.buySeq += 1;
  sendFarm({ act: a });
  a.op === 'destroy' ? sfx.splat() : sfx.join(); navigator.vibrate?.(30);
  closeAct(); drawFarm();
});

// ---------------- Land Grab ----------------
const PT = { view: null, info: null, g: '', t: '', p: '', lastSent: 0, pend: null, timer: null };
function ensurePt() {
  if (!isPaint() || !uid) return;
  if (!PT.view) {
    PT.view = new PaintView($('#pt-scene'), { uid, onSteer: (a) => sendSteer(a) });
    if (PT.info) PT.view.setInfo(PT.info);
    PT.view.setGrid(PT.g || ''); PT.view.setTrail(PT.t || ''); PT.view.setPos(PT.p || '');
  }
  drawPtHud();
}
function sendSteer(a) {
  PT.pend = a;
  if (PT.timer) return;
  const go = () => { PT.timer = null; if (PT.pend == null) return; update(G(`inputs/${uid}`), { a: PT.pend }).catch(() => {}); PT.pend = null; PT.lastSent = Date.now(); };
  const wait = Math.max(0, 80 - (Date.now() - PT.lastSent));
  PT.timer = setTimeout(go, wait);
}
function drawPtHud() {
  if (!isPaint()) return;
  const ps = D.ps;
  $('#pt-speed').textContent = `⚡ ${ps.speed || 5}`;
  $('#pt-mine').textContent = `🏳️ ${ps.pct || 0}%`;
  $('#pt-lc').textContent = `${ps.lc ?? 0}%`; $('#pt-lt').textContent = `${ps.lt ?? 0}%`;
  $('#pt-out').classList.toggle('hidden', !(ps.out && D.state.phase === 'playing'));
}

// ---------------- Advance ----------------
const ADV = { info: null, s: '', board: null, mode: 'move', seq: Date.now(), q: [], layout: null, pending: 0 };
function renderPiecePick(refresh = false) {
  const me = D.me; if (!me || !me.team) return;
  if (refresh && !$('#wait .piece-pick')) return;
  show('wait');
  const team = me.team;
  const taken = new Set(Object.entries(D.all || {}).filter(([u, p]) => u !== uid && p && p.team === team && p.pc).map(([, p]) => p.pc));
  const cell = (p, c) => {
    const pc = `${p.id}${c.id}`; const art = pieceSprite(team, pc); const off = taken.has(pc);
    const face = ADV_ART.has(art) ? `<img src="${sprite(art)}" alt="">` : `<span class="pp-token" style="background:${c.fill};color:${c.ink}">${p.glyph}</span>`;
    return `<button class="pp ${off ? 'taken' : ''}" data-pc="${pc}" ${off ? 'disabled' : ''} title="${c.name} ${p.name}">${face}<small>${off ? 'taken' : `${c.name}<br>${p.name}`}</small></button>`;
  };
  $('#wait').innerHTML = html`<div class="piece-pick">
    <h1 class="comic-title slant">PICK YOUR PIECE!</h1>
    <p style="margin:0">Choose a piece and colour. Faded ones are already taken by a teammate.</p>
    <div class="pp-grid">${raw(COLOURS[team].map((c) => PIECES.map((p) => cell(p, c)).join('')).join(''))}</div></div>`;
  $$('[data-pc]').forEach((b) => { b.onclick = () => { sfx.click(); $$('[data-pc]').forEach((x) => { x.disabled = true; }); update(G(`players/${uid}`), { pc: b.dataset.pc }).catch((e) => { console.error(e); renderPiecePick(); }); }; });
}
/** Turn the synced strings into a board object (pieces keep their slide positions). */
function advBuild() {
  const info = ADV.info; if (!info) return;
  const [ps = '', bs = ''] = String(ADV.s || '').split('|');
  const old = new Map((ADV.board?.pieces || []).map((p) => [p.uid, p]));
  const meta = new Map((info.players || []).map(([u, team, pc, name]) => [u, { team, pc, name }]));
  const pieces = ps.split(';').filter(Boolean).map((t) => {
    const [u, r, c, h] = t.split('.'); const m = meta.get(u) || { team: 'chicken', pc: 'pw', name: '' };
    const o = old.get(u) || {};
    return { uid: u, team: m.team, pc: m.pc, name: m.name, r: +r, c: +c, home: h === '1', dx: o.dx, dy: o.dy };
  });
  const blocks = bs.split(';').filter(Boolean).map((t) => { const [r, c, left, owner] = t.split('.'); return { r: +r, c: +c, left: +left, owner }; });
  ADV.board = { W: info.W, L: info.L, pieces, blocks };
  ADV.pending = 0;
  ensureAdvCanvas();
  advHud();
}
function ensureAdvCanvas() {
  if (ADV.canvas) return;
  const el = $('#adv-scene');
  ADV.canvas = document.createElement('canvas'); ADV.canvas.className = 'adv-canvas'; el.appendChild(ADV.canvas);
  ADV.ctx = ADV.canvas.getContext('2d');
  new ResizeObserver(advResize).observe(el); advResize();
  const frame = () => { advDraw(); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
  ADV.canvas.addEventListener('pointerdown', (e) => advTap(e));
  // debug/test hook: screen position of the first highlighted square
  window.cvtAdv = { target: () => { const m = advMarks()[0]; const Ly = ADV.layout; if (!m || !Ly) return null; const rect = ADV.canvas.getBoundingClientRect(); const c = Ly.flip ? Ly.W - 1 - m.c : m.c; const r = Ly.flip ? Ly.L - 1 - m.r : m.r; return { x: rect.left + Ly.ox + (c + 0.5) * Ly.cell, y: rect.top + Ly.oy + (r + 0.5) * Ly.cell }; } };
}
function advResize() {
  if (!ADV.canvas) return;
  const el = $('#adv-scene'); const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ADV.canvas.width = Math.round(el.clientWidth * dpr); ADV.canvas.height = Math.round(el.clientHeight * dpr);
  ADV.canvas.style.width = `${el.clientWidth}px`; ADV.canvas.style.height = `${el.clientHeight}px`; ADV.dpr = dpr;
}
function myPiece() { return ADV.board?.pieces.find((p) => p.uid === uid); }
function advMarks() {
  const me = myPiece(); if (!me || me.home || (D.ps.moves || 0) - ADV.pending <= 0 || D.state.phase !== 'playing') return [];
  if (ADV.mode === 'block') return blockSpots(ADV.board, me).map(([r, c]) => ({ r, c, kind: 'block' }));
  return legalMoves(ADV.board, me).map(([r, c]) => ({ r, c, kind: 'move' }));
}
function advDraw() {
  if (!ADV.board || !ADV.ctx || $('#view-adv').classList.contains('hidden')) return;
  const ctx = ADV.ctx; const dpr = ADV.dpr; const W = ADV.canvas.width / dpr; const H = ADV.canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ADV.layout = drawBoard(ctx, ADV.board, 6, 10, W - 12, H - 20, { flip: D.me?.team === 'turkey', me: uid, marks: advMarks() });
}
function advTap(e) {
  if (D.state.phase !== 'playing' || D.state.paused) return;
  const rect = ADV.canvas.getBoundingClientRect();
  const sq = hitSquare(ADV.layout, e.clientX - rect.left, e.clientY - rect.top); if (!sq) return;
  const mark = advMarks().find((m) => m.r === sq.r && m.c === sq.c);
  if (!mark) {
    const left = (D.ps.moves || 0) - ADV.pending;
    advHint(left <= 0 ? 'No moves left — answer a question on the QUIZ tab!' : ADV.mode === 'block' ? 'Tap an orange square next to you to drop a block.' : 'Tap a green square to move there.', 'bad');
    sfx.wrong(); return;
  }
  ADV.seq += 1; ADV.q.push({ s: ADV.seq, op: ADV.mode, r: sq.r, c: sq.c }); ADV.q = ADV.q.slice(-6);
  ADV.pending += 1;
  update(G(`inputs/${uid}`), { q: ADV.q }).catch(() => {});
  if (ADV.mode === 'move') { const me = myPiece(); if (me) { me.r = sq.r; me.c = sq.c; } } // optimistic
  sfx.click(); navigator.vibrate?.(25);
  advHint(ADV.mode === 'block' ? '🧱 Block placed! It lasts for your next 2 answers.' : '♟ Moved!', 'good');
  if (ADV.mode === 'block') setAdvMode('move');
  if ((D.ps.moves || 0) - ADV.pending <= 0) setTimeout(() => setTab('answer'), 650);
}
function setAdvMode(m) {
  ADV.mode = m;
  $$('#adv-modes [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
}
$('#adv-modes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]'); if (!b || b.disabled) return;
  setAdvMode(b.dataset.mode); sfx.click();
});
let advHintT = null;
function advHint(msg, cls = '') { const h = $('#adv-hint'); h.textContent = msg; h.className = `tw-hint ${cls}`; clearTimeout(advHintT); advHintT = setTimeout(() => { advHintT = null; advHud(); }, 2400); }
function advHud() {
  if (!isAdv()) return;
  const ps = D.ps; const left = Math.max(0, (ps.moves || 0) - ADV.pending);
  $('#adv-moves').textContent = ps.home ? '⭐ You made it across!' : left ? `♟ ${left} move${left > 1 ? 's' : ''} ready!` : 'No moves — answer a question';
  $('#adv-moves').classList.toggle('ready', !!left && !ps.home);
  $('#adv-ac').textContent = `${ps.ac ?? 0}%`; $('#adv-at').textContent = `${ps.at ?? 0}%`;
  const blockBtn = $('#adv-modes [data-mode="block"]');
  $('#adv-modes').classList.toggle('hidden', !ps.blockSmall);
  blockBtn.disabled = !ps.canBlock; if (!ps.canBlock && ADV.mode === 'block') setAdvMode('move');
  if (left && L.tab === 'answer' && !L.lockUntil && D.state.phase === 'playing') $('#tab-fight').classList.add('nudge');
  if (advHintT) return;
  const h = $('#adv-hint'); h.className = 'tw-hint';
  h.textContent = ps.home ? '⭐ You\'re home! Keep answering — your right answers still count for your place on the leaderboard.'
    : left ? (ADV.mode === 'block' ? 'Tap an orange square next to you to drop a hay-bale block.' : 'Tap a green square: forward, diagonal or sideways.')
      : 'Answer questions on the QUIZ tab. Each right answer = 1 move.';
}
