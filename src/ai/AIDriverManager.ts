import * as THREE from 'three';
import { createStaticRaceCar } from '../render/RaceCarModel';
import { TrackSpline } from '../track/TrackSpline';
import { AIDriverProfile, AI_DRIVER_ROSTER } from './AIDriverProfiles';
import { countsForFastestLap } from '../engine/RaceOrder';
import { RenderPose } from '../engine/RenderPose';

export interface AICarState {
  profile: AIDriverProfile;
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  pitch: number;
  roll: number;
  speedKmh: number;
  splineT: number;
  lateralOffset: number;
  lap: number;
  isSpinningOut: boolean;
  spinTimer: number;
  /** Seconds since the start when this car completed the race distance; null while racing. */
  finishTime: number | null;
  /** Sprint finishers park at the end of the road and leave the race (hidden, no collisions). */
  isParked: boolean;
  /** Race time (s) when the current lap started */
  lapStartTime: number;
  /** Fastest counted lap in seconds (see countsForFastestLap); null until one is completed */
  bestLapTime: number | null;
  /** True from a standing start until the car reaches launch speed (see LAUNCH_ACCEL_KMH_S) */
  isLaunching: boolean;
}

/** Gap from the start line to pole position, and between grid slots, in metres. */
const GRID_LINE_GAP = 8;
const GRID_SLOT_SPACING = 8.5;

/**
 * Where grid slot `rank` (1 = pole) sits, in metres along the road from the start line.
 * On circuits every slot is behind the line, so all cars race the same distance (U-11).
 * Sprints start at the beginning of the road, so their grid stays ahead of it.
 */
export function gridSlotOffset(rank: number, isClosed: boolean): number {
  return isClosed
    ? -(GRID_LINE_GAP + (rank - 1) * GRID_SLOT_SPACING)
    : 14 + (20 - rank) * GRID_SLOT_SPACING;
}

/** Spline position (0 to 1) of a point `offset` metres from the start line, wrapping on circuits. */
export function offsetToSplineT(offset: number, totalLength: number): number {
  if (totalLength <= 0) return 0;
  const t = (offset / totalLength) % 1.0;
  return t < 0 ? t + 1.0 : t;
}

export class AIDriverManager {
  public cars: AICarState[] = [];
  /** One per car, same order as `cars`: where to draw it between physics steps. */
  private readonly renderPoses: RenderPose[] = [];
  /** One per car: extra turn drawn on top of its heading while it is spun (U-05), now and one step ago. */
  private readonly spinAngles: number[] = [];
  private readonly previousSpinAngles: number[] = [];
  public group: THREE.Group;
  private trackSpline: TrackSpline | null = null;
  private raceElapsed = 0;

  /** How long a hit car is out of contention, in seconds (set by the collision). */
  private static readonly SPIN_RECOVERY_SECONDS = 3.0;
  /** How long its single turn takes, in seconds. */
  private static readonly SPIN_TURN_SECONDS = 1.0;
  /** A spun car never slows below this, in km/h. */
  private static readonly SPIN_MIN_SPEED_KMH = 40;
  /**
   * Standing-start acceleration, in km/h per second at skill 1.0, until the car reaches
   * LAUNCH_END_FRACTION of its target speed. The player's car does 0-135 km/h in about 2.9 s.
   */
  private static readonly LAUNCH_ACCEL_KMH_S = 40;
  private static readonly LAUNCH_END_FRACTION = 0.8;

  // Reusable scratch objects for zero GC in 60Hz loop
  private readonly _scratchCenter = new THREE.Vector3();
  private readonly _scratchTangent = new THREE.Vector3();
  private readonly _scratchNormal = new THREE.Vector3();
  private readonly _scratchDiff = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();
    this.initCars();
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  private initCars(): void {
    for (const profile of AI_DRIVER_ROSTER) {
      const mesh = this.createCarMesh(profile);
      this.group.add(mesh);

      this.renderPoses.push(new RenderPose());
      this.spinAngles.push(0);
      this.previousSpinAngles.push(0);
      this.cars.push({
        profile,
        mesh,
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        heading: 0,
        pitch: 0,
        roll: 0,
        speedKmh: 120 * profile.skill,
        splineT: 0,
        lateralOffset: profile.preferredLateralOffset,
        lap: 1,
        isSpinningOut: false,
        spinTimer: 0,
        finishTime: null,
        isParked: false,
        lapStartTime: 0,
        bestLapTime: null,
        isLaunching: false
      });
    }
  }

