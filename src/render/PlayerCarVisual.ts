import * as THREE from 'three';
import type { VehicleState } from '../engine/VehiclePhysics';

const WHEEL_RADIUS = 0.38; // metres

/** The player car as drawn: the low-poly model and its pose each frame. */
export class PlayerCarVisual {
  public readonly group: THREE.Group;

  private readonly frontLeftWheel: THREE.Mesh;
  private readonly frontRightWheel: THREE.Mesh;
  private readonly rearLeftWheel: THREE.Mesh;
  private readonly rearRightWheel: THREE.Mesh;
  private wheelRoll = 0;

  constructor() {
    const car = new THREE.Group();

    // 1. Aerodynamic Chassis (Electric Cyan)
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 3.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.25,
      metalness: 0.4,
      flatShading: true
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.55;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    car.add(bodyMesh);

    // 2. Cockpit / Windshield Canopy
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

    // 3. High-Downforce Rear Spoiler
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e17,
      roughness: 0.4,
      flatShading: true
    });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), wingMat);
    wing.position.set(0, 1.15, 1.6);
    wing.castShadow = true;
    car.add(wing);

    const strutGeo = new THREE.BoxGeometry(0.08, 0.4, 0.15);
    const strutLeft = new THREE.Mesh(strutGeo, wingMat);
    strutLeft.position.set(-0.6, 0.95, 1.6);
    car.add(strutLeft);
    const strutRight = new THREE.Mesh(strutGeo, wingMat);
    strutRight.position.set(0.6, 0.95, 1.6);
    car.add(strutRight);

    // 4. Wheels
    const wheelGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.32, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1c1d24,
      roughness: 0.8,
      flatShading: true
    });
    const addWheel = (x: number, z: number): THREE.Mesh => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, WHEEL_RADIUS, z);
      wheel.castShadow = true;
      car.add(wheel);
      return wheel;
    };
    this.frontLeftWheel = addWheel(-1.0, -1.2);
    this.frontRightWheel = addWheel(1.0, -1.2);
    this.rearLeftWheel = addWheel(-1.0, 1.2);
    this.rearRightWheel = addWheel(1.0, 1.2);

    this.group = car;
  }

  /**
   * Places the model for this frame. `position` and `heading` are the drawn pose
   * (between physics steps); `slopePitch` is the slope of the road under the car in radians.
   */
  public update(
    position: THREE.Vector3,
    heading: number,
    state: VehicleState,
    slopePitch: number,
    frameDelta: number
  ): void {
    this.group.position.copy(position);
    this.group.rotation.y = heading;
    this.group.rotation.x = slopePitch;

    const cornerRoll = (state.steeringAngle * (state.speedKmh / 180)) * 0.12;
    this.group.rotation.z = -cornerRoll;

    this.frontLeftWheel.rotation.y = state.steeringAngle;
    this.frontRightWheel.rotation.y = state.steeringAngle;

    this.wheelRoll += (state.forwardSpeed * frameDelta) / WHEEL_RADIUS;
    this.frontLeftWheel.rotation.x = this.wheelRoll;
    this.frontRightWheel.rotation.x = this.wheelRoll;
    this.rearLeftWheel.rotation.x = this.wheelRoll;
    this.rearRightWheel.rotation.x = this.wheelRoll;
  }
}
