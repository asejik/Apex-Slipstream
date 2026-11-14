# IDEA BRIEF: Apex Slipstream (Arcade Racing Championship)

Generated: 2026-11-13 | Mode: MODE A (My Idea) | Project Type: Personal / Indie Web Game  
Owner: Developer (Personal Project) | Target Platform: Cross-Platform Web & Mobile (PWA)

---

## 1. Problem Statement & Opportunity

### The Problem
Fans of arcade racing games on web and mobile are trapped between two frustrating extremes:
1. **Commercial Mobile Racers** (e.g. *Asphalt*, *Need for Speed Mobile*): Multi-gigabyte downloads gated by intrusive microtransactions, artificial energy timers, forced upgrade treadmills, and rubber-banded AI dominated by nitro gimmicks rather than pure driving skill.
2. **Casual Web Racers**: Lightweight browser games that often lack depth, offering only single throwaway races, rigid 2D physics, no seasonal continuity, and sluggish touch controls on mobile devices.

### The Solution
**Apex Slipstream** is an instant-loading, zero-paywall 3D arcade racer built for mobile and desktop browsers. It replaces nitro boosts and mechanical grinding with **pure racecraft**:
- Equal-spec cars where victory depends strictly on carrying momentum through apexes, managing tire grip across dynamic surfaces, and executing aerodynamic slipstream overtakes.
- A rich **Seasonal Championship** pitting the player against a persistent grid of 19 named AI rivals across an 8-race calendar.
- Strategic pre-race qualifying sessions, 1-click tactical tire selections (Street, All-Terrain, Wet), and a forgiving yet tense 3-Restart-Token mechanic.
- Instant gratification via Quick Race and precision mastery via Time Trial ghost replays.

---

## 2. Value Proposition & Target Audience

- **Positioning Statement:** For racing game enthusiasts and casual gamers on mobile and desktop who want instant, skill-based arcade thrills without paywalls or install friction, **Apex Slipstream** delivers the depth and tension of a full championship season with momentum-based physics, slipstream passing, and persistent AI rivals directly in the browser.
- **Target Players:**
  - Nostalgic fans of classic arcade racers (*OutRun*, *Daytona USA*, *Micro Machines*, *Screamer*).
  - Mobile web gamers looking for a high-framerate, ad-free racing experience that boots instantly in Safari or Chrome.
- **Initial Reach & Discovery (First 100+ Players):**
  - Web game curation portals (itch.io browser games, Newgrounds, CrazyGames).
  - Community showcases: Reddit (`r/WebGames`, `r/IndieGaming`, `r/threejs`), Hacker News ("Show HN: 60 FPS 3D Arcade Racer in Browser"), and social media gameplay clips showcasing the High-Chase camera and slipstream passes.

---

## 3. Users, Devices & Operational Context

- **User Roles:** Single Player (100% offline-ready client-side).
- **Supported Devices:**
  - **Desktop / Laptop:** Chrome, Firefox, Safari, Edge with responsive keyboard (WASD / Arrows, Space) and Gamepad API support.
  - **Mobile / Tablet:** iOS Safari and Android Chrome with responsive multi-touch virtual controls (steering slider/buttons, throttle, brake) locked in landscape orientation.
- **Connectivity & Storage:** Fully playable offline after initial asset caching via Service Worker. Save states, championship standings, and ghost telemetry stored in browser `localStorage` and `IndexedDB`.

---

## 4. Core Scope for Version One (V1)

### The Single Job of V1
Deliver an exhilarating, rock-solid 60 FPS racing experience from race start to season podium across desktop and mobile browsers, featuring deep AI rivalries and precision time-trial ghost chasing.

### Must-Have for V1
1. **Dynamic Camera System:** Default **High-Chase** (top-back) camera for optimal forward track visibility; settings toggle for **Low-Chase** (immersive rear bumper) and **Classic Top-Down** (retro arcade).
2. **8-Race Seasonal Calendar:** Balanced progression (~120 seconds target duration per race):
   - *Stages 1 & 2 (Highways):* Coastal Freeway & Sunlit Expressway (Wide, forgiving sweepers to master slipstreaming).
   - *Stages 3 & 4 (City Grids):* Metro Boulevard & Downtown Neon (90-degree corners, chicane chokepoints, narrow overtaking lanes).
   - *Stages 5 & 6 (Mixed Country):* Gravel Ridge & Valley Shortcut (Mixed tarmac and dirt shoulders testing All-Terrain tires).
   - *Stages 7 & 8 (Stormy Mountains):* Alpine Torrent & Misty Peak Pass (Rain-slicked asphalt, torrential weather, hairpin turns testing Wet tires).
   - *Format:* 5 closed circuits (2–3 laps) and 3 point-to-point sprints.
3. **20-Driver Persistent AI Grid:** 19 persistent AI drivers with predetermined names, racing colors, and terrain affinities (e.g., city specialists, wet-weather aces, aggressive highway drafters).
4. **Equal-Spec Physics & Pure Racecraft:**
   - No artificial nitro buttons or upgrade stats; all cars share identical baseline speed and handling.
   - **Slipstream Drafting:** Trailing within ~20m of an opponent's wake cone for >1.5 seconds grants a progressive +8% to +10% top-speed boost with aerodynamic wind visuals and audio whoosh to slingshot past.
