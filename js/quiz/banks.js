// Question banks: premade (static JSON files) + teacher banks (Realtime Database).
import { db, ref, set, push, remove, get, onValue } from '../core/firebase.js?v=20261010134616';

const DATA = new URL('../../data/', import.meta.url).href;

let strandsCache = null;
export async function loadStrands() {
  if (strandsCache) return strandsCache;
  const res = await fetch(DATA + 'strands.json');
  const json = await res.json();
  delete json._note;
  strandsCache = json;
  return json;
}

let curriculaCache = null;
/** All curricula (data/curricula.json). New Zealand's subjects come from strands.json. */
export async function loadCurricula() {
  if (curriculaCache) return curriculaCache;
  const [res, nz] = await Promise.all([fetch(DATA + 'curricula.json'), loadStrands()]);
  const json = await res.json();
  delete json._note;
  for (const c of Object.values(json.curricula)) if (c.subjects === 'strands.json') c.subjects = nz;
  json.order = (json.order || Object.keys(json.curricula)).filter((id) => json.curricula[id]);
  curriculaCache = json;
  return json;
}
/** Subject → strands map for a curriculum (falls back to New Zealand). */
export function subjectsFor(curricula, id) {
  return (curricula?.curricula?.[id] || curricula?.curricula?.nz)?.subjects || {};
}

export async function listPremade() {
  const res = await fetch(DATA + 'premade/index.json');
  return res.json();
}
export async function getPremade(id) {
  const list = await listPremade();
  const item = list.find((b) => b.id === id);
  if (!item) throw new Error('Premade bank not found');
  const res = await fetch(DATA + 'premade/' + item.file);
  return normalizeBank({ ...(await res.json()), id, premade: true });
}

