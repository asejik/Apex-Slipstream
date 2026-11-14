# AGENTS.md (Project Rules, P06-A)

<!--
Antigravity edition. Loaded in every conversation.
Keep well under 24 KB.
-->

## Project
- **Apex Slipstream**: A high-performance, cross-platform 3D arcade racing game for web and mobile browsers.
- **Owner**: Solo Developer. **Rigor Level**: LIGHT.
- **Stack**: Vite + TypeScript + Three.js (WebGL) + Web Audio API + IndexedDB / localStorage (Hosted on Cloudflare Pages).
- **Read before any task**: docs/PROMPT_PLAN.md, docs/PROJECT_PLAN.md, docs/DATA_INVENTORY.md, docs/DESIGN.md (when created), docs/PROGRESS.md.
- **Prompt suite**: docs/prompts/ (every code change strictly follows P06).

## Commands
- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Build: `npm run build`
- Unit tests: `npm test`
- End-to-end smoke tests: `npx playwright test`
- Unused code: `npx knip`

## Working rules
- One feature or fix per task, on its own branch. Never commit directly to `main`.
- Only modify files needed for the task. No unrequested refactors, renames, or reformatting.
- Follow existing patterns in the codebase. If none exists, ask before inventing one.
- Fit before code: if a feature doesn't fit the existing structure cleanly (it would need duplicated logic, special cases in shared code, an already-large file growing further, or code in a place that doesn't own that job), stop before coding and say so. Propose a refactor as its own task first (no behaviour change), then build the feature on top. Never refactor without my approval, and never force a bad fit instead.
- Use design tokens from docs/DESIGN.md; no one-off colours, sizes, or spacing.
- At the end of every task, update docs/PROGRESS.md.

## Antigravity working mode
- Non-trivial tasks: work in Planning mode. Your implementation plan is P06 Phase 1: wait for my comments and Proceed before changing code.
- TRIVIAL tasks (copy, styling inside one component): Fast mode is fine.
- Finish every task with a walkthrough artifact: it is the P06 Phase 4 report, with screenshots of any UI change.
- Never change Antigravity permission settings, rules, skills, or MCP configuration yourself. Ask me.

## Browser and verification
- Use the browser subagent to check your own work: open local or preview URLs, take screenshots at 360px and desktop width, click through the changed journey, and check the console for errors. Save the key screenshots to the walkthrough. Use Playwright for scripted checks and CI tests.
- Production: public pages only, read-only. Never sign in with real user accounts, submit real forms or payments, or change production data.
- Use test profiles locally, never real personal data.

## Never do these to make an error go away
- Disable TypeScript strict mode, suppress warnings globally, or add allow-all security policies.
- Delete, skip, or weaken tests.
- Hardcode test data to make something work.
- Add fake reads of variables to silence unused warnings.

## Ask me first
- `@ts-ignore`, `@ts-expect-error`, `any`, or `eslint-disable` (if I approve, add a comment saying why).
- Deleting code you believe is unused (list it with your evidence).
- Installing, upgrading, or removing dependencies.
- Destructive commands: `rm -rf`, `git push --force`, `git reset --hard`.

## Performance & Game Engine Rules
- Fixed-timestep physics: All physics calculations must run in the fixed-timestep loop (`dt = 1/60s`) decoupled from variable rendering frames.
- Hot-loop memory hygiene: Zero object allocations (`new Vector3()`, closures, temporary arrays) inside per-frame `update()` or `render()` ticks. Reuse pre-allocated scratch objects.
- Mobile touch isolation: Ensure `touch-action: none` and `user-select: none` are maintained on all game canvas elements.
- Web Audio unlock: Web Audio must only be initialized or resumed following a direct user pointer gesture to respect iOS Safari and Android Chrome autoplay restrictions.

## Security & Privacy basics
- No secrets or private tokens in code or client-exposed variables (`VITE_*`).
- User input sanitization: Custom player names must be sanitized and rendered using `.textContent` / safe DOM properties to prevent XSS.
- Privacy: Never log personal data. Zero third-party trackers or ad SDKs.

## Done means
Type check, lint, build, and tests pass, with real output shown.
UI changes are checked with the browser subagent, with screenshots in the walkthrough.
CI passes on the branch before merge. If you cannot run a check, say so.
Never claim a check passed without running it.

## Stop and ask when
- Checks were already failing before your change.
- The code differs from what you expected.
- The same error survives two fix attempts.
- A change would affect features outside the task.
- A requirement is ambiguous or conflicts with docs/PROJECT_PLAN.md.
