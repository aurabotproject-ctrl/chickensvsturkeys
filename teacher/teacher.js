// Teacher HQ: sign-in, dashboard, question banks, create game, results.
import {
  isConfigured, db, ref, onValue, watchUser, signInTeacher, signOutUser, isTeacher, explainError,
} from '../js/core/firebase.js?v=20261010134616';
import { $, $$, html, raw, esc, toast, modal } from '../js/core/ui.js?v=20261010134616';
import { sprite, subjectIcon, teamIco } from '../js/core/assets.js?v=20261010134616';
import { createGame, DEFAULT_SETTINGS } from '../js/core/games.js?v=20261010134616';
import { loadStrands, loadCurricula, listPremade, watchMyBanks, loadBankByKey } from '../js/quiz/banks.js?v=20261010134616';
import { renderBanks } from './banks-ui.js?v=20261010134616';

const app = $('#app');
export const ctx = { user: null, strands: {}, premade: [], mine: [], results: [], view: 'dashboard', go };

let unsubs = [];

async function boot() {
  if (!isConfigured) { app.innerHTML = '<p class="loading">Firebase is not configured — see README.md.</p>'; return; }
  try {
    [ctx.strands, ctx.premade, ctx.curricula] = await Promise.all([loadStrands(), listPremade(), loadCurricula()]);
  } catch (e) { console.error(e); }
  watchUser((u) => {
    unsubs.forEach((f) => f()); unsubs = [];
    if (!isTeacher(u)) { ctx.user = null; renderSignIn(); return; }
    ctx.user = u;
    unsubs.push(watchMyBanks(u.uid, (list) => { ctx.mine = list; if (['banks', 'dashboard', 'create'].includes(ctx.view)) render(); }));
    unsubs.push(onValue(ref(db, `results/${u.uid}`), (snap) => {
      ctx.results = Object.entries(snap.val() || {}).map(([id, r]) => ({ id, ...r })).sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
      if (['results', 'dashboard'].includes(ctx.view)) render();
    }));
    const want = new URLSearchParams(location.search).get('view');
    go(want || ctx.view || 'dashboard');
  });
}

function renderSignIn() {
  app.innerHTML = html`<div class="signin"><div class="box stack">
    <img src="${sprite('logo')}" alt="Chickens vs Turkeys">
    <div class="panel"><p style="margin-top:0">Teachers sign in with Google to make question banks and host games.<br>Students don't need an account — they join with a code.</p>
    <button id="signin" class="btn big yellow">Sign in with Google</button>
    <p id="err" class="error-text"></p></div>
    <p><a href="../">← Back</a> · <a href="../play/">I'm a student</a></p></div></div>`;
  $('#signin').onclick = async () => {
    try { await signInTeacher(); } catch (e) { $('#err').textContent = explainError(e); }
  };
}

const NAV = [
  ['dashboard', '🏠', 'Dashboard'],
  ['create', '🎮', 'Create Game'],
  ['banks', '📚', 'Question Banks'],
  ['results', '📊', 'Results'],
];