/** Live list of the teacher's own banks. cb([{id, ...bank}]) */
export function watchMyBanks(uid, cb) {
  return onValue(ref(db, `banks/${uid}`), (snap) => {
    const val = snap.val() || {};
    cb(Object.entries(val).map(([id, b]) => normalizeBank({ ...b, id })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
  });
}
export async function getMyBank(uid, id) {
  const snap = await get(ref(db, `banks/${uid}/${id}`));
  if (!snap.exists()) throw new Error('Bank not found');
  return normalizeBank({ ...snap.val(), id });
}
export async function saveBank(uid, bank) {
  const clean = stripForSave(bank);
  const id = bank.id && !bank.premade ? bank.id : push(ref(db, `banks/${uid}`)).key;
  await set(ref(db, `banks/${uid}/${id}`), { ...clean, updatedAt: Date.now() });
  return id;
}
export const deleteBank = (uid, id) => remove(ref(db, `banks/${uid}/${id}`));

/** Load a bank by "premade:ID" or "mine:ID". */
export async function loadBankByKey(uid, key) {
  const [kind, id] = key.split(':');
  return kind === 'premade' ? getPremade(id) : getMyBank(uid, id);
}

// ---------- shape + validation ----------
const asArray = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

export function normalizeQuestion(q, i = 0) {
  const type = q.type === 'tf' ? 'tf' : 'mc';
  let options = asArray(q.options).map((o) => String(o ?? '').trim());
  if (type === 'tf') options = ['True', 'False'];
  let correct = Number(q.correct);
  if (!Number.isInteger(correct)) correct = 0;
  return {
    id: q.id || `q${i + 1}`,
    type,
    q: String(q.q ?? q.question ?? '').trim(),
    options,
    correct,
    explanation: String(q.explanation ?? '').trim(),
    strand: String(q.strand ?? '').trim(),
    difficulty: [1, 2, 3].includes(Number(q.difficulty)) ? Number(q.difficulty) : 2,
    page: q.page === undefined || q.page === '' ? null : q.page,
    seconds: Number(q.seconds) > 4 ? Number(q.seconds) : 20,
    tags: asArray(q.tags).map(String),
  };
}

export function normalizeBank(b) {
  const questions = asArray(b.questions).map(normalizeQuestion);
  questions.forEach((q, i) => { q.id = `q${i + 1}`; });
  return {
    id: b.id,
    premade: !!b.premade,
    title: String(b.title || 'Untitled bank').trim(),
    curriculum: String(b.curriculum || 'nz'),
    subject: String(b.subject || 'General Knowledge'),
    yearLevels: asArray(b.yearLevels).map(Number).filter(Boolean),
    source: String(b.source || ''),
    strands: asArray(b.strands).map(String),
    questions,
    updatedAt: b.updatedAt || 0,
  };
}

function stripForSave(b) {
  const n = normalizeBank(b);
  return {
    cvtBank: 1,
    title: n.title, curriculum: n.curriculum, subject: n.subject, yearLevels: n.yearLevels, source: n.source,
    strands: [...new Set(n.questions.map((q) => q.strand).filter(Boolean))],
    questions: n.questions.map((q) => ({ ...q, page: q.page ?? '' })),
  };
}

/** Returns a list of problems for one question ([] = fine). */
export function questionProblems(q, allowedStrands = null) {
  const p = [];
  if (!q.q) p.push('Question text is empty');
  if (q.q.length > 200) p.push('Question is very long (keep under ~140 characters)');
  if (q.type === 'mc') {
    if (q.options.length !== 4) p.push('Needs exactly 4 options');
    if (q.options.some((o) => !o)) p.push('An option is empty');
    if (new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) p.push('Two options are the same');
    if (q.options.some((o) => o.length > 80)) p.push('An option is too long for a phone button');
  }
  if (!(q.correct >= 0 && q.correct < q.options.length)) p.push('Correct answer is not set');
  if (!q.explanation) p.push('Explanation is missing');
  if (!q.strand) p.push('Strand is missing');
  else if (allowedStrands && allowedStrands.length && !allowedStrands.includes(q.strand)) p.push(`Strand "${q.strand}" is not in the list for this subject`);
  return p;
}

export function bankProblems(bank, strandsMap) {
  const allowed = strandsMap?.[bank.subject] || null;
  const out = [];
  bank.questions.forEach((q, i) => {
    const p = questionProblems(q, allowed);
    if (p.length) out.push({ i, problems: p });
  });
  const seen = new Map();
  bank.questions.forEach((q, i) => {
    const k = q.q.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(k)) out.push({ i, problems: [`Duplicate of question ${seen.get(k) + 1}`] });
    else seen.set(k, i);
  });
  return out;
}

// ---------- CSV ----------
function csvRows(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/** CSV columns: question,optionA,optionB,optionC,optionD,correct(A-D),explanation,strand,difficulty,seconds */
export function parseCSV(text, meta = {}) {
  const rows = csvRows(text.trim());
  if (rows.length && /question/i.test(rows[0][0])) rows.shift();
  const questions = rows.map((r) => {
    const [q, a, b, c, d, correct, explanation, strand, difficulty, seconds] = r.map((x) => (x ?? '').trim());
    const isTF = !c && !d && /^(true|false)$/i.test(a) && /^(true|false)$/i.test(b);
    const letter = (correct || 'A').toUpperCase();
    let idx = 'ABCD'.indexOf(letter);
    if (isTF) idx = /^t/i.test(letter) ? 0 : /^f/i.test(letter) ? 1 : idx;
    return { type: isTF ? 'tf' : 'mc', q, options: isTF ? ['True', 'False'] : [a, b, c, d], correct: Math.max(0, idx), explanation, strand, difficulty, seconds };
  });
  return normalizeBank({ title: meta.title || 'Imported bank', subject: meta.subject || 'General Knowledge', questions });
}

export function toCSV(bank) {
  const cell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = 'question,optionA,optionB,optionC,optionD,correct,explanation,strand,difficulty,seconds';
  return [head, ...bank.questions.map((q) => [q.q, ...[0, 1, 2, 3].map((i) => q.options[i] || ''), 'ABCD'[q.correct], q.explanation, q.strand, q.difficulty, q.seconds].map(cell).join(','))].join('\n');
}
