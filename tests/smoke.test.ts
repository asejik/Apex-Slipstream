import { describe, it, expect, beforeEach } from 'vitest';
import { POINTS_TABLE } from '../src/engine/ChampionshipEngine';
import { SeasonManager } from '../src/engine/SeasonManager';
import { AI_DRIVER_ROSTER } from '../src/ai/AIDriverProfiles';

/**
 * The game's headline rules, checked against the code that applies them (P15-12: these
 * used to compare constants written in the test with themselves, so they could never fail).
 */
describe('Apex Slipstream - Smoke Test Suite', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.clear();
  });

  it('validates 1st to 15th championship point scale', () => {
    const pointsScale = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const scored = pointsScale.map((_, index) => POINTS_TABLE[index + 1]);
    expect(scored).toEqual(pointsScale);
    // 16th and below score nothing
    expect(POINTS_TABLE[16]).toBeUndefined();
    expect(Object.keys(POINTS_TABLE)).toHaveLength(15);
  });

  it('verifies seasonal restart token allocation', () => {
    expect(new SeasonManager().restartTokensRemaining).toBe(3);
  });

  it('verifies grid size of 20 total drivers', () => {
    expect(AI_DRIVER_ROSTER).toHaveLength(19);
    const standings = new SeasonManager().standings;
    expect(standings).toHaveLength(20);
    expect(standings.filter((s) => s.isPlayer)).toHaveLength(1);
    // Every AI driver in the roster has a place in the championship, once
    const aiIds = standings.filter((s) => !s.isPlayer).map((s) => s.driverId);
    expect(new Set(aiIds)).toEqual(new Set(AI_DRIVER_ROSTER.map((d) => d.id)));
  });
});
