import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { splashRemainingMs, SPLASH_MIN_SHOW_MS } from '../src/ui/Splash';

describe('Loading screen', () => {
  it('shows the logo for at least a couple of seconds from page load, never longer than needed', () => {
    expect(SPLASH_MIN_SHOW_MS).toBeGreaterThanOrEqual(2000);
    expect(splashRemainingMs(0)).toBe(SPLASH_MIN_SHOW_MS);
    expect(splashRemainingMs(1000)).toBe(SPLASH_MIN_SHOW_MS - 1000);
    // A slow start has already shown it long enough: it goes as soon as the game is ready
    expect(splashRemainingMs(SPLASH_MIN_SHOW_MS + 5000)).toBe(0);
  });

  it('is plain HTML styled in the page, so it shows before any script', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    const body = html.slice(html.indexOf('<body>'));
    // The first thing in the page body, with its styles in the page's own <style>
    expect(body.indexOf('id="splash"')).toBeLessThan(body.indexOf('id="app"'));
    expect(html.slice(0, html.indexOf('</head>'))).toMatch(/\.splash \{/);
  });
});
