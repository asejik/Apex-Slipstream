import * as THREE from 'three';
import { TrackSpline } from '../track/TrackSpline';
import { AIDriverProfile, AI_DRIVER_ROSTER } from './AIDriverProfiles';

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
}

export class AIDriverManager {
  public cars: AICarState[] = [];
  public group: THREE.Group;
  private trackSpline: TrackSpline | null = null;

  // Reusable scratch objects for zero GC in 60Hz loop
  private readonly _scratchCenter = new THREE.Vector3();
  private readonly _scratchTangent = new THREE.Vector3();
  private readonly _scratchNormal = new THREE.Vector3();
  private readonly _scratchDiff = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();
    this.initCars();
  }

  private initCars(): void {
    for (const profile of AI_DRIVER_ROSTER) {
      const mesh = this.createCarMesh(profile);
      this.group.add(mesh);

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
        spinTimer: 0
      });
    }
  }

  /**
   * Positions all 19 AI drivers on the starting grid staggered behind or ahead of player.
   */
  public resetGrid(spline: TrackSpline): void {
    this.trackSpline = spline;
    const totalLength = spline.totalLength;

    // Grid spacing: each row is 8 meters apart, alternating left/right
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car) continue;

      // Stagger cars along spline ahead of start line
      // Car 0 starts ~15m ahead, car 1 at ~23m, etc.
      const distAhead = 14 + i * 8.5;
      car.splineT = (distAhead / totalLength) % 1.0;
      car.speedKmh = (115 + (i % 5) * 5) * car.profile.skill;
      car.lap = 1;
      car.isSpinningOut = false;
      car.spinTimer = 0;
      car.lateralOffset = (i % 2 === 0 ? 1 : -1) * (2.0 + (i % 3) * 0.7);

      this.updateCarTransform(car, 0);
    }
  }

  /**
   * Fixed 60Hz update loop for all 19 AI agents with zero heap allocations.
   */
  public update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.trackSpline) return;
    const totalLength = this.trackSpline.totalLength;

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car) continue;

      // Spin-out recovery handler
      if (car.isSpinningOut) {
        car.spinTimer -= dt;
        car.speedKmh = Math.max(0, car.speedKmh - 45 * dt);
        car.heading += 8.0 * dt; // Rapid spin
        if (car.spinTimer <= 0) {
          car.isSpinningOut = false;
          car.speedKmh = 60 * car.profile.skill;
        }
        this.applyMeshTransform(car);
        continue;
      }

      // 1. Natural speed calculation based on driver skill & upcoming curvature
      const targetSpeed = 135 * car.profile.skill;
      if (car.speedKmh < targetSpeed) {
        car.speedKmh += 12 * dt;
      } else {
        car.speedKmh -= 8 * dt;
      }

      // 2. Obstacle & Pack Avoidance Steering
      let lateralAvoidForce = 0;

      // Avoid player car if close
      this._scratchDiff.subVectors(car.position, playerPos);
      const distToPlayer = this._scratchDiff.length();
      if (distToPlayer < 9.0) {
        // Push laterally away from player
        const sideSign = this._scratchDiff.x >= 0 ? 1 : -1;
        lateralAvoidForce += sideSign * (9.0 - distToPlayer) * 0.8;
      }

      // Avoid other nearby AI cars
      for (let j = 0; j < this.cars.length; j++) {
        if (i === j) continue;
        const other = this.cars[j];
        if (!other) continue;

        this._scratchDiff.subVectors(car.position, other.position);
        const dist = this._scratchDiff.length();
        if (dist < 7.5) {
          const sign = this._scratchDiff.x >= 0 ? 1 : -1;
          lateralAvoidForce += sign * (7.5 - dist) * 0.6;
        }
      }

      // Blend preferred lateral offset with avoidance steering
      const targetOffset = THREE.MathUtils.clamp(
        car.profile.preferredLateralOffset + lateralAvoidForce,
        -(this.trackSpline.data.roadWidth / 2 - 1.5),
        this.trackSpline.data.roadWidth / 2 - 1.5
      );
      car.lateralOffset = THREE.MathUtils.lerp(car.lateralOffset, targetOffset, 4.0 * dt);

      // 3. Advance along spline
      const speedMs = car.speedKmh / 3.6;
      const deltaT = (speedMs * dt) / totalLength;
      const prevT = car.splineT;
      car.splineT = (car.splineT + deltaT) % 1.0;

      // Lap increment when crossing finish line
      if (car.splineT < prevT && prevT > 0.8) {
        car.lap++;
      }

      this.updateCarTransform(car, dt);
    }
  }

  private updateCarTransform(car: AICarState, _dt: number): void {
    if (!this.trackSpline) return;

    this.trackSpline.getPointAt(car.splineT, this._scratchCenter);
    this.trackSpline.getNormalAt(car.splineT, this._scratchNormal);
    this.trackSpline.getTangentAt(car.splineT, this._scratchTangent);

    // Apply lateral offset along track normal and elevation
    car.position.copy(this._scratchCenter)
      .addScaledVector(this._scratchNormal, car.lateralOffset);
    car.position.y += 0.28; // Sit on road surface

    // Calculate heading (yaw) from tangent
    car.heading = Math.atan2(-this._scratchTangent.x, -this._scratchTangent.z);

    // Pitch along road slope
    car.pitch = Math.atan2(this._scratchTangent.y, Math.hypot(this._scratchTangent.x, this._scratchTangent.z));

    this.applyMeshTransform(car);
  }

  private applyMeshTransform(car: AICarState): void {
    car.mesh.position.copy(car.position);
    car.mesh.rotation.set(car.pitch, car.heading, car.roll);
  }

  private createCarMesh(profile: AIDriverProfile): THREE.Group {
    const car = new THREE.Group();

    // Chassis body with driver's primary team color
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 3.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: profile.colorHex,
      roughness: 0.3,
      metalness: 0.5,
      flatShading: true
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    body.receiveShadow = true;
    body.frustumCulled = false;
    car.add(body);

    // Cockpit canopy with secondary team color
    const canopyGeo = new THREE.BoxGeometry(1.25, 0.45, 1.8);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: profile.secondaryColorHex,
      roughness: 0.2,
      metalness: 0.8,
      flatShading: true
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 0.95, -0.2);
    canopy.castShadow = true;
    canopy.frustumCulled = false;
    car.add(canopy);

    // Rear Spoiler
    const wingGeo = new THREE.BoxGeometry(1.8, 0.08, 0.4);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.4,
      flatShading: true
    });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 1.15, 1.6);
    wing.castShadow = true;
    wing.frustumCulled = false;
    car.add(wing);

    // Taillights
    const tailGeo = new THREE.BoxGeometry(0.35, 0.12, 0.05);
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const leftTail = new THREE.Mesh(tailGeo, tailMat);
    leftTail.position.set(-0.6, 0.65, 1.91);
    leftTail.frustumCulled = false;
    car.add(leftTail);

    const rightTail = leftTail.clone();
    rightTail.position.set(0.6, 0.65, 1.91);
    rightTail.frustumCulled = false;
    car.add(rightTail);

    return car;
  }

  public dispose(): void {
    for (const car of this.cars) {
      car.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
}
