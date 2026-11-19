import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraController, CameraMode, SLIPSTREAM_FOV_BOOST } from '../src/engine/CameraController';

const car = { position: new THREE.Vector3(0, 0, 0), heading: 0 };

/** The view width after one second of frames at 60 fps, with this pulse */
function fovAfterASecond(mode: CameraMode, boost: number): number {
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 1000);
  const controller = new CameraController(mode);
  controller.setFovBoost(boost);
  for (let i = 0; i < 60; i++) controller.update(camera, car, 1 / 60);
  return camera.fov;
}

describe('The slipstream zoom pulse (R10-06)', () => {
  it('widens the view by the full boost, over every camera mode’s own width', () => {
    for (const mode of ['high-chase', 'low-chase', 'top-down'] as const) {
      const plain = fovAfterASecond(mode, 0);
      expect(fovAfterASecond(mode, SLIPSTREAM_FOV_BOOST) - plain).toBeCloseTo(SLIPSTREAM_FOV_BOOST, 0);
    }
  });

  it('eases back to the mode’s width once the boost ends', () => {
    const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 1000);
    const controller = new CameraController('high-chase');
    controller.setFovBoost(SLIPSTREAM_FOV_BOOST);
    for (let i = 0; i < 60; i++) controller.update(camera, car, 1 / 60);
    controller.setFovBoost(0);
    for (let i = 0; i < 60; i++) controller.update(camera, car, 1 / 60);
    expect(camera.fov).toBeCloseTo(58, 0);
  });
});
