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
  highSpeedYawGain: 1.8, // 45 m turning circle at top speed; corners are 20 to 50 m (U-03)
  tireGripBase: 8.5,
  tireGripDrift: 2.2,
  boundaryLimit: 5000.0
};

export class VehiclePhysics {
  public config: VehicleConfig;
  public state: VehicleState;

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
    surfaceModifier: { grip: number; drag: number } = { grip: 1.0, drag: 1.0 },
    boostMultiplier = 1.0,
    targetElevation?: number
  ): void {
    const gripMultiplier = surfaceModifier.grip;
    const dragMultiplier = surfaceModifier.drag;
    const effectiveMaxSpeed = this.config.maxForwardSpeed * boostMultiplier;

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
      const yawDelta = -this.state.steeringAngle * this.config.turnSpeedRate * yawGain * directionSign * turnMultiplier * dt;
      this.state.heading += yawDelta;
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
        accelForward -= input.brake * this.config.brakeRate;
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
    } else if (dragMultiplier > 1.2) {
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
