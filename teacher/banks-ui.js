// Question Banks page: list, editor, Build with Claude, CSV import.
import { $, $$, html, raw, esc, toast, modal, confirmBox, copyText } from '../js/core/ui.js?v=20261010145254';
import { subjectIcon } from '../js/core/assets.js?v=20261010145254';
import {
  saveBank, deleteBank, getPremade, getMyBank, normalizeBank, normalizeQuestion,
  questionProblems, bankProblems, parseCSV, toCSV, subjectsFor,
} from '../js/quiz/banks.js?v=20261010145254';
import { buildPrompt, extractBank, TEMPLATE } from '../js/quiz/promptBuilder.js?v=20261010145254';
import { explainError } from '../js/core/firebase.js?v=20261010145254';

let filter = { text: '', subject: '' };
const CUR_KEY = 'cvt-curriculum';
const lastCurriculum = () => { try { return localStorage.getItem(CUR_KEY) || 'nz'; } catch { return 'nz'; } };
const rememberCurriculum = (id) => { try { localStorage.setItem(CUR_KEY, id); } catch { /* ignore */ } };
const curriculumOptions = (ctx, sel) => (ctx.curricula?.order || ['nz']).map((id) => `<option value="${esc(id)}" ${id === sel ? 'selected' : ''}>${esc(ctx.curricula?.curricula[id]?.name || id)}</option>`).join('');

