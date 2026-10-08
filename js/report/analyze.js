// Turns a saved game result into class / strand / student / question analytics.
// Pure functions — no Firebase — so it's easy to test.

export const CATS = {
  mastered: { label: 'Mastered', conf: 'sure', correct: true },
  blind: { label: 'Blind spot', conf: 'sure', correct: false },
  fragile: { label: 'Fragile', conf: 'think', correct: true },
  developing: { label: 'Developing', conf: 'think', correct: false },
  lucky: { label: 'Lucky guess', conf: 'guess', correct: true },
  aware: { label: 'Knows they don\'t know', conf: 'guess', correct: false },
};

export function classify(conf, correct) {
  if (conf === 'sure') return correct ? 'mastered' : 'blind';
  if (conf === 'think') return correct ? 'fragile' : 'developing';
  if (conf === 'guess') return correct ? 'lucky' : 'aware';
  return correct ? 'unratedRight' : 'unratedWrong';
}

export const level = (pct) => (pct == null ? null : pct >= 80 ? 'm' : pct >= 50 ? 'd' : 'n');
export const LEVEL_TEXT = { m: 'Mastered', d: 'Developing', n: 'Needs support' };
export const SYM = { m: '✔', d: '~', n: '✖' };
const e = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (c, a) => (a ? Math.round((c / a) * 100) : null);
const vals = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

