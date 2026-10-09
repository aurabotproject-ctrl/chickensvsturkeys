// =========================================================
// HOST SCREEN (projector): lobby → rounds → final.
// The host runs the whole game: grades answers, simulates the
// arena, keeps scores, and writes small updates for the phones.
// =========================================================
import {
  isConfigured, db, ref, get, set, update, remove, onValue, onChildAdded, onChildChanged,
  currentUser, isTeacher, serverNow, explainError,
} from '../js/core/firebase.js?v=20261009153050';
import { $, $$, esc, html, raw, toast, modal, confirmBox, promptBox, params, rand, shuffle, sleep } from '../js/core/ui.js?v=20261009153050';
import { sprite, avatar, AVATARS, TEAM, teamIco } from '../js/core/assets.js?v=20261009153050';
import { playUrl } from '../js/core/games.js?v=20261009153050';
import { sfx, setMuted, isMuted } from '../js/core/sfx.js?v=20261009153050';
import { loadBankByKey } from '../js/quiz/banks.js?v=20261009153050';
import { QuizEngine } from '../js/quiz/engine.js?v=20261009153050';
import { DodgeArena } from '../js/modes/dodge/arena.js?v=20261009153050';
import { makeBot, botTick } from '../js/modes/dodge/bots.js?v=20261009153050';
import { CannonArena } from '../js/modes/cannon/arena.js?v=20261009153050';
import { cannonBotTick, botLoadEggs } from '../js/modes/cannon/bots.js?v=20261009153050';
import { FarmBoard, fmt } from '../js/modes/farm/board.js?v=20261009153050';
import { TowerArena } from '../js/modes/towers/arena.js?v=20261009153050';
import { SiegeArena } from '../js/modes/siege/arena.js?v=20261009153050';
import { defenderFor } from '../js/modes/siege/rules.js?v=20261009153050';
import { EVENTS, randomEvent } from '../js/events/events.js?v=20261009153050';

const gameId = params.get('g');
const G = (p = '') => ref(db, `games/${gameId}${p ? '/' + p : ''}`);

let user; let meta; let bank; let engine; let arena;
const players = new Map(); // uid -> { name, av, team, online, bot }
const bots = new Map();
const lastThrow = new Map();
const dirty = new Set();
const S = { phase: 'lobby', round: 0, endsAt: 0, paused: false, pausedAt: 0, remaining: 0, event: null, winner: null, mode: 'dodge', wind: 0, quota: 0 };
const bonus = { chicken: 0, turkey: 0 };
let autoEvents = []; let lastEvent = null; let playIndex = 0;
let nextTimer = null;
const QUOTA = 5;          // Egg Cannon: questions per round
const BATTLE_MS = 45000;  // Egg Cannon: battle length
const roundAnswered = new Map();
let settledSince = 0;
const isCannon = () => meta?.mode === 'cannon';
const isFarm = () => meta?.mode === 'farm';
const isTowers = () => meta?.mode === 'towers';
const isSiege = () => meta?.mode === 'siege';
const teamPick = () => (meta?.settings?.teams || 'choose') === 'choose'; // older games without the setting: students choose
const isTimed = () => isFarm() || isTowers() || isSiege();
const showScore = (n) => (isFarm() ? fmt(n) : isTowers() || isSiege() ? Math.floor(n) : Math.round(n));
const UNIT = () => (isCannon() || isSiege() ? 'pts' : isFarm() ? '' : 'KO');

// ---------------- boot ----------------
async function boot() {
  if (!isConfigured || !gameId) return fail('No game selected. Start a game from Teacher HQ.');
  user = await currentUser();
  if (!isTeacher(user)) return fail('Please sign in on Teacher HQ first, then launch the game from there.');
  const snap = await get(G('meta'));
  if (!snap.exists()) return fail('That game doesn\'t exist any more.');
  meta = snap.val();
  if (meta.hostUid !== user.uid) return fail('This game belongs to another teacher account.');
  try { bank = await loadBankByKey(user.uid, meta.bankKey); } catch (e) { return fail('Couldn\'t load the question bank: ' + e.message); }
  engine = new QuizEngine(bank, meta.settings);
  S.mode = meta.mode || 'dodge';
  S.teamPick = teamPick();
  document.body.classList.add(`mode-${S.mode}`);

  // Fresh start: clear any old game state (keeps the players).
  await update(G(), { state: { phase: 'lobby', round: 0, mode: S.mode, teamPick: teamPick() }, current: null, fb: null, sub: null, inputs: null, pstate: null, tw: null, sg: null, teams: { chicken: 0, turkey: 0 }, standings: null, answers: null });

  setupLobby();
  listen();
  $('#boot').classList.add('hidden');
  $('#lobby').classList.remove('hidden');
  setInterval(loop, 200);
  setInterval(flush, 300);
}

function fail(msg) {
  $('#boot').innerHTML = html`<div class="msg-screen"><div class="panel light" style="max-width:560px"><h2 class="comic-title" style="font-size:3rem">Hold your chickens!</h2><p>${msg}</p><a class="btn" href="../teacher/">Go to Teacher HQ</a></div></div>`;
}

