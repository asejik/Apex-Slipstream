# RUNBOOK: Apex Slipstream

Written 2026-11-18 (P13 Part A, LIGHT, sections 1 and 2). For a personal, offline browser game. There is no server code, database, account system, payment, email or personal data, so most of a normal runbook does not apply. What does apply is short and below.

---

## 1. System map

| Part | Where it runs | Dashboard | Owner |
|---|---|---|---|
| Source code and CI | GitHub, `asejik/Apex-Slipstream` | github.com/asejik/Apex-Slipstream (Actions tab for CI) | You |
| Hosting (static files) | Cloudflare Pages, project `apex-slipstream`, free tier | dash.cloudflare.com → Workers & Pages → apex-slipstream | You |
| Live site | https://apex-slipstream.pages.dev | (the site itself) | You |
| Player data | Each player's own browser: localStorage (career, season, settings, keys, driver) and IndexedDB (ghost laps) | Browser DevTools → Application | The player |

- **Deploys:** Cloudflare Pages builds and deploys every push to `main` (`npm run build`, output `dist/`, see `wrangler.toml`). Every pull request gets its own preview address.
- **Response headers** (security policy, caching): `public/_headers`.
- **Offline copy:** the service worker (`public/sw.js`) keeps each build's files in the player's browser.
- **No keys or secrets exist** (`.env.example` explains why). Nothing to rotate.

## 2. Monitoring (P13 Part A section 1)

| Check | State | Note |
|---|---|---|
| Uptime monitor | **None** | Cloudflare Pages serves static files; an outage is Cloudflare's. Accepted for a personal project; see ACTIONS. |
| Error tracking | **On screen only** | `installErrorBanner` (`src/app/BrowserSetup.ts`) shows runtime errors to whoever is playing. Nothing is sent anywhere (no trackers, by design). |
| Spend and quota alerts | Not needed | Free tiers only; Cloudflare Pages free tier allows 500 builds a month. |
| Domain and certificate | Managed by Cloudflare | `*.pages.dev` with automatic HTTPS; http redirects to https (checked 2026-11-18). |
| CI failures | GitHub emails | Default GitHub notifications on failed workflow runs. |

**Gaps:** no alert reaches your phone if the site goes down. For a personal game this is accepted (see ACTIONS FOR ME in `docs/audits/P14_2026-11-18.md`).

## 3. How to

### Roll back a bad release (about 2 minutes)
1. Cloudflare dashboard → Workers & Pages → apex-slipstream → **Deployments**.
2. Find the last good deployment (each one lists its commit).
3. Its **⋯** menu → **Rollback to this deployment**. The live site switches at once.
4. Then fix forward on a branch, or `git revert` the bad merge on a branch and merge that PR.

Players who already loaded the bad build get the rolled-back one on their next online visit: the service worker names its cache after each build and replaces the old cache.

### Switch off a feature
There are no remote switches (no server). A feature is switched off by a code change and a deploy, or by a rollback.

### Show a maintenance message
Not needed: the game runs entirely in the browser and keeps working offline.

### Find the logs for a time window
- **Build and deploy logs:** Cloudflare → apex-slipstream → Deployments → a deployment → **View build log**.
- **CI logs:** GitHub → Actions → the workflow run.
- **Runtime logs:** none are collected (privacy by design). Ask the player for a screenshot of the error banner.

### A player lost their save
Saves live only in the player's browser. Clearing site data, private browsing, or the browser evicting storage removes them.
- **Prevention:** after a finished race the game asks the browser to keep its storage (`navigator.storage.persist()`). On an iPhone, adding the game to the Home Screen also protects it from Safari's 7-day clearing.
- **Backup:** Settings → Your save → **Download save** writes one `.json` file with the career, seasons, settings, keys, driver and ghost laps.
- **Restore:** Settings → Your save → **Load save**, tap twice, choose the file; the game restarts with it.
- **No file:** the save is gone; there is no server copy (P07-R02).

## 4. Severity levels

| Level | Example | What to do |
|---|---|---|
| SEV1 | The live site doesn't load, or the game crashes on start for everyone | Roll back now (section 3), then fix |
| SEV2 | A mode is broken (results, saving, a track) | Fix on a branch; roll back if it corrupts saves |
| SEV3 | A visual or feel problem | Normal fix |

Breach playbook, regulator contacts and user notifications: **N/A**. No personal data leaves the player's browser (`docs/DATA_INVENTORY.md`; P03 is SKIP in `docs/PROMPT_PLAN.md`). If that changes (accounts, cloud saves, leaderboards, telemetry), P03 and this section must be redone first.

## 5. Maintenance calendar

| When | What |
|---|---|
| Every merge | CI green (`build-and-test`, `e2e`) |
| Monthly | `npm audit --omit=dev`; `npm outdated` |
| Before each major release | P07 PRE-LAUNCH, engine-feel supplement, P14 |
| Every 6 months | Check the Cloudflare Pages free-tier terms still fit |
