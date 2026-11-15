import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/** Returns the body of the first CSS rule whose selector is exactly `selector`. */
function cssRule(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[2] ?? null;
}

describe('HUD banners (P15-08)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

  it('WRONG WAY banner is hidden by default: its base rule has no animation overriding opacity', () => {
    const base = cssRule(html, '.wrong-way-alert');
    expect(base).not.toBeNull();
    expect(base).toMatch(/opacity:\s*0/);
    expect(base).not.toMatch(/animation\s*:/);
  });

  it('WRONG WAY banner pulses only when the active class is set', () => {
    const active = cssRule(html, '.wrong-way-alert.active');
    expect(active).not.toBeNull();
    expect(active).toMatch(/animation\s*:\s*pulse/);
  });

  it('touch layout moves the tire selector out of the bottom row, under the timing tower (P15-04)', () => {
    const group = cssRule(html, '.touch-controls-active .bottom-left-group');
    expect(group).not.toBeNull();
    expect(group).toMatch(/position:\s*absolute/);
    expect(group).toMatch(/top:\s*\d+px/);
    // R5 Broadcast HUD: one row of tyres, so it ends above the steering zone on a 375 px tall phone
    expect(cssRule(html, '.touch-controls-active .tire-pills')).toMatch(/flex-direction:\s*row/);
    expect(cssRule(html, '.touch-controls-active .tire-pill')).toMatch(/min-height:\s*44px/);
  });

  it('touch layout puts the speedometer between the thumb zones (P15-04)', () => {
    const speedo = cssRule(html, '.touch-controls-active .speedometer-card');
    expect(speedo).not.toBeNull();
    expect(speedo).toMatch(/position:\s*absolute/);
    expect(speedo).toMatch(/left:\s*50%/);
  });

  it('TouchController marks the page when the thumb controls are shown (P15-04)', () => {
    const touch = fs.readFileSync(path.resolve(__dirname, '../src/ui/TouchController.ts'), 'utf-8');
    expect(touch).toMatch(/document\.body\.classList\.add\('touch-controls-active'\)/);
  });

  it('HUD toggles the active class instead of writing inline opacity', () => {
    const hud = fs.readFileSync(path.resolve(__dirname, '../src/ui/HUDController.ts'), 'utf-8');
    expect(hud).toMatch(/wrongWayElement\.classList\.toggle\('active',\s*lapState\.wrongWay\)/);
  });
});
