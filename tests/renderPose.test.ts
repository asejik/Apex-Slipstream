import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RenderPose } from '../src/engine/RenderPose';
import { AIDriverManager } from '../src/ai/AIDriverManager';
import { TrackSpline } from '../src/track/TrackSpline';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';

describe('Drawing cars between physics steps (U-03)', () => {
  it('draws the car part-way between the last two physics steps', () => {
    const pose = new RenderPose();
    pose.savePrevious(new THREE.Vector3(0, 0, 0), 0);
    pose.sample(new THREE.Vector3(0, 0, -1), 0.2, 0.25);
    expect(pose.position.z).toBeCloseTo(-0.25, 5);
    expect(pose.heading).toBeCloseTo(0.05, 5);
  });

  it('turns the short way when the heading crosses half a turn', () => {
    const pose = new RenderPose();
    pose.savePrevious(new THREE.Vector3(), Math.PI - 0.1);
    pose.sample(new THREE.Vector3(), -Math.PI + 0.1, 0.5);
    expect(Math.abs(Math.abs(pose.heading) - Math.PI)).toBeLessThan(1e-6);
  });

  it('draws the car where it is before any physics step has run', () => {
    const pose = new RenderPose();
    pose.sample(new THREE.Vector3(5, 1, 7), 1.5, 0.5);
    expect(pose.position.toArray()).toEqual([5, 1, 7]);
    expect(pose.heading).toBe(1.5);
  });

  it('does not sweep the car across the map when it is moved to a new place', () => {
    const pose = new RenderPose();
    pose.savePrevious(new THREE.Vector3(0, 0, 0), 0);
    pose.sample(new THREE.Vector3(300, 0, 0), 2, 0.5);
    expect(pose.position.x).toBe(300);
    expect(pose.heading).toBe(2);
  });

  it('draws AI cars part-way between physics steps', () => {
    const manager = new AIDriverManager();
    const spline = new TrackSpline(ALL_TRACKS[0]!);
    manager.resetGrid(spline);
    const car = manager.cars[0]!;
    const player = new THREE.Vector3(9999, 0, 9999);

    // Cars start from a standstill (U-06): let them get up to speed first
    for (let i = 0; i < 180; i++) manager.update(1 / 60, player);
    const before = car.position.clone();
    manager.update(1 / 60, player);
    const after = car.position.clone();
    expect(before.distanceTo(after)).toBeGreaterThan(0.3);

    manager.render(0.5);
    const halfway = before.clone().lerp(after, 0.5);
    expect(car.mesh.position.distanceTo(halfway)).toBeLessThan(1e-6);

    manager.render(1);
    expect(car.mesh.position.distanceTo(after)).toBeLessThan(1e-6);
  });
});
