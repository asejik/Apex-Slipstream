import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AIDriverManager, gridSlotOffset, offsetToSplineT } from '../src/ai/AIDriverManager';
import { TrackSpline } from '../src/track/TrackSpline';
import { TRACK_1_COASTAL, TRACK_2_EXPRESSWAY, ALL_TRACKS } from '../src/track/TrackDefinitions';
import { TrackGeometryGenerator } from '../src/track/TrackGeometryGenerator';
import { LapManager } from '../src/engine/LapManager';
import { StartLights } from '../src/engine/StartLights';

const FAR_AWAY = new THREE.Vector3(0, 0, 99999);

describe('Grid behind the start line (U-11)', () => {
  it('puts every circuit grid slot behind the line, pole closest, 8.5 m apart', () => {
    expect(gridSlotOffset(1, true)).toBe(-8);
    expect(gridSlotOffset(2, true)).toBe(-16.5);
    expect(gridSlotOffset(20, true)).toBe(-(8 + 19 * 8.5));
    for (let rank = 1; rank <= 20; rank++) expect(gridSlotOffset(rank, true)).toBeLessThan(0);
    // Sprints start at the beginning of the road, so their grid stays ahead of it
    expect(gridSlotOffset(20, false)).toBe(14);
  });

  it('wraps a distance behind the line to the end of the lap', () => {
    expect(offsetToSplineT(-100, 1000)).toBeCloseTo(0.9, 10);
    expect(offsetToSplineT(250, 1000)).toBeCloseTo(0.25, 10);
  });

  it('lines the AI up behind the line on a circuit, stopped, before lap 1', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(TRACK_1_COASTAL);
    const { playerSpawnDist } = manager.resetGrid(spline);

    expect(playerSpawnDist).toBeLessThan(0);
    for (const car of manager.cars) {
      // Within 180 m of the line, on its approach
      expect(car.splineT).toBeGreaterThan(1 - 180 / spline.totalLength);
      expect(car.lap).toBe(0);
      expect(car.speedKmh).toBe(0);
    }
  });

  it('starts an AI car on lap 1 when it crosses the line, timing the lap from there', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(TRACK_1_COASTAL);
    manager.resetGrid(spline);
    const car = manager.cars[0]!;

    let seconds = 0;
    while (car.lap === 0 && seconds < 30) {
      manager.update(1 / 60, FAR_AWAY);
      seconds += 1 / 60;
    }
    expect(car.lap).toBe(1);
    expect(car.lapStartTime).toBeCloseTo(seconds, 1);
    expect(car.bestLapTime).toBeNull();
  });

  it('a sprint grid still starts on lap 1, from a standstill', () => {
    const manager = new AIDriverManager();
    manager.resetGrid(new TrackSpline(TRACK_2_EXPRESSWAY));
    for (const car of manager.cars) {
      expect(car.lap).toBe(1);
      expect(car.speedKmh).toBe(0);
    }
  });
});

describe('Standing start for the AI (U-06)', () => {
  it('launches from 0 to 100 km/h in under 4 s at skill 1.0', () => {
    const manager = new AIDriverManager();
    manager.resetGrid(new TrackSpline(TRACK_1_COASTAL));
    const car = manager.cars.find((c) => c.profile.skill >= 1.0) ?? manager.cars[0]!;

    let seconds = 0;
    while (car.speedKmh < 100 && seconds < 10) {
      manager.update(1 / 60, FAR_AWAY);
      seconds += 1 / 60;
    }
    expect(seconds).toBeLessThan(4);
    expect(car.isLaunching).toBe(true);

    // The launch ends at 80% of the target speed; normal pace control takes over
    for (let i = 0; i < 120; i++) manager.update(1 / 60, FAR_AWAY);
    expect(car.isLaunching).toBe(false);
  });
});

