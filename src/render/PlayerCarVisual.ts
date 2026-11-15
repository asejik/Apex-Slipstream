import * as THREE from 'three';
import type { VehicleState } from '../engine/VehiclePhysics';
import { createRaceCar, RaceCar, REAR_WHEEL_RADIUS } from './RaceCarModel';
import type { LoadedRaceCarModel } from './GltfRaceCar';

/** The player's livery: white with the Broadcast red accent (docs/DESIGN.md). */
const PLAYER_BODY = 0xf2f3f7;
const PLAYER_ACCENT = 0xff3347;

/**
 * The player car as drawn, and its pose each frame. It starts as the built-in race car
 * (RaceCarModel) and switches to the licensed model (U-07) once that has loaded.
 */
export class PlayerCarVisual {
  public readonly group: THREE.Group;

  private car: RaceCar;
  private frontRadius = 0.33;
  private rearRadius = REAR_WHEEL_RADIUS;
  private frontRoll = 0;
  private rearRoll = 0;

  constructor() {
    this.car = createRaceCar(PLAYER_BODY, PLAYER_ACCENT);
    this.group = new THREE.Group();
    this.group.add(this.car.group);
  }

  /** Swaps to the licensed model, in the player's livery. */
  public applyModel(model: LoadedRaceCarModel): void {
    const driven = model.createDriven(PLAYER_BODY, PLAYER_ACCENT);
    this.group.remove(this.car.group);
    this.car = driven;
    this.frontRadius = driven.frontRadius;
    this.rearRadius = driven.rearRadius;
    this.group.add(driven.group);
  }

  /**
   * Places the model for this frame. `position` and `heading` are the drawn pose
   * (between physics steps); `slopePitch` is the slope of the road under the car in radians.
   */
  public update(
    position: THREE.Vector3,
    heading: number,
    state: VehicleState,
    slopePitch: number,
    frameDelta: number
  ): void {
    this.group.position.copy(position);
    this.group.rotation.y = heading;
    this.group.rotation.x = slopePitch;

    const cornerRoll = (state.steeringAngle * (state.speedKmh / 180)) * 0.12;
    this.group.rotation.z = -cornerRoll;

    const { fl, fr, rl, rr } = this.car.wheels;
    fl.rotation.y = state.steeringAngle;
    fr.rotation.y = state.steeringAngle;

    const distance = state.forwardSpeed * frameDelta;
    this.frontRoll += distance / this.frontRadius;
    this.rearRoll += distance / this.rearRadius;
    fl.rotation.x = this.frontRoll;
    fr.rotation.x = this.frontRoll;
    rl.rotation.x = this.rearRoll;
    rr.rotation.x = this.rearRoll;
  }
}
