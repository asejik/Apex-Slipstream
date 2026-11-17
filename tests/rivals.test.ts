import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pickRival, rivalLabel, rivalResultLine, rivalShortName } from '../src/engine/Rivals';
import { CareerManager, RIVAL_BEAT_XP, raceXp } from '../src/engine/CareerManager';
import { SeasonManager } from '../src/engine/SeasonManager';
import { rivalryRows } from '../src/ui/RecordsScreen';
import { AI_DRIVER_ROSTER } from '../src/ai/AIDriverProfiles';
import type { DriverStanding } from '../src/engine/ChampionshipEngine';

/** A tiny Storage for tests (localStorage is not available here) */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value)
  };
}

/** Standings with points given per driver id (everyone else on 0) */
function standingsWith(points: Record<string, number>): DriverStanding[] {
  return new SeasonManager().standings.map((s) => ({ ...s, points: points[s.driverId] ?? 0 }));
}

const [first, second, third] = AI_DRIVER_ROSTER.map((d) => d.id) as [string, string, string];
const race = { kind: 'championship' as const, finishPosition: 5, gridPosition: 5, hasFastestLap: false, isCleanDriver: false };

describe('Your rival (R9 part 5)', () => {
  it('is the driver just ahead of you in the championship', () => {
    expect(pickRival(standingsWith({ [first]: 50, [second]: 30, player: 20 }))).toBe(second);
    expect(pickRival(standingsWith({ [first]: 50, player: 40, [second]: 30 }))).toBe(first);
  });

  it('is the driver in P2 while you lead, and someone even at the season start', () => {
    expect(pickRival(standingsWith({ player: 60, [third]: 45, [first]: 10 }))).toBe(third);
    expect(pickRival(new SeasonManager().standings)).not.toBeNull();
  });

  it('earns XP for beating them (half in a Quick Race), never for losing', () => {
    const total = (parts: { xp: number }[]) => parts.reduce((s, p) => s + p.xp, 0);
    const beat = total(raceXp({ ...race, rivalId: first, beatRival: true }));
    const lost = total(raceXp({ ...race, rivalId: first, beatRival: false }));
    expect(beat - lost).toBe(RIVAL_BEAT_XP);
    const quickBeat = total(raceXp({ ...race, kind: 'quick', rivalId: first, beatRival: true }));
    const quickLost = total(raceXp({ ...race, kind: 'quick', rivalId: first, beatRival: false }));
    expect(quickBeat - quickLost).toBe(Math.round(RIVAL_BEAT_XP / 2));
  });

  it('keeps a head-to-head for every rival, saved on this device', () => {
    const storage = memoryStorage();
    const career = new CareerManager(storage);
    career.awardRace({ ...race, rivalId: first, beatRival: true });
    career.awardRace({ ...race, rivalId: first, beatRival: true });
    career.awardRace({ ...race, rivalId: first, beatRival: false });
    career.awardRace({ ...race, rivalId: second, beatRival: false });
    career.awardRace({ ...race }); // no rival (e.g. none finished)
    const again = new CareerManager(storage);
    expect(again.headToHead(first)).toEqual({ won: 2, lost: 1 });
    expect(again.headToHead(third)).toEqual({ won: 0, lost: 0 });
    expect(again.rivalries().map((r) => r.driverId)).toEqual([first, second]);
  });

  it('ignores odd saved rivalries', () => {
    const storage = memoryStorage();
    storage.setItem('apex_career_v1', JSON.stringify({ rivals: { a: { won: 2, lost: -1 }, b: 'x', c: { won: 0, lost: 0 } } }));
    const career = new CareerManager(storage);
    expect(career.headToHead('a')).toEqual({ won: 2, lost: 0 });
    expect(career.rivalries().map((r) => r.driverId)).toEqual(['a']);
  });

  it('labels the rival on the hub, the results and the Records tab', () => {
    const name = rivalShortName(first);
    expect(name).toBe(name.toUpperCase());
    expect(rivalLabel(first, { won: 0, lost: 0 })).toBe(name);
    expect(rivalLabel(first, { won: 3, lost: 1 })).toBe(`${name} · 3–1`);
    expect(rivalResultLine(first, true, { won: 4, lost: 1 })).toBe(`Rival: you beat ${name} (4–1)`);
    expect(rivalResultLine(first, false, { won: 3, lost: 2 })).toBe(`Rival: ${name} beat you (3–2)`);
    const rows = rivalryRows({
      level: 1,
      xp: 0,
      stats: { races: 0, wins: 0, podiums: 0, fastestLaps: 0, cleanRaces: 0, placesGained: 0, ghostBeats: 0, seasons: 0, goldTrophies: 0, silverTrophies: 0, bronzeTrophies: 0 },
      bestLaps: [],
      bestFinishes: [],
      rivalries: [{ driverId: first, record: { won: 2, lost: 1 } }]
    });
    expect(rows).toEqual([[name, '2–1']]);
  });
});

describe('Rivals in the game (R9 part 5)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const main = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/ui/screens.css'), 'utf-8');

  it('shows the rival on the hub, the tower and the Records tab', () => {
    expect(html).toMatch(/id="hub-rival"/);
    expect(html).toMatch(/id="records-rivals"/);
    expect(css).toMatch(/\.tower-row\.rival/);
  });

  it('picks a rival only for races that count, and scores the head-to-head at the flag', () => {
    expect(main).toMatch(/this\.rivalId = this\.isSolo \|\| this\.loadedAsPractice \? null : pickRival\(this\.seasonManager\.standings\);/);
    expect(main).toMatch(/this\.towerView\.setRival\(this\.rivalId\);/);
    expect(main).toMatch(/beatRival = rivalFinish \? playerFinish\.finishPosition < rivalFinish\.finishPosition : undefined;/);
  });
});
