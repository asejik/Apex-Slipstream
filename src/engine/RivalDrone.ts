import * as THREE from 'three';
import { TrackSpline } from '../track/TrackSpline';

export class RivalDrone {
  public mesh: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public heading = 0;
  public speedKmh = 120; // Racing cruising speed (m/s = 33.3)

  private splineT = 0.03; // starts slightly ahead of player
  private trackSpline: TrackSpline | null = null;
  private _scratchPos = new THREE.Vector3();
  private _scratchTangent = new THREE.Vector3();

  constructor() {
    this.mesh = this.createCarMesh();
  }

  public setTrack(spline: TrackSpline, startT = 0.03): void {
    this.trackSpline = spline;
    this.splineT = startT;
    this.updateTransform(0);
  }

  public update(dt: number): void {
    if (!this.trackSpline) return;

    // Advance along spline: speed in m/s = speedKmh / 3.6
    const speedMs = this.speedKmh / 3.6;
    const totalLength = this.trackSpline.totalLength;
    const deltaT = (speedMs * dt) / totalLength;

    this.splineT += deltaT;
    if (this.splineT > 1.0) {
      this.splineT -= 1.0;
    }

    this.updateTransform(dt);
  }

  private updateTransform(_dt: number): void {
    if (!this.trackSpline) return;

    this.trackSpline.getPointAt(this.splineT, this._scratchPos);
    this.trackSpline.getTangentAt(this.splineT, this._scratchTangent);

    // Car position slightly elevated on road
    this.position.copy(this._scratchPos);
    this.position.y += 0.35;
    this.mesh.position.copy(this.position);

    // Heading from tangent: In Three.js forward is (-sinH, 0, -cosH)
    // tangent = (tx, ty, tz)
    // -sinH = tx => sinH = -tx
    // -cosH = tz => cosH = -tz
    this.heading = Math.atan2(-this._scratchTangent.x, -this._scratchTangent.z);
    this.mesh.rotation.y = this.heading;
  }

  private createCarMesh(): THREE.Group {
    const group = new THREE.Group();

    // Rival Car Body: Crimson Red / Carbon Livery to contrast player's Cyan car
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.55, 3.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Crimson
      roughness: 0.25,
      metalness: 0.8
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Cockpit
    const cabinGeo = new THREE.BoxGeometry(1.2, 0.45, 1.8);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x111827, // Dark cockpit tint
      roughness: 0.1,
      metalness: 0.95
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 0.45, -0.2);
    cabinMesh.castShadow = true;
    group.add(cabinMesh);

    // Rear Spoiler
    const wingGeo = new THREE.BoxGeometry(1.6, 0.08, 0.4);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 });
    const wingMesh = new THREE.Mesh(wingGeo, wingMat);
    wingMesh.position.set(0, 0.65, 1.6);
    group.add(wingMesh);

    // Taillights
    const tailGeo = new THREE.BoxGeometry(0.35, 0.12, 0.05);
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const leftTail = new THREE.Mesh(tailGeo, tailMat);
    leftTail.position.set(-0.6, 0.1, 1.91);
    const rightTail = leftTail.clone();
    rightTail.position.set(0.6, 0.1, 1.91);
    group.add(leftTail);
    group.add(rightTail);

    return group;
  }

  public dispose(): void {
    this.mesh.traverse((child) => {
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
