# FINDINGS REGISTER: Apex Slipstream

<!--
Every audit adds its findings here and every fix marks them FIXED. Never delete rows.
P09's grade and P14's launch gate both read from this file.
-->

| ID | Title | Severity | Source (audit + date) | Status | Found | Closed | Notes |
|---|---|---|---|---|---|---|---|
| P15-01 | Sprint tracks cannot be finished at the finish gantry | HIGH | P15 2026-11-14 | FIXED | 2026-11-14 | 2026-11-14 | Branch fix/p15-01-sprint-finish: finish checkpoint + gantry at road end, AI park and record finish time, sprint results ordered by finish time |
| P15-02 | Launch gate and audit reports assert things that are not true | HIGH | P15 2026-11-14 | OPEN | 2026-11-14 | | Re-run audits per P15 re-run plan |
| P15-03 | Qualifying needs full race distance; both modes identical | MEDIUM | P15 2026-11-14 | FIXED | 2026-11-14 | 2026-11-15 | Branch fix/p15-03-qualifying: `QualifyingManager.sessionTimeMs` ends a flying lap after one lap and a sector sprint after sector 1; AI benchmarks scaled to the same distance; HUD banner shows the qualifying result. AI pace calibration stays with P15-13 / R6 |
| P15-04 | Tire selector off-screen on phone landscape | MEDIUM | P15 2026-11-14 | FIXED | 2026-11-14 | 2026-11-15 | Branch fix/p15-04-tire-selector: when touch controls show, TouchController adds `touch-controls-active` to body; tire selector moves under the title as a vertical stack, speedometer sits between the thumb zones, keyboard hint hidden. Checked at 844x390, 667x375, 1024x768 touch, 1366x768 desktop |
| P15-05 | Wet tires never useful; no wet surface exists | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | `wetGrip` unused; values differ from US-03 |
| P15-06 | Stored PB ghost overwritten by first lap each session | MEDIUM | P15 2026-11-14 | FIXED | 2026-11-14 | 2026-11-15 | Branch fix/p15-06-pb-ghost: laps compared with the stored PB time (`isNewPersonalBest`), no PB claimed until the stored PB has loaded, ghosts saved under the track on screen (practice). Showing the previous-lap ghost moves to Time Trial (R8) |
| P15-07 | Track button [T] desyncs track and season round | MEDIUM | P15 2026-11-14 | FIXED | 2026-11-14 | 2026-11-15 | Branch fix/p15-07-track-button: [T] steps through all tracks as practice (badge says so, results not recorded, restarts free); stepping round returns to the championship round with its grid. New `TrackSelection` module, tests/trackSelection.test.ts |
| P15-08 | WRONG WAY banner permanently visible | MEDIUM | P15 2026-11-14 | FIXED | 2026-11-14 | 2026-11-15 | Branch fix/p15-08-wrong-way: pulse animation moved to `.wrong-way-alert.active`; HUD toggles the class instead of inline opacity. tests/hud.test.ts |
| P15-09 | Per-frame allocations in game loop | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Breaks AGENTS.md hot-loop rule |
| P15-10 | Track meshes never disposed on reload | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Geometries 117→147 over 6 reloads |
| P15-11 | Planned features missing but reported complete | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Time Trial, Quick Race, menu, pause, settings, etc. |
| P15-12 | No E2E tests; several unit tests cannot fail | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Playwright not installed |
| P15-13 | AI on rails; terrain affinity has no effect | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | `QualifyingManager.ts:43` self-comparison |
| P15-14 | Offline play fails until second online visit | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | JS bundle not precached |
| P15-15 | Share-card image is a relative SVG path | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | SUSPECTED; validators not run |
| P15-16 | Finale may be replayed and double-counted after reload | LOW | P15 2026-11-14 | OPEN | 2026-11-14 | | SUSPECTED |
| P15-17 | Assorted polish (debug global, dead file, CSP, stale docs) | LOW | P15 2026-11-14 | OPEN | 2026-11-14 | | See P15 report |
| U-01 | Live race position stuck at P20 after overtaking | HIGH | Owner playtest 2026-11-14 | FIXED | 2026-11-14 | 2026-11-14 | Branch fix/u-01-race-position. Causes: missing a checkpoint by >18 m froze the lap count; grid slots P1–P10 start past checkpoint 1; circuit results counted the player one lap short. Fix: gate-crossing checkpoints, lap count starts from spawn, shared RaceOrder for live position and results, AI circuit finish times |
| U-02 | Tracks too short (sprint ~30 s, laps < 1 min) and bends too sharp | HIGH | Owner playtest 2026-11-14 | OPEN | 2026-11-14 | | Part 1 done 2026-11-15 (branch fix/u-02-tight-bends): circuits enlarged 1.5 times and every bend eased to at least 30 m radius (was 3 to 9 m). Laps are now 940 to 1,390 m. Stays OPEN: laps are still under a minute and sprints are unchanged; full track redesign is R5 |
| U-03 | Car hard to turn into corners | HIGH | Owner playtest 2026-11-14 | FIXED | 2026-11-14 | 2026-11-15 | PR #21: turning circle at top speed 81 m to 45 m (`highSpeedYawGain`). Branch fix/u-03-render-interpolation: cars and camera drawn between physics steps (`RenderPose`); even motion measured at 60, 90 and 144 Hz. Owner playtest 2026-11-15: feels great |
| U-04 | No barriers at road edges; cars stray off track indefinitely | MEDIUM | Owner playtest 2026-11-14 | OPEN | 2026-11-14 | | |
| U-05 | Cars spin in circles after collisions, especially at the start | MEDIUM | Owner playtest 2026-11-14 | FIXED | 2026-11-14 | 2026-11-15 | Branch fix/u-05-collision-spins. Three causes: the spin was 8 rad/s for 3 s with the car stopped; impact speed counted any speed difference, so door-rubbing was a crash; an AI hitting the player from behind spun itself. Now: one turn in 1 s while still moving, impact speed is closing speed along the contact line, and an AI at fault brakes without spinning. Browser: 1.02 turns drawn, car travelled 106 m while recovering |
| U-06 | No 3-2-1-GO countdown; race starts immediately | MEDIUM | Owner playtest 2026-11-14 | OPEN | 2026-11-14 | | Grid should be held in qualifying order until GO |
| U-07 | Cars are plain boxes; owner wants near-realistic cars without lag | MEDIUM | Owner playtest 2026-11-14 | OPEN | 2026-11-14 | | Needs licensed glTF models + performance budget |
| U-08 | Interface far from vision; no menu, dashboard or settings | HIGH | Owner playtest 2026-11-14 | OPEN | 2026-11-14 | | Reference: F1 and eFootball menus/HUD. Overlaps P15-11 |
| U-09 | Player always wins the fastest-lap bonus | MEDIUM | U-01 fix verification 2026-11-14 | FIXED | 2026-11-14 | 2026-11-15 | Branch fix/u-09-fastest-lap: AI cars record real lap times; player and AI use the same rule (`countsForFastestLap`: lap 1 excluded on circuits, sprint run counts). Browser: P20 got no bonus, the AI with the real fastest lap did |
| U-10 | Service worker caches old code during local development | LOW | U-01 fix verification 2026-11-14 | OPEN | 2026-11-14 | | `main.ts` registers `/sw.js` on any http origin, including `localhost:5173`; dev reloads can run stale code. Related to P15-14 |
| U-11 | Grid sits ahead of the start line | LOW | U-01 fix 2026-11-14 | OPEN | 2026-11-14 | | P1 starts 175 m past the line, so front rows race a shorter first lap. Fix with U-06 (countdown grid) |
| U-12 | Top-right button stack overlaps the pedals on phones | MEDIUM | P15-04 fix verification 2026-11-15 | OPEN | 2026-11-15 | | At 844x390 and 667x375 the Track button sits under ACCEL and can't be tapped. These buttons belong in a pause/settings menu (R4/R5, U-08) |
| U-13 | Dev server crashes when index.html changes | LOW | P15-04 fix verification 2026-11-15 | OPEN | 2026-11-15 | | `vite` exits with Windows code 0xC000041D shortly after an HTML edit. Workaround: build + `vite preview`. Dev tooling only |

Statuses:
- OPEN: not fixed yet
- FIXED: fixed and re-checked (note the commit/PR)
- ACCEPTED RISK: deliberately not fixed (requires rationale and review date)
- WON'T FIX: not a problem in this context
- REGRESSED: was FIXED and returned

## Accepted Risks

| ID | Reason | Accepted by | Date | Review by |
|---|---|---|---|---|
