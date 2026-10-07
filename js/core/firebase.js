// =========================================================
// CHICKENS vs TURKEYS — Firebase setup
// 1. Paste YOUR config from the Firebase console into
//    firebaseConfig below (replace every PASTE_... value).
// 2. Make sure databaseURL is filled in — Realtime Database
//    will not work without it.
// This config is NOT a secret. The database is protected by
// the security rules in database.rules.json.
// =========================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, set, update, push, remove, get, onValue, off,
  runTransaction, serverTimestamp, onDisconnect,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyAQYAD5FBKQIeT86ZJq0SD04OlMAUz9Uvc",
  authDomain: "chickens-vs-turkeys.firebaseapp.com",
  databaseURL: "https://chickens-vs-turkeys-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chickens-vs-turkeys",
  storageBucket: "chickens-vs-turkeys.firebasestorage.app",
  messagingSenderId: "705277181435",
  appId: "1:705277181435:web:28e41e14854700adc31f5e"
};


/** true once the PASTE_ placeholders have been replaced */
export const isConfigured = !JSON.stringify(firebaseConfig).includes('PASTE_');

export let app = null;
export let auth = null;
export let db = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
}

/**
 * Signs in anonymously (students + test pages) and resolves with the user.
 * The same browser keeps the same anonymous uid between visits.
 */
export function ensureSignedIn() {
  if (!isConfigured) return Promise.reject(new Error('Firebase is not configured yet.'));
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) { stop(); resolve(user); }
    }, reject);
    if (!auth.currentUser) signInAnonymously(auth).catch((err) => { stop(); reject(err); });
  });
}

/** Turns a Firebase error into a plain-English hint for the setup screen. */
export function explainError(err) {
  const code = err?.code || '';
  const msg = err?.message || String(err);
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation')
    return 'Anonymous sign-in is switched off. Firebase console → Authentication → Sign-in method → enable Anonymous.';
  if (code === 'auth/unauthorized-domain')
    return 'This website address is not authorised. Firebase console → Authentication → Settings → Authorized domains → add it.';
  if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key' || msg.includes('api-key'))
    return 'The apiKey in js/core/firebase.js looks wrong. Copy the config again from Project settings.';
  if (msg.toUpperCase().includes('PERMISSION_DENIED'))
    return 'Permission denied — the security rules have not been pasted in yet. Realtime Database → Rules → paste database.rules.json → Publish.';
  if (msg.includes('Database URL') || msg.includes('databaseURL'))
    return 'databaseURL is missing or wrong in js/core/firebase.js. Copy it from the top of the Realtime Database → Data tab.';
  return msg;
}

// Re-export the database helpers so other files only import from here.
export {
  ref, set, update, push, remove, get, onValue, off,
  runTransaction, serverTimestamp, onDisconnect,
};
