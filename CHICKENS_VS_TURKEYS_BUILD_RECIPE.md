# CHICKENS vs TURKEYS — Build Recipe

> **How to use this file:** Paste this whole file into a new Claude chat, then say:
> **"We are starting Phase X. Build only that phase."**
> When a phase passes its TEST GATE, start a new chat (or continue), paste this file again, and say which phase is next. Also paste any files from earlier phases that the new phase touches.

---

## 1. The Vision

**Chickens vs Turkeys** is a classroom quiz-battle platform that makes Blooket feel old. Teachers pick (or create) a question bank, launch a game, and students join on their own devices with a **code or QR code**. The **teacher/host screen is the main show**: it displays the live arena, team scores, individual standings, and dramatic events. Student devices are **controllers + question screens**.

Everything is **comic-book styled**: thick black outlines, halftone dots, big burst-shaped sound effects (SPLAT! BOK! BLAST!), screen shake, squash-and-stretch. Students should say "can we play Chickens vs Turkeys?" and never mention Blooket again.

**Two teams:** 🐔 Chickens (blue) vs 🦃 Turkeys (red). Students are auto-balanced onto teams. Everyone earns **individual points** and **team points**.

### Three game modes
| # | Mode | View | Core loop | Individual score |
|---|------|------|-----------|------------------|
| 1 | **Dodge Egg** | Top-down fake-3D arena, dodgeball layout | Answer questions → each correct answer = 1 egg of ammo. Move around your half to dodge, aim and throw eggs at the other team. 1-minute rounds. | Number of opponents you knock out |
| 2 | **Egg Cannon** | Side-scrolling, artillery/Worms-style | Answer 5 questions per round → each correct answer = 1 egg. Fire eggs from the bird's rear-end egg cannon using angle + power bar to wreck the enemy fort. | Number of enemy targets you destroy |
| 3 | **Egg Farm** | Fake-2D bird's-eye idle tycoon (Egg Inc style) | Each student runs their own farm on their device; questions give cash boosts; host screen shows the race. | Money earned |

Plus **Random Events** the teacher can trigger (or auto-trigger) in any mode.

---

## 2. Working Agreement (rules for Claude in every phase)

1. **Build only the phase requested.** Do not jump ahead. Finish it so it can be tested.
2. **No build step.** The site must run as plain static files on **GitHub Pages / Netlify**: HTML + CSS + vanilla JavaScript ES modules, libraries loaded from a CDN. I edit and upload through the **GitHub web UI**, so:
   - Give me **complete files** (never "rest of file unchanged"), with the exact **path/filename** above each file.
   - Keep each file focused and under ~800 lines where possible; split into modules.
   - Tell me exactly which files are new vs replaced.
3. **Placeholders first, art later.** Every sprite/background is loaded through one **asset manifest** (`/js/core/assets.js`). If an image file is missing, draw a coloured placeholder shape with a label so the game is still testable. Final art drops in by filename with zero code changes.
4. **Host-authoritative game logic.** The host (teacher) screen runs the simulation. Phones send inputs and receive only small state updates. Never trust a phone for scores beyond validated limits.
5. **Mobile-first for students**, **big-screen-first for the host** (design at 1920×1080, scale to fit).
6. **Performance:** must run on school Chromebooks/iPads and a classroom projector over school Wi-Fi. Throttle network writes (see §6).
7. **Kid-safe:** no student emails or personal data. Name filter + teacher kick/rename. Anonymous auth for students.
8. **No secrets in client code.** Firebase web config is fine to expose, but locked down with security rules. Any AI/API keys would need a Cloud Function (later phase only).
9. At the end of each phase give me: (a) what was built, (b) **a numbered test checklist**, (c) known limitations, (d) what Phase N+1 will need from me (e.g. art files).
10. Comic style is a **requirement**, not polish: use the shared CSS design tokens from Phase 1 everywhere.

---

## 3. Tech Stack (and why)

