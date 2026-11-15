import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ALL_TRACKS, MIN_CORNER_RADIUS } from '../src/track/TrackDefinitions';
import { TrackSpline } from '../src/track/TrackSpline';
import { easeTightCorners } from '../src/track/TrackSmoothing';

/** Tightest radius of the centreline, measured over 2 m steps of the real spline. */
function tightestRadius(spline: TrackSpline): number {
  const steps = Math.floor(spline.totalLength / 2);
  const stepLength = spline.totalLength / steps;
  const last = spline.data.isClosed ? steps : steps - 1;
  let tightest = Infinity;
  for (let i = 0; i < last; i++) {
    const a = spline.curve.getTangentAt(i / steps);
    const nextT = (i + 1) / steps;
    const b = spline.curve.getTangentAt(spline.data.isClosed ? nextT % 1 : nextT);
    let turn = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    if (Math.abs(turn) > 1e-9) tightest = Math.min(tightest, stepLength / Math.abs(turn));
  }
  return tightest;
}

describe('Track corners (U-02)', () => {
  for (const track of ALL_TRACKS) {
    it(`${track.name} has no bend tighter than ${MIN_CORNER_RADIUS} m`, () => {
      // The car turns a 45 m circle at top speed and about 20 m at 100 km/h. Bends of
      // 3 to 6 m forced the player to slow almost to a stop.
      expect(tightestRadius(new TrackSpline(track))).toBeGreaterThanOrEqual(MIN_CORNER_RADIUS);
    });
  }

  it('leaves a track alone when no bend is too tight', () => {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -200),
      new THREE.Vector3(40, 0, -400),
      new THREE.Vector3(40, 0, -600)
    ];
    expect(easeTightCorners(points, false, 30)).toBe(points);
  });

  it('keeps the start and end of a sprint where they were', () => {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -100),
      new THREE.Vector3(10, 0, -110),
      new THREE.Vector3(100, 0, -110),
      new THREE.Vector3(200, 0, -110)
    ];
    const eased = easeTightCorners(points, false, 30);
    expect(eased).not.toBe(points);
    expect(eased[0]?.distanceTo(points[0] as THREE.Vector3)).toBeLessThan(0.01);
    expect(eased[eased.length - 1]?.distanceTo(points[4] as THREE.Vector3)).toBeLessThan(0.01);
  });
});
