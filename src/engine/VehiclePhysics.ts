import * as THREE from 'three';
import { InputState } from './InputManager';

export interface VehicleState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number; // Yaw angle in radians
  speedKmh: number;
  forwardSpeed: number; // m/s along car forward axis
  lateralSpeed: number; // m/s along car lateral axis
  steeringAngle: number;
  driftFactor: number; // 0.0 (full grip) to 1.0 (heavy slide)
  rpm: number; // 0.0 to 1.0 normalized engine rev
}

export interface VehicleConfig {
  maxForwardSpeed: number; // m/s (50 m/s = 180 km/h)
  maxReverseSpeed: number; // m/s (12 m/s = 43 km/h)
  accelerationRate: number; // m/s^2 (approx 14 m/s^2)
  brakeRate: number; // m/s^2 (approx 28 m/s^2)
  dragRate: number; // natural rolling drag
  maxSteerAngle: number; // radians at low speed (~0.58 rad = 33 deg)
  minSteerAngle: number; // radians at top speed (~0.22 rad = 13 deg)
  turnSpeedRate: number; // radians/sec yaw response
  highSpeedYawGain: number; // yaw response multiplier at top speed (1.0 at standstill)
  maxCorneringAccel: number; // m/s^2: the most sideways grip the tyres give (40 = about 4 g)
  tireGripBase: number; // lateral friction coefficient (8.0 normal)
  tireGripDrift: number; // lateral friction coefficient during drift (2.0)
  boundaryLimit: number; // test arena radius (meters)
}

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  maxForwardSpeed: 50.0, // 180 km/h
  maxReverseSpeed: 12.0, // 43 km/h
  accelerationRate: 14.0,
  brakeRate: 26.0,
  dragRate: 3.5,
  maxSteerAngle: 0.58,
  minSteerAngle: 0.22,
  turnSpeedRate: 2.8,
  highSpeedYawGain: 1.8, // quick turn-in at speed (U-03)
  // Grip limit (owner, R6): the faster you go, the wider you must turn, so tight bends need
  // braking. 62 m turning circle at top speed (45 m before, 81 m before U-03)
  maxCorneringAccel: 40.0,
  tireGripBase: 8.5,
  tireGripDrift: 2.2,
  boundaryLimit: 5000.0
};
/**
 * Extra grip in bends for the player's car only (owner, after R7: bends were hard by hand).
 * The AI drive exactly to the car's limit and always brake to the right speed; a person
 * carries a little too much. With this margin the tightest Coastal bend can be taken at
 * about 140 km/h instead of 128, while a perfect lap is only 0.5% quicker (129.8 s, was
 * 130.4), so the racing stays even. The AI keep DEFAULT_VEHICLE_CONFIG.
 */
export const PLAYER_CORNERING_ASSIST = 1.2;

/** The player's car: the AI's car with the cornering assist */
export const PLAYER_VEHICLE_CONFIG: VehicleConfig = {
  ...DEFAULT_VEHICLE_CONFIG,
  maxCorneringAccel: DEFAULT_VEHICLE_CONFIG.maxCorneringAccel * PLAYER_CORNERING_ASSIST
};


export class VehiclePhysics {
  public config: VehicleConfig;
  public state: VehicleState;

  /** Even the slipperiest surface leaves this share of the car's cornering and braking */
  private static readonly MIN_TRACTION = 0.3;

  // Pre-allocated scratch objects for zero GC in update loop
  private readonly _forward = new THREE.Vector3();
  private readonly _lateral = new THREE.Vector3();

  constructor(initialPosition = new THREE.Vector3(0, 0, 0), initialHeading = 0, config = DEFAULT_VEHICLE_CONFIG) {
    this.config = { ...config };
    this.state = {
      position: initialPosition.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      heading: initialHeading,
      speedKmh: 0,
      forwardSpeed: 0,
      lateralSpeed: 0,
      steeringAngle: 0,
      driftFactor: 0,
      rpm: 0.2
    };
  }

