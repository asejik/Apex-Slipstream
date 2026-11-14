# Apex Slipstream Design System (DESIGN.md)

> Direction: **Neon Cyber-Telemetry**  
> Formatted for high-performance cross-platform 3D racing with zero visual clutter, surgical contrast, and cybernetic telemetry cues.

---

## 1. Personality & Visual Identity

- **Keywords**: *Surgical*, *High-Velocity*, *Atmospheric*, *Tactical*, *Immersive*.
- **Aesthetic**: Modern Formula 1 telemetry married to *WipEout* cyber-racing.
- **Display Target**: Ultra-crisp rendering from 360px mobile portrait/landscape up to 4K ultrawide monitors.
- **Theme**: Dark mode by design. Deep carbon surfaces with electric neon telemetry accents.

---

## 2. Design Tokens (CSS Variables)

```css
:root {
  /* =========================================================================
     Color Roles & Contrast (WCAG AA Compliance Checked)
     ========================================================================= */
  /* Surfaces & Backgrounds */
  --color-bg-base: #06080e;
  --color-bg-surface: #0a0e17;
  --color-bg-surface-elevated: #111827;
  --color-bg-glass: rgba(10, 14, 23, 0.78);
  --color-bg-glass-card: rgba(17, 24, 39, 0.85);

  /* Borders */
  --color-border-subtle: rgba(255, 255, 255, 0.08);
  --color-border-default: rgba(255, 255, 255, 0.16);
  --color-border-accent: rgba(0, 240, 255, 0.5);

  /* Typography / Text Roles */
  --color-text-primary: #f8fafc;        /* High contrast (14.2:1 against bg) */
  --color-text-secondary: #94a3b8;      /* Readable muted info (5.8:1) */
  --color-text-tertiary: #64748b;       /* Minor captions / units */
  --color-text-disabled: #475569;

  /* Accent & Telemetry */
  --color-accent-cyan: #00f0ff;         /* Primary brand / speed indicator */
  --color-accent-cyan-glow: rgba(0, 240, 255, 0.35);
  --color-accent-amber: #eab308;        /* RPM redline / warning threshold */
  --color-accent-crimson: #ef4444;      /* Off-track / wrong way / crash */
  --color-accent-lime: #22c55e;         /* Best lap / slipstream drafting */
  --color-accent-lime-glow: rgba(34, 197, 94, 0.35);

  /* Tactical Tire Compounds */
  --color-tire-street: #38bdf8;         /* High-grip street cyan */
  --color-tire-allterrain: #f59e0b;     /* Rugged all-terrain amber */
  --color-tire-wet: #a855f7;            /* Hydro wet purple */

  /* =========================================================================
     Typography Scale
     ========================================================================= */
  --font-family-display: 'Rajdhani', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'Chakra Petch', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --font-size-xs: 0.6875rem;    /* 11px */
  --font-size-sm: 0.8125rem;    /* 13px */
  --font-size-base: 0.9375rem;  /* 15px */
  --font-size-lg: 1.125rem;     /* 18px */
  --font-size-xl: 1.375rem;     /* 22px */
  --font-size-2xl: 1.75rem;     /* 28px */
  --font-size-3xl: 2.25rem;     /* 36px */
  --font-size-4xl: 3.0rem;      /* 48px */

  --font-weight-regular: 500;
  --font-weight-bold: 700;
  --font-weight-black: 900;

  /* =========================================================================
     Spacing & Layout
     ========================================================================= */
  --spacing-1: 0.25rem;         /* 4px */
  --spacing-2: 0.5rem;          /* 8px */
  --spacing-3: 0.75rem;         /* 12px */
  --spacing-4: 1.0rem;          /* 16px */
  --spacing-5: 1.25rem;         /* 20px */
  --spacing-6: 1.5rem;          /* 24px */
  --spacing-8: 2.0rem;          /* 32px */

  /* =========================================================================
     Radii & Angles
     ========================================================================= */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 9999px;
  --chamfer-corner: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));

  /* =========================================================================
     Shadows & Atmospheric Depth
     ========================================================================= */
  --shadow-hud-card: 0 4px 20px rgba(0, 0, 0, 0.45);
  --shadow-neon-cyan: 0 0 16px rgba(0, 240, 255, 0.45);
  --shadow-neon-lime: 0 0 16px rgba(34, 197, 94, 0.5);
  --shadow-neon-crimson: 0 0 16px rgba(239, 68, 68, 0.6);

  /* =========================================================================
     Motion & Transitions
     ========================================================================= */
  --transition-instant: 75ms ease-out;
  --transition-fast: 150ms cubic-bezier(0.16, 1, 0.3, 1);
  --transition-normal: 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 3. Signature UI Moments

1. **Aerodynamic Slipstream Surge**:
   - As the player enters a rival's wake ($20\text{m}$, $< 15^\circ$), a dual-tier drafting gauge fills with an electric cyan pulse.
   - At $1.5\text{s}$, the gauge flashes into glowing gold (`--shadow-neon-lime`), accompanied by a visual aerodynamic tunnel and audio slipstream resonance whoosh.

2. **Tactical Tire Telemetry Pill**:
   - In-game HUD pill showing the active compound (`STREET`, `ALL-TERRAIN`, `WET`).
   - Displays real-time surface grip percentage ($100\%$ on clean asphalt down to $50\%$ on off-road gravel for street tires).

3. **Wrong-Way & Off-Road Alarm**:
   - Striated cyber-crimson banner with rapid pulse alerting the player to regain track centerline.

---

## 4. Accessibility & Safety Rules

- **Contrast Assurance**: All numerical data (speedometer, lap timer, gear) maintain $> 7:1$ contrast against their frosted backdrop.
- **Motion Reduction**: If `prefers-reduced-motion` is detected, disable screen rumble and camera FOV pulses.
- **Touch Targets**: All mobile buttons have minimum touch targets of $44 \times 44\text{px}$.
- **Zero One-Offs**: All HUD elements must consume CSS variables defined above. No rogue hardcoded colors or sizing in component styles.