| Need | Choice | Notes |
|------|--------|-------|
| Hosting | **GitHub Pages** (or Netlify) | Static files only |
| Rendering | **PixiJS v7** via CDN (WebGL sprites, filters, particles) | Much smoother than raw canvas for lots of sprites |
| Physics (Egg Cannon) | **Matter.js** via CDN | Host simulates; deterministic enough for one screen |
| Backend | **Firebase Realtime Database** | Lower latency than Firestore for live game state. Free (Spark) plan allows **100 simultaneous connections** — fine for one class; upgrade to Blaze (pay-as-you-go, still cheap) if several classes play at once |
| Auth | Firebase Auth: **Google sign-in for teachers**, **Anonymous for students** | No student accounts |
| QR codes | `qrcode` library via CDN | Generated on host lobby screen |
| Audio | **Howler.js** via CDN | SFX + music with mute |
| Fonts | Google Fonts: **Bangers** (headings/comic), **Luckiest Guy** (burst words), **Nunito** (body) | |
| Language | Vanilla JS ES modules | Keeps GitHub-web-UI workflow simple |

---

## 4. Folder Structure

```
/index.html                 landing (Teacher / Join)
/teacher/index.html         dashboard (classes, question banks, create game)
/host/index.html            live host screen (lobby → arena → results)
/play/index.html            student join + controller (phone)
/css/tokens.css             colours, fonts, comic borders, halftone utilities
/css/ui.css                 buttons, panels, scoreboard, toasts
/js/core/firebase.js        init + helpers
/js/core/assets.js          asset manifest + placeholder fallback
/js/core/audio.js
/js/core/net.js             game session sync, throttling, presence
/js/core/teams.js           auto-balance, team colours
/js/core/fx.js              screen shake, squash/stretch, comic word pops, particles
/js/quiz/banks.js           CRUD, CSV import, premade banks
/js/quiz/engine.js          question selection, validation, streaks
/js/modes/dodge/host.js     arena sim + rendering
/js/modes/dodge/player.js   phone controller
/js/modes/cannon/host.js
/js/modes/cannon/player.js
/js/modes/farm/host.js      race board + events
/js/modes/farm/player.js    the actual farm game
/js/events/events.js        random events
/assets/...                 art (see §10)
/data/premade/*.json        starter question banks
/database.rules.json        Firebase rules (copy into console)
```

---

## 5. Firebase Setup & Data Model

### Setup steps (Phase 0 walks me through these)
1. Create Firebase project → add **Web app** → copy config into `/js/core/firebase.js`.
2. Enable **Authentication**: Google (teachers) + Anonymous (students).
3. Create **Realtime Database** (**Singapore (asia-southeast1)** — closest to NZ that Realtime Database offers).
4. Paste security rules (generated in Phase 2).
5. Add the GitHub Pages domain to Auth → Authorized domains.

### Data model (Realtime Database)
```
/teachers/{uid}/profile
/banks/premade/{bankId}                 read-only for everyone, written by me
/banks/user/{uid}/{bankId}              {title, subject, yearLevel, questions[]}
/codes/{CODE}                           -> gameId  (6-char, no confusing letters)
/games/{gameId}/meta                    {hostUid, mode, bankIds[], createdAt, status, rounds, roundSeconds}
/games/{gameId}/teams                   {chickens:{score}, turkeys:{score}}
/games/{gameId}/players/{uid}           {name, avatar, team, score, connected, joinedAt}
/games/{gameId}/state                   {phase, round, endsAt, eventId, ...}   (host writes, all read)
/games/{gameId}/inputs/{uid}            {mx,my,ax,ay,fire,seq}                 (phone writes ~12Hz, host reads)
/games/{gameId}/ammo/{uid}              {eggs, streak}                         (host writes)
/games/{gameId}/events/{eventId}        {type, startedAt, duration}
```
**Question schema**
```json
{ "q": "What is 12 × 6?", "options": ["54","60","66","72"], "correct": 3,
  "image": null, "seconds": 20, "tags": ["maths","year5"] }
```
Support: multiple choice (2–4 options), true/false. (Later: type-in answer.)

### Rules of thumb
- Students may only write to **their own** `/players/{uid}` (limited fields) and `/inputs/{uid}`.
- Only the host (`meta/hostUid`) writes `state`, `teams`, `ammo`.
- Game code lookup is public-read, host-write.
- Games auto-expire (host "End Game" deletes; optional cleanup later).

---

## 6. Network Architecture (keep it fast and cheap)

- **Host runs the simulation** at 60fps locally.
- **Phones → host:** joystick/aim input throttled to **~10–12 Hz**, and only when changed. Answers sent as single events.
- **Host → phones:** only tiny state: phase, countdown end timestamp (`endsAt`), their ammo, alive/knocked-out, score, current event. **Never** stream positions of everyone to phones.
- Use **server timestamps** for countdowns so devices stay in sync.
- Presence via `.info/connected` + `onDisconnect`. A phone that drops and rejoins with the same anonymous uid gets its player back.
- Host losing connection: show "Reconnecting…", pause sim.

