import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  CareerManager,
  GHOST_BEAT_XP,
  levelForXp,
  levelProgress,
  MAX_LEVEL,
  raceXp,
  xpForLevel,
  xpSummary
} from '../src/engine/CareerManager';

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

const total = (parts: { xp: number }[]): number => parts.reduce((sum, p) => sum + p.xp, 0);

describe('Career XP (R9 part 1, Decision 14)', () => {
  it('rewards finishing position, a win, places gained, fastest lap and a clean race', () => {
    const win = raceXp({ kind: 'championship', finishPosition: 1, gridPosition: 6, hasFastestLap: true, isCleanDriver: true });
    // 100 for P1, 50 for the win, 25 for 5 places, 25 fastest lap, 20 clean
    expect(total(win)).toBe(220);
    const last = raceXp({ kind: 'championship', finishPosition: 20, gridPosition: 10, hasFastestLap: false, isCleanDriver: false });
    expect(total(last)).toBe(5);
    // Better results always earn more
    const p5 = total(raceXp({ kind: 'championship', finishPosition: 5, gridPosition: 5, hasFastestLap: false, isCleanDriver: true }));
    const p6 = total(raceXp({ kind: 'championship', finishPosition: 6, gridPosition: 6, hasFastestLap: false, isCleanDriver: true }));
    expect(p5).toBeGreaterThan(p6);
  });

  it('gives a Quick Race half the XP', () => {
    const input = { finishPosition: 3, gridPosition: 10, hasFastestLap: false, isCleanDriver: true };
    const championship = total(raceXp({ kind: 'championship', ...input }));
    const quick = total(raceXp({ kind: 'quick', ...input }));
    // Each part is halved and rounded on its own
    expect(Math.abs(quick - championship / 2)).toBeLessThanOrEqual(1);
  });

  it('needs a little more XP for each level, up to level 30', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(150);
    expect(xpForLevel(3)).toBe(450);
    expect(xpForLevel(4)).toBe(900);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(449)).toBe(2);
    expect(levelForXp(450)).toBe(3);
    expect(levelForXp(1e9)).toBe(MAX_LEVEL);
    expect(levelProgress(300)).toBeCloseTo(0.5, 5); // halfway from 150 to 450
    for (let level = 2; level < MAX_LEVEL; level++) {
      expect(xpForLevel(level + 1) - xpForLevel(level)).toBeGreaterThan(xpForLevel(level) - xpForLevel(level - 1));
    }
  });

  it('keeps the career on this device, with stats', () => {
    const storage = memoryStorage();
    const career = new CareerManager(storage);
    const award = career.awardRace({ kind: 'championship', finishPosition: 1, gridPosition: 6, hasFastestLap: true, isCleanDriver: true });
    expect(award.gained).toBe(220);
    expect(award.levelBefore).toBe(1);
    expect(award.levelAfter).toBe(2);
    career.awardGhostBeat();
    const again = new CareerManager(storage);
    expect(again.xp).toBe(220 + GHOST_BEAT_XP);
    expect(again.stats).toMatchObject({ races: 1, wins: 1, podiums: 1, fastestLaps: 1, cleanRaces: 1, placesGained: 5, ghostBeats: 1 });
  });

  it('starts a fresh career from a damaged save, and never trusts odd values', () => {
    const storage = memoryStorage();
    storage.setItem('apex_career_v1', '{not json');
    expect(new CareerManager(storage).xp).toBe(0);
    storage.setItem('apex_career_v1', JSON.stringify({ xp: -50, wins: 'lots', races: 3.7 }));
    const career = new CareerManager(storage);
    expect(career.xp).toBe(0);
    expect(career.stats.wins).toBe(0);
    expect(career.stats.races).toBe(3);
  });

  it('says what you earned on the results screen', () => {
    expect(xpSummary({ gained: 220, parts: [], levelBefore: 1, levelAfter: 2 }, 220)).toBe('+220 XP · Level up! Level 2');
    expect(xpSummary({ gained: 100, parts: [], levelBefore: 2, levelAfter: 2 }, 300)).toBe('+100 XP · Level 2 · 50% to level 3');
  });
});

describe('Career in the game (R9 part 1)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const main = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');

  it('shows your level on the hub and your XP on the results', () => {
    expect(html).toMatch(/id="hub-level-chip"/);
    expect(html).toMatch(/id="results-xp"/);
  });

  it('awards XP for championship and Quick races, and for beating your Time Trial best', () => {
    expect(main).toMatch(/kind: this\.quickRace \? 'quick' : 'championship'/);
    expect(main).toMatch(/if \(this\.timeTrial && this\.storedPbLapMs !== null\) \{\s*const award = this\.career\.awardGhostBeat\(\);/);
  });
});
