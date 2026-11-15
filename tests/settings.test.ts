import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_SETTINGS, displaySpeed, parseSettings, VOLUME_LEVELS } from '../src/app/Settings';

describe('Saved settings (R5 part 5)', () => {
  it('uses the defaults when nothing is saved or the save is unreadable', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid saved values and replaces bad ones field by field', () => {
    const saved = JSON.stringify({
      camera: 'top-down',
      ghost: false,
      sound: 'yes', // wrong type: default
      volume: 'high',
      units: 'furlongs', // unknown: default
      graphics: 'low',
      showFps: true,
      extra: 'ignored'
    });
    expect(parseSettings(saved)).toEqual({
      camera: 'top-down',
      ghost: false,
      sound: DEFAULT_SETTINGS.sound,
      volume: 'high',
      units: DEFAULT_SETTINGS.units,
      graphics: 'low',
      showFps: true
    });
  });

  it('shows speed in km/h or mph', () => {
    expect(displaySpeed(180, 'kmh')).toBe(180);
    expect(displaySpeed(180, 'mph')).toBe(112);
    expect(displaySpeed(0, 'mph')).toBe(0);
  });

  it('keeps the tuned mix at medium volume', () => {
    expect(VOLUME_LEVELS.medium).toBe(0.75);
    expect(VOLUME_LEVELS.low).toBeLessThan(VOLUME_LEVELS.medium);
    expect(VOLUME_LEVELS.high).toBeLessThanOrEqual(1);
  });
});

describe('Settings screen markup (R5 part 5)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const screen = html.slice(html.indexOf('id="settings-screen"'), html.indexOf('<!-- Tyre choice before the race'));

  it('has a row with a button for every value of every setting', () => {
    const values: Record<string, string[]> = {
      camera: ['high-chase', 'low-chase', 'top-down'],
      ghost: ['true', 'false'],
      sound: ['true', 'false'],
      volume: ['low', 'medium', 'high'],
      units: ['kmh', 'mph'],
      graphics: ['high', 'low'],
      showFps: ['true', 'false']
    };
    expect(Object.keys(values).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    for (const [key, options] of Object.entries(values)) {
      const start = screen.indexOf(`data-setting="${key}"`);
      expect(start, key).toBeGreaterThan(-1);
      const row = screen.slice(start, screen.indexOf('</div>', start));
      for (const option of options) expect(row, `${key}=${option}`).toContain(`data-value="${option}"`);
    }
  });

  it('opens from the hub and the pause menu', () => {
    expect(html).toMatch(/id="hub-tab-settings"/);
    expect(html).not.toMatch(/Settings <small>Soon<\/small>/);
    expect(html).toMatch(/id="pause-settings"/);
  });
});
