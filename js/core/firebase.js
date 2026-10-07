// =========================================================
// CHICKENS vs TURKEYS — Firebase setup (shared by every page)
// The config below is NOT a secret. The database is protected
// by the rules in database.rules.json.
//
// Pages that are used by STUDENTS put  data-auth="student"  on
// <html>. They sign in anonymously and the sign-in only lasts
// for that browser tab, so every tab/device is its own player.
// Teacher/host pages sign in with Google and stay signed in.
// =========================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, initializeAuth, signInAnonymously, onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup, browserSessionPersistence, browserPopupRedirectResolver,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, child, set, update, push, remove, get, onValue, off,
  onChildAdded, onChildChanged, onChildRemoved,
  runTransaction, serverTimestamp, onDisconnect,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAQYAD5FBKQIeT86ZJq0SD04OlMAUz9Uvc',
  authDomain: 'chickens-vs-turkeys.firebaseapp.com',
  databaseURL: 'https://chickens-vs-turkeys-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'chickens-vs-turkeys',
  storageBucket: 'chickens-vs-turkeys.firebasestorage.app',
  messagingSenderId: '705277181435',
  appId: '1:705277181435:web:28e41e14854700adc31f5e',
};

/** true once the PASTE_ placeholders have been replaced */
export const isConfigured = !JSON.stringify(firebaseConfig).includes('PASTE_');
const isStudentPage = document.documentElement.dataset.auth === 'student';

export let app = null;
export let auth = null;
export let db = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = isStudentPage
    ? initializeAuth(app, { persistence: browserSessionPersistence, popupRedirectResolver: browserPopupRedirectResolver })
    : getAuth(app);
  db = getDatabase(app);
}

/** Resolves with the current user (or null) once Firebase has checked. */
export function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (u) => { stop(); resolve(u); });
  });
}

/** Calls cb(user|null) now and whenever sign-in changes. */
export function watchUser(cb) { return onAuthStateChanged(auth, cb); }

/** Students + test pages: anonymous sign-in (one player per tab). */
export async function ensureSignedIn() {
  if (!isConfigured) throw new Error('Firebase is not configured yet.');
  const u = await currentUser();
  if (u) return u;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

/** Teachers: Google sign-in popup. */
export async function signInTeacher() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}
export function signOutUser() { return signOut(auth); }
export function isTeacher(user) { return !!user && !user.isAnonymous; }

/** Milliseconds to add to Date.now() to get Firebase server time. */
let serverOffset = 0;
if (isConfigured) onValue(ref(db, '.info/serverTimeOffset'), (s) => { serverOffset = s.val() || 0; });
export const serverNow = () => Date.now() + serverOffset;

/** Turns a Firebase error into a plain-English hint. */
export function explainError(err) {
  const code = err?.code || '';
  const msg = err?.message || String(err);
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation')
    return 'That sign-in method is switched off. Firebase console → Authentication → Sign-in method → enable Anonymous and Google.';
  if (code === 'auth/unauthorized-domain')
    return 'This website address is not authorised. Firebase console → Authentication → Settings → Authorized domains → add it.';
  if (code === 'auth/popup-blocked') return 'The sign-in popup was blocked. Allow popups for this site and try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
  if (code === 'auth/network-request-failed') return 'Network problem — check the internet connection.';
  if (msg.toUpperCase().includes('PERMISSION_DENIED'))
    return 'Permission denied by the database rules. Make sure the latest database.rules.json is pasted into Realtime Database → Rules → Publish.';
  return msg;
}

export {
  ref, child, set, update, push, remove, get, onValue, off,
  onChildAdded, onChildChanged, onChildRemoved,
  runTransaction, serverTimestamp, onDisconnect,
};
