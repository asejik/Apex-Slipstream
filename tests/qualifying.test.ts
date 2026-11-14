import { describe, it, expect } from 'vitest';
import { QualifyingManager } from '../src/engine/QualifyingManager';
import { TRACK_1_COASTAL } from '../src/track/TrackDefinitions';

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
