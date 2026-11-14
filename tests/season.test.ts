import { describe, it, expect, beforeEach } from 'vitest';
import { SeasonManager } from '../src/engine/SeasonManager';
import { DriverFinish } from '../src/engine/ChampionshipEngine';

describe('Seasonal Restart Tokens & Championship State Persistence', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('starts new season with 3 restart tokens, 20 drivers and race 0', () => {
    const season = new SeasonManager();
    expect(season.restartTokensRemaining).toBe(3);
    expect(season.canRestart()).toBe(true);
    expect(season.currentRaceIndex).toBe(0);
    expect(season.totalRaces).toBe(8);
    expect(season.standings.length).toBe(20);
    expect(season.isSeasonCompleted).toBe(false);
  });

  it('decrements tokens on restart and prevents restart at 0', () => {
    const season = new SeasonManager();
    expect(season.consumeRestartToken()).toBe(true);
    expect(season.restartTokensRemaining).toBe(2);

    expect(season.consumeRestartToken()).toBe(true);
    expect(season.restartTokensRemaining).toBe(1);

    expect(season.consumeRestartToken()).toBe(true);
    expect(season.restartTokensRemaining).toBe(0);
    expect(season.canRestart()).toBe(false);

    // Cannot consume at 0
    expect(season.consumeRestartToken()).toBe(false);
    expect(season.restartTokensRemaining).toBe(0);
  });

  it('resets season restoring 3 tokens and race 0', () => {
    const season = new SeasonManager();
    season.consumeRestartToken();
    season.consumeRestartToken();
    expect(season.restartTokensRemaining).toBe(1);

    season.resetSeason();
    expect(season.restartTokensRemaining).toBe(3);
    expect(season.currentRaceIndex).toBe(0);
  });

  it('records race results, updates standings and advances race index', () => {
    const season = new SeasonManager();
    const mockFinishes: DriverFinish[] = season.standings.map((driver, idx) => ({
      driverId: driver.driverId,
      driverName: driver.driverName,
      team: driver.team,
      isPlayer: driver.isPlayer,
      finishPosition: idx + 1,
      raceTimeMs: 120000 + idx * 1000,
      fastestLapMs: 38000 + idx * 500,
      hasFastestLap: idx === 0,
      isCleanDriver: driver.isPlayer,
      basePoints: idx === 0 ? 25 : (idx === 1 ? 20 : 0),
      bonusPoints: idx === 0 ? 3 : 0,
      totalPoints: idx === 0 ? 28 : (idx === 1 ? 20 : 0)
    }));

    const result = season.recordRaceResult(mockFinishes);
    expect(result.updatedStandings.length).toBe(20);
    expect(season.currentRaceIndex).toBe(1);
    expect(season.raceHistory.length).toBe(1);
  });
});
