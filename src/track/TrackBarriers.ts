import * as THREE from 'three';
import type { TrackSpline } from './TrackSpline';
import type { VehicleState } from '../engine/VehiclePhysics';

/** Metres from the edge of the road to the wall: the curb plus a strip of gravel run-off. */
export const BARRIER_RUNOFF = 6;
/** Height of the wall as drawn, in metres. */
export const BARRIER_HEIGHT = 1.1;

const CAR_HALF_WIDTH = 0.9; // metres
const BOUNCE = 0.2; // share of the speed into the wall that comes back out
const IMPACT_SPEED_LOSS = 0.02; // share of speed lost per m/s into the wall
const MAX_IMPACT_SPEED_LOSS = 0.5;
const SCRAPE_SPEED_KEPT_PER_SECOND = 0.55; // while rubbing along the wall
const STRAIGHTEN_RATE = 4; // per second: how quickly the nose swings along the wall

/** Distance from the centre of the road to the wall on each side, in metres. */
export function barrierOffset(roadWidth: number): number {
  return roadWidth / 2 + BARRIER_RUNOFF;
}

/**
 * Keeps a car between the walls that run along both sides of the track (U-04).
 * Holds its own scratch vectors: no allocations per call.
 */
export class BarrierCollider {
  private readonly _center = new THREE.Vector3();
  private readonly _normal = new THREE.Vector3();
  private readonly _tangent = new THREE.Vector3();

  /**
   * Call after each physics step. `trackT` is the car's place along the track
   * (0 to 1) from the surface check for this step. Returns true when the car hit a wall.
   */
  public resolve(spline: TrackSpline, trackT: number, state: VehicleState, dt: number): boolean {
    spline.getPointAt(trackT, this._center);
    spline.getNormalAt(trackT, this._normal);

    const offset =
      (state.position.x - this._center.x) * this._normal.x +
      (state.position.z - this._center.z) * this._normal.z;
    const limit = barrierOffset(spline.data.roadWidth) - CAR_HALF_WIDTH;
    if (Math.abs(offset) <= limit) return false;

    const side = Math.sign(offset);

    // 1. Put the car back inside the wall
    const excess = Math.abs(offset) - limit;
    state.position.x -= this._normal.x * side * excess;
    state.position.z -= this._normal.z * side * excess;

    // 2. Take away the speed going into the wall, with a small bounce, and scrub
    //    speed in proportion to how hard the hit was
    const speedIntoWall =
      (state.velocity.x * this._normal.x + state.velocity.z * this._normal.z) * side;
    if (speedIntoWall > 0) {
      const removed = speedIntoWall * (1 + BOUNCE);
      state.velocity.x -= this._normal.x * side * removed;
      state.velocity.z -= this._normal.z * side * removed;
      state.velocity.multiplyScalar(
        1 - Math.min(MAX_IMPACT_SPEED_LOSS, speedIntoWall * IMPACT_SPEED_LOSS)
      );
    }

    // 3. Rubbing along the wall costs speed
    state.velocity.multiplyScalar(Math.pow(SCRAPE_SPEED_KEPT_PER_SECOND, dt));

    // 4. Swing the nose along the wall so the car is not left stuck facing it
    spline.getTangentAt(trackT, this._tangent);
    const forwardX = -Math.sin(state.heading);
    const forwardZ = -Math.cos(state.heading);
    const facingAlongTrack = forwardX * this._tangent.x + forwardZ * this._tangent.z >= 0;
    const direction = facingAlongTrack ? 1 : -1;
    const wallHeading = Math.atan2(-this._tangent.x * direction, -this._tangent.z * direction);
    let turn = wallHeading - state.heading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    state.heading += turn * Math.min(1, STRAIGHTEN_RATE * dt);

    return true;
  }
}
