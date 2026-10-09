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
- **Curriculum:** pick New Zealand, Australia, England, Scotland, Wales, Northern Ireland, Ireland, USA (Common Core/NGSS, Texas TEKS, Florida B.E.S.T., Virginia SOL), Canada (Ontario, BC), Singapore, South Africa (CAPS), India (CBSE), IB PYP or Cambridge Primary. The subjects, strands, Year/Grade wording, spelling and examples in the prompt change to match. Your last choice is remembered. Edit `data/curricula.json` to tweak strands or add a curriculum.
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

## Egg Farm (Egg Inc style)
Create Game → **Egg Farm** → 5, 8 or 12 minutes. Each student runs a farm on their device:
- **Hold HATCH** → chicks run from the hatchery into your coops (the ring shows hatch charge).
- **Build coops** on the 4 plots and upgrade them; **buy trucks** (they drive the road and limit how many eggs you can sell); **egg machines** make eggs worth more.
- **Answer questions** (❓ QUIZ or the mystery crate) → a **STAMPEDE** of free chicks, cash, golden eggs and a ⚡×3 boost.
- **Golden eggs** buy **Research** upgrades. Tap **balloons** for bonuses; tap the **fox** 3 times before it reaches a coop.
The big screen shows the live team race. Most money earned wins.

## Coop Wars (Tower War style)
Create Game → **Coop Wars** → 5, 8 or 12 minutes, and choose **Troop growth** (Auto / Questions only / Slow + questions).
- Every student starts with their own coop (gold ring on their device, their name on the big screen). Devices show the same landscape map as the big screen (chickens left, turkeys right) and ask students to turn sideways if held upright.
- **Drag** from your coop to any building to march troops along a line. Troops lower enemy and grey buildings — at **0** the building is **captured** and becomes yours. Troops sent to your team's buildings raise their level.
- **Swipe** across one of your lines to cut it. Level **10** unlocks a 2nd line and level **20** a 3rd (max level 63).
- **Answer questions** (QUIZ tab or the crate) → +8 troops spread across all your coops (more for streaks and confident answers). Lost all your coops? Your answers reinforce your team.
- Tractor sheds send tractors worth 2. Egg Snipers (water towers) shoot enemy troops inside their circle. Golden egg piles give bonus troops when you march to them. Hay bales block lines. The Grand Barn in the middle grows fastest.
- The team with the most buildings at the end wins (or wipe out the other team early).
- Art: dedicated Coop Wars sprites (`assets/sprites/tw_*.webp`, sliced from `assets/images/tw-*.png`). Towers grow 1–5 storeys with their level; grey = unclaimed. If any file is missing the game falls back to the older farm art. Prompts: `COOP_WARS_IMAGE_PROMPTS.md`.

## Coop Siege (lawn-defence style)
Create Game → **Coop Siege** → each half lasts 2½, 3½ or 5 minutes. There are always **2 halves**.
- **First half:** 🐔 Chickens DEFEND their coop and 🦃 Turkeys ATTACK. **Second half:** they swap.
- Every right answer earns **🌽 50 corn** (+10 if 🔥 Sure, +25 on every 3rd answer in a row; double during a Golden Egg Rush).
- **Defenders** pick a defence in the shop, then tap an empty square on the 5 × 9 lawn:
  Egg Shooter 100 · Corn Popper 50 (+25 corn every 12 s) · Hay Wall 50 · Rotten Egg Trap 100 · Frost Egger 175 (slows) · Double Shooter 200 · Egg Bomb 150 (blasts 3 × 3).
- **Attackers** pick a troop, then tap a row (1–5) to send it: Raider 50 · Helmet Raider 100 · Hurdler 125 (jumps the first defence) · Tractor Brute 225 · Battle Wagon 400 (smashes everything).
- Each row has one lawn tractor that flattens the row the first time an attacker reaches the coop. After that, every attacker that gets through eats eggs from the coop (12 eggs). Empty the coop and the attackers win the half early (+100 team bonus).
- **Points:** defenders score for knocking out attackers. Attackers score for breaking in (30), setting off a tractor (15), wrecking defences, chewing (+1 per 100 damage) and staying alive on the lawn (+1 every 3 s). Highest team total after both halves wins.
- A few free "wild" raiders wander in so defenders always have something to do (they give no points).
- On phones the lawn stands upright: rows become columns, attackers come down from the top and your coop is at the bottom. The row numbers match the big screen.
- Art: dedicated sprites `assets/sprites/sg_*.webp` (sliced from `assets/images/sg-*.png`). Prompts: `COOP_SIEGE_IMAGE_PROMPTS.md`.

⚠️ This update changes `database.rules.json` again (Coop Siege adds `sg`) — paste it into Firebase → Realtime Database → Rules → **Publish**.

**Next:** Phase 13 — polish & classroom hardening.