  /**
   * Positions all 19 AI drivers on the starting grid staggered based on grid order.
   * Returns player's assigned spawn distance and lateral offset.
   */
  public resetGrid(
    spline: TrackSpline,
    gridOrder?: string[]
  ): { playerSpawnDist: number; playerLateralOffset: number } {
    this.trackSpline = spline;
    const totalLength = spline.totalLength;
    this.raceElapsed = 0;
    for (const car of this.cars) {
      car.finishTime = null;
      car.isParked = false;
      car.lapStartTime = 0;
      car.bestLapTime = null;
      car.mesh.visible = true;
    }

    let playerSpawnDist = 0;
    let playerLateralOffset = 0;
    const isClosed = spline.data.isClosed;

    // Default order: the AI roster from P1 to P19, the player last
    const order =
      gridOrder && gridOrder.length === 20
        ? gridOrder
        : [...this.cars.map((c) => c.profile.id), 'player'];

    // Ordered grid slots: order[0] is P1, order[19] is P20. Everyone starts from a standstill.
    for (let rank = 1; rank <= 20; rank++) {
      const driverId = order[rank - 1];
      const offset = gridSlotOffset(rank, isClosed);
      const lateral = (rank % 2 === 0 ? 1 : -1) * 2.2;

      if (driverId === 'player') {
        playerSpawnDist = offset;
        playerLateralOffset = lateral;
      } else {
        const car = this.cars.find((c) => c.profile.id === driverId);
        if (car) {
          car.splineT = offsetToSplineT(offset, totalLength);
          car.speedKmh = 0;
          car.isLaunching = true;
          // Behind the line on a circuit: crossing it starts lap 1
          car.lap = offset < 0 ? 0 : 1;
          car.isSpinningOut = false;
          car.spinTimer = 0;
          car.lateralOffset = lateral;
          this.updateCarTransform(car, 0);
        }
      }
    }

    return { playerSpawnDist, playerLateralOffset };
  }

