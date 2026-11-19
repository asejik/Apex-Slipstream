# Apex Slipstream

An offline 3D arcade racer for the web and phones: championships, Quick Races and Time Trials against your own ghost, on eight daylight tracks with weather, slipstreaming and 19 AI drivers.

Play it at **https://apex-slipstream.pages.dev**. It installs as an app and runs with no connection after the first visit. Everything is saved in your browser only (Settings → Your save makes a backup file).

## Built with

Vite, TypeScript (strict) and Three.js, with the Web Audio API for engine sound. There is no server: the game is static files on Cloudflare Pages.

## Running it locally

You need Node 22.

```sh
npm ci
npm run dev        # the game at http://localhost:5173
```

## Checks

| Command | What it checks |
|---|---|
| `npx tsc --noEmit` | Types (strict) |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build into `dist/` |
| `npx playwright test` | The browser journeys. Set `E2E_GL=gpu` on a machine with a graphics card; CI uses `E2E_GL=warp` |
| `npm run knip` | Unused files, exports and dependencies |

CI (`.github/workflows/ci.yml`) runs the first four, plus knip, on every pull request (`build-and-test`, required), and the browser journeys on Windows (`e2e`).

## Where things are

| Folder | What lives there |
|---|---|
| `src/main.ts` | Wires the game together: sessions, screens and the frame loop |
| `src/engine/` | The race: physics, laps, race order, slipstream, driving aids (`RaceWorld.ts` runs one physics step) |
| `src/ai/` | The 19 AI drivers: racing line, speed plans, traffic |
| `src/track/` | Track layouts and the road, kerbs and walls built from them |
| `src/render/` | The 3D scene, the car model and drawing each frame (`FrameRenderer.ts`) |
| `src/ui/` | The HUD and every screen |
| `src/app/` | Game rules and saved data: sessions, settings, career, save file, results |
| `tests/`, `e2e/` | Unit tests, and the Playwright browser journeys |
| `docs/` | The plan, design system, progress log, runbook and audits |

## Docs

- `AGENTS.md`: the rules for working on this code (read first).
- `docs/PROJECT_PLAN.md`: what the game is, and the Decisions Log.
- `docs/DESIGN.md`: colours, type, spacing and the 3D scene.
- `docs/PROGRESS.md`: what was built, when, and how it was checked.
- `docs/RUNBOOK.md`: deploys, rollbacks and what to do when something breaks.
- `docs/SETUP.md`: how the repository, CI and hosting are set up.
- `docs/audits/FINDINGS.md`: every audit finding and its status.
- `docs/CREDITS.md`: licences for the fonts and the car model.