function shell() {
  const u = ctx.user;
  app.innerHTML = html`<div class="shell">
    <aside class="side">
      <img class="logo" src="${sprite('logo')}" alt="Chickens vs Turkeys">
      <nav class="nav">${raw(NAV.map(([k, i, l]) => `<button data-go="${k}" class="${ctx.view === k || (ctx.view === 'edit' && k === 'banks') ? 'on' : ''}"><span class="ni">${i}</span><span class="nl">${l}</span></button>`).join(''))}</nav>
      <div class="me">${raw(u.photoURL ? `<img src="${esc(u.photoURL)}" alt="">` : '')}<span>${u.displayName || u.email}<br><a href="#" id="signout">Sign out</a></span></div>
    </aside>
    <main class="main" id="main"></main></div>`;
  $$('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });
  $('#signout').onclick = (e) => { e.preventDefault(); signOutUser(); };
  return $('#main');
}

export function go(view, data) {
  ctx.view = view; ctx.data = data;
  const u = new URL(location.href); u.searchParams.set('view', view === 'edit' ? 'banks' : view); history.replaceState(null, '', u);
  render();
}

function render() {
  if (!ctx.user) return;
  const main = shell();
  ({ dashboard: renderDashboard, create: renderCreate, banks: renderBanks, edit: renderBanks, results: renderResults }[ctx.view] || renderDashboard)(main, ctx);
}

// ---------------- Dashboard ----------------
function renderDashboard(main) {
  const first = (ctx.user.displayName || 'Teacher').split(' ')[0];
  main.innerHTML = html`<h1 class="page-title">Kia ora, ${first}!</h1>
    <div class="big-actions">
      <button class="btn grass" data-go="create">🎮 Create Game</button>
      <button class="btn blue" data-go="banks">📚 Question Banks</button>
      <button class="btn purple" data-go="results">📊 View Results</button>
    </div>
    <div class="dash-grid">
      <section class="panel light"><h3>Recent games</h3><div id="recent" class="list"></div></section>
      <section class="panel light"><h3>Your question banks</h3><div id="mybanks" class="list"></div></section>
      <section class="panel"><h3 style="color:var(--yolk)">How students join</h3>
        <p>Students go to <b class="mono">${new URL('../play/', location.href).href}</b> on any device, or scan the QR code on your game screen, then type the 6-letter code.</p>
        <p class="hint">Tip: open the game screen on the projector, and keep this tab for yourself.</p></section>
    </div>`;
  $$('[data-go]', main).forEach((b) => { b.onclick = () => go(b.dataset.go); });
  const recent = $('#recent');
  recent.innerHTML = ctx.results.length ? ctx.results.slice(0, 4).map(resultRow).join('') : '<p class="empty">No games yet — create one!</p>';
  wireResultRows(recent);
  const mb = $('#mybanks');
  mb.innerHTML = ctx.mine.length
    ? ctx.mine.slice(0, 4).map((b) => html`<div class="list-row"><img class="icon" src="${subjectIcon(b.subject)}" alt=""><div class="grow"><div class="title">${b.title}</div><div class="sub">${b.questions.length} questions · ${b.subject}</div></div></div>`).join('')
    : '<p class="empty">No banks yet. Try <b>Build with Claude</b> on the Question Banks page, or use a premade bank.</p>';
}

// ---------------- Create game ----------------
const MODES = [
  { id: 'dodge', name: 'Dodge Egg', img: 'chicken_throw', desc: 'Answer to earn eggs, then dodge and throw in a 1-minute arena battle.' },
  { id: 'cannon', name: 'Egg Cannon', img: 'c_chicken_fire', desc: 'Answer 5 questions to load your cannon, then aim and blast the enemy fort.' },
  { id: 'towers', name: 'Coop Wars', img: 'mode_towers', desc: 'Draw lines from your coops to march troops and capture the map. Right answers send reinforcements!' },
  { id: 'siege', name: 'Coop Siege', img: 'mode_siege', desc: 'Two halves: defend your coop with egg shooters and hay walls, then swap and attack! Right answers earn corn to spend.' },
  { id: 'paint', name: 'Land Grab', img: 'chicken_run', desc: 'Answer for 1 minute to power up your speed, then 30 seconds to grab land — loop back home, and don\'t let anyone cut your trail!' },
  { id: 'advance', name: 'Advance', img: 'mode_advance', desc: 'A giant chessboard race! Every right answer = 1 move. First team to get everyone to the other side wins the round.' },
  { id: 'farm', name: 'Egg Farm', img: 'fm_coop_c4', desc: 'Grow the richest egg farm — every right answer boosts your farm.' },
];

function renderCreate(main) {
  const s = ctx.createState ||= { mode: 'dodge', bankKey: '', settings: { ...DEFAULT_SETTINGS } };
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (s.settings[k] === undefined) s.settings[k] = v;
  const bankOpts = [
    ...ctx.mine.map((b) => ({ key: `mine:${b.id}`, label: `${b.title} (${b.questions.length} Qs · yours)` })),
    ...ctx.premade.map((b) => ({ key: `premade:${b.id}`, label: `${b.title} (${b.count} Qs · premade)` })),
  ];
  if (!s.bankKey && bankOpts.length) s.bankKey = bankOpts[0].key;
  const seg = (name, opts) => `<div class="seg">${opts.map(([v, l]) => `<input type="radio" id="${name}-${v}" name="${name}" value="${v}" ${String(s.settings[name]) === String(v) ? 'checked' : ''}><label for="${name}-${v}">${l}</label>`).join('')}</div>`;
  main.innerHTML = html`<h1 class="page-title">Create a Game</h1>
    <section class="panel light"><h3>1. Pick a game</h3>
      <div class="mode-grid">${raw(MODES.map((m) => `<div class="card mode-card ${m.soon ? 'soon' : ''} ${s.mode === m.id ? 'on' : ''}" data-mode="${m.id}"><img src="${sprite(m.img)}" alt=""><div class="title">${m.name}</div><div class="hint">${m.desc}</div></div>`).join(''))}</div>
    </section>
    <section class="panel light" style="margin-top:18px"><h3>2. Pick a question bank</h3>
      ${raw(bankOpts.length ? `<select class="select" id="bank">${bankOpts.map((o) => `<option value="${esc(o.key)}" ${o.key === s.bankKey ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>` : '<p class="empty">No banks yet.</p>')}
      <p class="hint">Make your own on the <a href="#" id="tobanks">Question Banks</a> page.</p>
    </section>
    <section class="panel light" style="margin-top:18px"><h3>3. Settings</h3>
      <div class="settings-grid">
        <div class="field ${s.mode === 'farm' || s.mode === 'towers' || s.mode === 'siege' ? 'hidden' : ''}"><span>Rounds</span>${raw(seg('rounds', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']]))}</div>
        <div class="field"><span>${s.mode === 'cannon' || s.mode === 'paint' ? 'Answer time per round' : s.mode === 'farm' || s.mode === 'towers' ? 'Game length' : s.mode === 'siege' ? 'Length of each half' : 'Round length'}</span>${raw(seg('roundSeconds', s.mode === 'farm' || s.mode === 'towers' ? [[300, '5 min'], [480, '8 min'], [720, '12 min']] : s.mode === 'siege' ? [[150, '2½ min'], [210, '3½ min'], [300, '5 min']] : s.mode === 'advance' ? [[60, '1 min'], [90, '90 s'], [120, '2 min']] : [[45, '45 s'], [60, '60 s'], [90, '90 s']]))}${raw(s.mode === 'cannon' ? '<span class="hint">Students answer 5 questions, then a 45-second battle.</span>' : s.mode === 'advance' ? '<span class="hint">The longest each round can last. A round ends early if a team gets everyone across.</span>' : s.mode === 'paint' ? '<span class="hint">Every right answer = more speed. Then a 30-second land grab.</span>' : s.mode === 'siege' ? '<span class="hint">2 halves — the teams swap between defending and attacking at half time.</span>' : '')}</div>
        <div class="field"><span>Teams</span>${raw(seg('teams', [['choose', 'Students choose'], ['auto', 'Auto-balance']]))}<span class="hint">Students choose = they tap Chickens or Turkeys when they join. You can still move anyone in the lobby.</span></div>
        <div class="field"><span>Confidence check</span>${raw(seg('confidence', [['every', 'Every question'], ['third', 'Every 3rd'], ['off', 'Off']]))}<span class="hint">Students tap 🔥 Sure / 🤔 Think so / 🎲 Guessing — powers the blind-spot report.</span></div>
        <div class="field ${s.mode !== 'paint' ? 'hidden' : ''}"><span>Starting spots</span>${raw(seg('landLayout', [['split', 'Separate sides'], ['mixed', 'Mixed']]))}<span class="hint">Separate = chickens start on the left, turkeys on the right. Mixed = everyone starts scattered across the field — harder and more competitive!</span></div>
        <div class="field ${s.mode !== 'towers' ? 'hidden' : ''}"><span>Troop growth</span>${raw(seg('growth', [['auto', 'Auto'], ['questions', 'Questions only'], ['slow', 'Slow + questions']]))}<span class="hint">Auto = slow growth for 4 or fewer students, questions-only for bigger classes.</span></div>
        <div class="field ${s.mode !== 'dodge' ? 'hidden' : ''}"><span>When hit by an egg</span>${raw(seg('koMode', [['respawn', 'Back in 5 s'], ['out', 'Out for the round']]))}</div>
        <div class="field"><span>Random events</span>${raw(seg('events', [['auto', 'Automatic'], ['manual', 'I\'ll trigger them'], ['off', 'Off']]))}</div>
      </div>
      <div class="launch"><button id="launch" class="btn big" ${raw(bankOpts.length ? '' : 'disabled')}>🚀 Launch Game</button></div>
    </section>`;
  $$('.mode-card', main).forEach((c) => {
    c.onclick = () => { if (c.classList.contains('soon')) { toast('That game is coming in a later phase!', 'warn'); return; } s.mode = c.dataset.mode;
      if (s.mode === 'farm' || s.mode === 'towers') { s.settings.rounds = 1; if (![300, 480, 720].includes(s.settings.roundSeconds)) s.settings.roundSeconds = 480; } else if (s.mode === 'advance') { if (![60, 90, 120].includes(s.settings.roundSeconds)) s.settings.roundSeconds = 120; } else if (s.mode === 'siege') { s.settings.rounds = 2; if (![150, 210, 300].includes(s.settings.roundSeconds)) s.settings.roundSeconds = 210; } else if (s.settings.roundSeconds > 90) s.settings.roundSeconds = 60;
      renderCreate(main); };
  });
  $('#tobanks').onclick = (e) => { e.preventDefault(); go('banks'); };
  $('#bank')?.addEventListener('change', (e) => { s.bankKey = e.target.value; });
  $$('.seg input', main).forEach((i) => i.addEventListener('change', () => { s.settings[i.name] = isNaN(+i.value) ? i.value : +i.value; }));
  $('#launch').onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Launching…';
    try {
      const bank = await loadBankByKey(ctx.user.uid, s.bankKey);
      if (!bank.questions.length) throw new Error('That bank has no questions.');
      const { gameId } = await createGame(ctx.user, { bankKey: s.bankKey, bank, mode: s.mode, settings: s.settings });
      location.href = `../host/?g=${encodeURIComponent(gameId)}`;
    } catch (err) {
      console.error(err); toast(explainError(err), 'bad', 6000);
      btn.disabled = false; btn.textContent = '🚀 Launch Game';
    }
  };
}

// ---------------- Results ----------------
function resultRow(r) {
  const d = r.finishedAt ? new Date(r.finishedAt) : null;
  const winner = r.winner === 'tie' ? 'Tie' : r.winner === 'chicken' ? raw(`${teamIco('chicken')} Chickens won`) : r.winner === 'turkey' ? raw(`${teamIco('turkey')} Turkeys won`) : '';
  return html`<div class="list-row card" data-result="${r.id}" style="cursor:pointer">
    <img class="icon" src="${subjectIcon(r.bankSubject)}" alt="">
    <div class="grow"><div class="title">${r.bankTitle || 'Game'}</div>
    <div class="sub">${d ? d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' }) : ''} · ${Object.keys(r.players || {}).length} players · ${winner}</div></div>
    <span class="badge yolk">${r.accuracy ?? '–'}%</span></div>`;
}
function wireResultRows(root) {
  $$('[data-result]', root).forEach((row) => { row.onclick = () => { location.href = `report.html?r=${encodeURIComponent(row.dataset.result)}`; }; });
}

function renderResults(main) {
  main.innerHTML = html`<h1 class="page-title">Results</h1>
    <p style="color:#cfe0ff">Every finished game is saved here. Click one to open its printable <b>Master Teacher Diagnostic</b> — strand mastery, student accuracy, blind spots and question analysis.</p>
    <div class="list" id="rlist"></div>`;
  const list = $('#rlist');
  list.innerHTML = ctx.results.length ? ctx.results.map(resultRow).join('') : '<div class="panel light"><p class="empty">No finished games yet.</p></div>';
  wireResultRows(list);
}

function showResult(r) {
  if (!r) return;
  const players = Object.entries(r.players || {}).map(([uid, p]) => ({ uid, ...p })).filter((p) => !p.bot)
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const rows = players.map((p) => {
    const acc = p.answered ? Math.round((p.correct / p.answered) * 100) : 0;
    return html`<tr><td>${p.name}</td><td>${raw(teamIco(p.team))}</td><td>${p.score || 0}</td><td>${p.correct || 0}/${p.answered || 0}</td><td>${acc}%</td><td>${p.blindSpots || 0}</td></tr>`;
  }).join('');
  modal({
    title: r.bankTitle || 'Game result', wide: true,
    body: html`<p><b>${raw(teamIco('chicken'))} Chickens ${r.teams?.chicken ?? 0}</b> vs <b>${raw(teamIco('turkey'))} Turkeys ${r.teams?.turkey ?? 0}</b> · class accuracy <b>${r.accuracy ?? 0}%</b></p>
      <table class="table"><thead><tr><th>Student</th><th>Team</th><th>KO points</th><th>Correct</th><th>Accuracy</th><th>Blind spots</th></tr></thead><tbody>${raw(rows || '<tr><td colspan="6">No students</td></tr>')}</tbody></table>
      <p class="hint">Blind spot = answered 🔥 Sure but got it wrong.</p>`,
    buttons: [{ label: 'Close', value: null }],
  });
}

boot();
