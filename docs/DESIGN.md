# Apex Slipstream Design System (DESIGN.md)

> **Direction: Broadcast** (chosen by the owner on 2026-11-15, R4).
> Feel reference: the TV graphics of an F1 race, with the home hub laid out like the eFootball menus.
> Feel only: no logos, fonts, colours or art are copied from F1, eFootball or any other game.
> Mockups: [`docs/design/r4-directions.html`](design/r4-directions.html). The "Chosen" section and direction A in that file are the reference.
>
> **Status: approved by the owner on 2026-11-15**, with one change: the hub shows the live championship standings as a table (section 5). R4 is done.

---

## 1. Personality

- **Keywords:** *Broadcast*, *Precise*, *Fast to read*, *Confident*, *Flat*.
- **Look:** flat, sharp-edged panels on near-black. Condensed capitals. Numbers in fixed-width figures. One red accent.
- **Lean towards A everywhere.** Every screen, menus included, uses this style. The only borrowing from the eFootball feel is the hub's layout: one big "race next" tile, smaller tiles for the other modes, tabs along the top, and level and points chips.
- **Not:** neon glow, blur, gradients on text, rounded "bubble" cards, or sci-fi styling. Those belong to the old Neon Cyber-Telemetry look, which this replaces.

## 2. Principles

1. **Readable at 200 km/h.** HUD numbers are large, white on dark, and never move position. A glance tells you your position, lap time and gap.
2. **Fixed corners.** Position and gaps are top left, lap time top right, speed and gear bottom right, tyre bottom right. Thumbs own the bottom corners.
3. **One accent, used sparingly.** Red means "act here" (the main button, your row, a selected item). Green means gaining, purple means fastest lap, amber means points and warnings.
4. **Flat and cheap to draw.** No `backdrop-filter`, no glow shadows, no animated gradients. A phone must spend its time on the 3D scene.
5. **Nothing extra while racing.** Anything you don't need during a lap goes to the pause menu.

---

## 3. Design tokens (CSS variables)

The token names are kept from the old system where the role is the same, so the rebuild changes values, not names. Tokens marked *new* are added; tokens marked *removed* go.

