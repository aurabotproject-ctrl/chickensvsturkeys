// Master Teacher Print Diagnostic page: teacher/report.html?r=<resultId>
import { isConfigured, db, ref, get, currentUser, isTeacher } from '../js/core/firebase.js?v=20261010193406';
import { $, $$, esc, params, sleep } from '../js/core/ui.js?v=20261010193406';
import { sprite } from '../js/core/assets.js?v=20261010193406';
import { analyze, CATS, level, LEVEL_TEXT, SYM, toCSV } from '../js/report/analyze.js?v=20261010193406';

const root = $('#report');
let result; let A;
const opts = { sort: 'name', initials: false, secs: { overview: true, matrix: true, questions: true, slips: false } };

async function boot() {
  const id = params.get('r');
  if (!isConfigured || !id) return msg('No game selected — open a report from Teacher HQ → Results.');
  const user = await currentUser();
  if (!isTeacher(user)) return msg('Please sign in on <a href="./">Teacher HQ</a> first.');
  // The game screen saves results a moment after the game ends — wait for them if needed.
  for (let i = 0; i < 10 && !result; i++) {
    const snap = await get(ref(db, `results/${user.uid}/${id}`));
    if (snap.exists()) result = snap.val(); else await sleep(1500);
  }
  if (!result) return msg('Couldn\'t find that game\'s results.');
  A = analyze(result);
  render();
}

function msg(h) { root.innerHTML = `<div class="empty-msg"><p>${h}</p></div>`; }

