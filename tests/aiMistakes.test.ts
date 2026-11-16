import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AIMistakes, MistakeEffect, MistakeKind, mistakeChance, spinShare } from '../src/ai/AIMistakes';
import { AIDriverManager } from '../src/ai/AIDriverManager';
import { DIFFICULTY_LIMIT } from '../src/ai/AIRacecraft';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { TrackSpline } from '../src/track/TrackSpline';

const STEP = 1 / 60;
const TOP = 45;

function effect(): MistakeEffect {
  return { speedScale: 1, lineShift: 0, startSpin: false };
}

/** Drives one driver into `corners` corners and returns how many mistakes they made. */
function cornersDriven(mistakes: AIMistakes, corners: number, skill: number, limit = DIFFICULTY_LIMIT.medium): number {
  const out = effect();
  for (let c = 0; c < corners; c++) {
    // A straight, then a corner long enough for any mistake to play out
    for (let s = 0; s < 60; s++) mistakes.update(0, TOP, TOP, -3, limit, skill, 0.5, false, STEP, out);
    for (let s = 0; s < 200; s++) mistakes.update(0, 25, TOP, -3, limit, skill, 0.5, false, STEP, out);
  }
  const counts = mistakes.counts;
  return counts[MistakeKind.LockUp]! + counts[MistakeKind.Wide]! + counts[MistakeKind.Spin]!;
}

describe('AI mistakes (R6 part 3)', () => {
  it('are likelier on easier difficulty, for weaker and bolder drivers, and under pressure', () => {
    const { easy, medium, hard } = DIFFICULTY_LIMIT;
    expect(mistakeChance(easy, 1, 0.5, false)).toBeGreaterThan(mistakeChance(medium, 1, 0.5, false));
    expect(mistakeChance(medium, 1, 0.5, false)).toBeGreaterThan(mistakeChance(hard, 1, 0.5, false));
    expect(mistakeChance(medium, 0.92, 0.5, false)).toBeGreaterThan(mistakeChance(medium, 1.02, 0.5, false));
    expect(mistakeChance(medium, 1, 0.9, false)).toBeGreaterThan(mistakeChance(medium, 1, 0.1, false));
    expect(mistakeChance(medium, 1, 0.5, true)).toBeGreaterThan(mistakeChance(medium, 1, 0.5, false));
    expect(spinShare(0.9)).toBeGreaterThan(spinShare(0.1));
    // Rare enough to stay a surprise: a few percent of corners at worst
    expect(mistakeChance(easy, 0.92, 1, true)).toBeLessThan(0.1);
  });

  it('happen at about the chance per corner, and the same seed gives the same mistakes', () => {
    const corners = 2000;
    const a = new AIMistakes();
    a.reset(42);
    const made = cornersDriven(a, corners, 0.95);
    const expected = mistakeChance(DIFFICULTY_LIMIT.medium, 0.95, 0.5, false) * corners;
    expect(made).toBeGreaterThan(expected * 0.6);
    expect(made).toBeLessThan(expected * 1.4);

    const b = new AIMistakes();
    b.reset(42);
    expect(cornersDriven(b, corners, 0.95)).toBe(made);
  });

  it('a lock-up costs speed and runs the car wide to the outside, then it recovers', () => {
    const mistakes = new AIMistakes();
    const out = effect();
    // Find a seed whose first corner is a lock-up for a weak driver on Easy
    let seed = 1;
    for (; seed < 5000; seed++) {
      mistakes.reset(seed);
      mistakes.update(0, 25, TOP, -3, DIFFICULTY_LIMIT.easy, 0.92, 0.5, true, STEP, out);
      if (mistakes.kindOf(0) === MistakeKind.LockUp) break;
    }
    expect(mistakes.kindOf(0)).toBe(MistakeKind.LockUp);
    // The line was on the left (negative) before the bend: the car goes wider left
    expect(out.speedScale).toBeLessThan(0.7);
    expect(out.lineShift).toBeLessThan(-1);
    for (let s = 0; s < 120; s++) mistakes.update(0, 25, TOP, -3, DIFFICULTY_LIMIT.easy, 0.92, 0.5, true, STEP, out);
    expect(mistakes.kindOf(0)).toBe(MistakeKind.None);
    expect(out.speedScale).toBe(1);
    expect(out.lineShift).toBe(0);
  });

  it('never strike on a straight', () => {
    const mistakes = new AIMistakes();
    mistakes.reset(3);
    const out = effect();
    for (let s = 0; s < 60 * 600; s++) {
      mistakes.update(0, TOP, TOP, 0, DIFFICULTY_LIMIT.easy, 0.92, 1, true, STEP, out);
      expect(out.speedScale).toBe(1);
      expect(out.startSpin).toBe(false);
    }
  });

  it('show up in a race, with no contact between cars still racing', () => {
    const spline = new TrackSpline(ALL_TRACKS[0]!);
    const manager = new AIDriverManager();
    manager.setDifficultyLimit(DIFFICULTY_LIMIT.easy);
    manager.resetGrid(spline, undefined, 11);
    const far = new THREE.Vector3(0, 0, 99999);
    const L = spline.totalLength;
    let contacts = 0;
    for (let step = 0; step < 60 * 240; step++) {
      manager.update(STEP, far);
      const cars = manager.cars;
      for (let a = 0; a < cars.length; a++) {
        if (cars[a]!.finishTime !== null) continue;
        for (let b = a + 1; b < cars.length; b++) {
          if (cars[b]!.finishTime !== null) continue;
          let g = (cars[b]!.splineT - cars[a]!.splineT) * L;
          if (g > L / 2) g -= L;
          if (g < -L / 2) g += L;
          if (Math.abs(g) < 4.6 && Math.abs(cars[a]!.lateralOffset - cars[b]!.lateralOffset) < 1.9) contacts++;
        }
      }
    }
    const counts = manager.mistakes.counts;
    expect(counts[MistakeKind.LockUp]! + counts[MistakeKind.Wide]! + counts[MistakeKind.Spin]!).toBeGreaterThan(0);
    expect(contacts).toBe(0);
  }, 30_000);
});
