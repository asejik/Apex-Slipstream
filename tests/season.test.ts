import { describe, it, expect, beforeEach } from 'vitest';
import { SeasonManager } from '../src/engine/SeasonManager';

describe('Seasonal Restart Tokens & State Persistence', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('starts new season with 3 restart tokens', () => {
    const season = new SeasonManager();
    expect(season.restartTokensRemaining).toBe(3);
    expect(season.canRestart()).toBe(true);
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

  it('resets season restoring 3 tokens', () => {
    const season = new SeasonManager();
    season.consumeRestartToken();
    season.consumeRestartToken();
    expect(season.restartTokensRemaining).toBe(1);

    season.resetSeason();
    expect(season.restartTokensRemaining).toBe(3);
  });
});
