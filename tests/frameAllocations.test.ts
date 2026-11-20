import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TrackSpline, blankSurface } from '../src/track/TrackSpline';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { InputManager } from '../src/engine/InputManager';
import { TouchController } from '../src/ui/TouchController';
import { SlipstreamManager } from '../src/engine/SlipstreamManager';

/**
 * P09-R04: what runs every frame or step fills in one reused object instead of making a new
 * one (AGENTS.md: no allocations in hot loops). Each returns the same object every call.
 */
describe('Per-frame results are reused, not made again (P09-R04)', () => {
  const spline = new TrackSpline(ALL_TRACKS[0]!);
  const onRoad = spline.getPointAt(0.3);

  it('the surface under a car fills in the object it is given', () => {
    const out = blankSurface();
    expect(spline.evaluateSurface(onRoad, out)).toBe(out);
    expect(out.surface).toBe('asphalt');
    expect(out.trackT).toBeCloseTo(0.3, 2);
    // Without one it still answers, as before
    expect(spline.evaluateSurface(onRoad)).toEqual(out);
  });

  it('the closest point on the road fills in the object it is given', () => {
    const out = { t: 0, distanceToCenterline: 0, lateralOffset: 0 };
    expect(spline.findClosestT(onRoad, out)).toBe(out);
    expect(out.t).toBeCloseTo(0.3, 2);
    expect(out.distanceToCenterline).toBeLessThan(0.5);
  });

  it('the controls, the touch controls and the slipstream are the same object every call', () => {
    const touch = new TouchController();
    const input = new InputManager(touch);
    expect(input.getInputState()).toBe(input.getInputState());
    expect(touch.getInput()).toBe(touch.getInput());
    const slipstream = new SlipstreamManager();
    const here = new THREE.Vector3();
    expect(slipstream.update(here, 0, 100, null, 0, 1 / 60)).toBe(slipstream.update(here, 0, 100, null, 0, 1 / 60));
  });
});
