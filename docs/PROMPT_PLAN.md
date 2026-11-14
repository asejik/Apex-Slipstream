# PROMPT PLAN: Cross-Platform Arcade Racing Game

Generated: 2026-11-13 | Stage: Start | Rigor Level: LIGHT

---

## 1. Context & Classification

- **What is it:** A high-performance, cross-platform arcade racing game for web and mobile browsers (with PWA capabilities). Features a full 20-driver grid (player + 19 persistent AI drivers), 3 dynamic camera angles (High-Chase default, Low-Chase, Classic Top-Down), seasonal championship progression (multi-lap circuits and point-to-point sprints), single-lap qualifying, tactical tire choices (Street, All-Terrain, Wet), slipstream passing mechanics, points down to 15th, 3 seasonal restart tokens, Quick Race, and Time Trial ghost replays.
- **Audience & Ownership:** Personal project (indie game / portfolio) for public web & mobile players.
- **Platform:** Web Application / PWA built with Vite + TypeScript + Three.js/WebGL (playable in browser, mobile responsive, packaged/wrapped readily).
- **Backend & Data:** 100% client-side. Championship state, settings, and ghost telemetry buffers are stored in local browser storage (`IndexedDB` / `localStorage`). No backend servers, databases, or accounts.
- **Personal Data & Analytics:** None collected, stored, or transmitted.
- **Money & Monetization:** Completely free. No in-app purchases, no ads, no payment gateways.
- **AI Logic:** 100% local deterministic game bot logic (finite state machines, racing line splines, steering behaviors, terrain speed modifiers) with predetermined driver names and attributes. No external LLMs or generative AI APIs.
- **Archetype:** Public Client-Side Web Game / PWA.
- **Risk Drivers:**
  - Personal Data: None
  - Money: None
  - Legal Status: None
  - Destructive Actions: None
  - Public Exposure: Some (publicly playable web app)
  - AI: None (local bot heuristics only)
- **Provisional Rigor Level:** **LIGHT** (Zero data/money/legal risk; rigorous focus on 60 FPS rendering performance, zero GC frame drops, mobile touch ergonomics, and input handling).

---

## 2. Run Order

Follow this sequence from conception to public release. Steps marked with `[SOLO]` can be done directly by the developer without AI guidance.

### Phase 1: Inception & Architecture
1. **P01 (Idea Refinement - LIGHT)**  
   *When:* Now  
   *Paste:* `Follow docs/prompts/P01_idea_refinement.md, MODE A, SCOPE: core scope, constraints, and mechanics clarification (Rounds 1 and 4).`  
   *Output:* `docs/IDEA_BRIEF.md`
2. **P02 (Project Blueprint - USE)**  
   *When:* After P01  
   *Paste:* `Follow docs/prompts/P02_project_blueprint.md.`  
   *Output:* `docs/PROJECT_PLAN.md` (Game loop architecture, Three.js scene setup, physics timestep model, 20-car data structures, AI driver state machine, local storage schema, touch input mapping).
3. **P04 (Project Setup & Guardrails - LIGHT)**  
   *When:* Milestone 1 (Repo Initialization)  
   *Paste:* `Follow docs/prompts/P04_project_setup_guardrails.md, SCOPE: sections 1, 3, 4, 5, 8.`  
   *Output:* `docs/SETUP.md`, GitHub Actions CI workflow (linting, TypeScript `tsc --noEmit`, Vite production build).  
   *Action:* `[SOLO]` Initialize git repo and push to GitHub.
4. **P05 (UI Design Direction - USE)**  
   *When:* Before HUD & menu implementation  
   *Paste:* `Follow docs/prompts/P05_ui_design_direction.md, Part B (Design System Definition).`  
   *Output:* `docs/DESIGN.md` (Arcade HUD design: speedometer, position indicator, slipstream visual cues, tire selection modal, championship calendar & standings table, mobile virtual touch overlay layout).

### Phase 2: Implementation & Safe Changes
5. **P06 (Safe Change Protocol - USE)**  
   *When:* Every implementation task (game engine, track rendering, physics loop, AI driver behavior, championship progression, time trial ghost system, audio engine).  
   *Paste:* `Follow docs/prompts/P06_safe_change_protocol.md, TASK: [task description]`

### Phase 3: Mid-Project Verification
6. **P07 (Production Readiness Audit - LIGHT, MID Mode)**  
   *When:* Once core racing loop (player + 19 AI cars + 1 track) is playable.  
   *Paste:* `Follow docs/prompts/P07_production_readiness_audit.md, MODE: MID-PROJECT, SCOPE: sections 2, 4, 5, 6.`  
   *Output:* `docs/audits/P07_[YYYY-MM-DD].md`