// ---------------- network listeners ----------------
function listen() {
  onValue(G('players'), (snap) => {
    const val = snap.val() || {};
    const seen = new Set();
    for (const [uid, p] of Object.entries(val)) {
      if (!p || !p.name) continue;
      seen.add(uid);
      const prev = players.get(uid);
      const cur = { ...p, bot: false };
      players.set(uid, cur);
      if (!prev) sfx.join();
      if (!cur.team) { if (!teamPick() || S.phase !== 'lobby') assignTeam(uid); } // students pick their own team in the lobby
      else if (arena) {
        if (!arena.players.has(uid) && S.phase !== 'lobby') joinMidGame(uid);
        else if (arena.players.has(uid)) arena.setTeam(uid, cur.team);
        const ap = arena.players.get(uid); if (ap && ap.name !== cur.name) { ap.name = cur.name; arena.updateTag(ap); }
      }
    }
    for (const uid of [...players.keys()]) {
      if (!seen.has(uid) && !players.get(uid).bot) { players.delete(uid); arena?.removePlayer(uid); }
    }
    drawRoster();
  });
  const onSub = (snap) => handleSub(snap.key, snap.val());
  onChildAdded(G('sub'), onSub); onChildChanged(G('sub'), onSub);
  const onInput = (snap) => handleInput(snap.key, snap.val());
  onChildAdded(G('inputs'), onInput); onChildChanged(G('inputs'), onInput);
}

function assignTeam(uid) {
  const counts = { chicken: 0, turkey: 0 };
  for (const p of players.values()) if (p.team) counts[p.team] += 1;
  const team = counts.chicken < counts.turkey ? 'chicken' : counts.turkey < counts.chicken ? 'turkey' : (Math.random() < 0.5 ? 'chicken' : 'turkey');
  players.get(uid).team = team;
  update(G(`players/${uid}`), { team }).catch(console.error);
}

function joinMidGame(uid) {
  const p = players.get(uid);
  arena.addPlayer({ uid, name: p.name, team: p.team, av: p.av });
  dirty.add(uid);
  if (S.phase === 'playing' && !isCannon()) dealNext(uid);
  if (S.phase === 'answer' && isCannon() && (roundAnswered.get(uid) || 0) < QUOTA) dealNext(uid);
}

