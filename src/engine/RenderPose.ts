import * as THREE from 'three';

/** A move longer than this in one physics step is a reposition, not driving (metres). */
const TELEPORT_DISTANCE = 5;

/**
 * Where to draw a car between two physics steps (U-03). Physics runs at a fixed 60 Hz;
 * screens refresh at other rates, so drawing the raw physics position stutters.
 * Holds its own vectors: no allocations after construction.
 */
export class RenderPose {
  /** Position to draw at, set by `sample`. */
  public readonly position = new THREE.Vector3();
  /** Heading to draw at, set by `sample`. */
  public heading = 0;

  private readonly previousPosition = new THREE.Vector3();
  private previousHeading = 0;
  private hasPrevious = false;

  /** Call at the start of each physics step with the pose before the step. */
  public savePrevious(position: THREE.Vector3, heading: number): void {
    this.previousPosition.copy(position);
    this.previousHeading = heading;
    this.hasPrevious = true;
  }

  /**
   * Call once per drawn frame with the latest physics pose.
   * `alpha` is how far the frame is into the next physics step, 0 to 1.
   */
  public sample(position: THREE.Vector3, heading: number, alpha: number): void {
    if (!this.hasPrevious || this.previousPosition.distanceTo(position) > TELEPORT_DISTANCE) {
      this.position.copy(position);
      this.heading = heading;
      return;
    }
    const clamped = Math.min(1, Math.max(0, alpha));
    this.position.lerpVectors(this.previousPosition, position, clamped);

    let turn = heading - this.previousHeading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    this.heading = this.previousHeading + turn * clamped;
  }
}