7. **Supplement: Web Game Engine & Feel (MID Mode)**  
   *When:* Alongside P07 MID.  
   *Paste:* `Follow docs/prompts/project/web_game_engine_and_feel.md.`  
   *Output:* `docs/audits/web_game_engine_and_feel_[YYYY-MM-DD].md` (Verify 60 FPS, fixed physics timestep, zero allocations in render loop, touch controls).

### Phase 4: Pre-Launch Audits & Polish
8. **P09 (Architecture & Product Quality Review - LIGHT)**  
   *When:* All game modes (Championship, Quick Race, Time Trial) and tracks are integrated.  
   *Paste:* `Follow docs/prompts/P09_architecture_quality_review.md, SCOPE: sections 1, 2, 4, 5, 6.`  
   *Output:* `docs/audits/P09_[YYYY-MM-DD].md` (UX review, edge cases, tiebreakers, restart token resets, accessibility).
9. **P08 (Security Audit - LIGHT)**  
   *When:* Code freeze before public release.  
   *Paste:* `Follow docs/prompts/P08_security_audit.md, SCOPE: sections 1, 3, 5, 9, 10, 11.`  
   *Output:* `docs/audits/P08_[YYYY-MM-DD].md` (Input sanitization on player names, npm supply chain check, CSP headers for static host).
10. **P12 (Egress & Efficiency Audit - LIGHT)**  
    *When:* Pre-launch.  
    *Paste:* `Follow docs/prompts/P12_egress_efficiency_audit.md, SCOPE: sections 1, 4.`  
    *Output:* `docs/audits/P12_[YYYY-MM-DD].md` (Asset payload optimization: 3D model compression/Draco, texture formats, Web Audio sample sizes, caching headers).
11. **P11 (SEO & Discoverability Audit - LIGHT)**  
    *When:* Pre-launch.  
    *Paste:* `Follow docs/prompts/P11_seo_discoverability_audit.md, SCOPE: sections 4, 6.`  
    *Output:* `docs/audits/P11_[YYYY-MM-DD].md` (Meta tags, Open Graph share cards, PWA manifest icons, viewport configs).
12. **P07 (Production Readiness Audit - LIGHT, PRE-LAUNCH Mode)**  
    *When:* Pre-launch.  
    *Paste:* `Follow docs/prompts/P07_production_readiness_audit.md, MODE: PRE-LAUNCH, SCOPE: sections 2, 4, 5, 6.`  
    *Output:* `docs/audits/P07_[YYYY-MM-DD].md`
13. **Supplement: Web Game Engine & Feel (PRE-LAUNCH Mode)**  
    *When:* Alongside P07 PRE-LAUNCH.  
    *Paste:* `Follow docs/prompts/project/web_game_engine_and_feel.md.`  
    *Output:* `docs/audits/web_game_engine_and_feel_[YYYY-MM-DD].md`
14. **P13 (Live Operations - Part A LIGHT)**  
    *When:* Pre-launch.  
    *Paste:* `Follow docs/prompts/P13_live_operations.md, Part A, SCOPE: sections 1, 2.`  
    *Output:* `docs/RUNBOOK.md` (Static site deployment, rollback procedure, CDN cache invalidation).

### Phase 5: Launch
15. **P14 (Launch Gate - LIGHT)**  
    *When:* Final step before publishing link / releasing.  
    *Paste:* `Follow docs/prompts/P14_launch_gate.md, MODE: LIGHT.`  
    *Output:* `docs/audits/P14_[YYYY-MM-DD].md` (GO / NO-GO decision).

---

## 3. Decisions Table

