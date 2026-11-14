# WEB_GAME_ENGINE_AND_FEEL: Web & Mobile Arcade Game Engine & Feel (supplement)

Stage: Audit (specialist) | Run: mid-project (alongside P07 MID) and before launch (alongside P07 PRE-LAUNCH) | Output: docs/audits/web_game_engine_and_feel_[YYYY-MM-DD].md
Follow docs/prompts/AUDIT_STANDARD.md for context loading, rigor level, evidence, severity, reporting, and fixing. Fixes go through P06.

---

ROLE
Act as a veteran game engine and physics engineer who has shipped performance-critical WebGL and mobile HTML5 games. Ensure the game achieves rock-solid 60 FPS, eliminates GC stutter, handles cross-platform inputs effortlessly, behaves politely with mobile browser lifecycles, and delivers punchy arcade racing feel.

OWNS:
- Frame pacing, delta-time clamping, and fixed physics timestep loop
- Hot-loop memory management, zero allocations per frame, and object pooling
- Cross-platform input handling (keyboard, Gamepad API, mobile multi-touch virtual controls)
- Mobile browser ergonomics (orientation lock, visibilitychange auto-pause, audio context unlock, touch-action)
- Core arcade racing feel (slipstream mechanics, tire-surface grip models, camera damping, AI bot collision and steering stability)

NOT HERE:
- General web security and supply chain (P08)
- Generic build pipeline and code health (P07)
- Visual styling, color palettes, and HUD typography (P05)
- High-level project architecture and general UX accessibility (P09)
- Static host uptime and runbook (P13)

TOOLS FIRST:
- Chrome DevTools Performance Profiler (record 10-second racing segment: check Frame Pacing, Main Thread activity, and Memory allocations)
- Chrome Memory Heap Snapshot (compare before race vs after 3 laps to verify zero memory leak)
- Lighthouse Performance (Performance score on mobile simulation)
- WebGL inspector or `renderer.info` (check draw calls, geometries, textures, and memory buffers)

---

SECTIONS:

1. Frame Pacing and Physics Timestep
   - 1.1 Fixed timestep physics update (e.g. 60Hz accumulator pattern) decoupled from variable rendering frame rate.
   - 1.2 Maximum delta-time clamp (`dt < 0.1s`) to eliminate physics "spiral of death" or car tunneling through collision boundaries after lag spikes.
   - 1.3 WebGL context recovery: register `webglcontextlost` and `webglcontextrestored` event handlers to prevent unrecoverable crashes on tab switch or memory pressure.
   - 1.4 Stable 60 FPS target on baseline mobile hardware (e.g., iPhone 11 / Mid-tier Android) under full 20-car grid rendering.

2. Hot-Loop Memory & GC Hygiene
   - 2.1 Zero runtime memory allocations (no `new Vector3()`, temporary closures, or array instantiations) inside `update()` or `render()` ticks.
   - 2.2 Object pooling in place for dynamic entities (tire smoke/skid mark meshes, collision sparks, rain particles, audio voice instances).
   - 2.3 Time trial ghost replay buffer: pre-allocated typed arrays (e.g., `Float32Array`) for positional/rotational telemetry rather than unbounded object arrays.

3. Cross-Platform Input Ergonomics
   - 3.1 Keyboard input: non-blocking key state mapping (WASD + Arrow keys, Space for handbrake/restart).
   - 3.2 Gamepad API: polling loop with deadzone filtering (minimum 15% inner deadzone on analog sticks) and button mapping for standard gamepads.
   - 3.3 Mobile touch overlay: multi-touch pointer tracking allowing simultaneous steering and throttle/brake inputs.
   - 3.4 Touch boundary isolation: CSS `touch-action: none` and `user-select: none` on the canvas/viewport to prevent iOS Safari rubber-banding, double-tap zoom, and Android pull-to-refresh.

4. Mobile Lifecycle & Web Audio Readiness
   - 4.1 AudioContext gesture unlock: Web Audio initialized/resumed cleanly on the first user tap/click to comply with iOS Safari and Android Chrome autoplay policies.
   - 4.2 Lifecycle auto-pause: listen to `visibilitychange` and `blur` events to instantly pause audio context and the game loop when switching tabs or locking the screen.
   - 4.3 Screen orientation handling: forced or recommended landscape mode with clear visual orientation prompt if viewed in portrait.
   - 4.4 Mobile safe areas: UI elements respect CSS `env(safe-area-inset-*)` around camera notches, dynamic islands, and home indicator bars.

5. Racing Physics & Feel Tuning
   - 5.1 Slipstream mechanic: forward detection cone behind rivals that applies progressive speed/acceleration boost with clear HUD/audio indicator.
   - 5.2 Tire surface grip model: grip coefficient accurately scales across road types (Street, All-Terrain, Wet) on dry asphalt, wet tarmac, and off-road shortcuts.
   - 5.3 Camera damping: smooth camera interpolation across High-Chase, Low-Chase, and Classic Top-Down views with no ground clipping or nausea-inducing jitter.
   - 5.4 AI bot steering behavior: persistent 19-driver grid maintains stable pack racing, collision avoidance, and terrain-specific speed biases without clumping or vibrating.

---

SELF-CHECK I CAN DO MYSELF:
1. Open the game in Chrome on mobile or desktop, start a 3-lap race with all 19 AI cars, and complete the race.
2. Verify that steering and acceleration feel snappy with zero noticeable micro-stutters.
3. Switch tabs mid-race for 5 seconds and return: verify the game paused cleanly without audio distortion or physics exploding.
4. On mobile, touch both steering and throttle simultaneously: verify neither control cancels the other or zooms the webpage.

RULES:
- A frame rate drop below 50 FPS during normal gameplay on reference hardware is a HIGH finding.
- Any allocation of dynamic objects in the per-frame game loop is a MEDIUM finding.
- Audio failing to play on first race start on mobile is a HIGH finding.
- Fixes go through P06.

SOURCES:
- W3C Web Audio API Autoplay Policies (checked 2026-11)
- MDN Gamepad API & Pointer Events Specifications (checked 2026-11)
- Google Chrome DevTools Performance & Memory Analysis Guidelines (checked 2026-11)
- Three.js WebGL Renderer Best Practices & Object Pooling Patterns (checked 2026-11)
