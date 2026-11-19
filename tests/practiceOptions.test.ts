import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { nextTyre } from '../src/ui/PracticeOptions';

describe('Practice weather and tyres (owner, R7 playtest)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/ui/screens.css'), 'utf-8');

  it('has weather and tyre rows in the pause menu, hidden until practice', () => {
    expect(html).toMatch(/id="btn-practice-weather"[^>]*hidden/);
    expect(html).toMatch(/id="btn-practice-tyres"[^>]*hidden/);
    // A menu item's display: flex must not override [hidden]
    expect(css).toMatch(/\.menu-item\[hidden\]\s*\{\s*display:\s*none/);
  });

  it('cycles the tyres Street, All-Terrain, Wet and back', () => {
    expect(nextTyre('street')).toBe('all_terrain');
    expect(nextTyre('all_terrain')).toBe('wet');
    expect(nextTyre('wet')).toBe('street');
  });
});
