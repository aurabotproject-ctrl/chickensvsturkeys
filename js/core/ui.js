// Small DOM helpers shared by every page.
const LOAD_EGG = new URL('../../assets/sprites/egg.webp', import.meta.url).href;
/** Full-screen (or inside `parent`) "LOADING…" screen with a spinning egg. Returns a function that removes it. */
export function showLoading(sub = '', parent = null) {
  const el = document.createElement('div');
  el.className = `loading-screen${parent ? ' inline' : ''}`;
  el.innerHTML = `<img class="egg" src="${LOAD_EGG}" alt=""><b>LOADING…</b>${sub ? `<small>${sub}</small>` : ''}`;
  (parent || document.body).appendChild(el);
  return () => el.remove();
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Tiny template helper: html`<b>${x}</b>` escapes ${} values unless wrapped in raw(). */
export function raw(s) { return { __raw: String(s) }; }
export function html(strings, ...vals) {
  return strings.reduce((out, str, i) => {
    if (i >= vals.length) return out + str;
    const v = vals[i];
    const s = Array.isArray(v) ? v.map((x) => (x && x.__raw !== undefined ? x.__raw : esc(x))).join('')
      : v && v.__raw !== undefined ? v.__raw : esc(v);
    return out + str + s;
  }, '');
}

let toastWrap;
export function toast(msg, kind = 'info', ms = 3200) {
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.className = 'toasts';
    document.body.appendChild(toastWrap);
  }
  const t = document.createElement('div');
  t.className = `toast ${kind} anim-pop`;
  t.textContent = msg;
  toastWrap.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

/** Promise-based modal. buttons: [{label, value, cls}] → resolves with value (null if closed). */
export function modal({ title = '', body = '', buttons = [{ label: 'OK', value: true, cls: '' }], wide = false, onOpen } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal panel light anim-pop ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <button class="modal-x" aria-label="Close">✕</button>
      ${title ? `<h2 class="modal-title">${esc(title)}</h2>` : ''}
      <div class="modal-body"></div>
      <div class="modal-actions row"></div></div>`;
    const bodyEl = back.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    back.querySelector('.modal-x').onclick = () => close(null);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
    const actions = back.querySelector('.modal-actions');
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = `btn ${b.cls || ''}`;
      btn.textContent = b.label;
      btn.onclick = () => close(typeof b.value === 'function' ? b.value(back) : b.value);
      actions.appendChild(btn);
    });
    document.body.appendChild(back);
    onOpen?.(back, close);
  });
}

export function confirmBox(message, okLabel = 'Yes', cls = 'red') {
  return modal({ body: `<p class="modal-msg">${esc(message)}</p>`, buttons: [{ label: 'Cancel', value: false, cls: 'grey' }, { label: okLabel, value: true, cls }] });
}

export function promptBox(title, value = '', placeholder = '') {
  return modal({
    title,
    body: `<input class="input" id="prompt-input" maxlength="40" value="${esc(value)}" placeholder="${esc(placeholder)}">`,
    buttons: [{ label: 'Cancel', value: null, cls: 'grey' }, { label: 'Save', value: (m) => m.querySelector('#prompt-input').value.trim() }],
    onOpen: (m) => { const i = m.querySelector('#prompt-input'); i.focus(); i.select(); },
  });
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); ta.remove();
  return Promise.resolve();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const params = new URLSearchParams(location.search);
