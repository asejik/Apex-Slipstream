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

  it('HUD toggles the active class instead of writing inline opacity', () => {
    const hud = fs.readFileSync(path.resolve(__dirname, '../src/ui/HUDController.ts'), 'utf-8');
    expect(hud).toMatch(/wrongWayElement\.classList\.toggle\('active',\s*lapState\.wrongWay\)/);
  });
});
