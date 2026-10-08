# Chickens vs Turkeys

A comic-book classroom quiz battle. Teachers host on the projector; students join on any device with a 6-letter code or QR code.

**Live site:** `https://aurabotproject-ctrl.github.io/chickensvsturkeys/`

| Page | Who | What |
|---|---|---|
| `/` | everyone | Landing page |
| `/teacher/` | teacher | Sign in with Google · Question Banks · Build with Claude · Create Game · Results |
| `/host/?g=…` | projector | Lobby (code + QR) → Dodge Egg arena → round scores → winners podium |
| `/play/` | students | Join → team + avatar → Answer / Fight controller → results |
| `/hello/` | anyone | Firebase connection check (Phase 0) |

---

## ⚠️ One-time step after each update that changes the rules

The database rules changed in Phase 1–7. Copy **everything** in `database.rules.json` into
**Firebase console → Realtime Database → Rules**, then click **Publish**. Without this, joining and hosting will say *Permission denied*.

Also check **Authentication → Sign-in method**: *Anonymous* and *Google* are both enabled, and **Authentication → Settings → Authorized domains** includes `aurabotproject-ctrl.github.io`.

---

## Try a game in 2 minutes (no students needed)
1. Open `/teacher/` → **Sign in with Google**.
2. **Create Game** → Dodge Egg → pick *Times Tables Showdown* → 1 round, 45 s → **Launch Game**.
3. On the game screen click **🤖 Add 4 test bots**.
4. On your phone (or another browser tab) open `/play/`, type the code and your name, pick an avatar.
5. Click **START!** Answer questions on the phone to earn eggs, switch to **FIGHT**, drag the right pad and let go to throw.
6. At the end the results are saved in **Teacher HQ → Results**.

Host controls (bottom of the arena, appears on hover): pause · end round / next round · random event · scores · sound · end game. Keyboard: **Space** = pause, **F** = full screen.

## Making question banks
- **✨ Build with Claude:** fill in the topic (or choose *attached file* + the pages to focus on), year level and number of questions → **Copy prompt** → paste into a new Claude chat (attach the file there if using one) → copy Claude's whole reply → **Next** → paste → **Check questions** → **Open in editor & save**.
- **➕ New bank** to type questions yourself, **📄 Import CSV**, or **Copy & edit** a premade bank.
- Every question needs an explanation and a NZ Curriculum strand (they power the Phase 8 Teacher Diagnostic). Strand lists live in `data/strands.json` — edit them freely.

---

## Folder map
```
index.html                 landing
teacher/                   Teacher HQ (teacher.js, banks-ui.js, teacher.css)
host/                      projector screen (host.js, host.css)
play/                      student controller (play.js, play.css)
hello/                     Firebase connection check
css/tokens.css, ui.css     comic design system
js/core/                   firebase, assets, ui helpers, sfx, games (codes)
js/quiz/                   banks, promptBuilder (Build with Claude), engine (grading)
js/modes/dodge/            arena (PixiJS), bots
js/events/events.js        random events
data/strands.json          NZ Curriculum strands per learning area
data/premade/              starter question banks
assets/sprites/            game art (sliced .webp)  ·  assets/images/  original ChatGPT sheets
database.rules.json        paste into Firebase → Realtime Database → Rules
CHICKENS_VS_TURKEYS_BUILD_RECIPE.md / _IMAGE_PROMPTS.md
```

## Teacher Report (Phase 8)
After any game: **Teacher HQ → Results → click a game**, or **View Results** on the winners screen. Print it or *Save as PDF*.

## Egg Cannon (Phases 9–10)
Create Game → **Egg Cannon**. Each round: students answer 5 questions (each right answer loads 1 egg), then everyone aims with the dial and taps **FIRE** while the power bar swings. Knock over or smash the other team's scarecrows, pumpkins, barrels, TNT and bullseyes for points.

**Next:** Phase 11 — Egg Farm.
