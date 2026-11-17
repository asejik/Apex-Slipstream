import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CareerManager } from '../src/engine/CareerManager';
import { careerStatRows, levelLine, RecordsModel, recordsTrackRows } from '../src/ui/RecordsScreen';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';

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

const race = { kind: 'championship' as const, gridPosition: 10, hasFastestLap: false, isCleanDriver: false };

function model(career: CareerManager, bestLaps: (number | null)[]): RecordsModel {
  return {
    level: career.level,
    xp: career.xp,
    stats: { ...career.stats },
    bestLaps,
    bestFinishes: ALL_TRACKS.map((track) => career.bestFinish(track.id)),
    rivalries: career.rivalries()
  };
}

describe('Records (R9 part 2)', () => {
  it('keeps your best finish on each track, and saves it', () => {
    const storage = memoryStorage();
    const career = new CareerManager(storage);
    const track = ALL_TRACKS[0]!.id;
    expect(career.bestFinish(track)).toBeNull();
    career.awardRace({ ...race, trackId: track, finishPosition: 7 });
    career.awardRace({ ...race, trackId: track, finishPosition: 3 });
    career.awardRace({ ...race, trackId: track, finishPosition: 12 });
    expect(career.bestFinish(track)).toBe(3);
    expect(new CareerManager(storage).bestFinish(track)).toBe(3);
  });

  it('puts finished championships in the trophy cabinet', () => {
    const storage = memoryStorage();
    const career = new CareerManager(storage);
    career.recordSeason('gold');
    career.recordSeason('bronze');
    career.recordSeason('none');
    expect(new CareerManager(storage).stats).toMatchObject({ seasons: 3, goldTrophies: 1, silverTrophies: 0, bronzeTrophies: 1 });
  });

  it('never trusts odd saved track bests', () => {
    const storage = memoryStorage();
    storage.setItem('apex_career_v1', JSON.stringify({ xp: 10, trackBests: { a: 2, b: 0, c: 4.5, d: 'P1', e: 99 } }));
    const career = new CareerManager(storage);
    expect(career.bestFinish('a')).toBe(2);
    for (const id of ['b', 'c', 'd', 'e']) expect(career.bestFinish(id)).toBeNull();
    storage.setItem('apex_career_v1', JSON.stringify({ xp: 10, trackBests: 'lots' }));
    expect(new CareerManager(storage).bestFinish('a')).toBeNull();
  });

  it('shows every track with its best lap and best finish, podiums in trophy colours', () => {
    const career = new CareerManager(memoryStorage());
    career.awardRace({ ...race, trackId: ALL_TRACKS[1]!.id, finishPosition: 2 });
    career.awardRace({ ...race, trackId: ALL_TRACKS[2]!.id, finishPosition: 9 });
    const laps = ALL_TRACKS.map((_, i) => (i === 0 ? 141_900 : null));
    const rows = recordsTrackRows(model(career, laps));
    expect(rows).toHaveLength(ALL_TRACKS.length);
    expect(rows[0]).toMatchObject({ bestLap: '2:21.90', bestFinish: '—', medal: null });
    expect(rows[1]).toMatchObject({ bestLap: '—', bestFinish: 'P2', medal: 'silver' });
    expect(rows[2]).toMatchObject({ bestFinish: 'P9', medal: null });
  });

  it('sums up your level and career', () => {
    expect(levelLine(2, 300)).toBe('Level 2 · 300 XP · 50% to level 3 (150 to go)');
    const career = new CareerManager(memoryStorage());
    career.awardRace({ ...race, trackId: 'x', finishPosition: 1 });
    career.awardRace({ ...race, trackId: 'x', finishPosition: 5 });
    const rows = Object.fromEntries(careerStatRows(model(career, [])));
    expect(rows['Races']).toBe('2');
    expect(rows['Wins']).toBe('1 (50%)');
  });
});

describe('Records in the game (R9 part 2)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const main = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');

  it('opens from the hub tab, which is no longer marked "Soon"', () => {
    expect(html).toMatch(/id="hub-tab-records"/);
    expect(html).not.toMatch(/Records <small>Soon<\/small>/);
    expect(html).toMatch(/id="records-screen"/);
  });

  it('records best finishes and finished championships', () => {
    expect(main).toMatch(/trackId: this\.trackSpline\.data\.id,/);
    expect(main).toMatch(/if \(result\.isSeasonFinale\) this\.career\.recordSeason\(result\.trophy\);/);
  });
});
