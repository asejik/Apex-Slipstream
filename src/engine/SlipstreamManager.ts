import * as THREE from 'three';

export interface SlipstreamState {
  inWake: boolean;
  draftProgress: number; // 0.0 to 1.0 (fills over 1.5s)
  isBoostActive: boolean;
  boostFactor: number; // 1.0 to 1.10 (+10% top speed)
  distanceToLead: number;
}

export class SlipstreamManager {
  // Tuning constants
  public static readonly MAX_DRAFT_DISTANCE = 20.0; // meters
  public static readonly MIN_DRAFT_DISTANCE = 1.5; // meters
  public static readonly HALF_CONE_ANGLE_RAD = 15 * (Math.PI / 180); // 15 deg
  public static readonly MIN_ALIGNMENT_DOT = 0.82; // cos(~35 deg)
  public static readonly REQUIRED_DRAFT_TIME = 1.5; // seconds
  public static readonly BOOST_DURATION = 3.0; // seconds
  public static readonly MAX_BOOST_FACTOR = 1.10; // +10% top speed
  public static readonly MIN_SPEED_KMH = 60.0; // must be moving at pace

  // State
  private draftTime = 0.0;
  private boostTimeRemaining = 0.0;
  private inWake = false;
  private distanceToLead = 999.0;

  // Scratch vectors for zero allocation in 60Hz tick
  /** Returned by every update: one object, filled in each step (P09-R04) */
  private readonly state: SlipstreamState = { inWake: false, draftProgress: 0, isBoostActive: false, boostFactor: 1, distanceToLead: 999 };
  private _scratchRel = new THREE.Vector3();
  private _scratchLeadFwd = new THREE.Vector3();
  private _scratchPlayerFwd = new THREE.Vector3();
  private _scratchAlongLead = new THREE.Vector3();
  private _scratchLateral = new THREE.Vector3();

  /**
   * Evaluates slipstream drafting behind a lead vehicle.
   *
   * @param playerPos Current player 3D position
   * @param playerHeading Player heading angle (radians, yaw)
   * @param playerSpeedKmh Player forward velocity in km/h
   * @param leadPos Lead vehicle 3D position
   * @param leadHeading Lead vehicle heading angle (radians, yaw)
   * @param dt Timestep (1/60s)
   */
  public update(
    playerPos: THREE.Vector3,
    playerHeading: number,
    playerSpeedKmh: number,
    leadPos: THREE.Vector3 | null,
    leadHeading: number,
    dt: number
  ): SlipstreamState {
    this.inWake = false;
    this.distanceToLead = 999.0;

    if (leadPos && playerSpeedKmh >= SlipstreamManager.MIN_SPEED_KMH) {
      // Relative vector: from lead car to player car
      this._scratchRel.subVectors(playerPos, leadPos);
      const totalDist = this._scratchRel.length();
      this.distanceToLead = totalDist;

      // Lead forward vector (Three.js coords: -Z is forward)
      this._scratchLeadFwd.set(
        -Math.sin(leadHeading),
        0,
        -Math.cos(leadHeading)
      );

      // Player forward vector (Three.js coords: -Z is forward)
      this._scratchPlayerFwd.set(
        -Math.sin(playerHeading),
        0,
        -Math.cos(playerHeading)
      );

      // Check heading alignment (both cars pointing roughly the same way)
      const alignmentDot = this._scratchPlayerFwd.dot(this._scratchLeadFwd);

      // Longitudinal distance behind lead car:
      // Player is behind if dot(player - lead, leadFwd) is negative
      const longitudinalDistBehind = -this._scratchRel.dot(this._scratchLeadFwd);

      if (
        alignmentDot >= SlipstreamManager.MIN_ALIGNMENT_DOT &&
        longitudinalDistBehind >= SlipstreamManager.MIN_DRAFT_DISTANCE &&
        longitudinalDistBehind <= SlipstreamManager.MAX_DRAFT_DISTANCE
      ) {
        // Lateral distance away from the wake centerline
        this._scratchAlongLead.copy(this._scratchLeadFwd).multiplyScalar(-longitudinalDistBehind);
        this._scratchLateral.subVectors(this._scratchRel, this._scratchAlongLead);
        this._scratchLateral.y = 0;
        const lateralDist = this._scratchLateral.length();

        // Expanding wake cone width: 1.8m car width base + distance * tan(15 deg)
        const maxAllowedLateral = 1.8 + longitudinalDistBehind * Math.tan(SlipstreamManager.HALF_CONE_ANGLE_RAD);

        if (lateralDist <= maxAllowedLateral) {
          this.inWake = true;
        }
      }
    }

    // Accumulate or decay draft timer
    if (this.inWake) {
      this.draftTime += dt;
      if (this.draftTime >= SlipstreamManager.REQUIRED_DRAFT_TIME) {
        this.draftTime = SlipstreamManager.REQUIRED_DRAFT_TIME;
        // Trigger / refresh boost
        this.boostTimeRemaining = SlipstreamManager.BOOST_DURATION;
      }
    } else {
      // Decay draft progress if pulling out of wake
      this.draftTime = Math.max(0, this.draftTime - dt * 2.0);
    }

    // Process active boost duration
    let boostFactor = 1.0;
    if (this.boostTimeRemaining > 0) {
      this.boostTimeRemaining = Math.max(0, this.boostTimeRemaining - dt);
      const remainingRatio = this.boostTimeRemaining / SlipstreamManager.BOOST_DURATION;
      // Smooth decay from max boost factor down to 1.0
      boostFactor = 1.0 + (SlipstreamManager.MAX_BOOST_FACTOR - 1.0) * remainingRatio;
    }

    const draftProgress = Math.min(1.0, this.draftTime / SlipstreamManager.REQUIRED_DRAFT_TIME);

    const state = this.state;
    state.inWake = this.inWake;
    state.draftProgress = draftProgress;
    state.isBoostActive = this.boostTimeRemaining > 0;
    state.boostFactor = boostFactor;
    state.distanceToLead = this.distanceToLead;
    return state;
  }

  public reset(): void {
    this.draftTime = 0.0;
    this.boostTimeRemaining = 0.0;
    this.inWake = false;
    this.distanceToLead = 999.0;
  }
}
