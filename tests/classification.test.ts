import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { pointsBreakdown, standingsProgressLabel } from '../src/ui/ClassificationRows';
import { DriverFinish } from '../src/engine/ChampionshipEngine';

function finish(overrides: Partial<DriverFinish>): DriverFinish {
  return {
    driverId: 'player',
    driverName: 'Player (You)',
    team: 'Apex Slipstream GP',
    isPlayer: true,
    finishPosition: 4,
    raceTimeMs: 120000,
    fastestLapMs: 40650,
    hasFastestLap: false,
    isCleanDriver: false,
    basePoints: 12,
    bonusPoints: 0,
    totalPoints: 12,
    ...overrides
  };
}

describe('Results and standings text (R5 part 4)', () => {
  it('explains where the points came from', () => {
    expect(pointsBreakdown(finish({}))).toBe('12 for P4');
    expect(pointsBreakdown(finish({ hasFastestLap: true, isCleanDriver: true }))).toBe(
      '12 for P4 · +1 fastest lap · +2 clean driving'
    );
  });

  it('labels the standings by rounds completed', () => {
    expect(standingsProgressLabel(0, 8)).toBe('Season start');
    expect(standingsProgressLabel(3, 8)).toBe('After round 3 of 8');
    expect(standingsProgressLabel(8, 8)).toBe('After round 8 of 8');
    expect(standingsProgressLabel(9, 8)).toBe('After round 8 of 8');
  });
});

describe('Race weekend screens markup (R5 part 4)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const hud = fs.readFileSync(path.resolve(__dirname, '../src/ui/HUDController.ts'), 'utf-8');

  it('lists the whole field in the results, not just the top 8', () => {
    expect(hud).not.toMatch(/finishes\.slice\(0,\s*8\)/);
    expect(hud).toMatch(/renderResultRows\(tbody, finishes\)/);
  });

  it('has no emoji or inline colours left in the weekend screens', () => {
    const screens = html.slice(html.indexOf('<!-- Qualifying choice -->'), html.indexOf('<!-- Mobile Multi-Touch'));
    expect(screens).not.toMatch(/style="/);
    expect(screens).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(hud).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