const nm = (s) => (opts.initials ? s.split(/\s+/).map((w) => w[0]?.toUpperCase() + '.').join('') : s);
const fmtDate = (t) => (t ? new Date(t).toLocaleString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const MODE = { dodge: 'Dodge Egg', cannon: 'Egg Cannon', farm: 'Egg Farm', towers: 'Coop Wars', siege: 'Coop Siege', paint: 'Land Grab', advance: 'Advance', eggtoss: 'Egg Toss', cross: 'Cross the Road' };

function head(title, sub) {
  return `<div class="rhead"><div><h1>${title}<small>${esc(sub || '')}</small></h1></div>
    <div class="meta"><b>${esc(result.bankTitle || '')}</b> · ${esc(result.bankSubject || '')}<br>${esc(MODE[result.mode] || '')} · ${fmtDate(result.finishedAt)}<br>${A.total.students} students · ${A.total.answered} answers</div>
    <img src="${sprite('logo')}" alt=""></div>`;
}

function sortedStudents() {
  const s = [...A.students];
  if (opts.sort === 'acc') s.sort((a, b) => (b.acc ?? -1) - (a.acc ?? -1));
  else if (opts.sort === 'blind') s.sort((a, b) => b.blind - a.blind || (a.acc ?? 0) - (b.acc ?? 0));
  else s.sort((a, b) => a.name.localeCompare(b.name));
  return s;
}

function bar(p) {
  const l = level(p);
  return `<div class="bar"><i class="lvl-${l || 'n'}" style="width:${p ?? 0}%"></i></div>`;
}

function overview() {
  const t = A.total; const c = A.classCats;
  const rated = c.mastered + c.blind + c.fragile + c.developing + c.lucky + c.aware;
  const cp = (n) => (rated ? Math.round((n / rated) * 100) : 0);
  const cell = (k, cls = '') => `<div class="cell ${cls}"><b>${c[k]}</b>${CATS[k].label}<br><small>${cp(c[k])}%</small></div>`;
  return `<section class="sheet wide" data-sec="overview">${head('Class Overview', 'Master Teacher Diagnostic')}
    <div class="kpis">
      <div class="kpi"><b>${t.acc ?? '–'}%</b><span>class accuracy</span></div>
      <div class="kpi"><b>${t.students}</b><span>students</span></div>
      <div class="kpi"><b>${t.answered}</b><span>answers given</span></div>
      <div class="kpi"><b>${t.questionsUsed}</b><span>questions used</span></div>
      <div class="kpi"><b>${t.avgMs ? (t.avgMs / 1000).toFixed(1) + 's' : '–'}</b><span>average answer time</span></div>
    </div>
    <div class="two">
      <div>
        <h2 class="st">Strand mastery</h2>
        <div class="bars">${A.strandRows.map((r) => `<div class="bar-row"><span>${esc(r.strand)}</span>${bar(r.pct)}<span class="sym">${r.pct == null ? '–' : `${SYM[level(r.pct)]} ${r.pct}%`}</span></div>`).join('')}</div>
        <p class="legend">✔ Mastered ≥ 80% · ~ Developing 50–79% · ✖ Needs support &lt; 50%</p>
        <h2 class="st">Top teaching priorities</h2>
        ${A.priorities.length ? `<ol class="prio">${A.priorities.map((p) => `<li>${p}</li>`).join('')}</ol>` : '<p>No big gaps — great work! 🎉</p>'}
      </div>
      <div>
        <h2 class="st">Confidence vs competence</h2>
        ${rated ? `<div class="conf-grid">
          <span></span><span class="h">✅ Correct</span><span class="h">❌ Wrong</span>
          <span class="r">🔥 Sure</span>${cell('mastered', 'mast')}${cell('blind', 'blind')}
          <span class="r">🤔 Think so</span>${cell('fragile')}${cell('developing')}
          <span class="r">🎲 Guessing</span>${cell('lucky')}${cell('aware')}
        </div>
        <p class="legend"><b>Blind spot</b> = confidently wrong — a misconception to address first. <b>Fragile</b> = right but unsure — needs more practice to stick. <b>Lucky guess</b> = right without knowing — don't count it as learned yet.</p>`
    : '<p>The confidence check was switched off for this game.</p>'}
      </div>
    </div></section>`;
}

function matrix() {
  const st = A.strands; const list = sortedStudents();
  const row = (s) => `<tr><td class="name"><span class="team-dot ${s.team}"></span>${esc(nm(s.name))}</td>
    ${st.map((x) => { const p = s.strandPct[x]; const l = level(p); return `<td class="${l || ''}">${p == null ? '·' : `${SYM[l]} ${p}%`}</td>`; }).join('')}
    <td><b>${s.acc ?? '–'}%</b></td><td>${s.c}/${s.a}</td>
    <td>${s.avgConf ? ['', '🎲', '🤔', '🔥'][Math.round(s.avgConf)] + ' ' + s.avgConf.toFixed(1) : '–'}</td>
    <td class="${s.blind >= 3 ? 'warn' : ''}">${s.blind}${s.blind >= 3 ? ' ⚠️' : ''}</td><td>${s.lucky}</td>
    <td>${s.calibration ?? '–'}${s.calibration != null ? '%' : ''}</td></tr>`;
  const avg = `<tr class="avg"><td class="name">Class average</td>${A.strandRows.map((r) => `<td>${r.pct ?? '–'}${r.pct != null ? '%' : ''}</td>`).join('')}<td>${A.total.acc ?? '–'}%</td><td>${A.total.correct}/${A.total.answered}</td><td></td><td>${A.classCats.blind}</td><td>${A.classCats.lucky}</td><td></td></tr>`;
  return `<section class="sheet wide" data-sec="matrix">${head('Student × Strand Matrix', 'Who needs what')}
    <table class="mx"><thead><tr><th>Student</th>${st.map((x) => `<th class="strand">${esc(x)}</th>`).join('')}<th>Accuracy</th><th>Correct</th><th>Avg confidence</th><th>Blind spots</th><th>Lucky guesses</th><th>Calibration</th></tr></thead>
    <tbody>${list.map(row).join('')}${avg}</tbody></table>
    <p class="legend">✔ ≥ 80% · ~ 50–79% · ✖ &lt; 50% · · = not asked. <b>Avg confidence</b>: 3 = Sure, 2 = Think so, 1 = Guessing. <b>Calibration</b> = how often a student's confidence matched their result (high = they know what they know). ⚠️ = 3 or more confidently-wrong answers.</p></section>`;
}

