// Creating games + join codes.
import { db, ref, set, get, push, runTransaction, serverTimestamp } from './firebase.js?v=20261010134958';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const randomCode = (n = 6) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export const DEFAULT_SETTINGS = {
  rounds: 3,
  roundSeconds: 60,
  confidence: 'every', // every | third | off
  koMode: 'respawn',   // respawn | out
  events: 'auto',      // auto | manual | off
  growth: 'auto',      // Coop Wars: auto | questions | slow
  landLayout: 'split', // Land Grab: split (chickens left, turkeys right) | mixed (scattered)
  teams: 'choose',     // choose = students pick Chickens or Turkeys when joining · auto = balanced automatically
};

/** Creates /games/{id} and a unique /codes/{CODE}. Returns { gameId, code }. */
export async function createGame(user, { bankKey, bank, mode = 'dodge', settings = {} }) {
  const gameId = push(ref(db, 'games')).key;
  let code = null;
  for (let tries = 0; tries < 8 && !code; tries++) {
    const c = randomCode();
    const res = await runTransaction(ref(db, `codes/${c}`), (cur) => (cur === null ? { g: gameId, host: user.uid, at: Date.now() } : undefined));
    if (res.committed) code = c;
  }
  if (!code) throw new Error('Could not make a join code — please try again.');
  await set(ref(db, `games/${gameId}/meta`), {
    hostUid: user.uid,
    code,
    mode,
    bankKey,
    bankTitle: bank.title,
    bankSubject: bank.subject,
    questionCount: bank.questions.length,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    createdAt: serverTimestamp(),
    status: 'lobby',
  });
  await set(ref(db, `games/${gameId}/state`), { phase: 'lobby', round: 0 });
  return { gameId, code };
}

/** Student side: CODE -> gameId (or null). */
export async function lookupCode(code) {
  const snap = await get(ref(db, `codes/${cleanCode(code)}`));
  return snap.exists() ? snap.val().g : null;
}

export function playUrl(code) {
  const u = new URL('../../play/', import.meta.url);
  if (code) u.searchParams.set('code', code);
  return u.href;
}
