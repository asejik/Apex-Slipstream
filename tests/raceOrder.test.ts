import { describe, it, expect } from 'vitest';
import { RaceProgress, classificationProgress, isAhead, countsForFastestLap } from '../src/engine/RaceOrder';

const entry = (completedLaps: number, lapFraction: number, finishTime: number | null = null): RaceProgress => ({
  completedLaps,
  lapFraction,
  finishTime
});

describe('RaceOrder (U-01)', () => {
  const totalLaps = 3;

  it('puts a car further around the same lap ahead', () => {
    expect(isAhead(entry(0, 0.6), entry(0, 0.5), totalLaps)).toBe(true);
    expect(isAhead(entry(0, 0.5), entry(0, 0.6), totalLaps)).toBe(false);
  });

  it('puts a car on a later lap ahead even when its lap fraction is smaller', () => {
    expect(isAhead(entry(1, 0.05), entry(0, 0.95), totalLaps)).toBe(true);
  });

  it('puts a finished car ahead of a car still on its final lap', () => {
    const player = entry(3, 0.0, 120);
    const aiOnFinalLap = entry(2, 0.95);
    expect(isAhead(player, aiOnFinalLap, totalLaps)).toBe(true);
    expect(isAhead(aiOnFinalLap, player, totalLaps)).toBe(false);
  });

  it('orders finished cars by finish time', () => {
    expect(isAhead(entry(3, 0, 100), entry(3, 0, 101), totalLaps)).toBe(true);
    expect(isAhead(entry(3, 0, 101), entry(3, 0, 100), totalLaps)).toBe(false);
  });

  it('gives every finisher the same classification progress, above any unfinished car', () => {
    const finished = classificationProgress(entry(3, 0.2, 99), totalLaps);
    expect(finished).toBe(classificationProgress(entry(4, 0.7, 105), totalLaps));
    expect(finished).toBeGreaterThan(classificationProgress(entry(2, 0.999), totalLaps));
  });
});

describe('Fastest lap eligibility (U-09)', () => {
  it('on circuits the rolling first lap does not count', () => {
    expect(countsForFastestLap(1, true)).toBe(false);
    expect(countsForFastestLap(2, true)).toBe(true);
  });

  it('on sprints the single lap is the run and counts', () => {
    expect(countsForFastestLap(1, false)).toBe(true);
  });
});