---

## 7. Screens

### Teacher dashboard (`/teacher`)
Sidebar: Dashboard, My Classes, Question Banks, Games, Results, Settings. Big buttons: **Create Game**, **Question Banks**, **View Results**. Matches the concept sheet.
- Create Game flow: pick mode → pick bank(s) → rounds/time → **Launch** → opens `/host` with code.
- Question Bank: search, subject/year filter chips (Maths, English, Science, History, Geography, NZ Curriculum), **New Question**, **CSV import**, **Duplicate premade → edit**.

### Host screen (`/host`) — the main interface (16:9, projector friendly)
1. **Lobby:** huge join code, QR code, two team columns (Chickens left, Turkeys right) filling with avatar+name as students join, "Players are joining…", Start button, rename/kick.
2. **Arena:** mode-specific scene, top bar with team scores, centre timer, right-hand panel with individual standings + team standings, bottom teacher controls (Pause, Next Round, Random Event, Scores, End Game).
3. **Between rounds:** comic scoreboard slam-in.
4. **Final:** "CHICKENS TEAM WINS!" with trophy, top 3 podium, Play Again / View Results.

### Student phone (`/play`)
Join screen (code + name + avatar pick) → "You're a CHICKEN!" team reveal → mode controller → results/rank. Landscape-friendly but portrait must work.

---

## 8. Game Mode Specs

### 8.1 Dodge Egg (build first — it's the flagship)
**Arena:** logical size 1600×900, top-down fake-3D. Centre line splits Chicken half (left, blue) and Turkey half (right, red). Crowd/bleachers border. Players cannot cross the centre line.

**Round flow:** 3-2-1 countdown → **60 seconds** → end-of-round scoreboard (10s) → next round (teacher sets 1–5 rounds).

**Phone controller (two modes, toggle button, big and obvious):**
- **ANSWER tab:** current question, 2–4 big answer buttons. Correct = **+1 egg** (+ streak bonus: every 3 correct in a row = +1 bonus egg). Wrong = 2-second lockout, streak resets. Questions keep flowing for the whole round.
- **FIGHT tab:** left thumb **joystick** to move; right side **aim pad** — drag to set direction (aim arrow shown), release to throw. Ammo counter (🥚 × n, max carry 8) always visible. Auto-switch hint animation when ammo is available.
- *(Test option: also offer a "split screen" layout later.)*

**Sim rules (tunable constants in one `config.js`):**
- Move speed 220 px/s, player radius 28, egg radius 14, egg speed 650 px/s, egg lifetime until off-arena.
- Egg hit = player **knocked out** for **5 s** (dizzy stars, spin-out), then respawns at back of their half with 1.5 s shield. (Option: stay out for rest of round — teacher toggle.)
- Thrower gets **+1 individual point per knock-out**. Team score = sum of its members' points.
- No friendly fire. Eggs hitting the floor splat and fade.
- If a team is entirely knocked out → "CLEAN SWEEP" event, +5 team bonus, instant respawn.

**Fake-3D rendering (important):**
- Each bird = layered sprites: **shadow** (ground ellipse), **feet**, **body**, **wings**, **head+comb**, **tail**. Depth-sort by Y.
- Fake animation only: walking = squash/stretch + hop bob + slight rotation wobble; wing flap = scale/rotate wings; throw = wind-up squash then stretch; hit = knockback squish, spin, feather particles, dizzy stars.
- Eggs: scale up and shadow separates from the egg to fake an arc, slight spin.
- Camera: tiny screen shake on hits, zoom-punch on big events, parallax on the crowd.
- Comic pops: floating **SPLAT!/BOK!/OOF!** words with burst shapes at impact points.

### 8.2 Egg Cannon (artillery, side-scroll)
**World:** side-scrolling, ~3200px wide, parallax layers. Chicken fort on the left, Turkey fort on the right, a gap of hills between. Camera pans/zooms to follow volleys.

