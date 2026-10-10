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

**Teams:** by default students tap **Chickens** or **Turkeys** when they join (Create Game → Teams → *Students choose*). Tap a student's name in the lobby to switch their team, or use 🔀 Shuffle. Anyone who hasn't chosen when you press START is placed automatically. Pick *Auto-balance* to have teams made for you.

**Between rounds and at the end:** press **👀 Hide results** (bottom-right of the game screen) to show the game board as it finished; press **📊 Show results** to bring the scores back. The next-round countdown pauses while the results are hidden.

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
- **Tap any building** (coop, truck, egg machine) to see its level and choose **⬆ Upgrade** (shows the price) or **💥 Destroy** (gives back half what you paid). Tap **🔨 BUILD** on an empty plot or the machine spot to choose what to build, with prices. A green ⬆ means you can afford an upgrade. The Coops / Trucks / Egg Machine buttons at the bottom open the same choices.
- **Answer questions** (❓ QUIZ or the mystery crate) → a **STAMPEDE** of free chicks, cash, golden eggs and a ⚡×3 boost.
- **Golden eggs** buy **Research** upgrades. Tap **balloons** for bonuses; tap the **fox** 3 times before it reaches a coop.
The big screen shows the live team race. Most money earned wins.

## Coop Wars (Tower War style)
Create Game → **Coop Wars** → 5, 8 or 12 minutes, and choose **Troop growth** (Auto / Questions only / Slow + questions).
- Every building your team holds belongs to the **whole team** (gold ring on devices). Each student's starting coop shows their name on the big screen.
- **Tap** one of your team's buildings → a question pops up over the map. Get it right and the troops (+8, more for streaks and 🔥 Sure answers) go to **that building**.
- **Hold and drag** from one of your team's buildings to any building to march troops along a line. Troops lower enemy and grey buildings — at **0** the building is **captured** and joins your team. Troops sent to your team's buildings raise their level.
- **Swipe** across one of your team's lines to cut it. Level **10** unlocks a 2nd line and level **20** a 3rd (max level 63).
- Devices show the same landscape map as the big screen and ask students to turn sideways if held upright.
- Tractor sheds send tractors worth 2. Egg Snipers shoot enemy troops inside their circle. Golden egg piles give bonus troops when you march to them. Hay bales block lines. The Grand Barn in the middle grows fastest.
- The team with the most buildings at the end wins (or wipe out the other team early).
- Art: dedicated Coop Wars sprites (`assets/sprites/tw_*.webp`). Prompts: `COOP_WARS_IMAGE_PROMPTS.md`.

## Advance (chessboard race)
Create Game → **Advance** → number of rounds, and the longest a round can last (1 min / 90 s / 2 min).
- Before the game each student picks a **chess piece + colour** (King, Queen, Rook, Bishop, Knight, Pawn × 4 colours). A combination a teammate has already picked fades out.
- The board is square: as wide as the bigger team, and at least **10 × 10**. Chickens start on the bottom row, turkeys on the top row.
- Every **right answer = 1 move**: forward, forward-diagonal, or one step sideways — never onto a square with a piece or a block. Students answer on the **QUIZ** tab and move on the **BOARD** tab (it opens by itself after a right answer and shows green squares to tap). Turkeys see the board turned round so they always move "up".
- **Blocks** (any team size): instead of moving, drop a hay bale on any empty square next to you. Nobody can move onto it. It disappears after your next 2 answers. Up to 2 blocks each on the board at a time.
- **Push back**: if an enemy piece is **directly in front of you or right beside you**, it glows purple on your board. Tap it (instead of moving or blocking) to push it **one square back** towards its own start. You stay where you are, and it uses up that move. You can't push a piece that has already made it home, or push one onto a hay bale, another piece or off the board.
- A round ends when a whole team reaches the far side (they win the round), or when time runs out — then the team that is further across **on average** wins. Each round won = 1 point; most rounds wins the game (ties broken by total distance).
- **Big screen** shows each player as a solid **blue (chickens) or red (turkeys) square**, so you can see at a glance who is further ahead and which parts of the board each team controls. **Student devices** are zoomed in on their own piece, the camera follows them as they move, and a mini-map in the corner shows the whole board (they are the yellow square).
- Image prompts for the chicken/turkey chess pieces: `ADVANCE_IMAGE_PROMPTS.md` (round tokens are used until then).

⚠️ Advance adds `pc` (piece choice) and `adv` to `database.rules.json` — paste it into Firebase → Realtime Database → Rules → **Publish**.

## Cross the Road ("Why did the chicken cross the road?")
Create Game → **Cross the Road** → rounds (1 / 2 / 3) and round length (2 / 3 / 4 min).
- Students answer on the **QUIZ** tab. Every right answer = **4 hops** (they can save up to 12). The **ROAD** tab opens by itself after a right answer.
- Hop with a **tap** (forward), a **swipe**, the **◀ ▲ ▶ ▼** buttons or the arrow keys. Chickens and turkeys all cross the same field together.
- **Roads**: tractors, vans, egg trucks, hay carts and semis — get hit and it's SPLAT, back to the start. **Rivers**: hop onto the logs and ride them, or hop across still lily pads — miss (or get carried off the edge) and it's SPLASH, back to the start. **Grass strips** are safe (watch out for trees and rocks in the way).
- Reaching the far side = **1 point for your team**, then you start again at the bottom. Most crossings over all rounds wins.
- The danger: run out of hops while standing on a road and you're a sitting duck! Students get a tip when they're about to step off the grass without enough hops to reach the next safe strip.
- A new field is made every round. The traffic runs on a shared clock, so every device and the big screen see the same tractor in the same place. Each device judges its own hops instantly, so timing feels fair.
- Image prompts: `CROSS_ROAD_IMAGE_PROMPTS.md` (the game reuses the existing vehicles, scenery and birds; the hay cart and logs are drawn in code until then).