```css
:root {
  /* ---------- Surfaces ---------- */
  --color-bg-base: #121319;              /* screen background */
  --color-bg-surface: #1b1c24;           /* solid panels, tiles, side lists */
  --color-bg-surface-elevated: #22232c;  /* selected list row, secondary button */
  --color-bg-glass: rgba(18, 19, 25, 0.88);       /* HUD panels over the 3D scene (no blur) */
  --color-bg-glass-card: rgba(18, 19, 25, 0.88);  /* kept as an alias of --color-bg-glass */
  --color-row-stripe: rgba(255, 255, 255, 0.04);  /* new: every other row in tables and towers */

  /* ---------- Borders ---------- */
  --color-border-subtle: rgba(255, 255, 255, 0.08);
  --color-border-default: rgba(255, 255, 255, 0.16);
  --color-border-control: rgba(255, 255, 255, 0.35);  /* new: outline of touch controls */
  /* removed: --color-border-accent */

  /* ---------- Text ---------- */
  --color-text-primary: #ffffff;
  --color-text-secondary: #a4a6b3;
  --color-text-tertiary: #6e7080;
  --color-text-disabled: #4a4c58;
  --color-text-inverse: #121319;         /* new: text on white (your row, gear box) */

  /* ---------- Accent and meaning ---------- */
  --color-accent: #ff3347;               /* new: the one accent. Main button, your row marker, selected item */
  --color-gain: #2ee06f;                 /* new: ahead of best / ghost, slipstream bar, rev lights */
  --color-fastest: #b45cff;              /* new: fastest lap, personal best */
  --color-points: #ffc21a;               /* new: points, warnings */
  --color-danger: #ff3347;               /* new: wrong way, off track. Same red as the accent */
  --color-trophy-gold: #ffc21a;          /* new (R5): end-of-season block for P1 */
  --color-trophy-silver: #c9ccd6;        /* new (R5): P2 */
  --color-trophy-bronze: #d9894a;        /* new (R5): P3 */
  /* removed: --color-accent-cyan, -cyan-glow, -amber, -crimson, -lime, -lime-glow */

  /* ---------- Tyres ---------- */
  --color-tire-street: #ffffff;
  --color-tire-allterrain: #ffc21a;
  --color-tire-wet: #3d8bff;

  /* ---------- Driver strips (the thin bar beside a name) ----------
     The player's strip is --color-text-inverse on a white row. AI driver N uses
     --color-team-((N mod 10) + 1). */
  --color-team-1: #ff9b2e;
  --color-team-2: #3d8bff;
  --color-team-3: #2ee06f;
  --color-team-4: #b45cff;
  --color-team-5: #ffd84a;
  --color-team-6: #19c7c2;
  --color-team-7: #ff5fa2;
  --color-team-8: #9aa3b5;
  --color-team-9: #ff6a3d;
  --color-team-10: #6be0ff;

  /* ---------- Type ---------- */
  --font-family-display: 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif;  /* everything in the game */
  --font-family-body: 'Barlow', system-ui, sans-serif;  /* new: long text only (settings descriptions, help) */
  /* removed: --font-family-mono. Use font-variant-numeric: tabular-nums on numbers instead */

  --font-size-xs: 0.6875rem;    /* 11px: captions above numbers ("LAP TIME") */
  --font-size-sm: 0.8125rem;    /* 13px: tower rows on small phones, table rows */
  --font-size-base: 0.9375rem;  /* 15px: list items, buttons */
  --font-size-lg: 1.125rem;     /* 18px: menu items, tile titles */
  --font-size-xl: 1.375rem;     /* 22px: lap time */
  --font-size-2xl: 1.75rem;     /* 28px: screen titles */
  --font-size-3xl: 2.25rem;     /* 36px: speed, gear, big position */
  --font-size-4xl: 3.0rem;      /* 48px: results headline, countdown */

  --font-weight-regular: 500;
  --font-weight-semibold: 600;  /* new: table rows, captions */
  --font-weight-bold: 700;
  --font-weight-black: 800;     /* was 900; Barlow Condensed's heaviest bundled weight is 800 */

  --letter-spacing-caps: 0.04em; /* new: all capitals text */

  /* ---------- Spacing ---------- */
  --spacing-1: 0.25rem;  /* 4px */
  --spacing-2: 0.5rem;   /* 8px */
  --spacing-3: 0.75rem;  /* 12px */
  --spacing-4: 1.0rem;   /* 16px */
  --spacing-5: 1.25rem;  /* 20px */
  --spacing-6: 1.5rem;   /* 24px */
  --spacing-8: 2.0rem;   /* 32px */

  /* ---------- Shapes ---------- */
  --radius-sm: 0;        /* panels, tiles, buttons: square corners */
  --radius-md: 0;
  --radius-lg: 0;
  --radius-pill: 9999px; /* only round things: tyre badge, toggles */
  --stripe-width: 4px;   /* new: driver strips, selected-item bar, tile top edge */
  --cut-cta: polygon(0 0, 100% 0, 94% 100%, 0 100%);  /* new: slanted right edge on the main button */
  /* removed: --chamfer-corner */

  /* ---------- Depth ---------- */
  --shadow-hud-card: none;  /* panels are flat; contrast comes from the panel colour */
  /* removed: --shadow-neon-cyan, --shadow-neon-lime, --shadow-neon-crimson */

  /* ---------- Motion ---------- */
  --transition-instant: 75ms ease-out;
  --transition-fast: 150ms cubic-bezier(0.16, 1, 0.3, 1);
  --transition-normal: 250ms cubic-bezier(0.16, 1, 0.3, 1);
  --transition-panel: 200ms cubic-bezier(0.2, 0, 0, 1);  /* new: panels slide in from their edge */
}
```

### Fonts
Barlow Condensed (weights 600, 700, 800) and Barlow (500, 600) are under the SIL Open Font License. The font files are **bundled with the game** (`public/fonts/`, `font-display: swap`) and precached by the service worker, so the game looks the same offline. They are not loaded from Google Fonts at run time.

---

## 4. Components

