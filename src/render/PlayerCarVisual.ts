import * as THREE from 'three';
import type { VehicleState } from '../engine/VehiclePhysics';
import { createRaceCar, RaceCar, REAR_WHEEL_RADIUS } from './RaceCarModel';

/** The player's livery: white with the Broadcast red accent (docs/DESIGN.md). */
const PLAYER_BODY = 0xf2f3f7;
const PLAYER_ACCENT = 0xff3347;
const FRONT_WHEEL_RADIUS = 0.33;

/** The player car as drawn: the race car model (U-07) and its pose each frame. */
export class PlayerCarVisual {
  public readonly group: THREE.Group;

  private readonly car: RaceCar;
  private frontRoll = 0;
  private rearRoll = 0;

  constructor() {
    this.car = createRaceCar(PLAYER_BODY, PLAYER_ACCENT);
    this.group = this.car.group;
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
    this.frontRoll += distance / FRONT_WHEEL_RADIUS;
    this.rearRoll += distance / REAR_WHEEL_RADIUS;
    fl.rotation.x = this.frontRoll;
    fr.rotation.x = this.frontRoll;
    rl.rotation.x = this.rearRoll;
    rr.rotation.x = this.rearRoll;
  }
}
