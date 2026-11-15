# PROGRESS: Apex Slipstream

Last updated: 2026-11-14  
Current Status: All Milestones (M1–M8) Complete · Production Released & Launch Ready 🚀

---

## 1. Roadmap & Milestones

| Milestone | Goal | Effort | Status | Completed Date | Walkthrough / Report |
|---|---|---|---|---|---|
| **M1: Walking Skeleton** | Vite + TypeScript + Three.js + GitHub CI + Cloudflare Pages deploy | S | **COMPLETED** | 2026-11-14 | [M1 Walkthrough](file:///C:/Users/asejik/.gemini/antigravity/brain/3fd22b07-fc0a-41ca-9988-d6d7b8e41220/milestone_1_walkthrough.md) |
| **M2: Vehicle Physics & Camera** | 60Hz fixed-timestep physics, 3 camera modes, keyboard & gamepad | M | **COMPLETED** | 2026-11-14 | [M2 Walkthrough](file:///C:/Users/asejik/.gemini/antigravity/brain/3fd22b07-fc0a-41ca-9988-d6d7b8e41220/milestone_2_walkthrough.md) |
| **M3: Procedural Spline Tracks** | Catmull-Rom road extrusion, surface tagging, checkpoints & lap timing | L | **COMPLETED** | 2026-11-14 | [M3 Walkthrough](file:///C:/Users/asejik/.gemini/antigravity/brain/3fd22b07-fc0a-41ca-9988-d6d7b8e41220/milestone_3_walkthrough.md) |
| **M4: Slipstream, Tires & Audio** | Drafting wake cone, 3-tire strategy matrix, procedural Web Audio synth | L | **COMPLETED** | 2026-11-14 | [M4 Walkthrough](file:///C:/Users/asejik/.gemini/antigravity/brain/3fd22b07-fc0a-41ca-9988-d6d7b8e41220/milestone_4_walkthrough.md) |
| **M5: 19 AI Drivers & Grid** | 19 persistent AI drivers, collision dynamics, 3 restart tokens | L | **COMPLETED** | 2026-11-14 | [M5 Walkthrough](file:///C:/Users/asejik/.gemini/antigravity/brain/3fd22b07-fc0a-41ca-9988-d6d7b8e41220/milestone_5_walkthrough.md) |
| **M6: Championship & Qualifying** | 8-race calendar, qualifying (1-lap vs sector), points 1st–15th, standings | L | **COMPLETED** | 2026-11-14 | [M6 Walkthrough](file:///C:/Users/asejik/.gemini/antigravity/brain/3fd22b07-fc0a-41ca-9988-d6d7b8e41220/milestone_6_walkthrough.md) |
| **M7: Ghost Time Trial Replays** | 30 Hz Float32Array telemetry recording/playback in IndexedDB | M | **COMPLETED** | 2026-11-14 | [M7 Walkthrough](file:///C:/Users/asejik/.gemini/antigravity/brain/3fd22b07-fc0a-41ca-9988-d6d7b8e41220/milestone_7_walkthrough.md) |
| **M8: Mobile & Launch Polish** | Touch controls (`touch-action: none`), PWA, pre-launch audits, live release | M | **COMPLETED** | 2026-11-14 | [M8 Walkthrough](file:///C:/Users/asejik/.gemini/antigravity/brain/3fd22b07-fc0a-41ca-9988-d6d7b8e41220/milestone_8_walkthrough.md) |

---

## 2. Audit & Quality Gate History

| Prompt / Audit | Mode / Stage | Date Run | Rigor | Status / Decision | Report Link |
|---|---|---|---|---|---|
| **P00 (Project Triage)** | Start | 2026-11-13 | LIGHT | Completed | [PROMPT_PLAN.md](file:///d:/dev/racing/docs/PROMPT_PLAN.md) |
| **P01 (Idea Refinement)** | Think (Mode A) | 2026-11-13 | LIGHT | Completed | [IDEA_BRIEF.md](file:///d:/dev/racing/docs/IDEA_BRIEF.md) |
| **P02 (Project Blueprint)** | Plan (New) | 2026-11-13 | LIGHT | Completed | [PROJECT_PLAN.md](file:///d:/dev/racing/docs/PROJECT_PLAN.md) |
| **P04 (Setup & Guardrails)** | Setup | 2026-11-14 | LIGHT | Completed | [SETUP.md](file:///d:/dev/racing/docs/SETUP.md) |
| **P05 (UI Design Direction)** | Build (Part B) | 2026-11-14 | LIGHT | Direction A Approved | [DESIGN.md](file:///d:/dev/racing/docs/DESIGN.md) |
| **P07 (Production Readiness)** | MID | 2026-11-14 | LIGHT | Verified 60 FPS / 20 Cars | [FINDINGS.md](file:///d:/dev/racing/docs/audits/FINDINGS.md) |
| **Web Game Engine & Feel** | MID | 2026-11-14 | LIGHT | Elevation / Clamping Fixed | [FINDINGS.md](file:///d:/dev/racing/docs/audits/FINDINGS.md) |
| **P09 (Architecture & UX)** | Pre-Launch | 2026-11-14 | LIGHT | Grade A (Approved) | [P09_2026-11-14.md](file:///d:/dev/racing/docs/audits/P09_2026-11-14.md) |
| **P08 (Security Audit)** | Pre-Launch | 2026-11-14 | LIGHT | Passed (0 Vulnerabilities, Strict CSP) | [P08_2026-11-14.md](file:///d:/dev/racing/docs/audits/P08_2026-11-14.md) |
| **P12 (Egress & Efficiency)** | Pre-Launch | 2026-11-14 | LIGHT | Grade A+ (155 kB Gzip Transfer) | [P12_2026-11-14.md](file:///d:/dev/racing/docs/audits/P12_2026-11-14.md) |
| **P11 (SEO & Social Cards)** | Pre-Launch | 2026-11-14 | LIGHT | Passed (Open Graph, PWA Manifest) | [P11_2026-11-14.md](file:///d:/dev/racing/docs/audits/P11_2026-11-14.md) |
| **P07 (Production Readiness)** | Pre-Launch | 2026-11-14 | LIGHT | Passed (60 FPS, Zero Allocations) | [P07_2026-11-14.md](file:///d:/dev/racing/docs/audits/P07_2026-11-14.md) |
| **P13 & P14 (Launch Gate)** | Pre-Launch | 2026-11-14 | LIGHT | 10/10 Gates Passed · GO FOR LAUNCH (not upheld by P15) | [P13_P14_2026-11-14.md](file:///d:/dev/racing/docs/audits/P13_P14_2026-11-14.md) |
| **P15 (Independent Review)** | Post-Launch | 2026-11-14 | LIGHT | SOUND WITH FIXES · 2 HIGH, 13 MEDIUM, 2 LOW open | [P15_2026-11-14.md](audits/P15_2026-11-14.md) |

---

## 3. Current Task / Next Steps

- **Completed:** Milestone 8 (Mobile Touch Controls with virtual steering slider and pedal triggers, landscape orientation lock prompt, PWA manifest and offline Service Worker, Cloudflare Pages security headers, and pre-launch audit suite P07, P08, P09, P11, P12, P13, P14). 62 passing unit tests across 14 test suites, verified live in browser with zero console errors.
- **Project Status:** Live at `https://apex-slipstream.pages.dev/`, but not complete. The P15 independent review (2026-11-14) found sprint races cannot be finished (season stalls at round 2) and several planned features missing. See `docs/audits/FINDINGS.md`.
- **2026-11-14 · P15-01 fixed** (branch `fix/p15-01-sprint-finish`): sprints now finish at a gantry at the end of the road; AI cars stop at the end, record a finish time and leave the race; sprint results are ordered by real finish time. Circuits unchanged. 67/67 tests (5 new). Owner playtest feedback logged as U-01 to U-08 in FINDINGS.md.
- **Known issues:** live position stuck at P20 (U-01); short tracks and sharp bends (U-02); hard to turn (U-03); no barriers (U-04); collision spins (U-05); no countdown (U-06); box cars (U-07); no menu or settings (U-08).
- **2026-11-14 · Vision decisions recorded** (branch `docs/vision-decisions`): PROJECT_PLAN.md gains the Phase 2 Vision Rebuild roadmap (R1–R10) and Decisions Log #6–#13. Confirmed: offline personal project, with no accounts, leaderboards or cloud saves.
- **2026-11-14 · U-01 fixed** (branch `fix/u-01-race-position`): the live position no longer sticks at P20. Checkpoints are now gates you cross (running wide still counts), lap counting starts from your grid slot, and a new `RaceOrder` module decides who is ahead for both the HUD and the results. AI cars record finish times on circuits. 75/75 tests (8 new). New findings U-09 (fastest-lap bonus always yours), U-10 (service worker in dev), U-11 (grid ahead of line).
- **2026-11-15 · XP decision recorded** (branch `docs/xp-decision`): Decision #14, XP for career and unlocks only, never performance; added to R9.
- **2026-11-15 · P15-08 fixed** (branch `fix/p15-08-wrong-way`): the WRONG WAY banner now shows only when driving backwards. Its pulse animation had been overriding the hidden state. 78/78 tests (3 new). Browser-checked: hidden at start and driving forward, pulsing when reversed.
- **Working mode from 2026-11-15:** the owner asked to build faster: decisions are made and reported after, and every branch is pushed with a PR.
- **2026-11-15 · P15-04 fixed** (branch `fix/p15-04-tire-selector`): on phones and touch screens the tire selector now sits under the title as three large buttons, and the speedometer sits between the thumb controls. Desktop is unchanged. 81/81 tests (3 new). New findings U-12 (top-right buttons overlap the pedals on phones) and U-13 (dev server crash on HTML edits).
- **2026-11-15 · P15-07 fixed** (branch `fix/p15-07-track-button`): the track button [T] now steps through all 8 tracks as practice. The badge says "Practice", results don't count, and restarts don't use tokens. Stepping all the way round returns to the championship round. 83/83 tests (2 new).
- **Next:** R1 — P15-03, P15-06, U-09; then R2 driving feel.