| Component | Look | Used on |
|---|---|---|
| **Timing tower** | Red header bar ("LAP 2/3 · GAP"), then rows: position, 4px driver strip, surname in capitals, gap in tabular figures. Your row is white with dark text. Shows 2 cars ahead and 2 behind (5 rows); the full 20 in the pause menu's standings | HUD top left, hub standings tile |
| **Lap panel** | Caption "LAP TIME" over the time. Beside it, a block showing the gap to your best lap: green when ahead, red when behind | HUD top right |
| **Speed block** | A white box with the gear in dark figures, then the speed and "KM/H", with a row of 9 rev lights below: green, the last two red at the limit | HUD bottom right |
| **Tyre badge** | Round badge in the compound colour with its letter (S, A, W), with the compound name and grip % beside it | HUD bottom right, tyre choice screen |
| **Slipstream bar** | Small panel at top centre: "SLIPSTREAM" and a green bar. Only shown while in a wake | HUD |
| **Pause button** | 44px square, panel colour, two white bars | HUD top right, under the lap panel |
| **Alert band** | Full-width band across the upper third: red for WRONG WAY and OFF TRACK, purple for PERSONAL BEST, green for BOOST. Capitals, one line, slides in from the left | HUD |
| **Main button (CTA)** | Red, capitals, black weight, slanted right edge (`--cut-cta`) | One per screen at most |
| **Secondary button** | `--color-bg-surface-elevated`, capitals, square | Beside a CTA |
| **Tile** | Solid panel with a 4px top edge. The main tile's edge is red; the others are elevated grey. Title in capitals, one line of detail. Optional corner flag (for example, purple "NEW PB") | Hub |
| **Tabs** | A row of square blocks; the selected one is red | Hub top |
| **Chip** | Small solid panel: label plus an amber value ("LEVEL 7", "P2 · 38 PTS") | Hub top right |
| **Side list** | Menu items in capitals. The selected item has a 4px red bar on the left and an elevated background | Pause menu, settings |
| **Segmented control** | A row of square options; the selected one is white with dark text | Settings, pause menu (camera, ghost, sound) |
| **Results table** | Rows like the tower, plus columns for gap and best lap. Your row is white; the fastest lap is purple | Results, standings |
| **Touch controls** | Square, 2px outline in `--color-border-control`, translucent dark fill, capitals label. At least 72px | HUD bottom left (steer, brake) and bottom right (throttle) on touch screens |

---

## 5. Screens

These are the screens R3 part 3 builds the game-state structure for.

1. **Hub** (tabs: Race, Garage, Records, Settings). The Race tab has the main tile "Next race" with the round, track, laps, forecast and points gap, and the CTA "Start weekend". Beside it, a **live standings tile**: a timing-tower table (red "STANDINGS · PTS" header) of the championship top 5, your row in white. If you are outside the top 5, the fifth row is replaced by yours. Tapping it opens the full standings. Smaller tiles: Quick race, Time trial. Chips at the top show level and season position. Liveries live in the Garage tab.
2. **Race weekend:** Qualifying (choose a session type) → Tyre choice (with the forecast) → Grid with the 3-2-1-GO countdown → Race → Results → Standings → back to the Hub.
3. **Paused** (over a dimmed race): Resume, Restart (shows tokens left), Standings, Settings, Quit to hub. Quick toggles for camera (High, Low, Top), ghost and sound sit beside the list.
4. **Settings:** controls, camera, sound, graphics quality, units. Uses side lists and segmented controls.
5. **Quick race setup** and **Time trial setup:** choose the track (and the weather for Quick race), then the CTA.

**HUD during a race** shows only: the timing tower, the lap panel, the pause button, the speed block, the tyre badge, the slipstream bar when in a wake, alert bands when needed, and the touch controls on touch screens. The FPS readout moves to Settings as a developer option. The top-right button stack (fullscreen, ghost, standings, qualifying, restart, sound, camera, track) is removed: each control moves to the pause menu or settings, and the keyboard shortcuts stay.

---

## 6. Layout

