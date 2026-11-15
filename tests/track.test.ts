import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { TrackSpline } from '../src/track/TrackSpline';
import { TRACK_1_COASTAL, TRACK_2_EXPRESSWAY } from '../src/track/TrackDefinitions';
import { LapManager } from '../src/engine/LapManager';

describe('TrackSpline & LapManager Suite', () => {
  let coastalSpline: TrackSpline;
  let expresswaySpline: TrackSpline;

  beforeEach(() => {
    coastalSpline = new TrackSpline(TRACK_1_COASTAL);
    expresswaySpline = new TrackSpline(TRACK_2_EXPRESSWAY);
  });

  it('samples valid 3D points and tangents along the spline', () => {
    const point = coastalSpline.getPointAt(0);
    const tangent = coastalSpline.getTangentAt(0);

    expect(point).toBeInstanceOf(THREE.Vector3);
    expect(tangent.length()).toBeCloseTo(1.0, 3);
  });

  it('correctly calculates road surface and grip modifiers', () => {
    const startPoint = coastalSpline.getPointAt(0.2);

    // 1. Point on track center -> Asphalt
    const onTrack = coastalSpline.evaluateSurface(startPoint);
    expect(onTrack.surface).toBe('asphalt');
    expect(onTrack.gripMultiplier).toBe(1.0);
    expect(onTrack.dragMultiplier).toBe(1.0);

    // 2. Point 7.5m out -> Curb
    const normal = coastalSpline.getNormalAt(0.2);
    const curbPos = startPoint.clone().addScaledVector(normal, 7.5);
    const onCurb = coastalSpline.evaluateSurface(curbPos);
    expect(onCurb.surface).toBe('curb');
    expect(onCurb.gripMultiplier).toBeLessThan(1.0);

    // 3. Point 15m out -> Off-road Gravel
    const offRoadPos = startPoint.clone().addScaledVector(normal, 15.0);
    const offRoad = coastalSpline.evaluateSurface(offRoadPos);
    expect(offRoad.surface).toBe('gravel');
    expect(offRoad.gripMultiplier).toBe(0.45);
    expect(offRoad.dragMultiplier).toBeGreaterThan(2.0);
  });

  it('builds 12 sequential checkpoints divided into 3 sectors', () => {
    expect(coastalSpline.checkpoints).toHaveLength(12);
    expect(coastalSpline.checkpoints[0]?.isFinishLine).toBe(true);
    expect(coastalSpline.checkpoints[0]?.sector).toBe(1);
    expect(coastalSpline.checkpoints[5]?.sector).toBe(2);
    expect(coastalSpline.checkpoints[10]?.sector).toBe(3);
  });

  it('tracks lap completion when checkpoints are traversed sequentially', () => {
    const lapManager = new LapManager(coastalSpline);
    expect(lapManager.state.currentLap).toBe(1);
    expect(lapManager.state.isRaceCompleted).toBe(false);

    const zeroVel = new THREE.Vector3(0, 0, 10);

    // Drive the centreline in 5 m steps through every checkpoint and back over the line.
    // (This used to jump from checkpoint to checkpoint; on a lap that doubles back, a
    // 250 m jump can land ahead of the next gate, which no real car does.)
    const steps = Math.ceil(coastalSpline.totalLength / 5);
    const position = new THREE.Vector3();
    for (let i = 1; i <= steps + 1; i++) {
      coastalSpline.getPointAt((i / steps) % 1, position);
      lapManager.update(position, zeroVel, 1.0);
    }

    // Lap 1 completed -> now on Lap 2
    expect(lapManager.state.currentLap).toBe(2);
    expect(lapManager.state.lastLapTime).toBeGreaterThan(10);
    expect(lapManager.state.bestLapTime).toBe(lapManager.state.lastLapTime);
  });

  it('prevents infield shortcutting if checkpoints were skipped', () => {
    const lapManager = new LapManager(coastalSpline);
    const zeroVel = new THREE.Vector3(0, 0, 10);

    // Only visit Checkpoint 1, then immediately try to trigger Finish Line Checkpoint 0
    const cp1 = coastalSpline.checkpoints[1]!;
    lapManager.update(cp1.position, zeroVel, 1.0);

    const finishCp = coastalSpline.checkpoints[0]!;
    lapManager.update(finishCp.position, zeroVel, 1.0);

    // Lap must NOT complete because only 1 checkpoint was crossed
    expect(lapManager.state.currentLap).toBe(1);
    expect(lapManager.state.lastLapTime).toBeNull();
  });

  it('supports point-to-point sprint track', () => {
    expect(expresswaySpline.data.type).toBe('sprint');
    expect(expresswaySpline.data.laps).toBe(1);
    expect(expresswaySpline.totalLength).toBeGreaterThan(1000);
  });

  it('places the sprint finish line at the end of the road, not the start (P15-01)', () => {
    const cps = expresswaySpline.checkpoints;
    const finish = cps.filter((cp) => cp.isFinishLine);
    expect(finish).toHaveLength(1);
    expect(finish[0]!.t).toBe(1);
    expect(cps[0]!.isFinishLine).toBe(false);
    expect(finish[0]!.position.distanceTo(expresswaySpline.getPointAt(1))).toBeLessThan(0.01);
  });

  it('finishes a sprint race when driven from start to end (P15-01)', () => {
    const lapManager = new LapManager(expresswaySpline);
    const vel = new THREE.Vector3(0, 0, -10);
    for (let i = 0; i <= 1000 && !lapManager.state.isRaceCompleted; i++) {
      lapManager.update(expresswaySpline.getPointAt(i / 1000), vel, 0.05);
    }
    expect(lapManager.state.isRaceCompleted).toBe(true);
    expect(lapManager.state.lastLapTime).toBeGreaterThan(0);
  });

  it('counts the lap when the car runs wide past a checkpoint (U-01)', () => {
    const lapManager = new LapManager(coastalSpline);
    const vel = new THREE.Vector3(0, 0, -10);
    const wideT = coastalSpline.checkpoints[3]!.t;
    const pos = new THREE.Vector3();
    const normal = new THREE.Vector3();
    for (let i = 1; i <= 1000; i++) {
      const t = (i / 1000) % 1;
      coastalSpline.getPointAt(t, pos);
      if (Math.abs(t - wideT) < 0.03) {
        // 22 m off the centreline: well outside the old 18 m pass radius
        coastalSpline.getNormalAt(t, normal);
        pos.addScaledVector(normal, 22);
      }
      lapManager.update(pos, vel, 0.05);
    }
    expect(lapManager.state.currentLap).toBe(2);
  });

  it('counts laps for a car that starts ahead of the line on the grid (U-01)', () => {
    const lapManager = new LapManager(coastalSpline);
    // Grid slot P1 sits 175 m past the start line, beyond checkpoint 1
    const startT = 175 / coastalSpline.totalLength;
    lapManager.setStartPosition(coastalSpline.getPointAt(startT));
    const vel = new THREE.Vector3(0, 0, -10);
    for (let i = 1; i <= 1000; i++) {
      const t = (startT + i / 1000) % 1;
      lapManager.update(coastalSpline.getPointAt(t), vel, 0.05);
    }
    expect(lapManager.state.currentLap).toBe(2);
  });

  it('still completes circuit laps at the start/finish line (P15-01 regression guard)', () => {
    expect(coastalSpline.checkpoints[0]!.t).toBe(0);
    const lapManager = new LapManager(coastalSpline);
    const vel = new THREE.Vector3(0, 0, -10);
    // Drive one full lap and come back to t = 0
    for (let i = 1; i <= 1000; i++) {
      lapManager.update(coastalSpline.getPointAt((i / 1000) % 1), vel, 0.05);
    }
    expect(lapManager.state.currentLap).toBe(2);
    expect(lapManager.state.isRaceCompleted).toBe(false);
  });
});