function questions() {
  const qs = A.qRows.filter((q) => q.asked).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  const card = (q, i) => {
    const total = q.asked || 1;
    const optsHtml = q.options.map((o, j) => {
      const p = Math.round((q.choices[j] / total) * 100);
      const cls = j === q.correct ? 'right' : j === q.common && q.commonCount ? 'miscon' : '';
      return `<div class="opt ${cls}"><span>${j === q.correct ? '✔' : 'ABCD'[j] || ''}</span><span>${esc(o)}</span><div class="pbar"><i style="width:${p}%"></i></div><span>${p}%</span></div>`;
    }).join('');
    const who = q.common >= 0 && q.choosers[q.common]?.length ? `<div><b>Chose “${esc(q.options[q.common])}”:</b> ${q.choosers[q.common].map((n) => esc(nm(n))).join(', ')}</div>` : '';
    return `<div class="qc"><div class="qtop"><span>#${i + 1} · <b>${esc(q.strand)}</b> · ${['', 'Recall', 'Understand', 'Apply'][q.difficulty] || ''}${q.page ? ` · p.${esc(q.page)}` : ''}</span><span><b>${q.pct}%</b> correct</span></div>
      <h3>${esc(q.q)}</h3>${optsHtml}
      ${q.explanation ? `<div class="why">💡 ${esc(q.explanation)}</div>` : ''}
      <div class="stats"><span>Answered: <b>${q.asked}</b></span><span>Blind spots: <b>${q.blind}</b>${q.blindPct != null ? ` (${q.blindPct}% of the "Sure" answers)` : ''}</span><span>Avg time: <b>${q.avgMs ? (q.avgMs / 1000).toFixed(1) + 's' : '–'}</b></span></div>
      ${who}</div>`;
  };
  return `<section class="sheet portrait" data-sec="questions">${head('Question Analysis', 'Hardest questions first')}
    <div class="qgrid">${qs.length ? qs.map(card).join('') : '<p>No questions were answered.</p>'}</div></section>`;
}

function slips() {
  const qById = new Map(A.qRows.map((q) => [q.id, q]));
  const slip = (s) => `<div class="slip"><h3>${esc(nm(s.name))}</h3>
    <div>Accuracy <b>${s.acc ?? '–'}%</b> (${s.c}/${s.a}) · 💥 ${s.score} points</div>
    <div class="mini">${A.strands.map((x) => { const p = s.strandPct[x]; return p == null ? '' : `<span>${esc(x)}</span><span>${SYM[level(p)]} ${p}%</span>`; }).join('')}</div>
    ${s.blindQs.length ? `<div><b>Check these — you were sure, but…</b></div>${s.blindQs.slice(0, 3).map((id) => { const q = qById.get(id); return q ? `<div class="bs">${esc(q.q)}<br>✔ <b>${esc(q.options[q.correct])}</b> — ${esc(q.explanation)}</div>` : ''; }).join('')}` : '<div class="bs" style="border-color:var(--grass);background:#f0fbe8">No blind spots — your confidence matched your answers. 👏</div>'}
    <div style="margin-top:6px;font-size:.8rem">My next step: ________________________________</div></div>`;
  return `<section class="sheet portrait" data-sec="slips">${head('Student Slips', 'Cut along the dashed lines')}
    <div class="slips">${sortedStudents().map(slip).join('')}</div></section>`;
}

function render() {
  const scroll = window.scrollY;
  root.innerHTML = overview() + matrix() + questions() + slips();
  $$('.sheet', root).forEach((s) => s.classList.toggle('hidden-sec', !opts.secs[s.dataset.sec]));
  window.scrollTo(0, scroll);
}

$$('[data-sec]', $('#toolbar')).forEach((c) => {
  c.onchange = () => { opts.secs[c.dataset.sec] = c.checked; render(); };
});
$('#sort').onchange = (e) => { opts.sort = e.target.value; render(); };
$('#initials').onchange = (e) => { opts.initials = e.target.checked; render(); };
$('#print').onclick = () => window.print();
$('#csv').onclick = () => {
  if (!A) return;
  const blob = new Blob([toCSV(result, A)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(result.bankTitle || 'game').replace(/\W+/g, '-')}-answers.csv`;
  a.click();
};

boot();
