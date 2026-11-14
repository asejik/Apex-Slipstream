import * as THREE from 'three';
import { GhostRecorder } from './GhostRecorder';

export interface GhostSample {
  position: THREE.Vector3;
  heading: number;
  steeringAngle: number;
}

export class GhostPlayback {
  public mesh: THREE.Group;
  private data: Float32Array | null = null;
  private sampleCount = 0;
  private isLoaded = false;
  private isVisible = true;

  // Wheel meshes for animated steering
  private frontLeftWheel: THREE.Mesh | null = null;
  private frontRightWheel: THREE.Mesh | null = null;

  // Scratch objects for zero heap allocations
  private readonly _currentSample: GhostSample = {
    position: new THREE.Vector3(0, 0, 0),
    heading: 0,
    steeringAngle: 0
  };

  constructor() {
    this.mesh = this.createGhostMesh();
    this.mesh.visible = false;
  }

  public loadGhost(data: Float32Array, sampleCount: number): void {
    this.data = data;
    this.sampleCount = sampleCount;
    this.isLoaded = sampleCount > 0;
    this.mesh.visible = this.isLoaded && this.isVisible;
  }

  public clear(): void {
    this.data = null;
    this.sampleCount = 0;
    this.isLoaded = false;
    this.mesh.visible = false;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.mesh.visible = this.isLoaded && this.isVisible;
  }

  public get hasGhost(): boolean {
    return this.isLoaded;
  }

  public get visible(): boolean {
    return this.mesh.visible;
  }

  /**
   * Samples interpolated ghost telemetry at a given elapsed lap time.
   */
  public sampleAtTime(lapTimeSeconds: number): GhostSample | null {
    if (!this.data || this.sampleCount === 0) return null;

    const frameFloat = lapTimeSeconds * GhostRecorder.SAMPLE_RATE_HZ;
    const maxIndex = this.sampleCount - 1;

    if (frameFloat <= 0) {
      this.readKeyframe(0, this._currentSample);
      return this._currentSample;
    }

    if (frameFloat >= maxIndex) {
      this.readKeyframe(maxIndex, this._currentSample);
      return this._currentSample;
    }

    const indexA = Math.floor(frameFloat);
    const indexB = Math.min(indexA + 1, maxIndex);
    const alpha = frameFloat - indexA;

    const offsetA = indexA * GhostRecorder.STRIDE;
    const offsetB = indexB * GhostRecorder.STRIDE;

    // Linear interpolation for spatial position
    const xA = this.data[offsetA + 0] ?? 0;
    const yA = this.data[offsetA + 1] ?? 0;
    const zA = this.data[offsetA + 2] ?? 0;
    const xB = this.data[offsetB + 0] ?? 0;
    const yB = this.data[offsetB + 1] ?? 0;
    const zB = this.data[offsetB + 2] ?? 0;

    this._currentSample.position.set(
      THREE.MathUtils.lerp(xA, xB, alpha),
      THREE.MathUtils.lerp(yA, yB, alpha),
      THREE.MathUtils.lerp(zA, zB, alpha)
    );

    // Shortest-arc angular interpolation for yaw heading
    const yawA = this.data[offsetA + 3] ?? 0;
    const yawB = this.data[offsetB + 3] ?? 0;
    let diff = yawB - yawA;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this._currentSample.heading = yawA + diff * alpha;

    // Steer angle interpolation
    const steerA = this.data[offsetA + 4] ?? 0;
    const steerB = this.data[offsetB + 4] ?? 0;
    this._currentSample.steeringAngle = THREE.MathUtils.lerp(steerA, steerB, alpha);

    return this._currentSample;
  }

  /**
   * Updates 3D ghost mesh position and wheel steer angles.
   */
  public update(lapTimeSeconds: number): GhostSample | null {
    if (!this.isLoaded || !this.isVisible) return null;

    const sample = this.sampleAtTime(lapTimeSeconds);
    if (!sample) return null;

    this.mesh.position.copy(sample.position);
    this.mesh.rotation.y = sample.heading;

    if (this.frontLeftWheel && this.frontRightWheel) {
      this.frontLeftWheel.rotation.y = sample.steeringAngle;
      this.frontRightWheel.rotation.y = sample.steeringAngle;
    }

    return sample;
  }

  /**
   * Computes spatial delta along the track between player and ghost.
   * Returns estimated seconds delta (negative = player ahead of ghost; positive = player behind ghost).
   */
  public computeTimeDelta(playerPos: THREE.Vector3, playerSpeedKmh: number, ghostPos: THREE.Vector3): number {
    const dx = playerPos.x - ghostPos.x;
    const dz = playerPos.z - ghostPos.z;
    const distanceMeters = Math.hypot(dx, dz);

    const speedMs = Math.max(10.0, (playerSpeedKmh * 1000) / 3600);
    const timeDelta = distanceMeters / speedMs;

    // Determine if player is ahead or behind based on player forward vector
    return timeDelta;
  }

  private readKeyframe(index: number, out: GhostSample): void {
    if (!this.data) return;
    const offset = index * GhostRecorder.STRIDE;
    out.position.set(
      this.data[offset + 0] ?? 0,
      this.data[offset + 1] ?? 0,
      this.data[offset + 2] ?? 0
    );
    out.heading = this.data[offset + 3] ?? 0;
    out.steeringAngle = this.data[offset + 4] ?? 0;
  }

  private createGhostMesh(): THREE.Group {
    const car = new THREE.Group();

    // Translucent holographic cyan material
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.38,
      roughness: 0.2,
      metalness: 0.7,
      wireframe: false
    });

    const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 3.8);
    const bodyMesh = new THREE.Mesh(bodyGeo, ghostMat);
    bodyMesh.position.y = 0.55;
    car.add(bodyMesh);

    const cabinGeo = new THREE.BoxGeometry(1.3, 0.45, 1.8);
    const cabinMesh = new THREE.Mesh(cabinGeo, ghostMat);
    cabinMesh.position.set(0, 0.95, -0.2);
    car.add(cabinMesh);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), ghostMat);
    wing.position.set(0, 1.15, 1.6);
    car.add(wing);

    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    this.frontLeftWheel = new THREE.Mesh(wheelGeo, ghostMat);
    this.frontLeftWheel.position.set(-1.0, 0.38, -1.2);
    car.add(this.frontLeftWheel);

    this.frontRightWheel = new THREE.Mesh(wheelGeo, ghostMat);
    this.frontRightWheel.position.set(1.0, 0.38, -1.2);
    car.add(this.frontRightWheel);

    const wRL = new THREE.Mesh(wheelGeo, ghostMat);
    wRL.position.set(-1.0, 0.38, 1.2);
    car.add(wRL);

    const wRR = new THREE.Mesh(wheelGeo, ghostMat);
    wRR.position.set(1.0, 0.38, 1.2);
    car.add(wRR);

    return car;
  }
}
