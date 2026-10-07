# Chickens vs Turkeys — Phase 0 setup

Phase 0 goal: the site is live on GitHub Pages and the **Coop Check** page (`/hello/`) proves Firebase works across two devices.

Total time: about 20 minutes.

---

## Part A — Create the Firebase project (web console)

1. Go to **https://console.firebase.google.com** and sign in with the Google account you want to own the app.
2. Click **Create a project** (or **Add project**).
   - Name: `chickens-vs-turkeys` → Continue.
   - Google Analytics: **turn it off** (not needed) → **Create project** → wait → **Continue**.

### A1. Create the Realtime Database *first*
Do this before registering the web app so the config you copy later already includes `databaseURL`.

3. Left menu → **Build → Realtime Database** → **Create Database**.
4. Location: **Singapore (asia-southeast1)** — the closest to NZ. → Next.
5. Choose **Start in locked mode** → **Enable**.
6. At the top of the **Data** tab you'll see a URL like
   `https://chickens-vs-turkeys-default-rtdb.asia-southeast1.firebasedatabase.app` — that's your **databaseURL**. Keep this tab open.

### A2. Paste the security rules
7. Still in Realtime Database, click the **Rules** tab.
8. Delete everything there, paste the full contents of **`database.rules.json`** from this folder, click **Publish**.
   (These only allow signed-in users to touch the `/hello` test area. Everything else stays locked. Each phase will give you an updated rules file.)

### A3. Turn on sign-in
9. Left menu → **Build → Authentication** → **Get started**.
10. **Sign-in method** tab:
    - **Anonymous** → Enable → Save. (Students and the test page use this.)
    - **Google** → Enable → choose your support email → Save. (Teachers, used from Phase 2.)
11. **Settings** tab → **Authorized domains** → **Add domain** → type `YOUR-GITHUB-USERNAME.github.io` (no `https://`, no folder) → Add.

### A4. Register the web app and copy the config
12. Click the ⚙️ gear next to **Project Overview** → **Project settings**.
13. Scroll to **Your apps** → click the **`</>`** (Web) icon.
    - Nickname: `cvt-web`. **Don't** tick Firebase Hosting (we use GitHub Pages). → **Register app**.
14. You'll see a code block with `const firebaseConfig = { ... }`. Copy just the values.
    You can always find it again in Project settings → Your apps → **SDK setup and configuration → Config**.
15. Check it contains a `databaseURL` line. If it doesn't, add it yourself using the URL from step 6.

---

## Part B — Put your config into the code

16. Open **`js/core/firebase.js`** and replace each `PASTE_...` value with yours. It should end up looking like:

```js
const firebaseConfig = {
  apiKey: 'AIzaSy...your key...',
  authDomain: 'chickens-vs-turkeys.firebaseapp.com',
  databaseURL: 'https://chickens-vs-turkeys-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'chickens-vs-turkeys',
  storageBucket: 'chickens-vs-turkeys.appspot.com',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123',
};
```

> It's fine for this config to be public on GitHub — it identifies the project, it doesn't unlock it. The **rules** are what keep the database safe.

You can do this edit on your Mac before uploading, or afterwards with the ✏️ pencil on GitHub.

---

## Part C — Upload to GitHub and switch on Pages

17. On GitHub → **New repository** → name `chickensvsturkeys` → **Public** → tick **Add a README** → **Create repository**.
18. **Add file → Upload files**. In Finder, open this `chickensvsturkeys` folder, select **everything inside it** (`css`, `js`, `hello`, `index.html`, `database.rules.json`, the `.md` files) and drag it onto the GitHub page. Folders keep their structure. → **Commit changes**.
    - Check on GitHub that you see `css/tokens.css`, `js/core/firebase.js` and `hello/index.html` in those exact folders.
19. Repo **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → **Save**.
20. Wait 1–2 minutes. Your site will be at
    `https://YOUR-GITHUB-USERNAME.github.io/chickensvsturkeys/`
    and the test page at
    `https://YOUR-GITHUB-USERNAME.github.io/chickensvsturkeys/hello/`

> Pages must be opened through that web address — double-clicking `index.html` on your Mac won't work because the code uses JavaScript modules.

---

## Phase 0 TEST GATE ✅

Open `.../chickensvsturkeys/hello/` and check:

1. Landing page (`/chickensvsturkeys/`) shows the comic **CHICKENS VS TURKEYS** title with the Bangers font.
2. On the Coop Check page, all four checklist tags are green: **Config pasted · Signed in · Connected · Read + write**.
3. Tap **TAP! 🥚** → the egg number goes up with a squash and a **BOK!**
4. Open the same page on your **phone** (or a second browser). Tap on one device → the number updates on the other within a second.
5. **Devices online** shows one bird per open tab/phone. Close one tab → its bird disappears within a few seconds.
6. **Send ping** on school Wi-Fi → note the ms. Under 300 ms = ready for live games.
7. In the Firebase console → Realtime Database → **Data**, you can see `hello/counter`, `hello/ping` and `hello/visitors` changing live.

### If something is red
| Message | Fix |
|---|---|
| Config pasted: NO | `PASTE_` values still in `js/core/firebase.js` |
| Anonymous sign-in is switched off | Step 10 |
| Not authorised domain | Step 11 |
| Permission denied | Step 8 — rules not published |
| databaseURL missing/wrong | Step 15 |
| Page is blank / unstyled | Files aren't in the right folders on GitHub (step 18), or Pages hasn't finished building yet |

Still stuck? Open the page, press **⌥⌘J** (Chrome) / **⌥⌘C** (Safari) to open the console, and paste the red error into the chat.

---

## What's in this folder

```
chickensvsturkeys/
├─ index.html                      landing page (placeholder)
├─ hello/index.html + hello.js     Coop Check — Firebase test page
├─ css/tokens.css                  colours, fonts, comic panels/buttons/bursts
├─ js/core/firebase.js             Firebase setup (paste your config here)
├─ database.rules.json             paste into Realtime Database → Rules
├─ CHICKENS_VS_TURKEYS_BUILD_RECIPE.md
└─ CHICKENS_VS_TURKEYS_IMAGE_PROMPTS.md
```

**Next:** Phase 1 — design system + static screens (landing, teacher dashboard, question bank, student join, host lobby).
