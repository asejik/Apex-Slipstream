import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { formatLapTime, TIME_TRIAL_LAPS, timeTrialGrid, timeTrialTrack } from '../src/app/TimeTrial';
import { bestLapLabel } from '../src/ui/TimeTrialScreen';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { SCENE_COLOURS } from '../src/render/SceneSetup';

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
const main = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');
const design = fs.readFileSync(path.resolve(__dirname, '../docs/DESIGN.md'), 'utf-8');
const circuit = ALL_TRACKS.findIndex((t) => t.isClosed);
const sprint = ALL_TRACKS.findIndex((t) => !t.isClosed);

describe('Time Trial rules (R8 part 6)', () => {
  it('laps a circuit without end, and runs a sprint once at a time', () => {
    expect(timeTrialTrack({ trackIndex: circuit, tyre: 'street' }).laps).toBe(TIME_TRIAL_LAPS);
    expect(TIME_TRIAL_LAPS).toBeGreaterThan(20);
    expect(timeTrialTrack({ trackIndex: sprint, tyre: 'street' }).laps).toBe(1);
    // The track itself is untouched
    expect(ALL_TRACKS[circuit]!.laps).toBeLessThan(TIME_TRIAL_LAPS);
  });

  it('starts you from pole', () => {
    const grid = timeTrialGrid();
    expect(grid[0]).toBe('player');
    expect(grid).toHaveLength(20);
  });

  it('formats lap times as minutes, seconds and hundredths', () => {
    expect(formatLapTime(118420)).toBe('1:58.42');
    expect(formatLapTime(65050)).toBe('1:05.05');
    expect(formatLapTime(9990)).toBe('0:09.99');
    expect(bestLapLabel(null)).toBe('No time yet');
    expect(bestLapLabel(121300)).toBe('Best 2:01.30');
  });
});

describe('Time Trial in the game (R8 part 6)', () => {
  it('opens from the hub tile, which is no longer marked "Soon"', () => {
    expect(html).toMatch(/<button class="tile tile-trial" id="hub-time-trial"/);
    expect(html).not.toMatch(/tile-trial tile-disabled/);
    expect(html).not.toMatch(/class="tile-flag">Soon/);
  });

  it('has a setup screen with tyres, a reset and a start button', () => {
    const screen = html.slice(html.indexOf('id="time-trial-screen"'), html.indexOf('<!-- Settings (R5)'));
    expect(screen).toMatch(/data-trial="tyre"[\s\S]*data-value="street"[\s\S]*data-value="all_terrain"[\s\S]*data-value="wet"/);
    expect(screen).toMatch(/id="time-trial-reset"/);
    expect(screen).toMatch(/id="time-trial-start"/);
  });

  it('runs alone in the dry with a second, white ghost for the last lap', () => {
    expect(main).toMatch(/return this\.isQualifying \|\| this\.timeTrial !== null;/);
    expect(main).toMatch(/this\.raceWeather = this\.timeTrial\s*\?\s*'dry'/);
    expect(main).toMatch(/new GhostPlayback\(SCENE_COLOURS\.lastLapGhost\)/);
    expect(main).toMatch(/if \(this\.timeTrial\) this\.lastLapGhost\.loadGhost\(data, sampleCount\);/);
    expect(SCENE_COLOURS.lastLapGhost).not.toBe(SCENE_COLOURS.pbGhost);
    expect(design).toContain(`#${SCENE_COLOURS.lastLapGhost.toString(16)}`);
    expect(design).toContain(`#${SCENE_COLOURS.pbGhost.toString(16).padStart(6, '0')}`);
  });

  it('never counts for the championship', () => {
    expect(main).toMatch(/!this\.quickRace && !this\.timeTrial;/);
  });
});
