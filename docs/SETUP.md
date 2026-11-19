# SETUP & GUARDRAILS: Apex Slipstream

Last reviewed: 2026-11-20 (P09-R07: brought up to date; it had not changed since Milestone 1) · Rigor Level: LIGHT

---

## 1. Setup status by checklist item

| # | Item | Status | Where it is configured | How to verify |
|---|---|---|---|---|
| **1** | **Version control** | DONE | GitHub `asejik/Apex-Slipstream`; `.gitignore` | `git remote -v`; history on GitHub |
| **2** | **Protected main branch** | DONE | GitHub ruleset "Protect Main" (active): a pull request is required, force pushes and deleting `main` are blocked, and `build-and-test` must pass | `gh api repos/asejik/Apex-Slipstream/rulesets`; a direct push to `main` is refused |
| **3** | **Automated checks (CI)** | DONE | `.github/workflows/ci.yml` on every push to `main` and every pull request. `build-and-test` (required): type check, lint, unit tests, build, knip. `e2e` (not required, by the owner's choice on 2026-11-19 for speed): the Playwright journeys on Windows with WARP | The checks on any pull request |
| **4** | **Secret protection** | DONE (by design) | No secrets exist: the game has no server, accounts or keys. `.gitignore` covers `.env*`; `.env.example` documents zero variables; GitHub secret scanning and push protection | `git status --ignored` |
| **5** | **Dependency hygiene** | DONE | `package-lock.json` committed; `.github/dependabot.yml` (weekly npm updates). Dependabot security updates are off in the repository settings; `npm audit --omit=dev` reports 0 in shipped code (P08) | Dependabot tab on GitHub; `npm audit --omit=dev` |
| **6** | **Environments** | DONE (by design) | Client-side only. Cloudflare Pages builds `main` to production (https://apex-slipstream.pages.dev) and each pull request to a preview URL; `wrangler.toml` sets `dist` as the output | The Cloudflare Pages dashboard |
| **7** | **AI tool guardrails** | DONE | `AGENTS.md` at the repository root (`CLAUDE.md` points to it) | Read `AGENTS.md` |
| **8** | **Strictness** | DONE | `tsconfig.json` (`strict`, `noUnusedLocals`, `noUnusedParameters`); `eslint.config.js`; `knip.json` | `npx tsc --noEmit`, `npm run lint`, `npm run knip` |
| **9** | **Monitoring** | DONE (light) | `installErrorBanner` in `src/app/BrowserSetup.ts` shows uncaught errors and rejected promises on screen; the browser journeys fail on any console error. No remote error reporting: the game sends nothing anywhere (Decision 7) | Throw an error in the dev build: the banner shows it |
| **10** | **Accounts and billing** | DONE (owner) | GitHub and Cloudflare on free tiers, two-factor sign-in on both (owner confirmed 2026-11-18) | The account security pages |
| **11** | **Backups** | DONE (by design) | The code: Git on GitHub. Player data lives only in the player's browser; Settings → Your save downloads a backup file (P07-R02) | `git log`; download a save in Settings |
| **12** | **Docs** | DONE | `README.md`; `docs/PROJECT_PLAN.md`, `DESIGN.md`, `PROGRESS.md`, `RUNBOOK.md`, `DATA_INVENTORY.md`, `CREDITS.md`; audits in `docs/audits/` with every finding in `FINDINGS.md` | The files exist |

---

## 2. How the hosting is set up

### Cloudflare Pages
- Connected to the GitHub repository. Build command `npm run build`, output directory `dist`.
- Every push to `main` deploys to production; every pull request gets a preview URL.
- Response headers (security policy, caching) live in `public/_headers`. The Content-Security-Policy allows only the game's own files (`script-src 'self'`).
- Deploys and rollbacks: see `docs/RUNBOOK.md`.

### GitHub
- Ruleset **Protect Main**: pull request required; required status check `build-and-test`; force pushes and deletion of `main` blocked.
- Secret scanning and push protection are on.

---

## 3. Accounts and spend

- **Domain:** the free `apex-slipstream.pages.dev` subdomain (TLS renewed by Cloudflare).
- **Hosting:** Cloudflare Pages free tier (unlimited bandwidth, 500 builds a month).
- **Backend:** none. $0 a month.
