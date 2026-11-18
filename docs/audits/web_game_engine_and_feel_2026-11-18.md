# Web Game Engine and Feel Audit: 2026-11-18 (LIGHT)

First run of `docs/prompts/project/web_game_engine_and_feel.md`. The P15 review found it had never been run, although the launch gate cited it. Checked on `main` at the merge of #79.

**Machine:** a Windows laptop with Intel HD Graphics 520 (an integrated GPU of about the class of a mid-range phone's), headless Chromium on the real GPU (`--use-angle=d3d11`). It is not a real phone; see NOT VERIFIED.

## 1. Context

- **Rigor: LIGHT** (personal, offline, no data, no money).
- **All five sections apply.**
- **Tools:**
  - Frame times from `requestAnimationFrame` over 20 s in a running race.
  - `renderer.info` (draw calls, triangles, geometries).
  - Lost-context and restore through `WEBGL_lose_context`.
  - Two-finger touch through the Chrome DevTools Protocol.
  - A simulated hidden tab.
  - Code reading.
- **Not run:** a DevTools Performance recording and Lighthouse, as GUI tools. The measurements above stand in for them, and P07 covers load speed.

## 2. Top fixes

1. **EF-R01:** add a 15% stick deadzone. One constant.
2. **EF-R02:** profile the rare long frame on a real phone before anything else.

## 3. Findings

| ID | Severity | Section | Finding | Confidence |
|---|---|---|---|---|
| EF-R01 | LOW | 3.2 | Gamepad stick deadzone is 10%; the prompt asks for at least 15% | VERIFIED |
| EF-R02 | LOW | 1.4 | One-off frame hitches of 117–283 ms, in 2 of 8 twenty-second runs | VERIFIED (seen), cause SUSPECTED |
| P15-09 remainder | (FIXED, noted) | 2.1 | 1–4 KB of garbage per frame from engine-level number boxing and five functions returning small objects (P09-R04) | VERIFIED |

**EF-R01: stick deadzone.**
- **Where:** `src/engine/InputManager.ts:194-197`:
  ```ts
  // Left stick X with 0.1 deadzone
  const stickX = gp.axes[0] ?? 0;
  if (Math.abs(stickX) > 0.1) {
  ```
- **Impact:** a worn stick that rests at 0.1–0.15 steers the car slightly on its own.
- **Fix:** 0.15, and rescale above it so steering still reaches full lock.
- **Verify:** rest the stick; the car runs straight.

**EF-R02: rare hitches.** Run 1 had one 283 ms frame (phone size, high) and one 117 ms frame (phone size, low). Run 2 of the same cases had none (maximum 17 ms). No shader was compiled at those moments (`renderer.info.programs` stayed the same). Garbage collection or the OS are the likely causes. Profile it on a phone.

## 4. Measurements

**Section 1.4: frame pacing.** Quick Race on Coastal Highway, 20 cars, flat out from the lights into the pack, measured for 20 s after 8 s of driving:

```
run1 desktop 1280x720 high dry {"fps":60,"p50":16.7,"p99":16.8,"max":33,"over33":0,"calls":34,"tris":152238}
run1 desktop 1280x720 high wet {"fps":59.8,"p50":16.7,"p99":16.8,"max":33,"over33":1,"calls":36,"tris":152238}
run1 phone 740x360@2x high dry {"fps":58.8,"p50":16.7,"p99":16.8,"max":283,"over33":3,"calls":34,"tris":152238}
run1 phone 740x360@2x low wet {"fps":59.5,"p50":16.7,"p99":16.8,"max":117,"over33":2,"calls":36,"tris":152238}
run2 desktop 1280x720 high dry {"fps":60,"p50":16.7,"p99":16.8,"max":17,"over33":0,"calls":34,"tris":152238}
run2 desktop 1280x720 high wet {"fps":60,"p50":16.7,"p99":16.8,"max":33,"over33":0,"calls":36,"tris":152238}
run2 phone 740x360@2x high dry {"fps":60,"p50":16.7,"p99":16.8,"max":17,"over33":0,"calls":34,"tris":152238}
run2 phone 740x360@2x low wet {"fps":60,"p50":16.7,"p99":16.8,"max":17,"over33":0,"calls":36,"tris":152238}
```

- **No drop below 50 fps** (the HIGH threshold) in any run.
- **One measurement thrown out:** a run while another process was building and testing on the same machine showed many 33 ms frames. It was discarded as contaminated, and both runs above were made on a quiet machine.

## 5. CHECKED AND PASSED

**1. Frame pacing and physics**
- **1.1 Fixed 60 Hz physics:** an accumulator in `gameLoop` (`src/main.ts`, `PHYSICS_STEP = 1 / 60`).
- **1.2 Delta clamp:** `MAX_ACCUMULATOR = 0.1`, and the delta is never negative.
- **1.3 Lost WebGL context:**
  - The game has no handler of its own (P09-R05). three.js r170's renderer handles it: after `loseContext()` and `restoreContext()` mid-race, the scene drew again with all cars and HUD, and there were no errors (screenshot in the audit session).
  - **Gap:** the race doesn't pause while the context is lost. LOW, not filed.

**2. Memory and garbage**
- **2.1 Hot loop:** see P15-09 (FIXED with remainder) and P09-R04.
- **2.2 Pooling:** rain, spray and wind lines use buffers made once (`src/effects/WeatherEffects.ts:124-160`, `src/effects/WindStreamlines.ts:16-49`) and only update their contents. No per-event meshes exist.
- **2.3 Ghost buffers:** `Float32Array` telemetry (`src/replay/`, `src/storage/GhostStorage.ts`).
- **Leaks:** geometries stay at 33–35 across 13 track loads (P15-10). They read 43 in a race here (cars and effects included), the same in every case.

**3. Input**
- **3.1 Keyboard:** key state is non-blocking, with arrows always active and rebinding available (R9).
- **3.3 Two fingers:** steering and throttle held at once on a 740×360 touch screen:
  ```
  {"speed":157,"touch":{"steer":1,"throttle":1,"brake":0,"drift":false},"zoom":1,"scrollY":0}
  ```
  Each finger is tracked by `identifier` (`src/ui/TouchController.ts:77-106`). No zoom or scroll happened.
- **3.4 Touch isolation:** `touch-action: none` and `user-select: none` on the game layers (`index.html:137-139`, `:826-828`).

**4. Mobile lifecycle**
- **4.1 Sound unlock:** Web Audio starts on a gesture and resumes on every gesture (`onUserGestures`, R9 part 6).
- **4.2 Hidden tab:** mid-race, the game went to `paused`, the sound context was `suspended`, and race time held: 3.450 s before, 3.483 s after 5 s hidden. It stayed paused on return.
  ```
  {"before":{"screen":"racing","t":3.45},"hidden":{"screen":"paused","audio":"suspended"},"after":{"screen":"paused","t":3.48}}
  ```
- **4.3 Upright phone:** the rotate prompt shows at 360×740 (E2E `phone.e2e.ts`).
- **4.4 Notches:** HUD and screens pad with `env(safe-area-inset-*)` (`index.html:163-166`, `:778-781`).

**5. Feel (with tests)**
- **5.1 Slipstream:** a 1.5 s draft gives a +10% boost with HUD banner and meter. It now fades when the boost ends (R10-03).
- **5.2 Tyres:** grip by compound, surface and weather (R7). Top speed now follows the tyre: 180 / 176.5 / 163.6 km/h (R10-01).
- **5.4 AI:** no contact in a 150 s race test (`tests/aiTraffic.test.ts`), and finished cars keep apart (R10-02).

## 6. NOT VERIFIED

- **A real phone:** 60 fps on an iPhone 11 or mid-range Android, iOS sound on the first race, and real two-thumb play. No device was available.
- **5.3 Camera feel:** no clipping in any screenshot, but "nausea" is the owner's call.
- **A full 3-lap race in real time:** the E2E journeys skip to the flag.

## 7. ACTIONS FOR ME

The prompt's self-check, on your phone:
- [ ] A full 3-lap race with 19 AI cars, all the way to the flag.
- [ ] Does steering and acceleration feel snappy, with no stutters?
- [ ] Switch tabs for 5 s mid-race: the game should be paused, with no crackle.
- [ ] Steer and throttle at once: neither should cancel the other, and the page shouldn't zoom.

## 8. Comparison

No earlier report exists. The 2026-11-14 launch gate cited this audit without it having been run (P15-02).