  /**
   * Fixed 60Hz update loop for all 19 AI agents with zero heap allocations.
   */
  public update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.trackSpline || !this.group.visible) return;
    const totalLength = this.trackSpline.totalLength;
    const isClosed = this.trackSpline.data.isClosed;
    this.raceElapsed += dt;

    // Remember where each car was, including any collision push since the last step (U-03)
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const pose = this.renderPoses[i];
      if (car && pose) pose.savePrevious(car.position, car.heading);
      this.previousSpinAngles[i] = this.spinAngles[i] ?? 0;
    }

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car || car.isParked) continue;

      // Spin-out recovery (U-05): the car turns once while sliding on down the road,
      // then picks its speed back up. It no longer stops and spins on the spot.
      this.spinAngles[i] = 0;
      let isSliding = false;
      if (car.isSpinningOut) {
        const sinceHit = AIDriverManager.SPIN_RECOVERY_SECONDS - car.spinTimer;
        car.spinTimer -= dt;
        if (sinceHit < AIDriverManager.SPIN_TURN_SECONDS) {
          isSliding = true;
          const progress = sinceHit / AIDriverManager.SPIN_TURN_SECONDS;
          // Ease in and out over one full turn
          this.spinAngles[i] = Math.PI * 2 * progress * progress * (3 - 2 * progress);
          car.speedKmh = Math.max(AIDriverManager.SPIN_MIN_SPEED_KMH, car.speedKmh - 45 * dt);
        }
        if (car.spinTimer <= 0) {
          car.isSpinningOut = false;
        }
      }

      // 1. Natural speed calculation based on driver skill & upcoming curvature
      const targetSpeed = 135 * car.profile.skill;
      if (car.isLaunching && car.speedKmh >= targetSpeed * AIDriverManager.LAUNCH_END_FRACTION) {
        car.isLaunching = false;
      }
      if (!isSliding) {
        if (car.isLaunching) {
          car.speedKmh += AIDriverManager.LAUNCH_ACCEL_KMH_S * car.profile.skill * dt;
        } else if (car.speedKmh < targetSpeed) {
          car.speedKmh += 12 * dt;
        } else {
          car.speedKmh -= 8 * dt;
        }
      }

      // 2. Obstacle & Pack Avoidance Steering
      let lateralAvoidForce = 0;

      // Avoid Player
      this._scratchDiff.subVectors(car.position, playerPos);
      const distToPlayer = this._scratchDiff.length();
      if (distToPlayer < 7.0 && distToPlayer > 0.1) {
        // Lateral separation bias
        lateralAvoidForce += (this._scratchDiff.x > 0 ? 1 : -1) * (1.0 / distToPlayer) * 4.5;
      }

      // Avoid nearby AI pack rivals
      for (let j = 0; j < this.cars.length; j++) {
        if (i === j) continue;
        const other = this.cars[j];
        if (!other || other.isParked) continue;

        const dx = car.position.x - other.position.x;
        const dz = car.position.z - other.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < 36.0 && distSq > 0.01) { // within 6m
          const dist = Math.sqrt(distSq);
          lateralAvoidForce += (dx > 0 ? 1 : -1) * ((6.0 - dist) / 6.0) * 2.5;
        }
      }

      // 3. Smooth lateral adjustment towards preferred line + avoidance
      const targetOffset = car.profile.preferredLateralOffset + lateralAvoidForce;
      car.lateralOffset = THREE.MathUtils.lerp(
        car.lateralOffset,
        THREE.MathUtils.clamp(targetOffset, -5.5, 5.5),
        2.5 * dt
      );

      // 4. Advance spline position
      const speedMs = (car.speedKmh * 1000) / 3600;
      const distTraveled = speedMs * dt;
      const deltaT = distTraveled / totalLength;

      if (!isClosed && car.splineT + deltaT >= 1.0) {
        // Sprint finish: park at the end of the road and leave the race
        car.splineT = 1.0;
        this.recordLap(car, isClosed);
        car.lap++;
        car.finishTime = this.raceElapsed;
        car.isParked = true;
        car.speedKmh = 0;
        this.updateCarTransform(car, dt);
        car.mesh.visible = false;
        continue;
      }

      const previousT = car.splineT;
      car.splineT = (car.splineT + deltaT) % 1.0;

      if (car.splineT < previousT) {
        // Cool-down laps after the finish do not count
        if (car.finishTime === null) this.recordLap(car, isClosed);
        car.lap++;
        // Circuit finish: record the time, then keep driving a cool-down lap
        if (car.finishTime === null && car.lap > this.trackSpline.data.laps) {
          car.finishTime = this.raceElapsed;
        }
      }

      this.updateCarTransform(car, dt);
    }
  }

  /** The closest car still racing within `maxDistance` metres of `position` on the ground, or null. */
  public nearestCar(position: THREE.Vector3, maxDistance: number): AICarState | null {
    let nearest: AICarState | null = null;
    let nearestDistance = maxDistance;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car || car.isParked) continue;
      const distance = Math.hypot(car.position.x - position.x, car.position.z - position.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = car;
      }
    }
    return nearest;
  }

  /**
   * Draws every car between its last two physics steps (U-03). Call once per frame.
   * `alpha` is how far the frame is into the next physics step, 0 to 1.
   */
  public render(alpha: number): void {
    if (!this.group.visible) return;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const pose = this.renderPoses[i];
      if (!car || !pose || car.isParked) continue;
      pose.sample(car.position, car.heading, alpha);
      car.mesh.position.copy(pose.position);
      const spinNow = this.spinAngles[i] ?? 0;
      const spinBefore = this.previousSpinAngles[i] ?? 0;
      // A finished turn snaps from a full circle back to zero: the same direction
      const spin = spinNow === 0 ? 0 : spinBefore + (spinNow - spinBefore) * Math.min(1, Math.max(0, alpha));
      car.mesh.rotation.y = pose.heading + spin;
    }
  }

  /** Closes the car's current lap (car.lap is the lap just completed) and keeps its best (U-09). */
  private recordLap(car: AICarState, isClosed: boolean): void {
    const lapTime = this.raceElapsed - car.lapStartTime;
    car.lapStartTime = this.raceElapsed;
    if (!countsForFastestLap(car.lap, isClosed)) return;
    if (car.bestLapTime === null || lapTime < car.bestLapTime) {
      car.bestLapTime = lapTime;
    }
  }

  private updateCarTransform(car: AICarState, dt: number): void {
    if (!this.trackSpline) return;

    this.trackSpline.getPointAt(car.splineT, this._scratchCenter);
    this.trackSpline.getTangentAt(car.splineT, this._scratchTangent);

    // Lateral normal vector
    this._scratchNormal.set(-this._scratchTangent.z, 0, this._scratchTangent.x).normalize();

    // Position along spline + lateral offset + elevation clearance
    car.position.copy(this._scratchCenter);
    car.position.addScaledVector(this._scratchNormal, car.lateralOffset);
    car.position.y = this._scratchCenter.y + 0.05;

    // Heading aligned with tangent
    const targetHeading = Math.atan2(-this._scratchTangent.x, -this._scratchTangent.z);
    if (dt > 0) {
      let angleDiff = targetHeading - car.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      car.heading += angleDiff * Math.min(1, 10.0 * dt);
    } else {
      car.heading = targetHeading;
    }

    // Road slope pitch
    const slopePitch = Math.atan2(
      this._scratchTangent.y,
      Math.hypot(this._scratchTangent.x, this._scratchTangent.z)
    );
    car.pitch = slopePitch;

    this.applyMeshTransform(car);
  }

  private applyMeshTransform(car: AICarState): void {
    car.mesh.position.copy(car.position);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.x = car.pitch;
    car.mesh.rotation.z = car.roll;
  }

  /** The race car model (U-07) in this driver's team colours; geometry is shared by all cars. */
  private createCarMesh(profile: AIDriverProfile): THREE.Group {
    return createStaticRaceCar(profile.colorHex, profile.secondaryColorHex);
  }
}
