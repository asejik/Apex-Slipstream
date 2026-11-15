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
  /** Seconds since the start when this car completed the race distance; null while racing. */
  finishTime: number | null;
  /** Sprint finishers park at the end of the road and leave the race (hidden, no collisions). */
  isParked: boolean;
}

export class AIDriverManager {
  public cars: AICarState[] = [];
  public group: THREE.Group;
  private trackSpline: TrackSpline | null = null;
  private raceElapsed = 0;

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
        isParked: false
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
      car.mesh.visible = true;
    }

    let playerSpawnDist = 0;
    let playerLateralOffset = 0;

    if (!gridOrder || gridOrder.length !== 20) {
      // Default: AI in front (P1..P19), Player at P20 (start line)
      for (let i = 0; i < this.cars.length; i++) {
        const car = this.cars[i];
        if (!car) continue;

        // Rank 1 is furthest ahead, Rank 19 is closest to P20
        const rank = i + 1;
        const distAhead = 14 + (19 - rank) * 8.5;
        car.splineT = (distAhead / totalLength) % 1.0;
        car.speedKmh = (115 + (i % 5) * 5) * car.profile.skill;
        car.lap = 1;
        car.isSpinningOut = false;
        car.spinTimer = 0;
        car.lateralOffset = (rank % 2 === 0 ? 1 : -1) * 2.2;

        this.updateCarTransform(car, 0);
      }
      return { playerSpawnDist: 0, playerLateralOffset: 0 };
    }

    // Ordered grid slots: gridOrder[0] is P1, gridOrder[19] is P20
    for (let rank = 1; rank <= 20; rank++) {
      const driverId = gridOrder[rank - 1];
      const distAhead = 14 + (20 - rank) * 8.5;
      const lateral = (rank % 2 === 0 ? 1 : -1) * 2.2;

      if (driverId === 'player') {
        playerSpawnDist = distAhead;
        playerLateralOffset = lateral;
      } else {
        const car = this.cars.find((c) => c.profile.id === driverId);
        if (car) {
          car.splineT = (distAhead / totalLength) % 1.0;
          car.speedKmh = (115 + (rank % 5) * 5) * car.profile.skill;
          car.lap = 1;
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

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car || car.isParked) continue;

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
        car.lap++;
        // Circuit finish: record the time, then keep driving a cool-down lap
        if (car.finishTime === null && car.lap > this.trackSpline.data.laps) {
          car.finishTime = this.raceElapsed;
        }
      }

      this.updateCarTransform(car, dt);
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

  private createCarMesh(profile: AIDriverProfile): THREE.Group {
    const car = new THREE.Group();

    // 1. Chassis Body (Unique AI Liveries)
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 3.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: profile.colorHex,
      roughness: 0.35,
      metalness: 0.3,
      flatShading: true
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.55;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    car.add(bodyMesh);

    // 2. Cockpit
    const cabinGeo = new THREE.BoxGeometry(1.3, 0.45, 1.8);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e17,
      roughness: 0.1,
      metalness: 0.9,
      flatShading: true
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 0.95, -0.2);
    cabinMesh.castShadow = true;
    car.add(cabinMesh);

    // 3. Team Color Accent Stripe
    const stripeGeo = new THREE.BoxGeometry(0.5, 0.52, 3.82);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: profile.secondaryColorHex,
      roughness: 0.2,
      metalness: 0.5,
      flatShading: true
    });
    const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
    stripeMesh.position.y = 0.55;
    car.add(stripeMesh);

    // 4. Rear Spoiler
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.5,
      flatShading: true
    });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), wingMat);
    wing.position.set(0, 1.15, 1.6);
    wing.castShadow = true;
    car.add(wing);

    // 5. Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1c1d24,
      roughness: 0.8,
      flatShading: true
    });

    const wFL = new THREE.Mesh(wheelGeo, wheelMat);
    wFL.position.set(-1.0, 0.38, -1.2);
    car.add(wFL);

    const wFR = new THREE.Mesh(wheelGeo, wheelMat);
    wFR.position.set(1.0, 0.38, -1.2);
    car.add(wFR);

    const wRL = new THREE.Mesh(wheelGeo, wheelMat);
    wRL.position.set(-1.0, 0.38, 1.2);
    car.add(wRL);

    const wRR = new THREE.Mesh(wheelGeo, wheelMat);
    wRR.position.set(1.0, 0.38, 1.2);
    car.add(wRR);

    return car;
  }
}
