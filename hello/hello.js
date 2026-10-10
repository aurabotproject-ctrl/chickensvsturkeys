// Phase 0 hello-world: proves auth + Realtime Database + presence work.
import {
  isConfigured, db, ensureSignedIn, explainError,
  ref, set, onValue, push, runTransaction, serverTimestamp, onDisconnect,
} from '../js/core/firebase.js?v=20261010181753';

window.__cvtStarted = true; // tells the fallback timer in index.html the code loaded

const $ = (id) => document.getElementById(id);

function mark(id, ok, text) {
  const el = $(id);
  el.className = 'tag ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'warn');
  el.textContent = text;
}

function showError(err) {
  console.error(err);
  $('error-text').textContent = explainError(err);
  $('error-box').classList.remove('hidden');
}

function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // restart CSS animation
  el.classList.add(cls);
}

async function start() {
  if (!isConfigured) {
    mark('c-config', false, 'NO');
    ['c-auth', 'c-conn', 'c-rw'].forEach((id) => mark(id, null, 'waiting'));
    $('setup').classList.remove('hidden');
    return;
  }
  mark('c-config', true, 'YES');

  // 1. Sign in anonymously
  let user;
  try {
    user = await ensureSignedIn();
    mark('c-auth', true, 'YES');
    $('uid').textContent = user.uid.slice(0, 10) + '…';
  } catch (err) {
    mark('c-auth', false, 'NO');
    showError(err);
    return;
  }

  // 2. Connection status (special Firebase path)
  onValue(ref(db, '.info/connected'), (snap) => {
    const on = snap.val() === true;
    mark('c-conn', on, on ? 'ONLINE' : 'OFFLINE');
  });
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    $('offset').textContent = `${Math.round(snap.val() || 0)} ms`;
  });

  // 3. Read/write test + shared counter
  const counterRef = ref(db, 'hello/counter');
  onValue(counterRef, (snap) => {
    $('egg').textContent = snap.val() ?? 0;
    retrigger($('egg'), 'anim-squash');
    mark('c-rw', true, 'YES');
    ['tap', 'reset', 'ping'].forEach((id) => { $(id).disabled = false; });
  }, (err) => { mark('c-rw', false, 'NO'); showError(err); });

  $('tap').addEventListener('click', async () => {
    const splat = $('splat');
    splat.classList.remove('hidden');
    retrigger(splat, 'anim-pop');
    clearTimeout(splat._t);
    splat._t = setTimeout(() => splat.classList.add('hidden'), 500);
    try { await runTransaction(counterRef, (n) => (n || 0) + 1); }
    catch (err) { showError(err); }
  });

  $('reset').addEventListener('click', () => set(counterRef, 0).catch(showError));

  // 4. Round-trip ping (the set() promise resolves when the SERVER confirms)
  const pingRef = ref(db, 'hello/ping');
  $('ping').addEventListener('click', async () => {
    const t0 = performance.now();
    try {
      await set(pingRef, { by: user.uid, at: serverTimestamp(), device: navigator.userAgent.includes('Mobile') ? 'phone' : 'computer' });
      const ms = Math.round(performance.now() - t0);
      const verdict = ms < 150 ? 'Lightning fast! ⚡' : ms < 300 ? 'Game ready ✅' : ms < 600 ? 'OK-ish 🐢' : 'Slow — check Wi-Fi 🐌';
      $('ping-out').innerHTML = `Round trip: <b>${ms} ms</b> — ${verdict}`;
    } catch (err) { showError(err); }
  });
  onValue(pingRef, (snap) => {
    const p = snap.val();
    if (!p || typeof p.at !== 'number') return;
    const who = p.by === user.uid ? 'you' : 'another device';
    $('last-ping').textContent = `${new Date(p.at).toLocaleTimeString()} from ${who} (${p.device})`;
  });

  // 5. Presence: one entry per open tab, removed automatically on disconnect
  const birds = ['🐔', '🦃', '🐣', '🐓', '🐥', '🥚'];
  const visitorsRef = ref(db, 'hello/visitors');
  const me = push(visitorsRef);
  onValue(ref(db, '.info/connected'), async (snap) => {
    if (snap.val() !== true) return;
    try {
      // Write first, THEN register the auto-remove: the rules only allow removing
      // an entry that already exists and belongs to you.
      await set(me, { uid: user.uid, at: serverTimestamp(), bird: birds[Math.floor(Math.random() * birds.length)] });
      await onDisconnect(me).remove();
    } catch (err) { showError(err); }
  });
  onValue(visitorsRef, (snap) => {
    const list = Object.entries(snap.val() || {});
    $('devices').innerHTML = list.map(([k, v]) =>
      `<span title="${k === me.key ? 'this tab' : 'another tab'}">${v.bird || '🐔'}</span>`).join('');
    $('device-count').textContent = `${list.length} online`;
  });
}

start();
