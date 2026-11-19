import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  defaultQuickRace,
  normaliseQuickRace,
  QUICK_RACE_GRID_SLOT,
  quickRaceGrid,
  quickRaceTrack
} from '../src/app/QuickRace';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { AI_DRIVER_ROSTER } from '../src/ai/AIDriverProfiles';
import { quickRaceTrackDetail } from '../src/ui/QuickRaceScreen';

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
const coastal = 0;
const expressway = ALL_TRACKS.findIndex((t) => !t.isClosed);
const stormy = ALL_TRACKS.findIndex((t) => t.rainChance >= 1);

describe('Quick Race rules (R8 part 5)', () => {
  it('runs the chosen track over the chosen laps; a sprint is always one run', () => {
    expect(quickRaceTrack({ trackIndex: coastal, weather: 'dry', laps: 5 }).laps).toBe(5);
    expect(quickRaceTrack({ trackIndex: coastal, weather: 'dry', laps: 1 }).laps).toBe(1);
    expect(quickRaceTrack({ trackIndex: expressway, weather: 'dry', laps: 4 }).laps).toBe(1);
    // The track itself is untouched
    expect(ALL_TRACKS[coastal]!.laps).toBe(3);
    expect(quickRaceTrack({ trackIndex: coastal, weather: 'dry', laps: 5 }).id).toBe(ALL_TRACKS[coastal]!.id);
  });

  it('keeps a setup valid: unknown tracks and lap counts fall back', () => {
    expect(normaliseQuickRace({ trackIndex: 99, weather: 'wet', laps: 2 })).toEqual({ trackIndex: 0, weather: 'wet', laps: 2 });
    expect(normaliseQuickRace({ trackIndex: coastal, weather: 'dry', laps: 9 }).laps).toBe(ALL_TRACKS[coastal]!.laps);
    expect(defaultQuickRace(coastal)).toEqual({ trackIndex: coastal, weather: 'dry', laps: 3 });
  });

  it('starts you mid-field, with the AI lined up fastest first', () => {
    const grid = quickRaceGrid();
    expect(grid).toHaveLength(20);
    expect(grid.indexOf('player')).toBe(QUICK_RACE_GRID_SLOT - 1);
    const skills = grid.filter((id) => id !== 'player').map((id) => AI_DRIVER_ROSTER.find((d) => d.id === id)!.skill);
    for (let i = 1; i < skills.length; i++) expect(skills[i]!).toBeLessThanOrEqual(skills[i - 1]!);
  });
});

describe('Quick Race setup screen (R8 part 5)', () => {
  it('offers the weather and 1 to 5 laps, and a button to the grid', () => {
    const screen = html.slice(html.indexOf('id="quick-race-screen"'), html.indexOf('<!-- Settings (R5)'));
    expect(screen).toMatch(/data-quick="weather"[\s\S]*data-value="dry"[\s\S]*data-value="wet"/);
    for (const laps of [1, 2, 3, 4, 5]) expect(screen).toContain(`data-value="${laps}"`);
    expect(screen).toMatch(/id="quick-race-tracks"/);
    expect(screen).toMatch(/id="quick-race-start"/);
  });

  it('describes each track: length, type, dirt and rain', () => {
    expect(quickRaceTrackDetail(coastal, 6474)).toBe('6.5 km · Circuit');
    expect(quickRaceTrackDetail(stormy, 5845)).toBe('5.8 km · Circuit · Always wet');
    // Before its length is worked out (P07-R01), the line starts at the kind of track
    expect(quickRaceTrackDetail(stormy, null)).toBe('Circuit · Always wet');
    expect(quickRaceTrackDetail(expressway, 5966)).toBe('6.0 km · Sprint');
  });
});

describe('Quick Race in the game (R8 part 5)', () => {
  it('opens from the hub tile, which is no longer marked "Soon"', () => {
    expect(html).toMatch(/<button class="tile tile-quick" id="hub-quick-race"/);
    expect(html).not.toMatch(/tile-quick tile-disabled/);
  });

});