⚠️ Cross the Road adds `cr` to `database.rules.json` — paste it into Firebase → Realtime Database → Rules → **Publish**.

## Egg Toss (fairground egg-flinging gallery)
Create Game → **Egg Toss** → rounds (2 / 4 / 6), and the answer time per round (30 / 45 / 60 s).
- Before the game each student picks a **chess piece + colour** (the same pieces as Advance). Combinations a teammate already picked fade out.
- Each round, one team **flings** and the other team **dodges**. Round 1: turkeys fling at chickens. The teams swap every round, so both teams fling the same number of times.
- **Questions first.** Flingers: every right answer = **2 eggs** for this round. Dodgers: every right answer makes their target **10% smaller**, down to 30%. No right answers = full-size target.
- **Then 30 seconds of flinging.** The dodgers' pieces stand on **4 rails** and slide left/right (hold ◀ ▶ on their device). Flingers drag a finger to aim and let go to fling. **Only the flinger can see their own crosshair**; nobody else sees it, including the big screen. Eggs take under a second to land, so dodgers can see them coming and move.
- Only an egg that hits the **bullseye** counts, not one that just hits the piece. A hit = yolk splat, the piece topples, and that student spectates for the rest of the round.
- Unused eggs are lost at the end of each round. The team with the most **targets hit** over all rounds wins. Individual standings are by questions answered correctly.
- Game-card icon: `mode_eggtoss.webp` (prompt in `EGG_TOSS_IMAGE_PROMPTS.md`).

⚠️ Egg Toss adds `et` to `database.rules.json` — paste it into Firebase → Realtime Database → Rules → **Publish**.

## Land Grab (paper.io style)
Create Game → **Land Grab** → number of rounds, and the answer time per round (45 / 60 / 90 s — 60 s recommended).
- **Each round = 1 minute of questions, then 30 seconds of land grab.** Every right answer in the question minute makes your character faster in the land grab (speed 5, +1 per right answer, up to 14).
- Everyone starts with a small patch of land. **Starting spots** (Create Game): *Separate sides* = chickens on the left, turkeys on the right; *Mixed* = everyone scattered across the field (harder, more competitive). Each student is their avatar, with their own colour shade.
- **Put a finger down and drag** to steer (arrow keys work on a computer). Leave your land to draw a trail; get back to your land to claim the loop and everything inside it. You can carve into other players' land.
- **If an enemy runs over your trail before you get home, you're OUT** — all your land disappears and you watch until the end of that round. (Teammates can't cut your trail.)
- **Team score each round = the % of the field the whole team covers.** The rounds are added together; the team with the biggest total wins.
- Individual places still go to most questions correct.
- No new art is needed; optional prompts are in `LAND_GRAB_IMAGE_PROMPTS.md`.

⚠️ Land Grab adds `pt` to `database.rules.json` — paste it into Firebase → Realtime Database → Rules → **Publish**.

## Coop Siege (lawn-defence style)
Create Game → **Coop Siege** → each half lasts 2½, 3½ or 5 minutes. There are always **2 halves**.
- **First half:** 🐔 Chickens DEFEND their coop and 🦃 Turkeys ATTACK. **Second half:** they swap.
- Every right answer earns **🌽 50 corn** (+10 if 🔥 Sure, +25 on every 3rd answer in a row; double during a Golden Egg Rush).
- **Defenders** pick a defence in the shop, then tap an empty square on the 5 × 9 lawn:
  Egg Shooter 100 (fires down its row whenever an attacker is in that row) · Corn Popper 50 (+25 corn every 12 s) · Hay Wall 50 · Rotten Egg Trap 100 (SPLAT: big hit + slow on every attacker that steps on it) · Frost Egger 175 (slows) · Double Shooter 200 · Egg Bomb 150 (waits for an attacker to come close, then blasts 3 × 3).
- **Attackers** pick a troop, then tap a row (1–5) to send it: Raider 50 · Helmet Raider 100 · Hurdler 125 (jumps the first defence) · Tractor Brute 225 · Battle Wagon 400 (smashes everything).
- Each row has one lawn tractor that flattens the row the first time an attacker reaches the coop. After that, every attacker that gets through eats eggs from the coop (12 eggs). Empty the coop and the attackers win the half early (+100 team bonus).
- **Points:** defenders score for knocking out attackers. Attackers score for breaking in (30), setting off a tractor (15), wrecking defences, chewing (+1 per 100 damage) and staying alive on the lawn (+1 every 3 s). Highest team total after both halves wins.
- Free "wild" raiders wander in every few seconds, mostly down rows that have defences with nothing to shoot, so every shooter gets action (they give no points).
- On phones the lawn stands upright: rows become columns, attackers come down from the top and your coop is at the bottom. The row numbers match the big screen.
- Art: dedicated sprites `assets/sprites/sg_*.webp` (sliced from `assets/images/sg-*.png`). Prompts: `COOP_SIEGE_IMAGE_PROMPTS.md`.

⚠️ This update changes `database.rules.json` again (Coop Siege adds `sg`) — paste it into Firebase → Realtime Database → Rules → **Publish**.

**Next:** Phase 13 — polish & classroom hardening.

## Updating the code
Before committing a change, run `python3 tools/stamp_version.py`. It adds a version tag (`?v=…`) to every script and stylesheet link so browsers and iPads load the new files straight away instead of an old cached copy.