// ---------------- lobby ----------------
function setupLobby() {
  const url = playUrl();
  $('#join-url').textContent = url.replace(/^https?:\/\//, '');
  $('#join-code').textContent = meta.code;
  $('#side-code').textContent = meta.code;
  try {
    const qr = window.qrcode(0, 'M'); qr.addData(playUrl(meta.code)); qr.make();
    $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  } catch { $('#qr').textContent = 'QR unavailable'; }
  const st = meta.settings;
  $('#lobby-info').innerHTML = html`<b>${meta.bankTitle}</b> · ${meta.questionCount} questions · ${isSiege() ? `2 halves × ${st.roundSeconds >= 60 ? `${+(st.roundSeconds / 60).toFixed(1)} min` : `${st.roundSeconds}s`} (teams swap attack & defence)` : isTimed() ? `${Math.round(st.roundSeconds / 60)} minutes` : `${st.rounds} round${st.rounds > 1 ? 's' : ''} × ${st.roundSeconds}s`} · ${isCannon() ? 'Egg Cannon' : isFarm() ? 'Egg Farm' : isTowers() ? 'Coop Wars' : isSiege() ? 'Coop Siege' : 'Dodge Egg'}`;
  if (isTowers()) $('.lobby-logo').src = sprite('tw_logo');
  if (isSiege()) $('.lobby-logo').src = sprite('sg_logo');
  $('#btn-bots').onclick = () => { for (let i = 0; i < 4; i++) addBot(); drawRoster(); };
  $('#btn-shuffle').onclick = shuffleTeams;
  $('#btn-full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  $('#btn-start').onclick = startGame;
}

function addBot() {
  const b = makeBot();
  const counts = { chicken: 0, turkey: 0 };
  for (const p of players.values()) if (p.team) counts[p.team] += 1;
  const team = counts.chicken <= counts.turkey ? 'chicken' : 'turkey';
  b.av = AVATARS[team][Math.floor(Math.random() * 12)];
  bots.set(b.uid, b);
  players.set(b.uid, { name: b.name, av: b.av, team, online: true, bot: true });
  if (arena && S.phase !== 'lobby') arena.addPlayer({ uid: b.uid, name: b.name, team, bot: true });
}

function drawRoster() {
  if (S.phase !== 'lobby') return;
  for (const team of ['chicken', 'turkey']) {
    const list = [...players.entries()].filter(([, p]) => p.team === team);
    $(`#n-${team}`).textContent = list.length;
    $(`#roster-${team}`).innerHTML = list.length
      ? list.map(([uid, p]) => html`<div class="pchip ${p.online === false ? 'off' : ''} ${p.bot ? 'bot' : ''}" data-uid="${uid}"><img src="${avatar(Number.isInteger(p.av) ? p.av : AVATARS[team][0])}" alt="">${p.bot ? '🤖 ' : ''}${p.name}</div>`).join('')
      : `<div class="empty-team">Waiting for ${TEAM[team].name.toLowerCase()}…</div>`;
  }
  const choosing = [...players.values()].filter((p) => !p.team);
  $('#choosing').innerHTML = choosing.length ? html`🤔 Choosing a team: ${choosing.map((p) => p.name).join(', ')}` : '';
  const n = players.size;
  $('#btn-start').disabled = n < 1;
  $('#btn-start').textContent = n ? `START! (${n})` : 'START!';
  $$('.pchip').forEach((c) => { c.onclick = () => playerMenu(c.dataset.uid); });
}

async function playerMenu(uid) {
  const p = players.get(uid); if (!p) return;
  const choice = await modal({
    title: p.name,
    body: `<p class="modal-msg">Team: <b>${TEAM[p.team]?.name || '—'}</b>${p.bot ? ' · test bot' : ''}</p>`,
    buttons: [
      { label: '🔀 Switch team', value: 'switch', cls: 'purple' },
      ...(p.bot ? [] : [{ label: '✏️ Rename', value: 'rename', cls: 'blue' }]),
      { label: '🚫 Remove', value: 'kick', cls: 'red' },
    ],
  });
  if (choice === 'switch') {
    const team = p.team === 'chicken' ? 'turkey' : 'chicken';
    p.team = team;
    if (p.bot) { arena?.setTeam(uid, team); drawRoster(); } else await update(G(`players/${uid}`), { team, av: null });
  } else if (choice === 'rename') {
    const name = await promptBox('New name', p.name);
    if (name) await update(G(`players/${uid}`), { name: name.slice(0, 16) });
  } else if (choice === 'kick') {
    if (p.bot) { bots.delete(uid); players.delete(uid); arena?.removePlayer(uid); drawRoster(); return; }
    if (await confirmBox(`Remove ${p.name} from the game?`, 'Remove')) {
      await update(G(), { [`kicked/${uid}`]: true, [`players/${uid}`]: null });
    }
  }
}

async function shuffleTeams() {
  const ids = shuffle([...players.keys()]);
  const updates = {};
  ids.forEach((uid, i) => {
    const team = i % 2 ? 'turkey' : 'chicken';
    const p = players.get(uid);
    if (p.team !== team) {
      p.team = team;
      if (p.bot) { p.av = AVATARS[team][Math.floor(Math.random() * 12)]; bots.get(uid).av = p.av; } else { updates[`players/${uid}/team`] = team; updates[`players/${uid}/av`] = null; }
    }
  });
  if (Object.keys(updates).length) await update(G(), updates);
  drawRoster();
}

// ---------------- game flow ----------------
async function startGame() {
  if (!players.size) return;
  for (const [uid, p] of players) if (!p.team) assignTeam(uid); // anyone still choosing gets a team
  $('#btn-start').disabled = true;
  $('#lobby').classList.add('hidden');
  $('#game').classList.remove('hidden');
  if (!arena) {
    if (isSiege()) meta.settings.rounds = 2;
    arena = isSiege()
      ? new SiegeArena($('#arena'), {
        onChange: (p) => dirty.add(p.uid),
        onSync: (up) => update(G(), up).catch(console.error),
        onWin: () => { if (S.phase === 'playing') endRound(); },
      })
      : isTowers()
      ? new TowerArena($('#arena'), {
        growth: meta.settings.growth || 'auto',
        onChange: (p) => dirty.add(p.uid),
        onSync: (up) => update(G(), up).catch(console.error),
        onWin: () => { if (S.phase === 'playing') endRound(); },
      })
      : isFarm()
      ? new FarmBoard($('#arena'), { onChange: (p) => dirty.add(p.uid) })
      : isCannon()
      ? new CannonArena($('#arena'), {
        onTarget: ({ shooter }) => { if (shooter) dirty.add(shooter.uid); bumpScores(); },
        onEggsChanged: (p) => dirty.add(p.uid),
      })
      : new DodgeArena($('#arena'), {
        koMode: meta.settings.koMode,
        onHit: ({ victim, thrower }) => { dirty.add(victim.uid); if (thrower) dirty.add(thrower.uid); bumpScores(); },
        onSweep: (winner) => { bonus[winner] += 5; showBanner('sweep'); setEvent('sweep', 0); bumpScores(); },
        onEggsChanged: (p) => dirty.add(p.uid),
      });
    if (isFarm()) arena.now = serverNow;
    try { await arena.init(); } catch (e) { console.error(e); toast('The arena failed to load: ' + e.message, 'bad', 8000); }
    if (isTimed()) setInterval(() => { if (S.phase === 'playing') { for (const uid of arena.players.keys()) dirty.add(uid); bumpScores(); } }, 1000);
    if (isTowers() || isSiege()) setInterval(() => { if (S.phase === 'playing' && !S.paused) arena.botTick(0.25); }, 250);
    if (!isTimed()) arena.app.ticker.add(() => {
      if (S.phase !== 'playing' || S.paused) return;
      const dt = Math.min(arena.app.ticker.deltaMS / 1000, 0.05);
      if (isCannon()) { for (const b of bots.values()) cannonBotTick(arena, b, dt); return; }
      for (const b of bots.values()) botTick(arena, b, dt, { onAnswer: (bot, ok) => { const p = players.get(bot.uid); if (p) { p.answered = (p.answered || 0) + 1; p.correct = (p.correct || 0) + (ok ? 1 : 0); } } });
    });
  }
  for (const [uid, p] of players) if (p.team) arena.addPlayer({ uid, name: p.name, team: p.team, bot: p.bot, av: p.av });
  await update(G('meta'), { status: 'playing' });
  S.round = 0;
  startRound();
}

async function startRound() {
  clearTimeout(nextTimer);
  S.round += 1;
  S.phase = 'countdown'; S.event = null; S.paused = false;
  await writeState();
  arena.startRound(S.round);
  for (const uid of arena.players.keys()) dirty.add(uid);
  if (isSiege()) { const d = defenderFor(S.round); phaseBanner(`<b>${S.round === 1 ? 'FIRST HALF' : 'SECOND HALF'}: ${d === 'chicken' ? `${teamIco('chicken')} CHICKENS DEFEND · ${teamIco('turkey')} TURKEYS ATTACK` : `${teamIco('turkey')} TURKEYS DEFEND · ${teamIco('chicken')} CHICKENS ATTACK`}</b><small>Answer questions for corn 🌽 — defenders build on the lawn, attackers pick a row!</small>`, 6000); }
  $('#round-label').textContent = isSiege() ? `HALF ${S.round} / 2` : `ROUND ${S.round} / ${meta.settings.rounds}`;
  const ms = meta.settings.roundSeconds * 1000;
  $('#timer').textContent = meta.settings.roundSeconds >= 60 ? `${Math.floor(meta.settings.roundSeconds / 60)}:${String(meta.settings.roundSeconds % 60).padStart(2, '0')}` : meta.settings.roundSeconds;
  await countdown();
  if (isCannon()) { startAnswerPhase(); return; }
  if (isTimed()) arena.startBattle();
  S.phase = 'playing';
  S.endsAt = serverNow() + ms;
  scheduleEvents(ms);
  await writeState();
  sfx.whistle();
  // Deal the first question to every real player.
  const updates = {};
  for (const [uid, p] of players) if (!p.bot && arena.players.has(uid)) updates[`current/${uid}`] = engine.deal(uid);
  updates.fb = null;
  await update(G(), updates);
}

function scheduleEvents(ms) {
  autoEvents = [];
  if (meta.settings.events !== 'auto') return;
  const n = isTimed() ? Math.max(2, Math.round(ms / 110000)) : ms >= 75000 ? 2 : 1;
  if (n > 2) { for (let i = 0; i < n; i++) autoEvents.push(S.endsAt - ms * ((n - i) / (n + 1) + rand(-0.04, 0.04))); autoEvents.sort((a, b) => a - b); return; }
  for (let i = 0; i < n; i++) autoEvents.push(S.endsAt - ms * (n === 1 ? rand(0.35, 0.65) : i === 0 ? rand(0.6, 0.75) : rand(0.25, 0.4)));
}

// ----- Egg Cannon: answer phase → battle phase -----
async function startAnswerPhase() {
  S.phase = 'answer'; S.quota = QUOTA; S.wind = arena.wind;
  S.endsAt = serverNow() + meta.settings.roundSeconds * 1000;
  roundAnswered.clear();
  await writeState();
  sfx.whistle();
  phaseBanner(`<b>ANSWER ${QUOTA} QUESTIONS</b> to load your cannon!<small>Each correct answer = 1 egg</small>`);
  const updates = { fb: null };
  for (const [uid, p] of players) if (!p.bot && arena.players.has(uid)) updates[`current/${uid}`] = engine.deal(uid);
  await update(G(), updates);
  $('#round-label').textContent = `ROUND ${S.round} · ANSWER!`;
}

async function startBattle() {
  if (S.phase !== 'answer') return;
  S.phase = 'playing';
  S.endsAt = serverNow() + BATTLE_MS;
  for (const b of bots.values()) if (arena.players.has(b.uid)) botLoadEggs(arena, b);
  arena.startBattle();
  settledSince = 0;
  scheduleEvents(BATTLE_MS);
  await writeState();
  await update(G(), { current: null });
  phaseBanner('<b>FIRE!</b><small>Set your angle, time your power, hit the enemy fort!</small>', 2200);
  sfx.go();
  $('#round-label').textContent = `ROUND ${S.round} / ${meta.settings.rounds}`;
  for (const uid of arena.players.keys()) dirty.add(uid);
}

let bannerTimer = null;
function phaseBanner(htmlText, ms = 0) {
  const b = $('#phase-banner');
  clearTimeout(bannerTimer);
  if (!htmlText) { b.classList.add('hidden'); return; }
  b.innerHTML = htmlText; b.classList.remove('hidden'); b.classList.remove('anim-pop'); void b.offsetWidth; b.classList.add('anim-pop');
  if (ms) bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
}

async function countdown() {
  const ov = $('#overlay');
  ov.className = 'overlay clear';
  for (const n of ['3', '2', '1', 'GO!']) {
    ov.innerHTML = `<div class="count ${n === 'GO!' ? 'go' : ''}">${n}</div>`;
    n === 'GO!' ? sfx.go() : sfx.tick();
    await sleep(n === 'GO!' ? 650 : 800);
  }
  ov.className = 'overlay hidden'; ov.innerHTML = '';
}

function loop() {
  if (S.phase === 'answer') { answerLoop(); return; }
  if (S.phase !== 'playing') return;
  if (S.paused) return;
  const left = Math.max(0, S.endsAt - serverNow());
  const secs = Math.ceil(left / 1000);
  const t = $('#timer');
  const label = secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : String(secs);
  if (t.textContent !== label) {
    t.textContent = label;
    t.classList.toggle('hurry', secs <= 10);
    if (secs <= 5 && secs > 0) sfx.tick();
  }
  if (autoEvents.length && serverNow() >= autoEvents[0]) { autoEvents.shift(); triggerEvent(randomEvent(lastEvent, S.mode)); }
  if (S.event && S.event.until && serverNow() > S.event.until) { S.event = null; $('#event-pill').classList.add('hidden'); writeState(); }
  if (S.event?.until) $('#event-pill').textContent = `${EVENTS[S.event.type].name} ${Math.ceil((S.event.until - serverNow()) / 1000)}s`;
  if (isCannon()) {
    const anyTargets = arena.targetsLeft('chicken') && arena.targetsLeft('turkey');
    if (arena.isSettled() || !anyTargets) { settledSince ||= serverNow(); } else settledSince = 0;
    if (settledSince && serverNow() - settledSince > 2500) endRound();
    const wind = $('#wind-pill');
    wind.classList.remove('hidden');
    wind.textContent = arena.wind ? `WIND ${arena.wind > 0 ? '→' : '←'} ${Math.abs(arena.wind)}` : 'NO WIND';
  }
  if (left <= 0) endRound();
  drawStandings();
}

function answerLoop() {
  if (S.paused) return;
  const left = Math.max(0, S.endsAt - serverNow());
  const secs = Math.ceil(left / 1000);
  const t = $('#timer');
  if (t.textContent !== String(secs)) { t.textContent = secs; t.classList.toggle('hurry', secs <= 10); }
  const humans = [...players.entries()].filter(([uid, p]) => !p.bot && arena.players.has(uid) && p.online !== false);
  const done = humans.filter(([uid]) => (roundAnswered.get(uid) || 0) >= QUOTA).length;
  const loaded = { chicken: 0, turkey: 0 };
  for (const p of arena.players.values()) loaded[p.team] += p.eggs;
  const b = $('#phase-banner small');
  if (b) b.innerHTML = `${done} / ${humans.length} finished · ${teamIco('chicken')} ${loaded.chicken} eggs loaded · ${teamIco('turkey')} ${loaded.turkey} eggs loaded`;
  const botsOnly = !humans.length && serverNow() - (S.endsAt - meta.settings.roundSeconds * 1000) > 4000;
  if (left <= 0 || botsOnly || (humans.length && done === humans.length)) { phaseBanner(''); startBattle(); }
}

async function endRound() {
  if (S.phase !== 'playing') return;
  S.phase = 'roundEnd'; S.event = null;
  arena.stopRound();
  $('#event-pill').classList.add('hidden');
  $('#wind-pill').classList.add('hidden');
  sfx.whistle();
  const standings = computeStandings();
  const last = S.round >= meta.settings.rounds;
  await update(G(), { current: null, standings: standings.slice(0, 10).map(slim), state: { ...S } });
  flush(true);
  if (last) { finalScreen(); return; }
  showRoundOverlay(standings);
}

function showRoundOverlay(standings) {
  const ts = teamScores();
  const ov = $('#overlay');
  ov.className = 'overlay';
  ov.innerHTML = html`<div class="round-box">
    ${raw(isSiege() ? `<img class="halftime-img" src="${sprite('sg_halftime')}" alt="Half time!">` : `<h1 class="comic-title slant">ROUND ${S.round} COMPLETE!</h1>`)}${raw(isSiege() ? `<p class="swap-note">Teams swap! ${defenderFor(S.round + 1) === 'chicken' ? `${teamIco('chicken')} Chickens defend · ${teamIco('turkey')} Turkeys attack` : `${teamIco('turkey')} Turkeys defend · ${teamIco('chicken')} Chickens attack`}</p>` : '')}
    <div class="round-teams">
      <div class="round-team chicken"><img src="${sprite(ts.chicken >= ts.turkey ? 'chicken_win' : 'chicken_dizzy')}" alt=""><div class="big">${showScore(ts.chicken)}</div><div class="lbl">CHICKENS</div></div>
      <div class="vs-burst burst">VS</div>
      <div class="round-team turkey"><img src="${sprite(ts.turkey >= ts.chicken ? 'turkey_win' : 'turkey_dizzy')}" alt=""><div class="big">${showScore(ts.turkey)}</div><div class="lbl">TURKEYS</div></div>
    </div>
    <div class="top5">${raw(standings.slice(0, 5).map((p, i) => html`<div class="who"><img src="${avatar(p.av)}" alt=""><b>${i + 1}. ${p.name}</b><span class="nowrap">${CORRECT(p)} ✅</span></div>`).join(''))}</div>
    <div class="next-row"><button class="btn big" id="ov-next">${isSiege() ? 'SECOND HALF ▶' : 'NEXT ROUND ▶'}</button><span id="ov-auto"></span></div></div>`;
  let n = 25;
  const tick = () => {
    $('#ov-auto').textContent = `starts in ${n}s`;
    if (n-- <= 0) { hideOverlay(); startRound(); return; }
    nextTimer = setTimeout(tick, 1000);
  };
  tick();
  $('#ov-next').onclick = () => { clearTimeout(nextTimer); hideOverlay(); startRound(); };
}

function hideOverlay() { const ov = $('#overlay'); ov.className = 'overlay hidden'; ov.innerHTML = ''; }

async function finalScreen() {
  clearTimeout(nextTimer);
  S.phase = 'final';
  const ts = teamScores();
  const winner = ts.chicken > ts.turkey ? 'chicken' : ts.turkey > ts.chicken ? 'turkey' : 'tie';
  S.winner = winner;
  arena.celebrate(winner);
  const standings = computeStandings();
  await update(G(), { state: { ...S }, standings: standings.slice(0, 10).map(slim), 'meta/status': 'ended' });
  flush(true);
  archive(winner, ts).catch((e) => { console.error(e); toast('Couldn\'t save results: ' + explainError(e), 'bad', 8000); });
  sfx.win();
  confetti();
  const top = standings.slice(0, 3);
  const ov = $('#overlay');
  ov.className = 'overlay';
  ov.innerHTML = html`<div class="final">
    <img class="burst-bg" src="${sprite(winner === 'chicken' ? 'burst_blue' : winner === 'turkey' ? 'burst_red' : 'burst_gold')}" alt="">
    <img class="win-banner" src="${sprite(winner === 'chicken' ? 'win_chicken' : winner === 'turkey' ? 'win_turkey' : 'win_tie')}" alt="${winner} wins">
    <div class="final-scores"><div style="background:var(--chicken)">${raw(teamIco('chicken'))} ${showScore(ts.chicken)}</div><div style="background:var(--turkey)">${raw(teamIco('turkey'))} ${showScore(ts.turkey)}</div></div>
    <div class="podium-wrap"><img class="podium" src="${sprite('podium')}" alt="">
      ${raw(top.map((p, i) => html`<div class="podium-spot p${i + 1}" style="animation-delay:${0.3 + (2 - i) * 0.35}s"><img class="av" src="${avatar(p.av)}" alt=""><img class="medal" src="${sprite(['medal_gold', 'medal_silver', 'medal_bronze'][i])}" alt=""><b>${p.name}</b><span class="nowrap">${CORRECT(p)} ✅</span></div>`).join(''))}
    </div>
    <div class="final-btns">
      <button class="img-btn" id="f-again" title="Play again"><img src="${sprite('btn_playagain')}" alt="Play again"></button>
      <button class="img-btn" id="f-results" title="View results"><img src="${sprite('btn_viewresults')}" alt="View results"></button>
      <a class="btn grey" href="../teacher/">🏠 Teacher HQ</a>
    </div></div>`;
  $('#f-again').onclick = playAgain;
  $('#f-results').onclick = () => window.open(`../teacher/report.html?r=${encodeURIComponent(`${gameId}-${playIndex}`)}`, '_blank');
}

function confetti() {
  const colors = ['#ffc72c', '#1e6fe0', '#e0402a', '#7ed321', '#7b2ff7', '#fff'];
  for (let i = 0; i < 90; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = `${rand(2.5, 5)}s`;
    c.style.animationDelay = `${rand(0, 1.5)}s`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 7000);
  }
}

async function playAgain() {
  hideOverlay();
  playIndex += 1;
  engine = new QuizEngine(bank, meta.settings);
  bonus.chicken = bonus.turkey = 0;
  arena.resetScores();
  for (const p of arena.players.values()) p.win = false;
  for (const p of players.values()) { p.correct = 0; p.answered = 0; }
  S.round = 0; S.phase = 'lobby'; S.winner = null;
  lastThrow.clear();
  await update(G(), { pstate: null, standings: null, answers: null, fb: null, current: null, sub: null, inputs: null, tw: null, sg: null, teams: { chicken: 0, turkey: 0 }, 'meta/status': 'lobby', state: { phase: 'lobby', round: 0, mode: S.mode, teamPick: teamPick() } });
  $('#game').classList.add('hidden');
  $('#lobby').classList.remove('hidden');
  drawRoster();
}

// ---------------- answers + inputs ----------------
function handleSub(uid, sub) {
  if (!sub || S.phase !== (isCannon() ? 'answer' : 'playing') || !arena?.players.has(uid)) return;
  const r = engine.grade(uid, sub, { round: S.round });
  if (!r) return;
  if (isSiege()) {
    r.feedback.sg = arena.reward(uid, { correct: r.entry.correct, conf: r.entry.conf, streak: r.feedback.streak });
    r.feedback.eggs = 0; r.feedback.bonus = []; r.feedback.lockMs = r.entry.correct ? 900 : 2500;
  } else if (isTowers()) {
    r.feedback.tw = arena.reward(uid, { correct: r.entry.correct, conf: r.entry.conf, streak: r.feedback.streak, target: sub.tgt });
    r.feedback.eggs = 0; r.feedback.bonus = []; r.feedback.lockMs = r.entry.correct ? 900 : 2500;
  } else if (isFarm()) {
    r.feedback.farm = arena.reward(uid, { correct: r.entry.correct, conf: r.entry.conf, streak: r.feedback.streak });
    r.feedback.eggs = 0; r.feedback.bonus = []; r.feedback.lockMs = r.entry.correct ? 900 : 2500;
  } else {
    const before = arena.players.get(uid).eggs;
    const changed = arena.addEggs(uid, r.feedback.eggs);
    r.feedback.full = r.feedback.eggs > 0 && changed < r.feedback.eggs && before + changed >= 8;
  }
  const p = players.get(uid); if (p) { p.correct = engine.stats(uid).correct; p.answered = engine.stats(uid).answered; }
  dirty.add(uid);
  const { entry } = r;
  let next = engine.deal(uid);
  if (isCannon()) { const n = (roundAnswered.get(uid) || 0) + 1; roundAnswered.set(uid, n); if (n >= QUOTA) next = null; }
  update(G(), {
    [`fb/${uid}`]: r.feedback,
    [`answers/${uid}/${entry.n}`]: { qid: entry.qid, choice: entry.choice, correct: entry.correct, conf: entry.conf || '', ms: entry.ms, round: entry.round, at: entry.at },
    [`current/${uid}`]: next,
  }).catch(console.error);
}

function dealNext(uid) {
  update(G(), { [`current/${uid}`]: engine.deal(uid) }).catch(console.error);
}

function handleInput(uid, inp) {
  if (!inp || !arena) return;
  if (isTimed()) { if (S.phase === 'playing' && !S.paused) arena.handleInput(uid, inp); return; }
  if (isCannon()) {
    if (inp.angle != null && S.phase === 'playing') arena.setAim(uid, +inp.angle);
    const n = +inp.throws || 0;
    if (n > 0 && n !== (lastThrow.get(uid) || 0)) {
      lastThrow.set(uid, n);
      if (S.phase === 'playing' && !S.paused) arena.fire(uid, +inp.angle, +inp.power);
    }
    return;
  }
  if (S.phase === 'playing' && !S.paused) arena.setMove(uid, +inp.mx || 0, +inp.my || 0);
  const n = +inp.throws || 0;
  if (n > 0 && n !== (lastThrow.get(uid) || 0)) {
    lastThrow.set(uid, n);
    if (S.phase === 'playing' && !S.paused) arena.throwEgg(uid, +inp.tx || 0, +inp.ty || 0);
  }
}

// ---------------- scores + sync ----------------
function teamScores() {
  if ((isTowers() || isSiege()) && arena) return arena.teamTotals();
  const t = { chicken: bonus.chicken, turkey: bonus.turkey };
  if (arena) for (const p of arena.players.values()) t[p.team] += p.score;
  return t;
}

function computeStandings() {
  if (!arena) return [];
  return [...arena.players.values()]
    .map((p) => {
      const info = players.get(p.uid);
      const st = p.bot ? { correct: p.correct ?? info?.correct ?? 0, answered: p.answered ?? info?.answered ?? 0 } : engine.stats(p.uid);
      return { uid: p.uid, name: p.name, team: p.team, score: p.score, av: info?.av, bot: p.bot, correct: st.correct || 0, answered: st.answered || 0 };
    })
    // Individual places = most questions correct (then fewest wrong, then game points). The TEAM result still uses the game.
    .sort((a, b) => b.correct - a.correct || (a.answered - a.correct) - (b.answered - b.correct) || b.score - a.score || a.name.localeCompare(b.name));
}
const slim = (p) => ({ name: p.name, team: p.team, score: p.score, correct: p.correct, av: Number.isInteger(p.av) ? p.av : 0 });
const CORRECT = (p) => `${p.correct} correct`;

let lastTeams = { chicken: -1, turkey: -1 };
function bumpScores() {
  const ts = teamScores();
  for (const team of ['chicken', 'turkey']) {
    const el = $(`#score-${team}`);
    if (showScore(ts[team]) !== showScore(lastTeams[team])) { el.textContent = showScore(ts[team]); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  lastTeams = ts;
}

let lastStandings = '';
function drawStandings() {
  const st = computeStandings().slice(0, 8);
  const key = st.map((p) => p.uid + p.correct).join();
  if (key === lastStandings) return;
  lastStandings = key;
  $('#standings').innerHTML = st.map((p, i) => html`<li class="${p.team}"><span class="rk">${i + 1}</span><img src="${avatar(Number.isInteger(p.av) ? p.av : AVATARS[p.team][0])}" alt=""><span class="nm">${p.name}</span><span class="sc">✅${p.correct}</span></li>`).join('');
  const ts = teamScores();
  $('#team-scores').innerHTML = `<div class="chicken"><span>${teamIco('chicken')} Chickens</span><b>${showScore(ts.chicken)}</b></div><div class="turkey"><span>${teamIco('turkey')} Turkeys</span><b>${showScore(ts.turkey)}</b></div>`;
  bumpScores();
}

/** Writes changed player states + team scores (throttled). */
function flush(force = false) {
  if (!arena || (!dirty.size && !force)) return;
  const updates = {};
  const standings = force ? computeStandings() : null;
  for (const uid of dirty) {
    const p = arena.players.get(uid); const info = players.get(uid);
    if (!p || !info || info.bot) continue;
    const st = engine.stats(uid);
    if (isTimed()) {
      updates[`pstate/${uid}`] = { ...arena.stateFor(uid), correct: st.correct, answered: st.answered, streak: st.streak, ...(standings ? { rank: standings.findIndex((s) => s.uid === uid) + 1, of: standings.length } : {}) };
      continue;
    }
    updates[`pstate/${uid}`] = {
      eggs: p.eggs, score: p.score, ko: !!p.ko, koLeft: p.ko && p.koT < 999 ? Math.ceil(p.koT) : 0, shield: p.shieldT > 0, rq: roundAnswered.get(uid) || 0,
      correct: st.correct, answered: st.answered, streak: st.streak,
      ...(standings ? { rank: standings.findIndex((s) => s.uid === uid) + 1, of: standings.length } : {}),
    };
  }
  if (force && standings) {
    for (const s of standings) {
      if (s.bot || dirty.has(s.uid) || !players.has(s.uid)) continue;
      updates[`pstate/${s.uid}/rank`] = standings.indexOf(s) + 1; updates[`pstate/${s.uid}/of`] = standings.length;
    }
  }
  dirty.clear();
  const tsc = teamScores(); updates.teams = { chicken: Math.floor(tsc.chicken), turkey: Math.floor(tsc.turkey) };
  update(G(), updates).catch(console.error);
}
// KO countdowns change every second — keep phones in sync.
setInterval(() => { if (arena && S.phase === 'playing') for (const p of arena.players.values()) if (p.ko || p.shieldT > 0) dirty.add(p.uid); }, 1000);

function writeState() { return set(G('state'), { ...S, event: S.event || null }).catch(console.error); }

// ---------------- events ----------------
function triggerEvent(type) {
  if (S.phase !== 'playing' || S.paused) return;
  lastEvent = type;
  const ts = teamScores();
  const losing = ts.chicken < ts.turkey ? 'chicken' : ts.turkey < ts.chicken ? 'turkey' : null;
  arena.startEvent(type, losing);
  showBanner(type);
  setEvent(type, EVENTS[type].secs);
}
function setEvent(type, secs) {
  S.event = { type, at: serverNow(), until: secs ? serverNow() + secs * 1000 : 0 };
  const pill = $('#event-pill');
  if (secs) { pill.classList.remove('hidden'); pill.textContent = EVENTS[type].name; } else pill.classList.add('hidden');
  writeState();
  if (!secs) setTimeout(() => { if (S.event?.type === type && !S.event.until) { S.event = null; writeState(); } }, 4000);
}
function showBanner(type) {
  const b = $('#banner');
  b.innerHTML = `<img src="${sprite(EVENTS[type].banner)}" alt="${esc(EVENTS[type].name)}">`;
  b.className = 'banner'; void b.offsetWidth; b.className = 'banner in';
  sfx.event();
  setTimeout(() => { b.className = 'banner hidden'; }, 2900);
}

// ---------------- teacher controls ----------------
$('#c-pause').onclick = async () => {
  if (S.phase !== 'playing' && S.phase !== 'answer') return;
  S.paused = !S.paused;
  arena.paused = S.paused;
  if (S.paused) {
    S.pausedAt = serverNow();
    S.remaining = S.endsAt - S.pausedAt;
    const ov = $('#overlay'); ov.className = 'overlay';
    ov.innerHTML = '<div class="paused-box"><h1 class="comic-title">PAUSED</h1><button class="btn big" id="resume">▶ Resume</button></div>';
    $('#resume').onclick = () => $('#c-pause').click();
  } else {
    const shift = serverNow() - (S.pausedAt || serverNow());
    S.endsAt += shift;
    autoEvents = autoEvents.map((t) => t + shift);
    if (S.event?.until) S.event.until += shift;
    hideOverlay();
  }
  $('#c-pause img').src = sprite(S.paused ? 'ico_play' : 'ico_pause');
  writeState();
};
$('#c-next').onclick = () => {
  if (S.phase === 'answer') { phaseBanner(''); startBattle(); } else if (S.phase === 'playing') endRound();
  else if (S.phase === 'roundEnd') { clearTimeout(nextTimer); hideOverlay(); startRound(); }
};
$('#c-event').onclick = () => {
  if (S.phase !== 'playing') { toast('Events can only happen during a round.', 'warn'); return; }
  if (meta.settings.events === 'off') { toast('Events are switched off for this game.', 'warn'); return; }
  triggerEvent(randomEvent(lastEvent, S.mode));
};
$('#c-scores').onclick = () => {
  const st = computeStandings();
  modal({
    title: 'Scores', wide: true,
    body: `<table class="table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Correct ✅</th><th>${isCannon() ? 'Target points' : isFarm() ? 'Money earned' : isTowers() || isSiege() ? 'Battle points' : 'KO points'}</th></tr></thead><tbody>${st.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}${p.bot ? ' 🤖' : ''}</td><td>${teamIco(p.team)}</td><td><b>${p.correct}</b>/${p.answered}</td><td>${showScore(p.score)}</td></tr>`).join('')}</tbody></table>`,
    buttons: [{ label: 'Close', value: null }],
  });
};
$('#c-sound').onclick = () => { setMuted(!isMuted()); $('#c-sound img').src = sprite(isMuted() ? 'ico_mute' : 'ico_sound'); };
$('#c-sound img').src = sprite(isMuted() ? 'ico_mute' : 'ico_sound');
$('#c-end').onclick = async () => {
  if (S.phase === 'final') return;
  if (!(await confirmBox('End the game now and show the winners?', 'End game'))) return;
  if (S.phase === 'playing' || S.phase === 'answer') { S.phase = 'roundEnd'; arena.stopRound(); phaseBanner(''); }
  hideOverlay();
  finalScreen();
};
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === ' ' && (S.phase === 'playing' || S.phase === 'answer')) { e.preventDefault(); $('#c-pause').click(); }
  if (e.key === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
});

// ---------------- results archive ----------------
async function archive(winner, ts) {
  const answers = {};
  for (const e of engine.log) (answers[e.uid] ||= []).push({ n: e.n, qid: e.qid, choice: e.choice, correct: e.correct, conf: e.conf || '', ms: e.ms, round: e.round, at: e.at });
  const pl = {};
  let correct = 0; let answered = 0;
  for (const [uid, p] of players) {
    const ap = arena.players.get(uid);
    if (p.bot) { pl[uid] = { name: p.name, team: p.team, av: p.av ?? 0, score: Math.floor(ap?.score || 0), bot: true }; continue; }
    const st = engine.stats(uid);
    correct += st.correct; answered += st.answered;
    const blindSpots = (answers[uid] || []).filter((a) => a.conf === 'sure' && !a.correct).length;
    pl[uid] = { name: p.name, team: p.team, av: Number.isInteger(p.av) ? p.av : 0, score: Math.floor(ap?.score || 0), correct: st.correct, answered: st.answered, blindSpots };
  }
  await set(ref(db, `results/${user.uid}/${gameId}-${playIndex}`), {
    gameId, mode: meta.mode, bankKey: meta.bankKey, bankTitle: meta.bankTitle, bankSubject: meta.bankSubject,
    settings: meta.settings, finishedAt: Date.now(), rounds: S.round, teams: { chicken: Math.floor(ts.chicken), turkey: Math.floor(ts.turkey) }, bonus, winner,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    players: pl,
    bank: { title: bank.title, subject: bank.subject, strands: bank.strands, questions: bank.questions.map((q) => ({ ...q, page: q.page ?? '' })) },
    answers,
  });
  toast('Results saved to Teacher HQ → Results', 'ok');
}

window.addEventListener('beforeunload', (e) => { if (S.phase === 'playing' || S.phase === 'roundEnd') { e.preventDefault(); e.returnValue = ''; } });

// Long numbers ($1,849 or 12:00) shrink to fit inside the scoreboard art.
for (const id of ['timer', 'score-chicken', 'score-turkey']) {
  const el = document.getElementById(id); if (!el) continue;
  const fit = () => el.style.setProperty('--len', Math.max(2, el.textContent.length));
  new MutationObserver(fit).observe(el, { childList: true, characterData: true, subtree: true }); fit();
}
window.cvt = { get arena() { return arena; }, players, S }; // handy for debugging in the console
boot().catch((e) => { console.error(e); fail(explainError(e)); });
