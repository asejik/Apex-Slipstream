import { describe, it, expect } from 'vitest';
import { BarrierCollider, barrierOffset } from '../src/track/TrackBarriers';
import { TrackSpline } from '../src/track/TrackSpline';
import { TrackGeometryGenerator } from '../src/track/TrackGeometryGenerator';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { VehiclePhysics } from '../src/engine/VehiclePhysics';
import { InputState } from '../src/engine/InputManager';

const fullThrottle: InputState = {
  throttle: 1,
  brake: 0,
  steering: 0,
  handbrake: false,
  cameraToggleRequested: false,
  trackToggleRequested: false,
  tireSelectRequested: null,
  audioToggleRequested: false,
  restartRequested: false,
  standingsToggleRequested: false,
  ghostToggleRequested: false,
  pauseToggleRequested: false
};

/** A car on the centreline at `t`, pointing `turn` radians away from the direction of travel. */
function carOnTrack(spline: TrackSpline, t: number, turn: number): VehiclePhysics {
  const tangent = spline.getTangentAt(t);
  const heading = Math.atan2(-tangent.x, -tangent.z) + turn;
  return new VehiclePhysics(spline.getPointAt(t), heading);
}

function drive(spline: TrackSpline, car: VehiclePhysics, seconds: number): { widest: number; hits: number } {
  const barriers = new BarrierCollider();
  let widest = 0;
  let hits = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const surface = spline.evaluateSurface(car.state.position);
    car.update(1 / 60, fullThrottle, { grip: surface.gripMultiplier, drag: surface.dragMultiplier });
    if (barriers.resolve(spline, surface.trackT, car.state, 1 / 60)) hits++;
    widest = Math.max(widest, spline.findClosestT(car.state.position).distanceToCenterline);
  }
  return { widest, hits };
}

describe('Barriers at the road edges (U-04)', () => {
  const spline = new TrackSpline(ALL_TRACKS[1]!); // expressway: long and nearly straight
  const limit = barrierOffset(spline.data.roadWidth);

  it('stops a car that drives straight off the road', () => {
    const car = carOnTrack(spline, 0.3, Math.PI / 2);
    const { widest, hits } = drive(spline, car, 6);
    expect(hits).toBeGreaterThan(0);
    // Allow for the 0.8 m the car covers in one step before it is pushed back
    expect(widest).toBeLessThanOrEqual(limit + 0.5);
  });

  it('leaves a car on the road alone', () => {
    const car = carOnTrack(spline, 0.3, 0);
    const { hits } = drive(spline, car, 3);
    expect(hits).toBe(0);
  });

  it('lets a car that hits the wall at an angle carry on down the road', () => {
    const car = carOnTrack(spline, 0.2, 0.6);
    drive(spline, car, 8);
    const progress = spline.findClosestT(car.state.position).t - 0.2;
    // It runs along the gravel beside the wall, which is slow, but it is not stuck
    expect(progress * spline.totalLength).toBeGreaterThan(80);
    expect(car.state.speedKmh).toBeGreaterThan(20);
  });

  it('takes speed off in a hard hit', () => {
    const car = carOnTrack(spline, 0.3, Math.PI / 2);
    const barriers = new BarrierCollider();
    const normal = spline.getNormalAt(0.3);
    const outward = 1; // the side the road's normal points to
    car.state.position.addScaledVector(normal, outward * (limit + 0.3));
    car.state.velocity.copy(normal).multiplyScalar(outward * 30);

    expect(barriers.resolve(spline, 0.3, car.state, 1 / 60)).toBe(true);
    expect(car.state.velocity.dot(normal) * outward).toBeLessThanOrEqual(0); // no longer heading out
    expect(car.state.velocity.length()).toBeLessThan(15);
  });

  it('draws a wall on each side of every track', () => {
    for (const track of ALL_TRACKS) {
      const group = TrackGeometryGenerator.buildTrackMeshes(new TrackSpline(track));
      expect(group.getObjectByName('barrier-left')).toBeDefined();
      expect(group.getObjectByName('barrier-right')).toBeDefined();
    }
  });
});
