# Neon Strike: Rhythm Brawler

A high-octane cyberpunk rhythm brawler powered by HTML5 Canvas and Web Audio API, featuring dynamic frequency-band enemy generation and the original soundtrack by **defaultsaviour**.

---

## ⚡ Core Features

- **2-Lane Horizontal Conveyor Combat**:
  - Converging conveyor belts feed enemies from the **Left** and **Right** directly toward the player's central combat bridge.
  - Zero-freeze hit detection for butter-smooth visual frame rates synchronized to the audio hardware clock.
- **Dynamic Acoustic Frequency Band Analysis**:
  - In-place **Radix-2 FFT spectral analysis** maps incoming audio notes into three distinct frequency bands:
    - **Sub / Kick (~36–145 Hz)**: Red / Crimson / Blood Orange heavy juggernauts.
    - **Bassline (~105–300 Hz)**: Purple / Magenta / Acid Pink groove fighters.
    - **Highs (~800–6500 Hz)**: Cyan / Mint / Plasma White rapid-strike units.
- **9-Variant Cyber Enemy Roster**:
  - **Sub / Kick**:
    - Tier 1 (Low): **Titan** (1.15x scale, horned armor, stomp shockwaves).
    - Tier 2 (Mid): **Breaker** (1.0x scale, red breach visor, pneumatic gauntlets).
    - Tier 3 (High): **Rammer** (0.96x scale, blaze orange wedge shield with grinding sparks).
  - **Bassline**:
    - Tier 1 (Low): **Warlord** (1.08x scale, deep purple kabuto crest, sashimono banner).
    - Tier 2 (Mid): **Ronin** (1.0x scale, magenta cyber-kasa hat, dragging odachi blade).
    - Tier 3 (High): **Acid Dancer** (0.95x scale, acid-pink techno ninja, reverse scythes & ribbons).
  - **Highs**:
    - Tier 1 (Low): **Speeder** (0.98x scale, cyan roller-blade speedster with jet exhaust booster flames).
    - Tier 2 (Mid): **Wraith** (1.0x scale, mint hover-phantom with swept energy wings).
    - Tier 3 (High): **Seraph** (1.0x scale, celestial drone with rotating halo, quad wings & beam sabers).
- **Dynamic Song Audio Hit Impact (+25% Volume Surge)**:
  - Replaces synthetic beeps with an instantaneous +25% volume surge on impact, mastered via a studio Web Audio `DynamicsCompressorNode` for punch without digital clipping.
- **Sleek 24-Move Martial Arts Combat**:
  - 5-tier progression: Basic -> Advanced Acrobatic -> Superhuman Cyber -> Overdrive Master -> God-Tier Finisher.
  - Dynamic combo visuals: Ground aura rings (6+), cyber ghost afterimages (16+), overdrive lightning arcs (30+), and radiant plasma angel wings (50+).
- **Dual Combat Modes**:
  - **2-Button Mode**: Independent directional strikes for left (`[←]/[A]`) and right (`[→]/[D]`).
  - **1-Button Mode**: Automatically detects and targets the nearest incoming beat enemy across both lanes via `[SPACE]`, tap anywhere, or any key.

---

## 🎯 Timing Accuracy & Feel

- **Latency-corrected song clock** (`src/audio/songClock.ts`): the game follows the audio you *hear*, not the audio the browser is processing, so enemies reach the strike line exactly on the audible beat.
- **Charts land on the attack**: the kick/bass detector's built-in ~15 ms lag is removed (verified by tests on synthetic songs with known kick times).
- **Fair judging** (`src/game/timing.ts`): PERFECT ±55 ms, GOOD ±105 ms, OK ±160 ms. A press always hits the *earliest* enemy in range, and enemies only breach after their OK window has passed. Key auto-repeat is ignored, and presses are timed from the input event itself.
- **Timing rings** close onto each strike zone exactly on the beat, and non-PERFECT hits show **EARLY / LATE**.
- **Auto-calibration**: the results screen shows your average timing and offers a one-click latency offset.

## 💥 Visuals

- The arena **scales to the screen** (`src/game/layout.ts`): fighters fill about a third of the screen height on any monitor.
- **Beat-locked animation**: fighter bounce, enemy footsteps, sun and floor pulse all follow a beat grid fitted to the song (`src/audio/beatGrid.ts`).
- **Snappy strikes** (`src/game/motion.ts`): overshoot snap, hold, recover, and a lunge toward the target, plus hit-stop freeze frames and a camera punch.
- **Rigid-body shattering** (`src/game/debrisPhysics.ts`): enemies break into pieces that start from their real skeleton, then spin, bounce and slide with friction. The conveyors carry the pieces into the pit.
- **Clarity first**: only the next enemy in each lane is at full brightness, debris fades once it cools, and the timing ring is always drawn on top.

## 🧪 Tests

```bash
npm test
```

## 🎮 Controls

| Action | 2-Button Mode | 1-Button Mode | Touch / Mobile |
| :--- | :--- | :--- | :--- |
| **Strike Left** | `[←]` / `[A]` / `[J]` | `[SPACE]` / Any Key | Tap Left Strike Zone |
| **Strike Right** | `[→]` / `[D]` / `[L]` | `[SPACE]` / Any Key | Tap Right Strike Zone |
| **Unified Strike** | — | `[SPACE]` / `[ENTER]` | Tap Full-Width Strike Bar |
| **Toggle Mode** | HUD Header / Settings | HUD Header / Settings | HUD Header Toggle |
| **Pause** | `[ESC]` / `[P]` | `[ESC]` / `[P]` | Top-Right Pause Button |
| **Restart** | `[R]` | `[R]` | Top-Right Restart Button |

---

## 🎵 Official Soundtrack by defaultsaviour

| Track | BPM | Difficulty | Duration | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Eargasm** | 150 | Hard | 3:10 | Heavy thumping kicks and rolling 16th-note sub-bass groove. |
| **Eargasm 2** | 150 | Hard | 3:40 | Relentless driving rhythm with melodic synth breakdowns. |
| **Eargasm 3** | 155 | Hard | 3:09 | Dark electro industrial rhythm with rapid syncopated basslines. |
| **Eargasm 4** | 199 | Hard | 3:15 | High-speed 200 BPM frantic speedcore rush testing reflex limits. |
| **Eargasm 5** | 104 | Medium | 3:19 | Deep bouncy groove with rhythmic acoustic accents. |

---

## 🛠️ Development & Running Locally

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/DefaultSaviour/neon-strike-rhythm-brawler.git
cd neon-strike-rhythm-brawler

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000/` in your browser.

### Production Build
```bash
npm run build
```
Build output is generated in `dist/`.