describe('Lap counting from a grid behind the line (U-11)', () => {
  /** Drives a point along the centreline from t0 to t1 (t1 may pass 1 to wrap) in small steps. */
  function drive(lap: LapManager, spline: TrackSpline, t0: number, t1: number): void {
    const pos = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    for (let t = t0; t <= t1; t += 0.002) {
      const wrapped = t % 1;
      spline.getPointAt(wrapped, pos);
      spline.getTangentAt(wrapped, tangent);
      lap.update(pos, tangent.multiplyScalar(30), 1 / 60);
    }
  }

  it('crossing the line from the grid starts lap 1 instead of completing it', () => {
    const spline = new TrackSpline(ALL_TRACKS[0]!);
    const lap = new LapManager(spline);
    const crossed: number[] = [];
    lap.onStartLineCrossed = () => crossed.push(lap.state.currentLap);
    const completed: number[] = [];
    lap.onLapCompleted = (n) => completed.push(n);

    lap.setStartPosition(spline.getPointAt(0.9));
    expect(lap.isBeforeStartLine).toBe(true);

    drive(lap, spline, 0.9, 1.01);
    expect(lap.isBeforeStartLine).toBe(false);
    expect(crossed).toEqual([1]);
    expect(completed).toEqual([]);
    expect(lap.state.currentLap).toBe(1);
    expect(lap.state.currentLapTime).toBeLessThan(0.5); // timed from the line

    // One full lap later, lap 1 is complete
    drive(lap, spline, 1.01, 2.01);
    expect(completed).toEqual([1]);
    expect(lap.state.currentLap).toBe(2);
  });
});

describe('Start lights (U-06)', () => {
  it('lights one a second, holds, then all go out together', () => {
    const lights = new StartLights(() => 0.5); // hold = 0.2 + 1.0 * 0.5 = 0.7 s
    lights.reset();
    const step = 1 / 60;
    const litAt = (seconds: number): number => {
      const l = new StartLights(() => 0.5);
      l.reset();
      for (let t = 0; t < seconds - 1e-9; t += step) l.step(step);
      return l.litCount;
    };

    expect(lights.isHolding).toBe(true);
    expect(litAt(0)).toBe(1);
    expect(litAt(1.5)).toBe(2);
    expect(litAt(4.5)).toBe(5);
    expect(litAt(5.5)).toBe(5); // holding with all five on

    for (let t = 0; t < 5.7 + step; t += step) lights.step(step);
    expect(lights.isHolding).toBe(false);
    expect(lights.litCount).toBe(0);
    expect(lights.isVisible).toBe(true); // dark lights stay up briefly
    for (let t = 0; t < 1.1; t += step) lights.step(step);
    expect(lights.isVisible).toBe(false);
  });

  it('holds for a random time between 0.2 and 1.2 s after the fifth light', () => {
    const outTime = (r: number): number => {
      const l = new StartLights(() => r);
      l.reset();
      let t = 0;
      while (l.isHolding && t < 10) {
        l.step(1 / 60);
        t += 1 / 60;
      }
      return t;
    };
    expect(outTime(0)).toBeCloseTo(5.2, 1);
    expect(outTime(1)).toBeCloseTo(6.2, 1);
  });

  it('can be skipped for solo qualifying runs', () => {
    const lights = new StartLights();
    lights.reset();
    lights.skip();
    expect(lights.isHolding).toBe(false);
    expect(lights.isVisible).toBe(false);
  });
});

describe('Start/finish line strip (U-14)', () => {
  it('lies flat on the road and runs across it', () => {
    const spline = new TrackSpline(ALL_TRACKS[0]!);
    const group = TrackGeometryGenerator.buildTrackMeshes(spline);
    const strip = group.getObjectByName('start-line') as THREE.Mesh | undefined;
    expect(strip).toBeDefined();
    strip!.updateWorldMatrix(true, false);

    const box = new THREE.Box3().setFromObject(strip!);
    expect(box.max.y - box.min.y).toBeLessThan(0.01);

    // Its long side (local X, the road width) points along the road normal, across the road
    const across = new THREE.Vector3(1, 0, 0).transformDirection(strip!.matrixWorld);
    const tangent = spline.getTangentAt(0).setY(0).normalize();
    expect(Math.abs(across.dot(tangent))).toBeLessThan(0.01);
  });
});