**Round flow (per round):**
1. **Answer phase:** 5 questions on phones (self-paced, ~90 s cap). Each correct = **1 egg**.
2. **Aim phase:** for each egg, the student sets **angle** (slider or drag) and **power** (oscillating power bar — tap to lock, tank-game style). Optional wind indicator.
3. **Fire phase:** the host plays volleys one at a time (fast, ~1.5 s each, skipping idle students), camera follows each egg. Shooter's name pops up above the cannon bird.
4. **Result:** points tallied, short comic scoreboard, next round (forts rebuild; teacher toggle for persistent damage).

**Mechanics:**
- Birds fire eggs from a **rear-end egg cannon** (cartoonish tail-feather barrel) — keep it silly and family-friendly (puff of feathers + "POP!").
- **Matter.js** world on the host: fort blocks (wood, crate, hay, glass, stone with different health), enemy **targets** (the opposing birds' perched dummies/trophies) that must be knocked out/destroyed.
- **Score:** 1 point per **target destroyed**, credited to the student whose egg last hit the chain that destroyed it. Optional +0.25 per block (teacher toggle off by default).
- Special eggs earned by streaks: Golden egg (bigger damage), Bomb egg (area damage), Splitter egg.

### 8.3 Egg Farm (idle tycoon)
**Phone = the game.** Each student has their own farm (fake-2D bird's-eye, like Egg Inc but in our comic style): coops, chickens/turkeys (their team bird), silo, egg machine, truck.
- Eggs auto-produce cash per second. Tap bird/coop for bonus eggs. Spend cash on upgrades (more birds, bigger coop, egg machine, truck, silo).
- **Questions** pop up regularly (or on a tap on a "Quiz Crate"): correct = cash bonus and temporary multiplier (e.g. ×2 for 20 s); wrong = small delay.
- **Score = total money earned** (not current balance, so spending doesn't hurt).
- **Host screen:** animated race board (all farms as mini-icons climbing a leaderboard), team totals as two giant piggy-bank/egg-pile meters, event announcements, top-3 podium at the end. Games last 5–15 min (teacher sets).
- Phone syncs `score` to Firebase every ~2 s with host-side sanity limit (max plausible income per second).

### 8.4 Random Events (all modes, host-triggered or auto every N minutes)
Examples: **Golden Egg Rush** (×2 points 20 s) · **Fox Raid** (a fox chases the leading team; answer a bonus question to save eggs) · **Egg Storm** (eggs rain on arena) · **Fog of Feathers** (reduced visibility) · **Team Swap!** (a few random players swap sides) · **Shield Up** (brief invincibility to the losing team — catch-up mechanic) · **Double Trouble** (everyone gets +2 eggs). Each event has a full-screen comic banner, a sound, and a duration. Events defined as data in `events.js`.

---

## 9. Question System Details
- Premade banks (JSON in `/data/premade/`): I'll provide a starter set; **NZ Curriculum** tags, Years 3–8, subjects: Maths, English, Science, History (NZ), Geography, General Knowledge, Reading Comprehension.
- **CSV import** columns: `question,optionA,optionB,optionC,optionD,correct(A-D),seconds`.
- Shuffle question order and answer order per student.
- Avoid repeats until the bank is exhausted, then reshuffle.
- **Later phase (optional):** "Generate questions with AI" via a Firebase Cloud Function so no API key lives in the browser.

---

## 10. Art Pipeline

- Art comes from the separate **IMAGE_PROMPTS.md** file (ChatGPT). I upload results into the chat; Claude slices/cleans them (green-screen removal), names them, and wires them into the manifest.
- **Asset manifest names** (the code expects these; placeholders drawn if missing):
```
assets/ui/logo.png            assets/ui/ui-kit.png (sliced)    assets/ui/burst-words.png
assets/ui/key-art.jpg         assets/ui/event-banners.png
assets/dodge/arena.jpg        assets/dodge/chicken-parts.png   assets/dodge/turkey-parts.png
assets/dodge/eggs-fx.png
assets/cannon/chicken-side.png  assets/cannon/turkey-side.png
assets/cannon/parallax-sky.png  parallax-far.png  parallax-mid.png  parallax-ground.png
assets/cannon/fort-blocks.png
assets/farm/ground.jpg        assets/farm/buildings.png
assets/avatars/avatars.png
assets/ui/icons-subjects.png
```
- Sprite sheets are cut into frames using a small JSON atlas that Claude generates after seeing each image.

---

## 11. Build Phases (each ends with a TEST GATE)

**Phase 0 — Repo + Firebase hello world**
Folder structure, `tokens.css` comic design system, Firebase config, a page that writes/reads a test value in Realtime DB.
✅ *Gate:* Page loads on GitHub Pages, value round-trips between two browser tabs.

**Phase 1 — Design system + static screens (no logic)**
Landing, teacher dashboard shell, question bank shell, student join screen, host lobby layout — all in comic style with placeholder art.
✅ *Gate:* All screens look right on a phone, a laptop, and the projector (1920×1080).

**Phase 2 — Auth, create game, join by code/QR, live lobby**
Google sign-in for teacher, create game → 6-char code + QR, students join anonymously, auto team balance, players appear live, kick/rename, security rules.
✅ *Gate:* Teacher on laptop + 3 phones: everyone joins by QR, names show on host, refresh/reconnect works.

**Phase 3 — Question banks**
CRUD, CSV import, premade starter banks, bank picker in Create Game.
✅ *Gate:* Import a CSV of 20 questions, edit one, select it for a game.

**Phase 4 — Quiz engine**
Question delivery to phones, answer validation, lockouts, streaks, per-player stats, host live feed (generic "answering" screen as the testing mode).
✅ *Gate:* 3+ phones answer; scores/streaks correct; timing synced.

**Phase 5 — Dodge Egg v1 (rectangles/placeholders)**
Arena sim, joystick + aim pad controller, ammo from answers, throws, hits, knock-out/respawn, 60 s round, individual + team scoring, scoreboard.
✅ *Gate:* 3v3 on real phones; hits register fairly; no lag on projector; scoring adds up.

**Phase 6 — Dodge Egg art + juice pass**
Drop in real art; layered birds, fake-3D animation, shadows, squash/stretch, particles, comic words, screen shake, crowd, SFX.
✅ *Gate:* "Wow" test — show it to a student.

**Phase 7 — Game flow, rounds, results, random events**
Multi-round flow, between-round scoreboard, final podium, random events system, teacher controls (pause/skip/end).
✅ *Gate:* Full 3-round game start to finish.

**Phase 8 — Egg Cannon v1 (placeholders)**
Side-scroll world, forts, Matter.js, 5-question phase, angle + power bar, volley playback, attribution + scoring.
✅ *Gate:* Full round with 4+ players, scores credited correctly.

**Phase 9 — Egg Cannon art + juice**
Parallax, cannon animation, destruction particles, camera work, special eggs.

**Phase 10 — Egg Farm v1**
Phone farm game loop, upgrades, quiz bonuses, score sync, host race board + team meters.
✅ *Gate:* 10-minute game, scores sync, no cheating via dev tools beyond sanity limits.

**Phase 11 — Egg Farm art + juice**

**Phase 12 — Polish & classroom hardening**
Music/SFX, mute, accessibility (colour-blind-safe team shapes/icons, big text option), name filter, teacher results/reports (per student accuracy), performance test on school devices, error states, tutorial/"how to play" overlays.

**Phase 13 — Extras (optional)**
More modes, AI question generation, avatar unlocks, class leaderboards across games, themed seasons (Halloween Turkeys!).

---

## 12. Starter Prompts (paste after this file)

**Phase 0:**
> We are starting **Phase 0**. Walk me through creating the Firebase project step by step (I'll use the web console), then give me the full files for the repo skeleton, `tokens.css`, `firebase.js` and a hello-world page that proves Realtime Database works. I'm deploying through the GitHub web UI to GitHub Pages.

**Any later phase:**
> We are starting **Phase N**. Here are my current files: [paste]. Build only this phase, give complete files with paths, then a numbered test checklist.

**Art phase:**
> We are starting **Phase 6**. Here are the art images I generated: [upload]. Slice them, remove the green background, name them to match the asset manifest, give me the atlas JSON, and wire them in.

**Bug report template:**
> Phase N test failed. Step: __. Device: __. Expected: __. Actual: __. Console error (if any): __.

---

## 13. Classroom Reality Checks
- Test with **real phones on school Wi-Fi** before showing students.
- Keep a **"Lite mode"** switch (fewer particles, no screen shake) for older Chromebooks.
- Teacher should always be able to **end/skip/pause** instantly.
- Teams must feel **fair**: auto-balance, and catch-up mechanics (Shield Up, comeback eggs) so the losing team never gives up.
