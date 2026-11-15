# FINDINGS REGISTER: Apex Slipstream

<!--
Every audit adds its findings here and every fix marks them FIXED. Never delete rows.
P09's grade and P14's launch gate both read from this file.
-->

| ID | Title | Severity | Source (audit + date) | Status | Found | Closed | Notes |
|---|---|---|---|---|---|---|---|
| P15-01 | Sprint tracks cannot be finished at the finish gantry | HIGH | P15 2026-11-14 | OPEN | 2026-11-14 | | Finish checkpoint is t=0 on open splines; season stalls at round 2 |
| P15-02 | Launch gate and audit reports assert things that are not true | HIGH | P15 2026-11-14 | OPEN | 2026-11-14 | | Re-run audits per P15 re-run plan |
| P15-03 | Qualifying needs full race distance; both modes identical | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | `main.ts:697` waits for isRaceCompleted |
| P15-04 | Tire selector off-screen on phone landscape | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | y=475–500 at 844x390 |
| P15-05 | Wet tires never useful; no wet surface exists | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | `wetGrip` unused; values differ from US-03 |
| P15-06 | Stored PB ghost overwritten by first lap each session | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Previous-lap ghost never shown |
| P15-07 | Track button [T] desyncs track and season round | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | `cycleTrack()` |
| P15-08 | WRONG WAY banner permanently visible | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | CSS pulse animation overrides opacity |
| P15-09 | Per-frame allocations in game loop | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Breaks AGENTS.md hot-loop rule |
| P15-10 | Track meshes never disposed on reload | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Geometries 117→147 over 6 reloads |
| P15-11 | Planned features missing but reported complete | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Time Trial, Quick Race, menu, pause, settings, etc. |
| P15-12 | No E2E tests; several unit tests cannot fail | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | Playwright not installed |
| P15-13 | AI on rails; terrain affinity has no effect | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | `QualifyingManager.ts:43` self-comparison |
| P15-14 | Offline play fails until second online visit | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | JS bundle not precached |
| P15-15 | Share-card image is a relative SVG path | MEDIUM | P15 2026-11-14 | OPEN | 2026-11-14 | | SUSPECTED; validators not run |
| P15-16 | Finale may be replayed and double-counted after reload | LOW | P15 2026-11-14 | OPEN | 2026-11-14 | | SUSPECTED |
| P15-17 | Assorted polish (debug global, dead file, CSP, stale docs) | LOW | P15 2026-11-14 | OPEN | 2026-11-14 | | See P15 report |

Statuses:
- OPEN: not fixed yet
- FIXED: fixed and re-checked (note the commit/PR)
- ACCEPTED RISK: deliberately not fixed (requires rationale and review date)
- WON'T FIX: not a problem in this context
- REGRESSED: was FIXED and returned

## Accepted Risks

| ID | Reason | Accepted by | Date | Review by |
|---|---|---|---|---|
