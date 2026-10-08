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

And for the teacher: **Build with Claude** question banks (copy a prompt → paste the reply back, works with PDFs/ebooks and page ranges) and a printable **Master Teacher Diagnostic** after every game — strand mastery, student accuracy, and confidence-vs-competence blind spots.

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
/js/quiz/promptBuilder.js   Build with Claude: prompt template + paste-back parser/validator
/js/report/report.js        Master Teacher Print Diagnostic (analytics + rendering)
/css/print.css              A4 @media print styles
/teacher/report.html        report page (opens from final screen or Teacher → Results)
/data/strands.json          NZ Curriculum strand lists per learning area
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
/games/{gameId}/current/{uid}           {qid, options[], shownAt}              (host writes the question to each phone — NO answer key)
/games/{gameId}/submissions/{uid}       {qid, choice, conf, ms}                (phone writes its answer + confidence)
/games/{gameId}/answers/{uid}/{n}       {qid, choice, correct, conf, ms, round, at}   (host grades + logs every answer)
/results/{teacherUid}/{gameId}          archived summary + full answer log + bank snapshot, for the print diagnostic
```
**Bank + question schema** (this is also exactly what the Claude prompt builder returns — see §9)
```json
{
  "cvtBank": 1,
  "title": "Volcanoes of Aotearoa",
  "subject": "Science",
  "yearLevels": [5, 6],
  "source": "Topic: volcanoes in New Zealand",
  "strands": ["Planet Earth and Beyond", "Nature of Science"],
  "questions": [
    {
      "id": "q1",
      "type": "mc",
      "q": "Which city is built on a field of about 50 volcanoes?",
      "options": ["Wellington", "Auckland", "Christchurch", "Dunedin"],
      "correct": 1,
      "explanation": "Auckland sits on the Auckland Volcanic Field, which has around 50 volcanoes such as Rangitoto.",
      "strand": "Planet Earth and Beyond",
      "difficulty": 1,
      "page": null,
      "seconds": 20,
      "tags": ["volcanoes", "nz"]
    }
  ]
}
```
- `type`: `"mc"` (4 options) or `"tf"` (options exactly `["True","False"]`). (Later: type-in answer.)
- `correct`: index into `options` (0-based). **Never sent to student phones** — the host grades.
- `explanation`: 1–2 kid-friendly sentences; shown on the phone after answering and in the print diagnostic.
- `strand`: must be one of the bank's `strands` (used for strand mastery analytics).
- `difficulty`: 1 = recall, 2 = understanding, 3 = apply/reason.
- `page`: page reference when the bank was built from an attachment, otherwise `null`.

### Rules of thumb
- Students may only write to **their own** `/players/{uid}` (limited fields), `/inputs/{uid}` and `/submissions/{uid}`.
- Only the host writes `/current`, `/answers` and `/results`. Phones never receive the answer key, so dev-tools cheating can't reveal answers.
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
- Question Bank: search, subject/year filter chips (Maths, English, Science, History, Geography, NZ Curriculum), **New Question**, **CSV import**, **Build with Claude** (§9.1), **Duplicate premade → edit**.
- Results: list of past games → open the **Master Teacher Print Diagnostic** (§10).

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
- Premade banks (JSON in `/data/premade/`, same schema as §5): a starter set tagged to the **NZ Curriculum**, Years 3–8: Maths, English, Science, Social Sciences/NZ History, Geography, General Knowledge, Reading Comprehension.
- **Three ways to make a bank:** (1) type questions in the editor, (2) **CSV import**, (3) **Build with Claude** (prompt builder → paste back, below).
- **CSV import** columns: `question,optionA,optionB,optionC,optionD,correct(A-D),explanation,strand,difficulty,seconds`.
- Shuffle question order and answer order per student (the host remaps the correct index after shuffling).
- Avoid repeats until the bank is exhausted, then reshuffle.
- Every question **must** have an `explanation` and a `strand` before it can be saved — the editor flags missing ones in red. These drive the print diagnostic (§9.4).

### 9.1 "Build with Claude" — prompt builder (no API key needed)
On the Question Banks screen a **Build with Claude** button opens a two-step panel:

**Step 1 — Make the prompt.** A form with:
| Field | Notes |
|---|---|
| Source | Toggle: **Topic** (text box) or **Attached file** (PDF, ebook, worksheet, etc.) |
| Pages / sections to focus on | Shown when "Attached file" is chosen, e.g. `pages 12–30` or `chapters 3–4`. Blank = whole file |
| Subject / learning area | Dropdown (drives the strand list) |
| Year level / age | e.g. `Year 5–6 (ages 9–11)` |
| Number of questions | 5–50 (larger banks: run the prompt twice) |
| Difficulty mix | Easy / Balanced / Challenging (default Balanced) |
| Question types | Multiple choice only, or mix in True/False |
| Extra focus (optional) | e.g. learning intention, key vocabulary, a misconception to target |

The app fills these into the template below and shows a big **Copy prompt** button with the instruction: *"Paste this into a new Claude chat. If you chose Attached file, attach the file to that chat too."*
The raw template is also shown underneath so a teacher can copy it and replace the `[BRACKETS]` by hand.

**Step 2 — Paste the reply.** A large text box: *"Paste Claude's whole reply here."* → **Check questions**:
- Parser finds the JSON even if wrapped in ```json fences or surrounded by chatter; fixes smart quotes and trailing commas.
- Validates every question (4 options for mc, True/False for tf, `correct` in range, explanation + strand present, strand in the list, text lengths).
- Shows a preview: valid questions in green; invalid ones in red with the reason and an inline **Fix** editor; duplicates flagged.
- **Save as bank** (title/subject/year prefilled from the JSON, editable).