  public update(
    dt: number,
    input: InputState,
    surfaceModifier: { grip: number; drag: number; traction?: number; tyreDrag?: number } = { grip: 1.0, drag: 1.0 },
    boostMultiplier = 1.0,
    targetElevation?: number
  ): void {
    const gripMultiplier = surfaceModifier.grip;
    const dragMultiplier = surfaceModifier.drag;
    // Share of the cornering and braking limit the tyres give on this surface in this
    // weather (R7): 1 for Street on dry tarmac, about half for Street in the rain
    const traction = Math.max(VehiclePhysics.MIN_TRACTION, surfaceModifier.traction ?? 1.0);
    // The tyres' rolling drag lowers the top speed (R10-01): Wet tyres on dry tarmac reach
    // 1/1.10 of Street's, as the tyre screen's speed rating says
    const tyreDrag = Math.max(1.0, surfaceModifier.tyreDrag ?? 1.0);
    const effectiveMaxSpeed = (this.config.maxForwardSpeed * boostMultiplier) / tyreDrag;

    // 1. Compute unit vectors from current heading
    // In Three.js coordinates: -Z is forward, +X is right, +Y is up
    const sinH = Math.sin(this.state.heading);
    const cosH = Math.cos(this.state.heading);

    this._forward.set(-sinH, 0, -cosH);
    this._lateral.set(cosH, 0, -sinH);

    // 2. Resolve velocity into local forward and lateral components
    const forwardSpeed = this.state.velocity.dot(this._forward);
    const lateralSpeed = this.state.velocity.dot(this._lateral);
    const absSpeed = Math.abs(forwardSpeed);

    // 3. Speed-sensitive steering calculation
    const speedRatio = Math.min(1.0, absSpeed / this.config.maxForwardSpeed);
    const dynamicMaxSteer = THREE.MathUtils.lerp(
      this.config.maxSteerAngle,
      this.config.minSteerAngle,
      speedRatio
    );
    const targetSteer = input.steering * dynamicMaxSteer;
    this.state.steeringAngle = THREE.MathUtils.lerp(this.state.steeringAngle, targetSteer, 15.0 * dt);

    // 4. Yaw rate (turning)
    // Turning only occurs when car has velocity; reverses direction when backing up
    if (absSpeed > 0.1) {
      const directionSign = forwardSpeed >= 0 ? 1 : -1;
      const turnMultiplier = input.handbrake ? 1.4 : 1.0;
      // The steering angle shrinks with speed; the yaw gain grows so the car can still
      // be turned into a corner at speed (U-03)
      const yawGain = THREE.MathUtils.lerp(1.0, this.config.highSpeedYawGain, speedRatio);
      let yawRate = this.state.steeringAngle * this.config.turnSpeedRate * yawGain;
      // The tyres can only hold so much sideways force: at speed the car turns no tighter
      // than the grip allows (yaw rate = sideways acceleration / speed)
      const gripYawRate = (this.config.maxCorneringAccel * traction) / absSpeed;
      yawRate = THREE.MathUtils.clamp(yawRate, -gripYawRate, gripYawRate);
      // The handbrake still swings the tail round beyond the grip limit (a drift)
      this.state.heading -= yawRate * directionSign * turnMultiplier * dt;
    }

    // 5. Longitudinal Acceleration & Braking
    let accelForward = 0;

    if (input.throttle > 0) {
      // Accelerating forward
      if (forwardSpeed < effectiveMaxSpeed) {
        // Taper acceleration slightly near top speed
        const powerCurve = 1.0 - Math.pow(Math.max(0, forwardSpeed) / effectiveMaxSpeed, 2) * 0.4;
        const accelBoost = Math.max(1.0, (boostMultiplier - 1.0) * 1.5 + 1.0);
        accelForward += input.throttle * this.config.accelerationRate * accelBoost * powerCurve;
      }
    }

    if (input.brake > 0) {
      if (forwardSpeed > 0.5) {
        // Active braking
        accelForward -= input.brake * this.config.brakeRate * traction;
      } else {
        // Reverse
        if (Math.abs(forwardSpeed) < this.config.maxReverseSpeed) {
          accelForward -= input.brake * (this.config.accelerationRate * 0.6);
        }
      }
    }

    // Natural drag and rolling resistance scaled by surface modifier and slipstream reduction
    const aeroDragDamping = Math.max(1.0, (boostMultiplier - 1.0) * 2.0 + 1.0);
    const effectiveDrag = (this.config.dragRate / aeroDragDamping) * dragMultiplier;
    if (input.throttle === 0 && input.brake === 0) {
      const drag = Math.sign(forwardSpeed) * Math.min(absSpeed / dt, effectiveDrag);
      accelForward -= drag;
    } else if (input.throttle > 0 && forwardSpeed > effectiveMaxSpeed) {
      // Above this top speed (a slipstream boost has just ended, or slower tyres) the car
      // drifts back down to it under throttle, at the rolling drag rate (R10-03). It used
      // to hold the extra speed for as long as the throttle was held.
      accelForward -= Math.min((forwardSpeed - effectiveMaxSpeed) / dt, effectiveDrag);
    }
    if ((input.throttle !== 0 || input.brake !== 0) && dragMultiplier > 1.2) {
      // Extra surface resistance when off-road even under throttle
      accelForward -= Math.sign(forwardSpeed) * (dragMultiplier - 1.0) * 4.0;
    }

    // 6. Lateral friction (Grip vs Drift) modulated by surface
    const baseGrip = input.handbrake ? this.config.tireGripDrift : this.config.tireGripBase;
    const activeGrip = baseGrip * gripMultiplier;
    const lateralDamping = Math.min(1.0, activeGrip * dt);
    const newLateralSpeed = lateralSpeed * (1.0 - lateralDamping);

    // 7. Update new forward velocity
    const newForwardSpeed = forwardSpeed + accelForward * dt;

    // Reconstruct world velocity vector: forward * newForwardSpeed + lateral * newLateralSpeed
    this.state.velocity.copy(this._forward).multiplyScalar(newForwardSpeed)
      .add(this._scratchVec.copy(this._lateral).multiplyScalar(newLateralSpeed));

    // 8. Integrate Position
    this.state.position.addScaledVector(this.state.velocity, dt);

    if (targetElevation !== undefined) {
      // Smoothly conform car altitude to road terrain gradient
      this.state.position.y = THREE.MathUtils.lerp(this.state.position.y, targetElevation, Math.min(1.0, 20.0 * dt));
    }

    // 9. Arena Boundary Collision (elastic bounce with speed scrub)
    const limit = this.config.boundaryLimit;
    if (Math.abs(this.state.position.x) > limit) {
      this.state.position.x = Math.sign(this.state.position.x) * limit;
      this.state.velocity.x *= -0.4;
    }
    if (Math.abs(this.state.position.z) > limit) {
      this.state.position.z = Math.sign(this.state.position.z) * limit;
      this.state.velocity.z *= -0.4;
    }

    // 10. Compute derived telemetry state
    this.state.forwardSpeed = newForwardSpeed;
    this.state.lateralSpeed = newLateralSpeed;
    const currentSpeedMs = this.state.velocity.length();
    this.state.speedKmh = currentSpeedMs * 3.6;

    // Drift factor (ratio of lateral slip to total speed)
    this.state.driftFactor = Math.min(1.0, Math.abs(newLateralSpeed) / (currentSpeedMs + 1.0));

    // Normalized engine RPM (4 simulated gear ratios)
    const gearSpeed = (this.state.speedKmh % 45) / 45;
    this.state.rpm = Math.min(1.0, Math.max(0.2, (input.throttle * 0.3) + (gearSpeed * 0.7)));
  }

  // Scratch vector for zero allocations
  private readonly _scratchVec = new THREE.Vector3();
}