export function renderBanks(main, ctx) {
  if (ctx.view === 'edit') return renderEditor(main, ctx, ctx.data);
  const subjects = [...new Set([...Object.keys(ctx.strands), ...ctx.mine.map((b) => b.subject)])];
  main.innerHTML = html`<h1 class="page-title">Question Banks</h1>
    <div class="bank-tools">
      <button class="btn yellow" id="build">✨ Build with Claude</button>
      <button class="btn blue" id="new">➕ New bank</button>
      <button class="btn purple" id="csv">📄 Import CSV</button>
      <input class="input" id="search" placeholder="Search banks…" value="${filter.text}">
    </div>
    <div class="chips" id="subj">${raw(['', ...subjects].map((s) => `<button class="chip ${filter.subject === s ? 'on' : ''}" data-s="${esc(s)}">${esc(s || 'All')}</button>`).join(''))}</div>
    <h2 class="group-title">My banks</h2><div class="bank-grid" id="mine"></div>
    <h2 class="group-title">Premade banks</h2><div class="bank-grid" id="premade"></div>`;

  const match = (b) => (!filter.subject || b.subject === filter.subject) && (!filter.text || b.title.toLowerCase().includes(filter.text.toLowerCase()));
  const draw = () => {
    const mine = ctx.mine.filter(match);
    $('#mine').innerHTML = mine.length ? mine.map((b) => card(b, 'mine')).join('') : '<p class="empty" style="color:#cfe0ff">No banks here yet — try ✨ Build with Claude.</p>';
    const pre = ctx.premade.filter(match);
    $('#premade').innerHTML = pre.map((b) => card({ ...b, questions: { length: b.count } }, 'premade')).join('') || '<p class="empty" style="color:#cfe0ff">None match.</p>';
    wire();
  };
  const card = (b, kind) => html`<div class="card bank-card">
    <img class="icon" src="${subjectIcon(b.subject)}" alt="" style="width:64px;height:64px;border-radius:12px">
    <div class="grow"><div class="list-row"><div class="grow"><div class="title" style="font-family:var(--font-comic);font-size:1.3rem;letter-spacing:.04em">${b.title}</div>
    <div class="sub hint">${b.questions.length} questions · ${b.subject}${raw(b.yearLevels?.length ? ' · Y' + esc(b.yearLevels.join('–').replace(/–.*–/, '–')) : '')}</div></div></div>
    <div class="acts">${raw(kind === 'mine'
      ? `<button class="btn sm blue" data-edit="${esc(b.id)}">Edit</button><button class="btn sm grey" data-csv="${esc(b.id)}">CSV</button><button class="btn sm red" data-del="${esc(b.id)}">Delete</button>`
      : `<button class="btn sm blue" data-view="${esc(b.id)}">Preview</button><button class="btn sm yellow" data-copy="${esc(b.id)}">Copy &amp; edit</button>`)}</div></div></div>`;

  const wire = () => {
    $$('[data-edit]').forEach((b) => { b.onclick = async () => ctx.go('edit', await getMyBank(ctx.user.uid, b.dataset.edit)); });
    $$('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const bank = ctx.mine.find((x) => x.id === b.dataset.del);
        if (await confirmBox(`Delete "${bank?.title}"? This can't be undone.`, 'Delete')) {
          await deleteBank(ctx.user.uid, b.dataset.del); toast('Bank deleted', 'ok');
        }
      };
    });
    $$('[data-csv]').forEach((b) => {
      b.onclick = () => {
        const bank = ctx.mine.find((x) => x.id === b.dataset.csv);
        const blob = new Blob([toCSV(bank)], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${bank.title.replace(/\W+/g, '-')}.csv`; a.click();
      };
    });
    $$('[data-view]').forEach((b) => { b.onclick = async () => previewBank(await getPremade(b.dataset.view)); });
    $$('[data-copy]').forEach((b) => {
      b.onclick = async () => {
        const bank = await getPremade(b.dataset.copy);
        ctx.go('edit', { ...bank, id: null, premade: false, title: bank.title + ' (my copy)' });
      };
    });
  };
  $('#search').oninput = (e) => { filter.text = e.target.value; draw(); };
  $$('#subj .chip').forEach((c) => { c.onclick = () => { filter.subject = c.dataset.s; renderBanks(main, ctx); }; });
  $('#new').onclick = () => ctx.go('edit', normalizeBank({ title: 'New bank', subject: subjects[0] || 'General Knowledge', questions: [blankQ()] }));
  $('#build').onclick = () => openBuilder(ctx);
  $('#csv').onclick = () => openCsv(ctx);
  draw();
}

const blankQ = () => normalizeQuestion({ type: 'mc', q: '', options: ['', '', '', ''], correct: 0 });

function previewBank(bank) {
  modal({
    title: bank.title, wide: true,
    body: `<div class="preview-list" style="max-height:60vh">${bank.questions.map((q, i) => `<div class="pv"><b>${i + 1}. ${esc(q.q)}</b>
      <small>${q.options.map((o, j) => (j === q.correct ? `✔ <b>${esc(o)}</b>` : esc(o))).join(' · ')}</small><small>💡 ${esc(q.explanation)} · <i>${esc(q.strand)}</i></small></div>`).join('')}</div>`,
    buttons: [{ label: 'Close', value: null }],
  });
}

// ---------------- Editor ----------------
function renderEditor(main, ctx, bank) {
  if (!bank) { ctx.go('banks'); return; }
  bank.curriculum ||= 'nz';
  const map = () => subjectsFor(ctx.curricula, bank.curriculum);
  const subjectOpts = () => { const subs = Object.keys(map()); if (bank.subject && !subs.includes(bank.subject)) subs.push(bank.subject); return subs.map((s) => `<option ${s === bank.subject ? 'selected' : ''}>${esc(s)}</option>`).join(''); };
  const strandsFor = () => map()[bank.subject] || [];
  main.innerHTML = html`<h1 class="page-title">${bank.id ? 'Edit bank' : 'New bank'}</h1>
    <section class="panel light">
      <div class="ed-head">
        <label class="field"><span>Title</span><input class="input" id="t" value="${bank.title}" maxlength="60"></label>
        <label class="field"><span>Curriculum</span><select class="select" id="cur">${raw(curriculumOptions(ctx, bank.curriculum))}</select></label>
        <label class="field"><span>Subject / learning area</span><select class="select" id="s">${raw(subjectOpts())}</select></label>
        <label class="field"><span>Year levels</span><input class="input" id="y" value="${bank.yearLevels.join(', ')}" placeholder="e.g. 5, 6"></label>
      </div>
      <p class="hint" id="sum"></p>
    </section>
    <div class="qcards" id="cards"></div>
    <div class="ed-bar">
      <button class="btn blue" id="add">➕ Add question</button>
      <button class="btn grey" id="cancel">Cancel</button>
      <span style="flex:1"></span>
      <button class="btn big" id="save">💾 Save bank</button>
    </div>`;

  const cards = $('#cards');
  const drawCard = (q, i) => {
    const probs = questionProblems(q, strandsFor());
    const strandOpts = ['', ...strandsFor()];
    if (q.strand && !strandOpts.includes(q.strand)) strandOpts.push(q.strand);
    return html`<div class="card qcard ${probs.length ? 'bad' : ''}" data-i="${i}">
      <div class="tools"><button class="btn sm grey icon-only" data-dup title="Duplicate">⧉</button><button class="btn sm red icon-only" data-rm title="Delete">✕</button></div>
      <div class="qnum">Q${i + 1} <select class="select" data-k="type" style="width:auto;display:inline-block;font-size:.9rem;padding:.2em 2em .2em .5em"><option value="mc" ${q.type === 'mc' ? 'selected' : ''}>Multiple choice</option><option value="tf" ${q.type === 'tf' ? 'selected' : ''}>True / False</option></select></div>
      <div class="stack" style="gap:.6rem;margin-top:.5rem">
        <textarea class="textarea" data-k="q" rows="2" style="min-height:60px" placeholder="Question">${q.q}</textarea>
        <div class="opts">${raw(q.options.map((o, j) => `<label class="opt"><input type="radio" name="c${i}" value="${j}" ${q.correct === j ? 'checked' : ''} title="Correct answer"><input class="input" data-opt="${j}" value="${esc(o)}" placeholder="Option ${'ABCD'[j]}" ${q.type === 'tf' ? 'readonly' : ''}></label>`).join(''))}</div>
        <input class="input" data-k="explanation" value="${q.explanation}" placeholder="💡 Explanation — why is the answer right? (shown to students + in reports)">
        <div class="row3">
          <select class="select" data-k="strand">${raw(strandOpts.map((s) => `<option value="${esc(s)}" ${s === q.strand ? 'selected' : ''}>${esc(s || '— strand —')}</option>`).join(''))}</select>
          <select class="select" data-k="difficulty">${raw([[1, 'Recall'], [2, 'Understand'], [3, 'Apply']].map(([v, l]) => `<option value="${v}" ${q.difficulty === v ? 'selected' : ''}>${l}</option>`).join(''))}</select>
          <input class="input" data-k="page" value="${q.page ?? ''}" placeholder="Page">
          <input class="input" data-k="seconds" type="number" min="5" max="120" value="${q.seconds}" title="Seconds">
        </div>
        <div class="problems">${probs.join(' · ')}</div>
      </div></div>`;
  };
  const drawAll = () => {
    cards.innerHTML = bank.questions.map(drawCard).join('');
    const bad = bankProblems(bank, map()).length;
    $('#sum').textContent = `${bank.questions.length} questions${bad ? ` · ⚠️ ${bad} need fixing before saving` : ' · ✅ all good'}`;
  };
  const refreshCard = (i) => {
    const el = cards.querySelector(`[data-i="${i}"]`);
    const probs = questionProblems(bank.questions[i], strandsFor());
    el.classList.toggle('bad', probs.length > 0);
    el.querySelector('.problems').textContent = probs.join(' · ');
    const bad = bankProblems(bank, map()).length;
    $('#sum').textContent = `${bank.questions.length} questions${bad ? ` · ⚠️ ${bad} need fixing before saving` : ' · ✅ all good'}`;
  };
  cards.addEventListener('input', (e) => {
    const card = e.target.closest('.qcard'); if (!card) return;
    const i = +card.dataset.i; const q = bank.questions[i];
    if (e.target.dataset.opt !== undefined) q.options[+e.target.dataset.opt] = e.target.value;
    else if (e.target.dataset.k) {
      const k = e.target.dataset.k;
      q[k] = k === 'difficulty' || k === 'seconds' ? Number(e.target.value) : e.target.value;
      if (k === 'page') q.page = e.target.value || null;
    }
    refreshCard(i);
  });
  cards.addEventListener('change', (e) => {
    const card = e.target.closest('.qcard'); if (!card) return;
    const i = +card.dataset.i; const q = bank.questions[i];
    if (e.target.type === 'radio') q.correct = +e.target.value;
    if (e.target.dataset.k === 'type') {
      q.type = e.target.value;
      q.options = q.type === 'tf' ? ['True', 'False'] : ['', '', '', ''];
      q.correct = 0; drawAll(); return;
    }
    if (e.target.dataset.k === 'strand' || e.target.dataset.k === 'difficulty') q[e.target.dataset.k] = e.target.dataset.k === 'difficulty' ? +e.target.value : e.target.value;
    refreshCard(i);
  });
  cards.addEventListener('click', (e) => {
    const card = e.target.closest('.qcard'); if (!card) return;
    const i = +card.dataset.i;
    if (e.target.closest('[data-rm]')) { bank.questions.splice(i, 1); drawAll(); }
    if (e.target.closest('[data-dup]')) { bank.questions.splice(i + 1, 0, structuredClone(bank.questions[i])); drawAll(); }
  });
  $('#t').oninput = (e) => { bank.title = e.target.value; };
  $('#y').oninput = (e) => { bank.yearLevels = e.target.value.split(/[^0-9]+/).map(Number).filter(Boolean); };
  $('#s').onchange = (e) => { bank.subject = e.target.value; drawAll(); };
  $('#cur').onchange = (e) => {
    bank.curriculum = e.target.value;
    if (!map()[bank.subject]) bank.subject = Object.keys(map())[0];
    $('#s').innerHTML = subjectOpts(); drawAll();
  };
  $('#add').onclick = () => { bank.questions.push(blankQ()); drawAll(); cards.lastElementChild?.scrollIntoView({ behavior: 'smooth' }); };
  $('#cancel').onclick = () => ctx.go('banks');
  $('#save').onclick = async (e) => {
    const probs = bankProblems(bank, map());
    if (!bank.questions.length) { toast('Add at least one question.', 'warn'); return; }
    if (probs.length) {
      toast(`Fix ${probs.length} question(s) first — they're outlined in red.`, 'warn', 5000);
      cards.querySelector('.qcard.bad')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    e.currentTarget.disabled = true;
    try {
      bank.id = await saveBank(ctx.user.uid, bank);
      toast('Bank saved! 🎉', 'ok');
      ctx.go('banks');
    } catch (err) { toast(explainError(err), 'bad', 6000); e.currentTarget.disabled = false; }
  };
  drawAll();
}

// ---------------- Build with Claude ----------------
function openBuilder(ctx) {
  const curOf = (id) => ctx.curricula?.curricula?.[id] || ctx.curricula?.curricula?.nz || {};
  const startCur = ctx.curricula?.curricula?.[lastCurriculum()] ? lastCurriculum() : 'nz';
  const f = { source: 'topic', topic: '', pages: '', curriculum: startCur, subject: Object.keys(subjectsFor(ctx.curricula, startCur))[0], yearLevel: curOf(startCur).defaultLevel || 'Year 5–6 (ages 9–11)', count: 20, difficulty: 'balanced', types: 'mc', focus: '' };
  const subjectOptions = () => Object.keys(subjectsFor(ctx.curricula, f.curriculum)).map((s) => `<option ${s === f.subject ? 'selected' : ''}>${esc(s)}</option>`).join('');
  const body = document.createElement('div');
  body.innerHTML = html`<div class="steps"><span class="on">1. Make the prompt</span><span>2. Paste Claude's reply</span></div>
  <div class="builder">
    <div class="stack">
      <div class="field"><span>Source</span><div class="seg">
        <input type="radio" id="src-t" name="src" value="topic" checked><label for="src-t">📝 A topic</label>
        <input type="radio" id="src-a" name="src" value="attachment"><label for="src-a">📎 An attached file (PDF, ebook…)</label></div></div>
      <label class="field" id="f-topic"><span>Topic</span><input class="input" data-f="topic" placeholder="e.g. The water cycle, Volcanoes of Aotearoa"></label>
      <label class="field hidden" id="f-pages"><span>Pages / chapters to focus on</span><input class="input" data-f="pages" placeholder="e.g. pages 12–30, or chapters 3–4 (blank = whole file)"></label>
      <label class="field"><span>Curriculum</span><select class="select" data-f="curriculum" id="b-cur">${raw(curriculumOptions(ctx, f.curriculum))}</select></label>
      <label class="field"><span>Subject / learning area</span><select class="select" data-f="subject" id="b-subj">${raw(subjectOptions())}</select></label>
      <label class="field"><span id="b-lvl-label">${curOf(f.curriculum).levels || 'Year'} level / age</span><input class="input" data-f="yearLevel" id="b-lvl" value="${f.yearLevel}"></label>
      <div class="row" style="align-items:end">
        <label class="field" style="width:120px"><span>Questions</span><input class="input" type="number" min="5" max="50" data-f="count" value="20"></label>
        <label class="field" style="flex:1"><span>Difficulty</span><select class="select" data-f="difficulty"><option value="easy">Easy</option><option value="balanced" selected>Balanced</option><option value="challenging">Challenging</option></select></label>
      </div>
      <label class="field"><span>Question types</span><select class="select" data-f="types"><option value="mc">Multiple choice only</option><option value="mix">Mix in some True/False</option></select></label>
      <label class="field"><span>Extra focus (optional)</span><input class="input" data-f="focus" placeholder="learning intention, key vocab, a misconception…"></label>
    </div>
    <div class="stack">
      <div class="field"><span>Your prompt</span><textarea class="textarea mono prompt-out" id="prompt" readonly></textarea></div>
      <button class="btn big yellow" id="copy">📋 Copy prompt</button>
      <p class="hint" id="howto">Paste it into a <b>new Claude chat</b>. When Claude replies, copy its whole answer and come back for step 2.</p>
      <details><summary class="hint" style="cursor:pointer">Show the blank template (fill the [BRACKETS] yourself)</summary><textarea class="textarea mono" readonly style="min-height:200px">${TEMPLATE}</textarea></details>
    </div>
  </div>`;

  const update = () => {
    $('#f-topic', body).classList.toggle('hidden', f.source !== 'topic');
    $('#f-pages', body).classList.toggle('hidden', f.source !== 'attachment');
    $('#howto', body).innerHTML = f.source === 'attachment'
      ? 'Paste it into a <b>new Claude chat</b> and <b>attach your file</b> (📎) in that same message. When Claude replies, copy its whole answer and come back for step 2.'
      : 'Paste it into a <b>new Claude chat</b>. When Claude replies, copy its whole answer and come back for step 2.';
    $('#prompt', body).value = buildPrompt(f, subjectsFor(ctx.curricula, f.curriculum), curOf(f.curriculum));
  };
  body.addEventListener('input', (e) => { const k = e.target.dataset.f; if (k) { f[k] = e.target.value; update(); } });
  body.addEventListener('change', (e) => {
    if (e.target.name === 'src') f.source = e.target.value;
    const k = e.target.dataset.f; if (k) f[k] = e.target.value;
    if (k === 'curriculum') {
      rememberCurriculum(f.curriculum);
      f.subject = Object.keys(subjectsFor(ctx.curricula, f.curriculum))[0];
      $('#b-subj', body).innerHTML = subjectOptions();
      const c = curOf(f.curriculum);
      $('#b-lvl-label', body).textContent = `${c.levels || 'Year'} level / age`;
      if (!f.lvlEdited) { f.yearLevel = c.defaultLevel || f.yearLevel; $('#b-lvl', body).value = f.yearLevel; }
    }
    if (k === 'yearLevel') f.lvlEdited = true;
    update();
  });
  update();
  modal({
    title: '✨ Build with Claude', wide: true, body,
    buttons: [{ label: 'Close', value: null, cls: 'grey' }, { label: 'Next: paste the reply →', value: 'next', cls: 'blue' }],
    onOpen: (m) => {
      $('#copy', m).onclick = async () => {
        if (f.source === 'topic' && !f.topic.trim()) { toast('Type a topic first.', 'warn'); return; }
        await copyText($('#prompt', m).value); toast('Prompt copied! Paste it into Claude.', 'ok');
      };
    },
  }).then((v) => { if (v === 'next') openPaste(ctx, f); });
}

function openPaste(ctx, f = {}) {
  const body = document.createElement('div');
  body.innerHTML = `<div class="steps"><span>1. Make the prompt</span><span class="on">2. Paste Claude's reply</span></div>
    <div class="builder"><div class="stack">
      <textarea class="textarea mono" id="reply" style="min-height:340px" placeholder="Paste Claude's whole reply here…"></textarea>
      <button class="btn blue" id="check">🔍 Check questions</button>
      <p class="error-text" id="perr"></p></div>
    <div class="stack"><div class="field"><span>Preview</span><div class="preview-list" id="pv"><p class="hint">Questions will appear here.</p></div></div><p class="hint" id="psum"></p></div></div>`;
  let parsed = null;
  modal({
    title: '✨ Build with Claude', wide: true, body,
    buttons: [{ label: '← Back', value: 'back', cls: 'grey' }, { label: 'Open in editor & save', value: 'save' }],
    onOpen: (m) => {
      $('#check', m).onclick = () => {
        $('#perr', m).textContent = '';
        try {
          parsed = extractBank($('#reply', m).value);
          parsed.curriculum = f.curriculum || parsed.curriculum || 'nz';
          const cmap = subjectsFor(ctx.curricula, parsed.curriculum);
          if (f.subject && !cmap[parsed.subject]) parsed.subject = f.subject;
          const probs = bankProblems(parsed, cmap);
          const bad = new Map(probs.map((p) => [p.i, p.problems]));
          $('#pv', m).innerHTML = parsed.questions.map((q, i) => `<div class="pv ${bad.has(i) ? 'bad' : ''}"><b>${i + 1}. ${esc(q.q)}</b>
            <small>${q.options.map((o, j) => (j === q.correct ? `✔ <b>${esc(o)}</b>` : esc(o))).join(' · ')}</small>
            <small>💡 ${esc(q.explanation)} · <i>${esc(q.strand)}</i>${q.page ? ` · p.${esc(q.page)}` : ''}</small>
            ${bad.has(i) ? `<small class="error-text">⚠️ ${esc(bad.get(i).join(' · '))}</small>` : ''}</div>`).join('');
          $('#psum', m).textContent = `${parsed.questions.length} questions found · ${parsed.questions.length - bad.size} ready · ${bad.size} to fix (you can fix them in the editor).`;
        } catch (e) { parsed = null; $('#perr', m).textContent = e.message; }
      };
    },
  }).then((v) => {
    if (v === 'back') openBuilder(ctx);
    else if (v === 'save') {
      if (!parsed) { toast('Check the questions first.', 'warn'); openPaste(ctx, f); return; }
      ctx.go('edit', { ...parsed, id: null });
      toast('Review the questions, then press 💾 Save bank.', 'ok', 5000);
    }
  });
}

// ---------------- CSV ----------------
function openCsv(ctx) {
  const body = document.createElement('div');
  body.innerHTML = `<p class="hint">Columns: <span class="mono">question, optionA, optionB, optionC, optionD, correct (A–D), explanation, strand, difficulty (1–3), seconds</span>. A header row is fine. For True/False put True and False in optionA/optionB.</p>
    <input type="file" id="file" accept=".csv,text/csv" class="input">
    <p class="hint">…or paste the CSV text:</p><textarea class="textarea mono" id="csvtext" style="min-height:180px"></textarea>`;
  modal({
    title: '📄 Import CSV', wide: true, body,
    buttons: [{ label: 'Cancel', value: null, cls: 'grey' }, { label: 'Import', value: (m) => $('#csvtext', m).value }],
    onOpen: (m) => {
      $('#file', m).onchange = async (e) => { const file = e.target.files[0]; if (file) $('#csvtext', m).value = await file.text(); };
    },
  }).then((text) => {
    if (!text) return;
    const bank = parseCSV(text, { title: 'Imported bank', subject: Object.keys(ctx.strands)[0] });
    if (!bank.questions.length) { toast('No questions found in that CSV.', 'bad'); return; }
    ctx.go('edit', bank);
    toast(`${bank.questions.length} questions imported — check them, then Save.`, 'ok', 5000);
  });
}
