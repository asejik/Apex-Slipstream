import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  activeLivery,
  cleanName,
  cleanNumber,
  DEFAULT_DRIVER,
  fullName,
  licenceFor,
  LIVERIES,
  NAME_MAX_LENGTH,
  parseDriverProfile,
  shortName
} from '../src/app/DriverProfile';
import { isTextEntry } from '../src/engine/InputManager';
import { hubStandingsRows } from '../src/ui/HubScreen';
import { SeasonManager } from '../src/engine/SeasonManager';
import { MAX_LEVEL } from '../src/engine/CareerManager';

describe('Your driver (R9 part 4, Decision 12)', () => {
  it('cleans the name: no markup or odd characters, single spaces, 16 at most', () => {
    expect(cleanName('  Sam   Rivera ')).toBe('Sam Rivera');
    expect(cleanName('<img src=x onerror=alert(1)>')).toBe('img srcx onerror');
    expect(cleanName("O'Neil-Ávila Jr.")).toBe("O'Neil-Ávila Jr.");
    expect(cleanName('a'.repeat(40))).toHaveLength(NAME_MAX_LENGTH);
    expect(cleanName(42)).toBe('');
    expect(cleanName('<>{}')).toBe('');
  });

  it('keeps race numbers from 1 to 99', () => {
    expect(cleanNumber('44')).toBe(44);
    expect(cleanNumber(1)).toBe(1);
    expect(cleanNumber(99)).toBe(99);
    for (const bad of [0, 100, 7.5, '', 'x', null]) expect(cleanNumber(bad)).toBe(DEFAULT_DRIVER.number);
  });

  it('shows "You" until you set a name, and a short name like the AI on the tower', () => {
    expect(fullName(DEFAULT_DRIVER)).toBe('You');
    expect(shortName(DEFAULT_DRIVER)).toBe('YOU');
    const sam = { ...DEFAULT_DRIVER, name: 'Sam Rivera' };
    expect(fullName(sam)).toBe('Sam Rivera');
    expect(shortName(sam)).toBe('RIVERA');
  });

  it('reads a damaged or hand-edited save safely', () => {
    expect(parseDriverProfile('{oops')).toEqual(DEFAULT_DRIVER);
    expect(parseDriverProfile(JSON.stringify({ name: '<b>Kai</b>', number: 500, liveryId: 'chrome' }))).toEqual({
      name: 'bKaib',
      number: DEFAULT_DRIVER.number,
      liveryId: 'broadcast'
    });
  });
});

describe('Liveries and licence by level (R9 part 4, Decision 14)', () => {
  it('starts with Broadcast and unlocks the rest one by one', () => {
    expect(LIVERIES[0]).toMatchObject({ id: 'broadcast', unlockLevel: 1 });
    expect(new Set(LIVERIES.map((l) => l.id)).size).toBe(LIVERIES.length);
    for (let i = 1; i < LIVERIES.length; i++) {
      expect(LIVERIES[i]!.unlockLevel).toBeGreaterThan(LIVERIES[i - 1]!.unlockLevel);
      expect(LIVERIES[i]!.unlockLevel).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });

  it('paints a locked livery as Broadcast', () => {
    const gold = LIVERIES[LIVERIES.length - 1]!;
    const profile = { ...DEFAULT_DRIVER, liveryId: gold.id };
    expect(activeLivery(profile, 1).id).toBe('broadcast');
    expect(activeLivery(profile, gold.unlockLevel).id).toBe(gold.id);
  });

  it('raises the licence with your level', () => {
    expect(licenceFor(1)).toBe('Rookie');
    expect(licenceFor(4)).toBe('Club');
    expect(licenceFor(MAX_LEVEL)).toBe('Legend');
  });
});

describe('The Garage in the game (R9 part 4)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

  it('opens from the hub tab, which is no longer marked "Soon"', () => {
    expect(html).toMatch(/id="hub-tab-garage"/);
    expect(html).not.toMatch(/Garage <small>Soon<\/small>/);
    expect(html).toMatch(/id="garage-name"[^>]*maxlength="16"/);
  });

  it('puts your name on the hub standings', () => {
    const rows = hubStandingsRows(new SeasonManager().standings, 5, 'RIVERA');
    expect(rows.find((r) => r.isPlayer)?.name).toBe('RIVERA');
  });

  it('lets you type a name without the keys driving the game (only Escape counts)', () => {
    expect(isTextEntry({ tagName: 'INPUT', type: 'text' } as unknown as EventTarget)).toBe(true);
    expect(isTextEntry({ tagName: 'INPUT', type: 'number' } as unknown as EventTarget)).toBe(true);
    expect(isTextEntry({ tagName: 'INPUT', type: 'checkbox' } as unknown as EventTarget)).toBe(false);
    expect(isTextEntry({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
