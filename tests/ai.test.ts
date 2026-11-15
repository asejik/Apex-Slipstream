import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AI_DRIVER_ROSTER } from '../src/ai/AIDriverProfiles';
import { AIDriverManager } from '../src/ai/AIDriverManager';
import { TrackSpline } from '../src/track/TrackSpline';
import { TRACK_1_COASTAL, TRACK_2_EXPRESSWAY, TRACK_6_CYBER_DOCKS } from '../src/track/TrackDefinitions';

/**
 * A short circuit (about 600 m as drawn) for the tests that time laps in seconds. They used
 * Coastal until it became a 3.2 km lap (R5); the checks and durations are unchanged.
 */
const SHORT_CIRCUIT = TRACK_6_CYBER_DOCKS;

describe('19 Persistent AI Drivers & Grid Pack', () => {
  it('defines exactly 19 unique AI drivers with valid properties', () => {
    expect(AI_DRIVER_ROSTER.length).toBe(19);

    const ids = new Set<string>();
    for (const d of AI_DRIVER_ROSTER) {
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);

      expect(d.name.length).toBeGreaterThan(2);
      expect(d.skill).toBeGreaterThanOrEqual(0.90);
      expect(d.skill).toBeLessThanOrEqual(1.05);
      expect(typeof d.colorHex).toBe('number');
      expect(['asphalt', 'gravel', 'wet']).toContain(d.terrainAffinity);
    }
  });

  it('initializes 19 AI car state objects with 3D groups', () => {
    const manager = new AIDriverManager();
    expect(manager.cars.length).toBe(19);
    expect(manager.group.children.length).toBe(19);
  });

  it('staggers cars on starting grid without overlapping', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(TRACK_1_COASTAL);
    manager.resetGrid(spline);

    for (let i = 0; i < manager.cars.length; i++) {
      const car = manager.cars[i]!;
      expect(car.splineT).toBeGreaterThanOrEqual(0.0);
      expect(car.splineT).toBeLessThan(1.0);
      expect(car.position.length()).toBeGreaterThan(0);
      expect(isNaN(car.position.x)).toBe(false);
      expect(isNaN(car.position.y)).toBe(false);
      expect(isNaN(car.position.z)).toBe(false);
    }
  });

  it('advances cars along the track spline during update ticks', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(TRACK_1_COASTAL);
    manager.resetGrid(spline);

    const initialT = manager.cars[0]!.splineT;
    const playerPos = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < 60; i++) {
      manager.update(1 / 60, playerPos);
    }

    const newT = manager.cars[0]!.splineT;
    expect(newT).not.toBe(initialT);
  });

  it('stops AI cars at the end of a sprint instead of wrapping to the start (P15-01)', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(TRACK_2_EXPRESSWAY);
    manager.resetGrid(spline);
    const playerPos = new THREE.Vector3(0, 0, 5000);

    // 90 simulated seconds at 60 Hz is enough for every car to cover the sprint
    for (let i = 0; i < 60 * 90; i++) {
      manager.update(1 / 60, playerPos);
    }

    for (const car of manager.cars) {
      expect(car.finishTime).not.toBeNull();
      expect(car.finishTime!).toBeGreaterThan(0);
      expect(car.splineT).toBe(1);
      expect(car.lap).toBe(2);
      expect(car.isParked).toBe(true);
      expect(car.mesh.visible).toBe(false);
    }

    // A new race resets the finish state
    manager.resetGrid(spline);
    for (const car of manager.cars) {
      expect(car.finishTime).toBeNull();
      expect(car.mesh.visible).toBe(true);
      expect(car.lap).toBe(1);
    }
  });

  it('keeps AI cars lapping on closed circuits (P15-01 regression guard)', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(SHORT_CIRCUIT);
    manager.resetGrid(spline);
    const playerPos = new THREE.Vector3(0, 0, 5000);
    // 60 s: from a standing start behind the line (U-06, U-11) a car first reaches the line,
    // then drives a full lap. It used to start rolling, past the line, in 30 s.
    for (let i = 0; i < 60 * 60; i++) {
      manager.update(1 / 60, playerPos);
    }
    for (const car of manager.cars) {
      expect(car.isParked).toBe(false);
      expect(car.mesh.visible).toBe(true);
      expect(car.lap).toBeGreaterThan(1);
    }
  });

  it('records circuit finish times after the race distance and keeps cars driving (U-01)', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(SHORT_CIRCUIT);
    manager.resetGrid(spline);
    const playerPos = new THREE.Vector3(0, 0, 5000);
    const totalLaps = spline.data.laps;

    // Before anyone has covered the race distance, nobody has finished
    for (let i = 0; i < 60 * 20; i++) manager.update(1 / 60, playerPos);
    for (const car of manager.cars) expect(car.finishTime).toBeNull();

    // Long enough for every car to complete the race distance
    for (let i = 0; i < 60 * 120; i++) manager.update(1 / 60, playerPos);
    for (const car of manager.cars) {
      expect(car.lap).toBeGreaterThan(totalLaps);
      expect(car.finishTime).not.toBeNull();
      expect(car.isParked).toBe(false);
    }
  });

  it('records real AI lap times, excluding the rolling first lap on circuits (U-09)', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(SHORT_CIRCUIT);
    manager.resetGrid(spline);
    const playerPos = new THREE.Vector3(0, 0, 5000);
    const lapLength = spline.totalLength;

    // Run until every car has completed lap 1 but not lap 2: no counted lap yet
    let steps = 0;
    while (manager.cars.some((c) => c.lap < 2) && steps < 60 * 120) { manager.update(1 / 60, playerPos); steps++; }
    for (const car of manager.cars) {
      if (car.lap === 2) expect(car.bestLapTime).toBeNull();
    }

    // After a full racing lap each car has a best lap that matches its pace
    for (let i = 0; i < 60 * 60; i++) manager.update(1 / 60, playerPos);
    for (const car of manager.cars) {
      expect(car.bestLapTime).not.toBeNull();
      const minLap = lapLength / (200 / 3.6); // no AI averages 200 km/h
      expect(car.bestLapTime!).toBeGreaterThan(minLap);
    }
    // Faster drivers set faster laps
    const sorted = [...manager.cars].sort((a, b) => b.profile.skill - a.profile.skill);
    expect(sorted[0]!.bestLapTime!).toBeLessThan(sorted[sorted.length - 1]!.bestLapTime!);

    manager.resetGrid(spline);
    for (const car of manager.cars) expect(car.bestLapTime).toBeNull();
  });

  it('a sprint finish counts as the AI lap time (U-09)', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(TRACK_2_EXPRESSWAY);
    manager.resetGrid(spline);
    const playerPos = new THREE.Vector3(0, 0, 5000);
    for (let i = 0; i < 60 * 90; i++) manager.update(1 / 60, playerPos);
    for (const car of manager.cars) {
      expect(car.finishTime).not.toBeNull();
      expect(car.bestLapTime).toBeCloseTo(car.finishTime!, 5);
    }
  });
  it('a car that is hit turns once and keeps going, instead of spinning on the spot (U-05)', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(TRACK_2_EXPRESSWAY);
    manager.resetGrid(spline);
    const car = manager.cars[0]!;
    const player = new THREE.Vector3(9999, 0, 9999);
    for (let i = 0; i < 30; i++) manager.update(1 / 60, player);

    const startT = car.splineT;
    car.isSpinningOut = true;
    car.spinTimer = 3.0;

    let turned = 0;
    let lastYaw = car.mesh.rotation.y;
    for (let i = 0; i < 200; i++) {
      manager.update(1 / 60, player);
      manager.render(1);
      // Shortest way round, as the eye sees it: a full circle is the same direction as zero
      let step = car.mesh.rotation.y - lastYaw;
      while (step > Math.PI) step -= Math.PI * 2;
      while (step < -Math.PI) step += Math.PI * 2;
      turned += Math.abs(step);
      lastYaw = car.mesh.rotation.y;
    }

    // One full turn (6.28 rad) plus a little road curvature; it used to turn 24 rad
    expect(turned).toBeGreaterThan(5.5);
    expect(turned).toBeLessThan(7.5);
    // It keeps travelling down the road; it used to stop dead
    expect((car.splineT - startT) * spline.totalLength).toBeGreaterThan(30);
    expect(car.isSpinningOut).toBe(false);
  });
});
