// Loaded on its own (before the big game code) so the student is already
// signed in and connected by the time they finish typing their name.
import { ensureSignedIn, db, ref, get } from '../js/core/firebase.js?v=20261022152810';

ensureSignedIn().then(() => {
  // open the database connection now, so JOIN doesn't have to wait for it
  get(ref(db, '.info/serverTimeOffset')).catch(() => {});
}).catch(() => {});