- **Target:** landscape phone first (844 × 390 and 667 × 375), up to desktop. Portrait shows the existing "rotate your phone" prompt.
- **HUD margin:** `--spacing-4` from every edge, plus the device safe-area insets (`env(safe-area-inset-*)`).
- **Thumb zones:** on touch screens the bottom-left 30% and bottom-right 22% of the screen hold only the touch controls and the speed block. Nothing tappable goes in the top 25% except the pause button.
- **Desktop:** the same layout scaled up with the screen, to at most twice its size at 1920 × 1080.

---

## 7. Signature moments

1. **Gap flip:** when your gap to your best lap flips from behind to ahead, its block switches from red to green with a short `--transition-fast` wipe.
2. **Timing tower shuffle:** when you pass a car, the two rows swap with a 200 ms slide, as on a race broadcast.
3. **Slipstream:** the green bar fills while in a wake. At full, a green "BOOST" alert band slides in and the camera FOV widens.
4. **Lights out:** the countdown is five red blocks across the top centre that light one by one, then go out together for GO. (Built in R5, U-06.)

---

## 8. Accessibility and safety

- **Contrast:** HUD numbers are at least 7:1 against their panel; all other text at least 4.5:1. The gain, fastest-lap and danger colours are never the only signal: each comes with a sign, a word or a position (for example, "−0.42" and "+0.42").
- **Reduced motion:** when `prefers-reduced-motion` is set, turn off the tower slide, panel slides and camera FOV pulses. Alerts appear without sliding.
- **Touch targets:** at least 44 × 44 px; touch driving controls at least 72 px.
- **Player name:** always set with `textContent` (never `innerHTML`).
- **No one-off values:** every colour, size, gap and font in the UI comes from the tokens above.

---

## 9. Moving from the old look

- The game's `index.html` still uses the old Neon Cyber-Telemetry values. The new look is built screen by screen in R3 part 3 and R5; until then both may show.
- Token names are mostly kept, so most old CSS picks up the new values when the `:root` block is swapped. Where it uses a removed token (cyan, lime, glow shadows, chamfer), it is rewritten to the new roles.
- The 3D scene's colours are in section 10.

---

## 10. The 3D scene (added 2026-11-16, Decision 15)

Daylight, so the road stands out from its surroundings at a glance. The values live in `SCENE_COLOURS` (`src/render/SceneSetup.ts`).

| Part | Colour | Note |
|---|---|---|
| Sky and distance haze | `#8aa0b8` | The haze fades distant scenery into the sky |
| Ground | `#3d4a35` | Green, clearly darker and warmer than the road |
| Asphalt | `#4a4d55` | Mid grey |
| Road edge lines | `#d9dbe2` | A 0.35 m painted line along both edges |
| Walls | `#b8bcc6` | Pale concrete |
| Kerbs | red `#ee2233` and white `#f5f5f5` | Through corners only |
| Braking boards | white with dark bars | Three, two, one bars at 150, 100, 50 m |
| Rain sky and haze | `#6e7884` | In the rain (R7): greyer, and the haze is about three times as thick, so you see less far ahead |
| Wet asphalt | `#2f3239` | Dark and smooth (roughness 0.22), mirroring a blurred grey sky so the road reads as wet |
| Rain horizon | `#a7b0ba` | The light band of the sky the wet road mirrors (top `#6e7884`, below dark ground) |
| Rain streaks | `#c9d3df` | Falling streaks round the camera, at half opacity |
| Spray | `#c9d0d8` | A fine, low mist trailing cars above 40 km/h, at 16% opacity |
| Dirt road | `#8a6a48` | Dirt stretches of the road (R7): Alpine Ridge and Desert Dunes. No kerbs on dirt |

- **Mini-map:** under the timing tower on a `--color-bg-glass` panel, 180 × 150 px (120 × 100 on short phones). White route with a dark casing, a red square at the start line, team-coloured dots for the AI and a larger `--color-accent` dot with a white ring for the player. North is up.
- **Shadows:** cast by cars within 70 m of the player. Graphics: Low turns them off.
- **Rain:** sunlight dims from 1.3 to 0.55. Graphics: Low draws 500 rain streaks instead of 1,400 and up to 300 spray particles instead of 900.