### 9.2 The prompt template (exact text the app generates)
```
You are an expert New Zealand primary/intermediate teacher writing quiz questions for a fast classroom game called "Chickens vs Turkeys". Students answer on phones in about 20 seconds per question.

SOURCE: [TOPIC]
(If SOURCE says "ATTACHMENT": use ONLY the attached file. Focus on [PAGES]. Do not use facts that are not in those pages. If you cannot read the attachment, say so and stop.)
SUBJECT / LEARNING AREA: [SUBJECT]
YEAR LEVEL / AGE: [YEAR LEVEL]
NUMBER OF QUESTIONS: [NUMBER]
DIFFICULTY MIX: [DIFFICULTY]  (Balanced = about 30% recall, 50% understanding, 20% apply/reason)
QUESTION TYPES: [TYPES]
EXTRA FOCUS: [FOCUS]

RULES
1. Each question has exactly ONE clearly correct answer. No "all/none of the above", no trick wording, no negatives like "Which is NOT…" unless essential.
2. Multiple choice ("mc") has exactly 4 options. True/False ("tf") options are exactly ["True","False"].
3. Wrong options (distractors) must be believable and based on common misconceptions for this age group.
4. Keep the question under 140 characters and each option under 60 characters (they appear on phone buttons).
5. Vary the position of the correct answer across questions.
6. "explanation": 1–2 short sentences a [YEAR LEVEL] student understands, saying WHY the answer is right.
7. "strand": choose the best-fitting strand from this list ONLY: [STRAND LIST]
8. "difficulty": 1 = recall, 2 = understanding, 3 = apply/reason.
9. "page": the page number the question comes from when using an attachment, otherwise null.
10. Use New Zealand English spelling. Use te reo Māori words with correct macrons where appropriate. Be culturally respectful.
11. Age-appropriate content only.

OUTPUT
Reply with ONLY one JSON code block, nothing before or after it, in exactly this format:
{
  "cvtBank": 1,
  "title": "short title",
  "subject": "[SUBJECT]",
  "yearLevels": [numbers],
  "source": "topic, or file name + pages used",
  "strands": [the strands you used],
  "questions": [
    {
      "id": "q1",
      "type": "mc",
      "q": "question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "why the answer is right",
      "strand": "one strand from the list",
      "difficulty": 1,
      "page": null,
      "seconds": 20,
      "tags": ["keyword"]
    }
  ]
}
"correct" is the 0-based index of the right option. Number ids q1, q2, q3…
```
- With an attachment, the teacher types **ATTACHMENT** as the topic (the form does this automatically) and attaches the file in the Claude chat.
- `[STRAND LIST]` is filled from `/data/strands.json` for the chosen learning area.

