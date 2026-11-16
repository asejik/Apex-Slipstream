import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fitTrack } from '../src/ui/MiniMap';

describe('Mini-map (owner playtest 2026-11-16)', () => {
  it('fits a wide track inside the map with padding, keeping its shape', () => {
    // 1,000 m wide and 500 m tall into 240 x 200 with 10 px padding
    const fit = fitTrack(-200, 800, -400, 100, 240, 200, 10);
    expect(fit.scale).toBeCloseTo(0.22, 5); // limited by the width: 220 px / 1,000 m
    const px = (x: number): number => x * fit.scale + fit.offsetX;
    const py = (z: number): number => z * fit.scale + fit.offsetY;
    expect(px(-200)).toBeCloseTo(10, 5);
    expect(px(800)).toBeCloseTo(230, 5);
    // Centred top to bottom: 500 m is 110 px, so 45 px above and below
    expect(py(-400)).toBeCloseTo(45, 5);
    expect(py(100)).toBeCloseTo(155, 5);
  });

  it('fits a tall track by its height, with north (-Z) at the top', () => {
    const fit = fitTrack(0, 100, -1000, 0, 240, 200, 10);
    expect(fit.scale).toBeCloseTo(0.18, 5); // 180 px / 1,000 m
    expect(-1000 * fit.scale + fit.offsetY).toBeLessThan(0 * fit.scale + fit.offsetY);
  });

  it('does not divide by zero for a track with no width', () => {
    const fit = fitTrack(5, 5, 0, 100, 240, 200, 10);
    expect(Number.isFinite(fit.scale)).toBe(true);
    expect(Number.isFinite(fit.offsetX)).toBe(true);
  });

  it('sits in the race HUD under the timing tower', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    const overlay = html.slice(html.indexOf('<div id="ui-overlay">'), html.indexOf('<!-- Home hub'));
    expect(overlay.indexOf('id="mini-map"')).toBeGreaterThan(overlay.indexOf('id="timing-tower"'));
  });
});
