# SETUP & GUARDRAILS: Apex Slipstream

Last reviewed: 2026-11-13 · Stage: Setup (Milestone 1) · Rigor Level: LIGHT

---

## 1. Setup Status by Checklist Item

| # | Item | Status | Where Configured | How to Verify |
|---|---|---|---|---|
| **1** | **Version Control (*)** | PENDING INITIAL COMMIT | Git repo initialized; `.gitignore` configured; remote origin: `https://github.com/asejik/Apex-Slipstream.git` | Run `git status`; verify clean working tree and origin remote tracking. |
| **2** | **Protected Main Branch** | ACTION FOR USER | GitHub $\rightarrow$ Repository Settings $\rightarrow$ Rules $\rightarrow$ Rulesets | Try pushing directly to `main` without PR once configured; verify branch blocks force pushes. |
| **3** | **Automated Checks (CI) (*)** | READY TO APPLY | `.github/workflows/ci.yml` (runs on push/PR: lint, typecheck, test, build) | Push to GitHub; check that the GitHub Actions `build-and-test` workflow passes. |
| **4** | **Secret Protection (*)** | READY TO APPLY | `.gitignore` covers `.env*`; `.env.example` documents zero secrets; GitHub push protection | Run `git status --ignored`; verify secret files are excluded. |
| **5** | **Dependency Hygiene (*)** | READY TO APPLY | `package-lock.json` committed; `.github/dependabot.yml` configured (weekly security + monthly updates) | Check GitHub Dependency Graph and Dependabot alerts tab. |
| **6** | **Environments & Keys (*)** | DONE (BY DESIGN) | 100% client-side application. Cloudflare Pages handles preview deployments per PR and production deployment on `main`. | Cloudflare Pages dashboard shows production and preview deployment URLs. |
| **7** | **AI Tool Guardrails (*)** | DONE | `AGENTS.md` at repo root with game engine rules, memory hygiene, touch isolation, and prompt suite protocols. | Check `AGENTS.md` in repository root. |
| **8** | **Strictness (*)** | READY TO APPLY | `tsconfig.json` (`"strict": true`, `"noUnusedLocals": true`, etc.); ESLint config | Run `npx tsc --noEmit` and `npm run lint`. |
| **9** | **Monitoring From Day One (*)** | READY TO APPLY | Global error listener in `src/main.ts` surfacing runtime errors; Cloudflare Pages edge health metrics | Intentionally throw error in dev build; verify error overlay appears. |
| **10** | **Accounts & Billing Protection (*)** | ACTION FOR USER | GitHub & Cloudflare accounts (MFA active; both services on $0 free tiers) | Verify 2FA is enabled on GitHub and Cloudflare accounts. |
| **11** | **Backups** | DONE (BY DESIGN) | Distributed Git repository with remote origin on GitHub. Zero database to back up. | `git log` reflects full commit history on GitHub. |
| **12** | **Docs Seeded (*)** | DONE | `docs/PROMPT_PLAN.md`, `docs/PROJECT_PLAN.md`, `docs/DATA_INVENTORY.md`, `docs/PROGRESS.md`, `docs/audits/FINDINGS.md` | All files exist in `docs/` and `docs/audits/`. |

---

## 2. Actions for Developer (Dashboard Configurations)

### Action 1: Connect Cloudflare Pages to GitHub Repository
1. Log into your **Cloudflare Dashboard** $\rightarrow$ Navigate to **Workers & Pages** $\rightarrow$ Click **Create Application** $\rightarrow$ **Pages** $\rightarrow$ **Connect to Git**.
2. Select repository `asejik/Apex-Slipstream`.
3. Set build configuration:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Click **Save and Deploy**. Cloudflare Pages will automatically build and deploy every commit pushed to `main`, and generate unique preview URLs for pull requests.

### Action 2: Configure GitHub Branch Protection & Secret Scanning
1. On GitHub, navigate to **`https://github.com/asejik/Apex-Slipstream/settings`**:
2. Under **Code and automation** $\rightarrow$ **Rules** $\rightarrow$ **Rulesets**:
   - Click **New ruleset** $\rightarrow$ Name: `Protect Main`.
   - **Enforcement status:** Active.
   - **Target branches:** Add default branch (`main`).
   - Under **Rules**:
     - Check **Require a pull request before merging**.
     - Check **Require status checks to pass** $\rightarrow$ Add `build-and-test`.
     - Check **Block force pushes**.
3. Under **Security** $\rightarrow$ **Code security and analysis**:
   - Ensure **Secret scanning** and **Push protection** are Enabled (free for public repos).

---

## 3. Account Renewal & Spend Information

- **Domain / DNS:** Default `*.pages.dev` subdomain provided free by Cloudflare (SSL auto-renewed indefinitely).
- **Hosting Tier:** Cloudflare Pages Free Tier (Unlimited bandwidth, 500 builds/month).
- **Database / Backend Cost:** \$0.00 / month (100% client-side storage).