export function analyze(result) {
  const questions = vals(result.bank?.questions);
  const qById = new Map(questions.map((q) => [q.id, { ...q, options: vals(q.options) }]));
  const strands = [...new Set(questions.map((q) => q.strand || 'General'))];
  const players = Object.entries(result.players || {}).filter(([, p]) => !p.bot).map(([uid, p]) => ({ uid, ...p }));
  const answersBy = result.answers || {};

  const emptyCats = () => ({ mastered: 0, blind: 0, fragile: 0, developing: 0, lucky: 0, aware: 0, unratedRight: 0, unratedWrong: 0 });
  const classCats = emptyCats();
  const strandStats = Object.fromEntries(strands.map((s) => [s, { a: 0, c: 0, blind: 0 }]));
  const qStats = new Map(questions.map((q) => [q.id, { asked: 0, correct: 0, blind: 0, sure: 0, choices: vals(q.options).map(() => 0), none: 0, choosers: vals(q.options).map(() => []), ms: 0 }]));
  let totalA = 0; let totalC = 0; let totalMs = 0;

  const students = players.map((p) => {
    const list = vals(answersBy[p.uid]);
    const s = { uid: p.uid, name: p.name || '?', team: p.team, score: p.score || 0, a: 0, c: 0, ms: 0, cats: emptyCats(), strands: Object.fromEntries(strands.map((x) => [x, { a: 0, c: 0 }])), blindQs: [] };
    for (const ans of list) {
      const q = qById.get(ans.qid); if (!q) continue;
      const st = q.strand || 'General';
      const cat = classify(ans.conf, !!ans.correct);
      s.a += 1; s.c += ans.correct ? 1 : 0; s.ms += ans.ms || 0;
      s.cats[cat] += 1; classCats[cat] += 1;
      s.strands[st].a += 1; s.strands[st].c += ans.correct ? 1 : 0;
      strandStats[st].a += 1; strandStats[st].c += ans.correct ? 1 : 0;
      if (cat === 'blind') { strandStats[st].blind += 1; if (!s.blindQs.includes(q.id)) s.blindQs.push(q.id); }
      const qs = qStats.get(q.id);
      qs.asked += 1; qs.correct += ans.correct ? 1 : 0; qs.ms += ans.ms || 0;
      if (ans.conf === 'sure') qs.sure += 1;
      if (cat === 'blind') qs.blind += 1;
      if (Number.isInteger(ans.choice) && ans.choice >= 0 && ans.choice < qs.choices.length) {
        qs.choices[ans.choice] += 1;
        if (!ans.correct && !qs.choosers[ans.choice].includes(s.name)) qs.choosers[ans.choice].push(s.name);
      } else qs.none += 1;
    }
    totalA += s.a; totalC += s.c; totalMs += s.ms;
    s.acc = pct(s.c, s.a);
    s.blind = s.cats.blind;
    s.lucky = s.cats.lucky;
    const rated = s.cats.mastered + s.cats.blind + s.cats.fragile + s.cats.developing + s.cats.lucky + s.cats.aware;
    // Calibration: how often confidence matched the result (Sure→right, Guessing→wrong; Think so counts half).
    s.rated = rated;
    s.calibration = rated ? Math.round(((s.cats.mastered + s.cats.aware + 0.5 * (s.cats.fragile + s.cats.developing)) / rated) * 100) : null;
    const confScore = { sure: 3, think: 2, guess: 1 };
    const cs = list.filter((x) => confScore[x.conf]).map((x) => confScore[x.conf]);
    s.avgConf = cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : null;
    s.strandPct = Object.fromEntries(strands.map((x) => [x, pct(s.strands[x].c, s.strands[x].a)]));
    return s;
  });

  const strandRows = strands.map((st) => ({ strand: st, ...strandStats[st], pct: pct(strandStats[st].c, strandStats[st].a), blindPct: pct(strandStats[st].blind, strandStats[st].a) }));
  const qRows = questions.map((q) => {
    const st = qStats.get(q.id);
    const opts = vals(q.options);
    let common = -1; let max = 0;
    st.choices.forEach((n, i) => { if (i !== q.correct && n > max) { max = n; common = i; } });
    return {
      ...q, options: opts, ...st,
      pct: pct(st.correct, st.asked),
      blindPct: pct(st.blind, st.sure),
      avgMs: st.asked ? Math.round(st.ms / st.asked) : null,
      common, commonCount: max,
    };
  });

  // Teaching priorities: weakest strands, then questions with the most confident-but-wrong answers.
  const priorities = [];
  strandRows.filter((r) => r.a >= 3 && r.pct < 80).sort((a, b) => a.pct - b.pct).slice(0, 2)
    .forEach((r) => priorities.push(`<b>${e(r.strand)}</b> — class got ${r.pct}% right${r.blind ? ` (${r.blind} confident-but-wrong answers)` : ''}.`));
  qRows.filter((q) => q.blind >= 2).sort((a, b) => b.blind - a.blind).slice(0, 3 - Math.min(priorities.length, 2))
    .forEach((q) => priorities.push(`Misconception check: “${e(q.q)}” — ${q.blind} students were <b>sure</b> but wrong${q.common >= 0 ? `; most picked “${e(q.options[q.common])}”` : ''}.`));
  if (priorities.length < 3) {
    qRows.filter((q) => q.asked >= 2 && q.pct < 60 && !priorities.some((p) => p.includes(e(q.q)))).sort((a, b) => a.pct - b.pct).slice(0, 3 - priorities.length)
      .forEach((q) => priorities.push(`Re-teach: “${e(q.q)}” — only ${q.pct}% correct.`));
  }

  return {
    students, strands, strandRows, qRows, classCats, priorities,
    total: { answered: totalA, correct: totalC, acc: pct(totalC, totalA), avgMs: totalA ? Math.round(totalMs / totalA) : null, students: students.length, questionsUsed: qRows.filter((q) => q.asked).length },
  };
}

export function toCSV(result, A) {
  const cell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const qById = new Map(A.qRows.map((q) => [q.id, q]));
  const rows = [['student', 'team', 'question', 'strand', 'difficulty', 'chosen', 'correct_answer', 'correct', 'confidence', 'category', 'seconds', 'round']];
  for (const s of A.students) {
    for (const a of vals(result.answers?.[s.uid])) {
      const q = qById.get(a.qid); if (!q) continue;
      rows.push([s.name, s.team, q.q, q.strand, q.difficulty, q.options[a.choice] ?? '(no answer)', q.options[q.correct], a.correct ? 'yes' : 'no', a.conf || '', classify(a.conf, a.correct), ((a.ms || 0) / 1000).toFixed(1), a.round]);
    }
  }
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}
