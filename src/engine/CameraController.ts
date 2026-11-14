import * as THREE from 'three';
import { VehicleState } from './VehiclePhysics';

export type CameraMode = 'high-chase' | 'low-chase' | 'top-down';

interface CameraOffsetConfig {
  height: number;
  distance: number;
  lookAhead: number;
  lookHeight: number;
  fov: number;
  positionLerp: number;
  targetLerp: number;
}

const CAMERA_CONFIGS: Record<CameraMode, CameraOffsetConfig> = {
  'high-chase': {
    height: 4.8,
    distance: 8.5,
    lookAhead: 4.0,
    lookHeight: 1.2,
    fov: 58,
    positionLerp: 10.0,
    targetLerp: 14.0
  },
  'low-chase': {
    height: 2.2,
    distance: 5.2,
    lookAhead: 6.0,
    lookHeight: 0.9,
    fov: 68,
    positionLerp: 12.0,
    targetLerp: 16.0
  },
  'top-down': {
    height: 28.0,
    distance: 0.5,
    lookAhead: 0.1,
    lookHeight: 0.0,
    fov: 50,
    positionLerp: 8.0,
    targetLerp: 12.0
  }
};

export class CameraController {
  public currentMode: CameraMode = 'high-chase';

  // State
  private currentCameraPos = new THREE.Vector3(0, 10, 20);
  private currentLookTarget = new THREE.Vector3(0, 0, 0);

  // Scratch objects for zero per-frame allocation
  private readonly _idealPos = new THREE.Vector3();
  private readonly _idealTarget = new THREE.Vector3();
  private readonly _forward = new THREE.Vector3();

  constructor(initialMode: CameraMode = 'high-chase') {
    this.currentMode = initialMode;
  }

  public toggleMode(): CameraMode {
    switch (this.currentMode) {
      case 'high-chase':
        this.currentMode = 'low-chase';
        break;
      case 'low-chase':
        this.currentMode = 'top-down';
        break;
      case 'top-down':
        this.currentMode = 'high-chase';
        break;
    }
    return this.currentMode;
  }

  public setMode(mode: CameraMode): void {
    this.currentMode = mode;
  }

  public update(camera: THREE.PerspectiveCamera, vehicle: VehicleState, dt: number): void {
    const config = CAMERA_CONFIGS[this.currentMode];

    // 1. Calculate car forward direction from yaw heading
    const sinH = Math.sin(vehicle.heading);
    const cosH = Math.cos(vehicle.heading);
    this._forward.set(-sinH, 0, -cosH);

    // 2. Compute ideal camera position in world space
    // Position = car.pos - (forward * distance) + (up * height)
    this._idealPos.copy(vehicle.position)
      .addScaledVector(this._forward, -config.distance)
      .setY(vehicle.position.y + config.height);

    // 3. Compute ideal look-at target
    // Target = car.pos + (forward * lookAhead) + (up * lookHeight)
    this._idealTarget.copy(vehicle.position)
      .addScaledVector(this._forward, config.lookAhead)
      .setY(vehicle.position.y + config.lookHeight);

    // 4. Smooth interpolation (lerp)
    const posAlpha = 1.0 - Math.exp(-config.positionLerp * dt);
    const targetAlpha = 1.0 - Math.exp(-config.targetLerp * dt);

    this.currentCameraPos.lerp(this._idealPos, posAlpha);
    this.currentLookTarget.lerp(this._idealTarget, targetAlpha);

    // 5. Apply to Three.js camera
    camera.position.copy(this.currentCameraPos);
    camera.lookAt(this.currentLookTarget);

    // Adjust FOV dynamically if mode changed
    if (Math.abs(camera.fov - config.fov) > 0.1) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, config.fov, 10.0 * dt);
      camera.updateProjectionMatrix();
    }
  }

  public teleport(camera: THREE.PerspectiveCamera, vehicle: VehicleState): void {
    const config = CAMERA_CONFIGS[this.currentMode];
    const sinH = Math.sin(vehicle.heading);
    const cosH = Math.cos(vehicle.heading);
    this._forward.set(-sinH, 0, -cosH);

    this.currentCameraPos.copy(vehicle.position)
      .addScaledVector(this._forward, -config.distance)
      .setY(vehicle.position.y + config.height);

    this.currentLookTarget.copy(vehicle.position)
      .addScaledVector(this._forward, config.lookAhead)
      .setY(vehicle.position.y + config.lookHeight);

    camera.position.copy(this.currentCameraPos);
    camera.lookAt(this.currentLookTarget);
    camera.fov = config.fov;
    camera.updateProjectionMatrix();
  }
}