### 9.3 NZ Curriculum strands (`/data/strands.json`)
Editable data file so strands can be updated as the curriculum refresh rolls out — **check these against the current NZ Curriculum before Phase 3** and edit freely. Starting defaults:
- **Mathematics & Statistics:** Number, Algebra, Measurement, Geometry, Statistics, Probability
- **English:** Reading, Writing, Oral Language (Listening & Speaking)
- **Science:** Nature of Science, Living World, Material World, Physical World, Planet Earth and Beyond
- **Social Sciences (incl. Aotearoa NZ's histories):** Identity & Culture, Place & Environment, Continuity & Change, Economic World
- **Health & PE**, **Technology**, **The Arts**, **Te Reo Māori / Learning Languages**: added as needed
- **General Knowledge:** General (no strand analytics)

### 9.4 Confidence check (powers the blind-spot analytics)
After picking an answer, the phone shows three quick chips (one tap, ~1 s): **🔥 Sure · 🤔 Think so · 🎲 Guessing**. Teacher setting: *every question / every 3rd question / off* (default: every question).
To keep students honest there is a small **calibration bonus**: Sure + correct = +1 bonus egg; Sure + wrong = −1 egg and a slightly longer lockout; Think so and Guessing carry no extra risk or reward.

Each answer is classified:
| | Correct | Wrong |
|---|---|---|
| **Sure** | ✅ Mastered | ⚠️ **Blind spot** (confidently wrong, a misconception) |
| **Think so** | 🟡 Fragile (right but unsure) | 🔶 Developing |
| **Guessing** | 🎲 Lucky guess | ⬜ Knows they don't know |

### 9.5 Answer logging (all game modes)
The shared quiz engine logs every answer the same way whatever the mode (Dodge Egg, Egg Cannon, Egg Farm):
`{qid, choice, correct, conf, ms (time to answer), round, at}` under `/games/{gameId}/answers/{uid}`. When the game ends the host writes an archive to `/results/{teacherUid}/{gameId}` (players, bank snapshot, full answer log, final scores) so the report can be reopened and reprinted later from **Teacher → Results**. Teachers can delete archived results; only first names/nicknames are stored.

---

## 10. Master Teacher Print Diagnostic
Whatever game was played, the final summary screen has a **📋 Teacher Report** button (teacher only, never on the projector by accident; it opens in a new tab). It shows the diagnostic on screen and prints a clean **A4** report via `@media print` (A4 landscape for the matrices, portrait for question cards; black-and-white friendly: every colour also has a symbol/pattern; page breaks never split a row; header on every page with class, date, bank title, mode).

**Page 1 — Class Overview**
- Class accuracy %, questions asked, students, average time to answer.
- **Strand mastery bars:** class % correct per strand with level label: ✅ Mastered (≥80%) · 🟡 Developing (50–79%) · 🔴 Needs support (<50%).
- **Confidence vs competence chart:** class totals for the six categories in §9.4, with the blind-spot rate highlighted.
- **Top 3 teaching priorities** (auto-generated): the strands/questions with the lowest accuracy or highest blind-spot rate.

**Page 2 — Student × Strand Matrix**
Rows = students (alphabetical), columns = strands, cells = % correct with symbol shading. Extra columns: overall accuracy, answered, average confidence, **blind spots (count)**, lucky guesses, calibration (how well confidence matched results). Bottom row = class average per strand. Students with 3+ blind spots get a ⚠️ marker.

**Pages 3+ — Question Analysis** (one card per question, 3–4 per page)
- Question text, strand, difficulty, page ref (if any).
- Every option with the **% of students who chose it**, the correct answer ✔ marked.
- **Explanation**.
- % correct, blind-spot %, **most common wrong answer** (likely misconception) and which students chose it.

**Optional — Student Slips** (one per student, 4 per A4 page with cut lines)
Name, accuracy, strand mini-bars, their blind-spot questions with the correct answer and explanation — to hand back for reflection.

**Controls:** Print report · Choose sections · Sort matrix (name / accuracy / blind spots) · Hide names (use initials) · Export CSV of the raw answer log.

---

## 11. Art Pipeline

- Art comes from the separate **IMAGE_PROMPTS.md** file (ChatGPT). I upload results into the chat; Claude slices/cleans them (green-screen removal), names them, and wires them into the manifest.
- **Raw art is already in the repo** at `assets/images/` (generated Oct 2026): `logo, key-art, ui-kit, eggs-fx, chicken-parts, turkey-parts, cannon-characters, cannon-parallax, fort-blocks, farm-buildings, farm-ground, avatars, icons-subjects, event-banners, results-art` (all `.png`). The Dodge arena background (`dodge-arena`) is still to be generated.
- When a phase needs a sheet, Claude removes the green background, slices it into `assets/<mode>/...` frames + an atlas JSON, and registers them in `/js/core/assets.js`. Originals in `assets/images/` stay untouched. Missing art = coloured placeholder, never a crash.
- Sprite sheets are cut into frames using a small JSON atlas that Claude generates after seeing each image.

---

## 12. Build Phases (each ends with a TEST GATE)

**Phase 0 — Repo + Firebase hello world** ✔ done
Folder structure, `tokens.css` comic design system, Firebase config, a page that writes/reads a test value in Realtime DB.
✅ *Gate:* Page loads on GitHub Pages, value round-trips between two browser tabs.

**Phase 1 — Design system + static screens (no logic) ✔ built**
Landing, teacher dashboard shell, question bank shell (incl. Build with Claude panel layout), student join screen, host lobby layout — all in comic style using the real art in `assets/images/`.
✅ *Gate:* All screens look right on a phone, a laptop, and the projector (1920×1080).

**Phase 2 — Auth, create game, join by code/QR, live lobby ✔ built**
Google sign-in for teacher, create game → 6-char code + QR, students join anonymously, auto team balance, players appear live, kick/rename, security rules.
✅ *Gate:* Teacher on laptop + 3 phones: everyone joins by QR, names show on host, refresh/reconnect works.

**Phase 3 — Question banks + Build with Claude ✔ built**
Bank CRUD and editor (explanation + strand required), CSV import, `strands.json`, premade starter banks, **prompt builder** (form → generated prompt → copy), **paste-back parser** with validation preview and fix-up, bank picker in Create Game.
✅ *Gate:* (a) Generate a prompt for a topic, run it in Claude, paste the reply back, save a 20-question bank. (b) Do the same with a PDF attachment and a page range — every question has a page ref. (c) Import a CSV, edit a question, select the bank for a game.

**Phase 4 — Quiz engine + answer logging ✔ built**
Host-graded question delivery (no answer key on phones), shuffles, lockouts, streaks, **confidence chips + calibration bonus**, explanation shown after each answer, full answer log, per-player stats, host live feed (generic "answering" screen as the testing mode).
✅ *Gate:* 3+ phones answer; scores/streaks correct; confidence recorded; answer log in the database matches what happened.

**Phase 5 — Dodge Egg v1 (rectangles/placeholders) ✔ built**
Arena sim, joystick + aim pad controller, ammo from answers, throws, hits, knock-out/respawn, 60 s round, individual + team scoring, scoreboard.
✅ *Gate:* 3v3 on real phones; hits register fairly; no lag on projector; scoring adds up.

**Phase 6 — Dodge Egg art + juice pass ✔ built**
Drop in real art; layered birds, fake-3D animation, shadows, squash/stretch, particles, comic words, screen shake, crowd, SFX.
✅ *Gate:* "Wow" test — show it to a student.

**Phase 7 — Game flow, rounds, results, random events ✔ built**
Multi-round flow, between-round scoreboard, final podium, random events system, teacher controls (pause/skip/end), results archive written at game end.
✅ *Gate:* Full 3-round game start to finish; archive appears under Teacher → Results.

**Phase 8 — Master Teacher Print Diagnostic ✔ built**
Teacher Report from the final screen and from Teacher → Results: class overview, strand mastery, confidence-vs-competence, student × strand matrix, question analysis cards, student slips, A4 `@media print` styles, CSV export.
✅ *Gate:* After a real test game, print to PDF: every page is A4, readable in black and white, numbers match the answer log, blind spots are correct.

**Phase 9 — Egg Cannon v1 (placeholders) ✔ built**
Side-scroll world, forts, Matter.js, 5-question phase, angle + power bar, volley playback, attribution + scoring.
✅ *Gate:* Full round with 4+ players, scores credited correctly; report still works for this mode.

**Phase 10 — Egg Cannon art + juice ✔ built**
Parallax, cannon animation, destruction particles, camera work, special eggs.

**Phase 11 — Egg Farm v1 ✔ built**
Phone farm game loop, upgrades, quiz bonuses, score sync, host race board + team meters.
✅ *Gate:* 10-minute game, scores sync, no cheating via dev tools beyond sanity limits; report still works for this mode.

**Phase 12 — Egg Farm art + juice ✔ built**

**Phase 13 — Polish & classroom hardening**
Music/SFX, mute, accessibility (colour-blind-safe team shapes/icons, big text option), name filter, performance test on school devices, error states, tutorial/"how to play" overlays.

**Phase 14 — Extras (optional)**
More modes, avatar unlocks, class leaderboards across games, progress over time per strand (compare reports), themed seasons (Halloween Turkeys!).

---

### Build notes (Phases 1–7, Oct 2026)
- Art is sliced into `assets/sprites/*.webp` (originals stay in `assets/images/`). `js/core/assets.js` lists every sprite name.
- **Test bots:** the host lobby has "🤖 Add 4 test bots" so a teacher can try a full game without phones (bots never appear in results analytics).
- Students sign in per browser *tab*, so you can test with several tabs on one computer.
- Host keyboard: Space = pause, F = full screen. The bottom control bar fades until you hover it.
- Throw = drag on the right pad and let go (a quick tap throws straight ahead). Gentle aim assist helps younger students.
- **Teacher Report** (`teacher/report.html?r=…`): opens from Results or the 📊 View Results button on the winners screen. Toolbar: print/save PDF, choose sections, sort, initials-only, CSV export. Overview + matrix print A4 landscape; question cards + student slips print A4 portrait.
- **Egg Cannon flow per round:** answer phase (5 questions each, ends when everyone's done or time runs out) → 45 s battle (drag the dial to set angle, tap FIRE as the power bar sweeps) → round ends when all eggs are fired and the dust settles. 3 fort designs (Twin Towers, Castle Keep, Hay Fortress) rotate randomly; scarecrow dummies/pumpkin/barrel/TNT = 1 point, bullseye = 2. Wind changes each round. Fox Raid is skipped in this mode.
- **Egg Farm (v2, Egg Inc style):** one round of 5 / 8 / 12 minutes. Phone shows the whole farm map (PixiJS): HOLD the HATCH button → chicks run from the hatchery into coops; 4 coop plots × 5 levels; trucks drive along the road and cap eggs sold per second ("trucks full" warning); egg machines multiply egg value; balloons float past (tap for cash / golden eggs); a fox sneaks toward a coop (tap 3× to chase it). Right answer = STAMPEDE of free chicks + cash + golden eggs + ⚡×3 boost + full hatch charge. Golden eggs buy Research (Speedy Hatchery, Happy Hens, Golden Feed, Mega Stampede, Fox Fence). Host runs all economies; numbers in `js/modes/farm/economy.js`, phone scene in `js/modes/farm/scene.js`.
- Events available: Golden Egg Rush, Double Trouble, Shield Up, Egg Storm, Fog of Feathers, Fox Raid (+ automatic Clean Sweep). Team Swap is not used (it scrambles scoring).

## 13. Starter Prompts (paste after this file)

**Phase 0:**
> We are starting **Phase 0**. Walk me through creating the Firebase project step by step (I'll use the web console), then give me the full files for the repo skeleton, `tokens.css`, `firebase.js` and a hello-world page that proves Realtime Database works. I'm deploying through the GitHub web UI to GitHub Pages.

**Any later phase:**
> We are starting **Phase N**. Here are my current files: [paste]. Build only this phase, give complete files with paths, then a numbered test checklist.

**Art phase:**
> We are starting **Phase 6**. Here are the art images I generated: [upload]. Slice them, remove the green background, name them to match the asset manifest, give me the atlas JSON, and wire them in.

**Bug report template:**
> Phase N test failed. Step: __. Device: __. Expected: __. Actual: __. Console error (if any): __.

---

## 14. Classroom Reality Checks
- Test with **real phones on school Wi-Fi** before showing students.
- Keep a **"Lite mode"** switch (fewer particles, no screen shake) for older Chromebooks.
- Teacher should always be able to **end/skip/pause** instantly.
- Teams must feel **fair**: auto-balance, and catch-up mechanics (Shield Up, comeback eggs) so the losing team never gives up.