| ID | Prompt | Decision | Reason & Scope | Trigger for LATER |
|---|---|---|---|---|
| **P01** | Idea Refinement | **LIGHT** | Mode A. Scope: core mechanics, track progression, ghost recording buffer constraints (Rounds 1 and 4). Full market validation skipped for personal project. | — |
| **P02** | Project Blueprint | **USE** | Fundamental architecture for game loop, 3D rendering, physics equations, AI driver states, local storage schema, and mobile touch mappings. | — |
| **P03** | Privacy & Data Protection | **SKIP** | Zero personal data or analytics collected, stored, or transmitted. 100% client-side local storage. | If player accounts, cloud saves, online leaderboards, or telemetry are introduced. |
| **P04** | Project Setup & Guardrails | **LIGHT** | SCOPE: sections 1 (Version control), 3 (CI checks), 4 (Secrets), 5 (Dependencies), 8 (TypeScript strict mode). Cloud server/key items are N/A. | — |
| **P05** | UI Design Direction | **USE** | Critical for arcade HUD (speedometer, position, slipstream indicator), championship standings, tire choice modal, and mobile virtual touch overlay. | — |
| **P06** | Safe Change Protocol | **USE** | Applied to every code change task during development. | — |
| **P07** | Production Readiness Audit | **LIGHT** | SCOPE: sections 2 (Business logic: points, qualifying, tire modifiers), 4 (Reliability/recovery: IndexedDB corruption fallback, offline support), 5 (Build health), 6 (Performance). Database & payments are N/A. | — |
| **P08** | Security Audit | **LIGHT** | SCOPE: sections 1 (Repo hygiene), 3 (Secrets), 5 (Sanitize player name display to prevent DOM injection), 9 (Supply chain), 10 (CSP headers), 11 (PWA manifest safety). Auth and payment sections are N/A. | — |
| **P09** | Architecture & Product Quality | **LIGHT** | SCOPE: sections 1 (Game loop architecture), 2 (UX & game feel), 4 (Accessibility & motion sensitivity), 5 (Completeness: sprint vs circuit rules, restart tokens), 6 (Testing). | — |
| **P10** | AI Feature Review | **SKIP** | AI drivers use deterministic game bot heuristics (state machines, waypoints, steering logic), not LLM or generative AI APIs. | If generative AI / LLM features (e.g., dynamic AI commentary, procedural LLM track descriptions) are added. |
| **P11** | SEO & Discoverability | **LIGHT** | SCOPE: sections 4 (On-page meta tags, viewport), 6 (Social cards & Open Graph preview image for link sharing). | — |
| **P12** | Egress & Efficiency Audit | **LIGHT** | SCOPE: sections 1 (Asset payload compression: 3D models, textures, audio buffers), 4 (Static caching headers & service worker). | — |
| **P13** | Live Operations | **LIGHT** | Part A only. SCOPE: sections 1 (Uptime check on static host), 2 (`docs/RUNBOOK.md` deployment & rollback). Server and incident management sections are N/A. | If an online backend or multiplayer server is deployed. |
| **P14** | Launch Gate | **LIGHT** | Short light-rigor go/no-go verification before publishing. | — |

---

## 4. Supplements

| Supplement | Path | What it covers | When it runs | Library Candidate? |
|---|---|---|---|---|
| **Web Game Engine & Feel** | `docs/prompts/project/web_game_engine_and_feel.md` | Fixed physics timestep, 60 FPS frame pacing, zero-allocation game loops, object pooling, mobile touch overlay (`touch-action: none`), Web Audio unlock, slipstream detection, and AI steering stability. | Alongside P07 at MID-PROJECT and PRE-LAUNCH | **Yes** (valuable for any future HTML5/WebGL canvas game). |

---

## 5. Check-Only Items

- **Attached to P07:** Verify `IndexedDB` quota handling and graceful degradation to `localStorage` or memory if storage is disabled in private/incognito browsing.
- **Attached to P08:** Verify custom player name input is properly sanitized against DOM injection (XSS) in leaderboards and HUD.
- **Attached to P09:** Verify screen shake and motion effects can be toggled off for players prone to motion sickness.
- **Attached to P14:** Confirm Web Audio initializes silently on first user interaction across iOS Safari and Android Chrome without console warnings.
- **Attached to P14:** Verify `touch-action: none` prevents accidental page zooming, scrolling, or pull-to-refresh during aggressive mobile steering.

---

## 6. Minimum If Short on Time

If development time is constrained, this reduced pipeline guarantees build quality and prevents shipping critical regressions:

1. **P02 (Project Blueprint):** Define game loop, physics model, state schema, and data structures.
2. **P04 (Setup - LIGHT):** Git, TypeScript strict mode, and automated build verification.
3. **P06 (Safe Change Protocol):** Strictly used for each implementation step.
4. **Supplement `web_game_engine_and_feel.md` + P07 (LIGHT):** Verify 60 FPS, touch controls, scoring logic, and memory stability.
5. **P14 (Launch Gate - LIGHT):** Final mobile and desktop device smoke test.

---

## 7. Re-Triage Triggers

Run P00 again if any of the following occur:
- **Adding an online backend or database:** (e.g., global online leaderboards, cloud save sync, user accounts) -> Triggers P03 (Privacy) and full P07/P08/P13.
- **Adding multiplayer:** (e.g., WebSockets / WebRTC peer-to-peer racing) -> Triggers netcode architecture in P02, security in P08, and live ops in P13.
- **Adding monetization:** (e.g., ads, Web Monetization, microtransactions) -> Triggers P03 (ad tracking cookies), P07 (payment flows), and P08 (payment security).
- **Packaging for native app stores:** (e.g., Google Play / Apple App Store via Capacitor) -> Triggers Store Release supplement and mobile permissions review.
- **Adding Generative AI:** (e.g., dynamic race commentary or AI-generated track generation via LLMs) -> Triggers P10.