5. **Tactical Tire Choice (1-Click at Starting Line):**
   - **Street:** Peak grip and acceleration on dry tarmac; severe traction loss on wet road or dirt shoulders.
   - **Wet:** Maximum drainage and grip during rain stages; sluggish top speed and drag on bone-dry highways.
   - **All-Terrain:** Neutral, stable grip across all surfaces; immune to dirt/curb penalties but slightly lower peak highway speed.
6. **Pre-Race Qualifying:** Settings toggle allowing the player to choose between a **1-Lap Flying Qualifying** or a **Quick Single-Sector Sprint** to set grid position (1st to 20th).
7. **Hybrid Collision & Damage Model:**
   - *Minor contact / glancing blows:* Arcade elastic bounce, spark particle burst, and momentary speed scrub.
   - *High-speed head-on impact:* Triggers a "Wreck" animation with a 3–4 second spin and track reset penalty.
   - *3 Seasonal Restart Tokens:* Allows restarting a race if wrecked or stuck in a poor position. When all 3 tokens are exhausted, race results are final and locked into the championship table.
8. **Championship Scoring System:**
   - Points awarded from 1st down to 15th place (25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1).
   - +1 Bonus Point for Fastest Lap of the race.
   - +2 Bonus Points for Clean Driving (zero severe collisions or resets).
9. **Game Modes:**
   - **Championship:** 8-race season with persistent points table, qualifying, and trophy ceremony.
   - **Quick Race:** Instant grid race on any unlocked track with customizable weather and laps.
   - **Time Trial with Dual Ghost Replay:** Race against both your **Personal All-Time Best (PB) Ghost** and your **Previous Session Lap Ghost** loaded from `IndexedDB`.
10. **Audio Engine:** Procedural Web Audio API engine rev synthesizer (pitch-modulated by RPM), tire screech oscillators, collision crunch SFX, and atmospheric wind/slipstream audio.

### Out of Scope for V1 (Future / V2)
- Online real-time multiplayer / peer-to-peer WebRTC lobbies.
- Global cloud leaderboards and user accounts.
- Car garage customization (livery editors, mechanical tuning parts).
- Microtransactions, ads, or monetization systems.

---

## 5. Assumptions & Validation Register

| Assumption | Status | Validation Strategy |
|---|---|---|
| Three.js can sustain 60 FPS on mobile Safari/Chrome with 20 active cars and track scenery. | **ASSUMPTION** | Build a Phase 2 rendering/physics spike testing 20 instanced car meshes with low-poly track geometry and measure frame pacing via Chrome Performance DevTools. |
| Virtual touch controls on mobile feel responsive without interfering with browser gestures. | **ASSUMPTION** | Apply `touch-action: none` and test multi-finger touch tracking (simultaneous steering and throttle/brake) on real iOS and Android devices. |
| Slipstream cone math is intuitive and fun without causing chaotic pack pileups. | **ASSUMPTION** | Tune forward raycast detection angle and speed delta curve in early physics prototype. |
| Web Audio API can pitch-shift engine tones cleanly without audio crackle on mobile browsers. | **ASSUMPTION** | Prototype Web Audio oscillator node with user-gesture unlock verification. |
| IndexedDB can store high-density ghost telemetry (position/rotation at 30Hz for 120s) without storage warnings. | **FACT** | Telemetry for 120s @ 30Hz with Float32 arrays requires < 150 KB per track, well within standard browser storage quotas. |

---

## 6. Sustainability & Infrastructure

- **Cost Model:** \$0.00 / month running cost.
- **Hosting:** Static CDN deployment (Cloudflare Pages, GitHub Pages, or Vercel Free Tier).
- **Maintenance:** Solo developer maintenance; zero server management, zero database maintenance, zero ongoing recurring subscriptions.

---

## 7. Legal, Privacy & Safety Checklist

- **Personal Data & Privacy Laws:** Zero personal data collected, stored, or processed. No cookies, no tracking scripts, no third-party analytics. NDPA/GDPR obligations do not apply.
- **Intellectual Property:** All car models, liveries, driver names, and track layouts are 100% fictional and original.
- **Harm & Content Rating:** Non-violent arcade gameplay, family-friendly, suitable for all ages.

---

## 8. 90-Day Success Metric

- A fully playable, zero-glitch browser release where players can complete an entire 8-race season from start to finish on both desktop (keyboard/gamepad) and mobile (touch) maintaining a stable 60 FPS, with all championship points, settings, and time-trial ghosts persisting reliably across browser sessions.

---

## 9. Verdict & Next Steps

### Verdict: **GO**
The vision is well-defined, mechanically cohesive, and technically feasible. All core gameplay parameters, calendar progressions, collision models, and storage schemas have been established.

### Kill or Pivot Signals (During Development):
- If Three.js 3D rendering cannot maintain 50+ FPS on baseline mobile hardware with 20 cars, pivot to stylized low-poly flat shading or reduced draw-distance LODs.
- If virtual steering touch controls feel imprecise on glass, refine touch controls to a thumb-slider or tilt steering with adjustable sensitivity.

### Immediate Next Step
Proceed directly to **Step 2: P02 (Project Blueprint)** to draft the comprehensive technical architecture, data model, physics loop formulas, and build plan in `docs/PROJECT_PLAN.md`.
