import { describe, it, expect } from 'vitest';
import { QualifyingManager } from '../src/engine/QualifyingManager';
import { TRACK_1_COASTAL } from '../src/track/TrackDefinitions';
import { LapState } from '../src/engine/LapManager';

describe('QualifyingManager Benchmark & Grid Position Evaluation', () => {
  it('generates 19 sorted AI qualifying lap benchmarks', () => {
    const benchmarks = QualifyingManager.generateAIBenchmarks(TRACK_1_COASTAL);
    expect(benchmarks.length).toBe(19);

    // Should be sorted ascending by lap time
    for (let i = 1; i < benchmarks.length; i++) {
      expect(benchmarks[i]!.lapTimeMs).toBeGreaterThanOrEqual(benchmarks[i - 1]!.lapTimeMs);
    }
  });

  it('assigns P20 when player skips qualifying', () => {
    const benchmarks = QualifyingManager.generateAIBenchmarks(TRACK_1_COASTAL);
    const outcome = QualifyingManager.evaluateQualifying('skip', 0, benchmarks);

    expect(outcome.playerPosition).toBe(20);
    expect(outcome.gridOrder.length).toBe(20);
    expect(outcome.gridOrder[19]).toBe('player');
  });

  it('assigns Pole Position (P1) when player beats the fastest AI lap', () => {
    const benchmarks = QualifyingManager.generateAIBenchmarks(TRACK_1_COASTAL);
    const fastestAI = benchmarks[0]!.lapTimeMs;
    const playerTime = fastestAI - 500; // 0.5s faster than pole

    const outcome = QualifyingManager.evaluateQualifying('flying_lap', playerTime, benchmarks);

    expect(outcome.playerPosition).toBe(1);
    expect(outcome.gridOrder[0]).toBe('player');
    expect(outcome.deltaToPoleMs).toBeLessThan(0);
  });

  it('assigns accurate mid-pack position when player qualifies in the middle of the field', () => {
    const benchmarks = QualifyingManager.generateAIBenchmarks(TRACK_1_COASTAL);
    // Pick 10th AI time
    const targetAITime = benchmarks[9]!.lapTimeMs - 50;

    const outcome = QualifyingManager.evaluateQualifying('flying_lap', targetAITime, benchmarks);

    expect(outcome.playerPosition).toBe(10);
    expect(outcome.gridOrder[9]).toBe('player');
  });
});

describe('Qualifying session length and mode (P15-03)', () => {
  const lapState = (over: Partial<LapState>): LapState => ({
    currentLap: 1,
    totalLaps: 3,
    isRaceCompleted: false,
    currentLapTime: 0,
    lastLapTime: null,
    bestLapTime: null,
    currentSector: 1,
    sector1Time: null,
    sector2Time: null,
    wrongWay: false,
    checkpointProgress: 0,
    ...over
  });

  it('a flying lap ends after one lap, not the race distance', () => {
    expect(QualifyingManager.sessionTimeMs('flying_lap', lapState({ currentLapTime: 40 }))).toBeNull();
    const afterOneLap = lapState({ currentLap: 2, lastLapTime: 62.5, bestLapTime: 62.5 });
    expect(afterOneLap.isRaceCompleted).toBe(false);
    expect(QualifyingManager.sessionTimeMs('flying_lap', afterOneLap)).toBe(62500);
  });

  it('a sector sprint ends when sector 1 is complete', () => {
    expect(QualifyingManager.sessionTimeMs('sector_sprint', lapState({ currentLapTime: 15 }))).toBeNull();
    expect(QualifyingManager.sessionTimeMs('sector_sprint', lapState({ currentSector: 2, sector1Time: 21.3 }))).toBe(21300);
  });

  it('sector sprint benchmarks cover only the sector distance', () => {
    const full = QualifyingManager.generateAIBenchmarks(TRACK_1_COASTAL);
    const sector = QualifyingManager.generateAIBenchmarks(TRACK_1_COASTAL, 1 / 3);
    for (const s of sector) {
      const f = full.find((x) => x.driverId === s.driverId)!;
      // Times come from the speed plan (R6), so a third of the distance is about, not
      // exactly, a third of the time: within 1%
      expect(Math.abs(s.lapTimeMs - f.lapTimeMs / 3)).toBeLessThan(f.lapTimeMs / 3 * 0.01);
    }
  });

  it('a sector time that beats every AI sector time takes pole', () => {
    const sector = QualifyingManager.generateAIBenchmarks(TRACK_1_COASTAL, 1 / 3);
    const outcome = QualifyingManager.evaluateQualifying('sector_sprint', sector[0]!.lapTimeMs - 100, sector);
    expect(outcome.playerPosition).toBe(1);
  });
});
