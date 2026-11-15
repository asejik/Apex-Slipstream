import { describe, it, expect } from 'vitest';
import { nextTrackIndex, isPracticeTrack } from '../src/engine/TrackSelection';

describe('Track button: practice tracks (P15-07)', () => {
  it('steps from the loaded track, not the season round, so every track is reachable', () => {
    const seasonRound = 2;
    const visited: number[] = [];
    let loaded = seasonRound;
    for (let i = 0; i < 8; i++) {
      loaded = nextTrackIndex(loaded, 8);
      visited.push(loaded);
    }
    expect(new Set(visited).size).toBe(8);
    expect(loaded).toBe(seasonRound);
  });

  it('a track other than the season round is practice, so its result is not recorded', () => {
    expect(isPracticeTrack(3, 2)).toBe(true);
    expect(isPracticeTrack(2, 2)).toBe(false);
  });
});
