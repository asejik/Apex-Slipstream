import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  activeChampionship,
  CHAMPIONSHIPS,
  GRAND_PRIX,
  isChampionshipUnlocked
} from '../src/engine/Championships';
import { championshipRows } from '../src/ui/ChampionshipsScreen';
import {
  DIFFICULTY_UNLOCK_LEVEL,
  effectiveDifficulty,
  isDifficultyUnlocked,
  unlocksBetween
} from '../src/app/Unlocks';
import { DIFFICULTY_LIMIT } from '../src/ai/AIRacecraft';
import { parseSettings } from '../src/app/Settings';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { MAX_LEVEL } from '../src/engine/CareerManager';
import { QualifyingManager } from '../src/engine/QualifyingManager';

const byId = (id: string) => CHAMPIONSHIPS.find((c) => c.id === id)!;

describe('Championships unlocked by level (R9 part 3, Decision 14)', () => {
  it('opens with the Grand Prix, then highway, city and mountain in that order', () => {
    expect(CHAMPIONSHIPS[0]).toBe(GRAND_PRIX);
    expect(GRAND_PRIX.unlockLevel).toBe(1);
    const order = ['highway_cup', 'city_series', 'mountain_series'].map((id) => byId(id).unlockLevel);
    expect(order[0]!).toBeGreaterThan(1);
    expect(order[1]!).toBeGreaterThan(order[0]!);
    expect(order[2]!).toBeGreaterThan(order[1]!);
    expect(order[2]!).toBeLessThanOrEqual(MAX_LEVEL);
  });

  it('runs real tracks of the right kind, each saved apart', () => {
    const known = new Set(ALL_TRACKS.map((t) => t.id));
    const biome = (id: string) => ALL_TRACKS.find((t) => t.id === id)!.biome;
    for (const championship of CHAMPIONSHIPS) {
      expect(championship.trackIds.every((id) => known.has(id))).toBe(true);
      expect(new Set(championship.trackIds).size).toBe(championship.trackIds.length);
    }
    expect(new Set(CHAMPIONSHIPS.map((c) => c.storageKey)).size).toBe(CHAMPIONSHIPS.length);
    expect(byId('highway_cup').trackIds.every((id) => ['coastal', 'expressway'].includes(biome(id)))).toBe(true);
    expect(byId('city_series').trackIds.filter((id) => biome(id) === 'city')).toHaveLength(2);
    expect(byId('mountain_series').trackIds.filter((id) => biome(id) === 'mountain')).toHaveLength(2);
  });

  it('races the saved championship only while your level has it unlocked', () => {
    const highway = byId('highway_cup');
    expect(isChampionshipUnlocked(highway, highway.unlockLevel - 1)).toBe(false);
    expect(activeChampionship('highway_cup', highway.unlockLevel)).toBe(highway);
    expect(activeChampionship('highway_cup', 1)).toBe(GRAND_PRIX);
    expect(activeChampionship('nonsense', 30)).toBe(GRAND_PRIX);
    expect(activeChampionship(null, 30)).toBe(GRAND_PRIX);
  });

  it('lists every championship with progress, or the level it unlocks at', () => {
    const rows = championshipRows(3, 'highway_cup', (c) => ({ round: c.id === 'highway_cup' ? 1 : 0, totalRaces: c.trackIds.length }));
    expect(rows.map((r) => r.id)).toEqual(CHAMPIONSHIPS.map((c) => c.id));
    expect(rows[0]).toMatchObject({ locked: false, active: false, status: '8 rounds' });
    expect(rows[1]).toMatchObject({ locked: false, active: true, status: 'Round 2 of 3' });
    expect(rows[2]).toMatchObject({ locked: true, status: `Unlocks at level ${byId('city_series').unlockLevel}` });
  });
});

describe('Harder AI tiers (R9 part 3)', () => {
  it('adds Pro and Legend above Hard, unlocked by level', () => {
    expect(DIFFICULTY_LIMIT.pro).toBeGreaterThan(DIFFICULTY_LIMIT.hard);
    expect(DIFFICULTY_LIMIT.legend).toBeGreaterThan(DIFFICULTY_LIMIT.pro);
    expect(isDifficultyUnlocked('hard', 1)).toBe(true);
    expect(isDifficultyUnlocked('pro', DIFFICULTY_UNLOCK_LEVEL.pro - 1)).toBe(false);
    expect(isDifficultyUnlocked('pro', DIFFICULTY_UNLOCK_LEVEL.pro)).toBe(true);
    expect(DIFFICULTY_UNLOCK_LEVEL.legend).toBeGreaterThan(DIFFICULTY_UNLOCK_LEVEL.pro);
  });

  it('makes the field quicker on each tier: Hard, then Pro, then Legend', () => {
    const track = ALL_TRACKS[0]!;
    const median = (limit: number): number => {
      const times = QualifyingManager.generateAIBenchmarks(track, 1, limit).map((r) => r.lapTimeMs).sort((a, b) => a - b);
      return times[Math.floor(times.length / 2)]!;
    };
    const hard = median(DIFFICULTY_LIMIT.hard);
    const pro = median(DIFFICULTY_LIMIT.pro);
    const legend = median(DIFFICULTY_LIMIT.legend);
    expect(pro).toBeLessThan(hard);
    expect(legend).toBeLessThan(pro);
  }, 30_000);

  it('races a locked tier at Hard, and keeps a saved tier', () => {
    expect(effectiveDifficulty('legend', 1)).toBe('hard');
    expect(effectiveDifficulty('legend', DIFFICULTY_UNLOCK_LEVEL.legend)).toBe('legend');
    expect(effectiveDifficulty('easy', 1)).toBe('easy');
    expect(parseSettings(JSON.stringify({ difficulty: 'pro' })).difficulty).toBe('pro');
    expect(parseSettings(JSON.stringify({ difficulty: 'godlike' })).difficulty).toBe('medium');
  });

  it('says what a level-up unlocks', () => {
    expect(unlocksBetween(1, 2)).toEqual([]);
    expect(unlocksBetween(2, 3)).toEqual(['Highway Cup']);
    expect(unlocksBetween(3, DIFFICULTY_UNLOCK_LEVEL.pro)).toEqual(['Pro AI']);
    expect(unlocksBetween(1, MAX_LEVEL)).toHaveLength(5);
  });
});

describe('Championships in the game (R9 part 3)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const main = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');

  it('opens the list from the hub, and locks tiers in Settings', () => {
    expect(html).toMatch(/id="hub-championships"/);
    expect(html).toMatch(/id="championships-screen"/);
    expect(html).toMatch(/data-value="pro" data-unlock-level="4"/);
    expect(html).toMatch(/data-value="legend" data-unlock-level="7"/);
  });

  it('starts on the saved championship and races the AI at the unlocked tier', () => {
    expect(main).toMatch(/new SeasonManager\(activeChampionship\(loadActiveChampionshipId\(\), this\.career\.level\)\)/);
    expect(main).toMatch(/DIFFICULTY_LIMIT\[effectiveDifficulty\(this\.settings\.difficulty, this\.career\.level\)\]/);
    expect(main).not.toMatch(/DIFFICULTY_LIMIT\[this\.settings\.difficulty\]/);
  });
});
