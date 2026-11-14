import * as THREE from 'three';
import { InputManager } from './engine/InputManager';
import { VehiclePhysics } from './engine/VehiclePhysics';
import { CameraController } from './engine/CameraController';
import { HUDController } from './ui/HUDController';

// Global error handlers
window.addEventListener('error', (event) => {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = `Runtime Error: ${event.message}`;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = `Promise Rejection: ${event.reason}`;
  }
});

class ApexSlipstreamGame {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Engine Subsystems
  private inputManager: InputManager;
  private vehiclePhysics: VehiclePhysics;
  private cameraController: CameraController;
  private hudController: HUDController;

  // 3D Vehicle & Arena Meshes
  private carGroup: THREE.Group;
  private frontLeftWheel: THREE.Mesh | null = null;
  private frontRightWheel: THREE.Mesh | null = null;
  private rearLeftWheel: THREE.Mesh | null = null;
  private rearRightWheel: THREE.Mesh | null = null;

  // Fixed Timestep Accumulator Loop Constants
  private readonly PHYSICS_STEP = 1 / 60; // 16.666ms
  private readonly MAX_ACCUMULATOR = 0.1; // 100ms clamp prevents spiral of death
  private accumulator = 0;
  private lastTime = 0;

  // Performance telemetry
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private fpsElement: HTMLElement | null;

  // Wheel rotation accumulator
  private wheelRoll = 0;

  constructor() {
    const canvasElement = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvasElement) {
      throw new Error('Canvas element #game-canvas not found');
    }
    this.canvas = canvasElement;
    this.fpsElement = document.getElementById('fps-counter');

    // 1. Setup Three.js WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Setup Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a14);
    this.scene.fog = new THREE.FogExp2(0x0a0a14, 0.012);

    // 3. Setup Camera
    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    sunLight.position.set(25, 45, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    this.scene.add(sunLight);

    // 5. Build Test Arena (Track Pad, Kerbs, Boundary Guardrails)
    this.buildTestArena();

    // 6. Build Low-Poly Racecar
    this.carGroup = this.createLowPolyCar();
    this.scene.add(this.carGroup);

    // 7. Initialize Engine Subsystems
    this.inputManager = new InputManager();
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0);
    this.cameraController = new CameraController('high-chase');
    this.hudController = new HUDController(() => {
      this.cameraController.toggleMode();
    });

    // Initial camera teleport to prevent sweeping transition on spawn
    this.cameraController.teleport(this.camera, this.vehiclePhysics.state);

    // 8. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 9. Start Main Loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private buildTestArena(): void {
    // Ground plane (Asphalt)
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x14161f,
      roughness: 0.85,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Stylized perspective grid lines
    const gridHelper = new THREE.GridHelper(180, 45, 0x00e699, 0x222638);
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);

    // Inner Corner Slalom Pylons
    const pylonGeo = new THREE.CylinderGeometry(0.4, 0.6, 1.4, 8);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      roughness: 0.3,
      flatShading: true
    });

    const pylonPositions = [
      [-25, -20], [25, -20], [0, -35],
      [-30, 25], [30, 25], [0, 40]
    ];

    for (const pos of pylonPositions) {
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(pos[0] ?? 0, 0.7, pos[1] ?? 0);
      pylon.castShadow = true;
      this.scene.add(pylon);
    }

    // Outer Boundary Guardrail Ribbons
    const wallHeight = 1.2;
    const wallLength = 170;
    const wallGeoX = new THREE.BoxGeometry(wallLength, wallHeight, 1.0);
    const wallGeoZ = new THREE.BoxGeometry(1.0, wallHeight, wallLength);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2e334a,
      roughness: 0.4,
      metalness: 0.5,
      flatShading: true
    });

    // North & South Walls
    const northWall = new THREE.Mesh(wallGeoX, wallMat);
    northWall.position.set(0, wallHeight / 2, -85);
    northWall.castShadow = true;
    this.scene.add(northWall);

    const southWall = new THREE.Mesh(wallGeoX, wallMat);
    southWall.position.set(0, wallHeight / 2, 85);
    southWall.castShadow = true;
    this.scene.add(southWall);

    // East & West Walls
    const eastWall = new THREE.Mesh(wallGeoZ, wallMat);
    eastWall.position.set(85, wallHeight / 2, 0);
    eastWall.castShadow = true;
    this.scene.add(eastWall);

    const westWall = new THREE.Mesh(wallGeoZ, wallMat);
    westWall.position.set(-85, wallHeight / 2, 0);
    westWall.castShadow = true;
    this.scene.add(westWall);
  }

  private createLowPolyCar(): THREE.Group {
    const car = new THREE.Group();

    // 1. Aerodynamic Chassis (Apex green)
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 3.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00e699,
      roughness: 0.25,
      metalness: 0.3,
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
      color: 0x111625,
      roughness: 0.1,
      metalness: 0.9,
      flatShading: true
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 0.95, -0.2);
    cabinMesh.castShadow = true;
    car.add(cabinMesh);

    // 3. High-Downforce Rear Spoiler
    const wingGeo = new THREE.BoxGeometry(1.9, 0.08, 0.4);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      roughness: 0.4,
      flatShading: true
    });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 1.15, 1.6);
    wing.castShadow = true;
    car.add(wing);

    // Spoiler vertical struts
    const strutGeo = new THREE.BoxGeometry(0.08, 0.4, 0.15);
    const strutLeft = new THREE.Mesh(strutGeo, wingMat);
    strutLeft.position.set(-0.6, 0.95, 1.6);
    car.add(strutLeft);
    const strutRight = new THREE.Mesh(strutGeo, wingMat);
    strutRight.position.set(0.6, 0.95, 1.6);
    car.add(strutRight);

    // 4. Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1c1d24,
      roughness: 0.8,
      flatShading: true
    });

    // Front Wheels (steerable)
    this.frontLeftWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.frontLeftWheel.position.set(-1.0, 0.38, -1.2);
    this.frontLeftWheel.castShadow = true;
    car.add(this.frontLeftWheel);

    this.frontRightWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.frontRightWheel.position.set(1.0, 0.38, -1.2);
    this.frontRightWheel.castShadow = true;
    car.add(this.frontRightWheel);

    // Rear Wheels
    this.rearLeftWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.rearLeftWheel.position.set(-1.0, 0.38, 1.2);
    this.rearLeftWheel.castShadow = true;
    car.add(this.rearLeftWheel);

    this.rearRightWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.rearRightWheel.position.set(1.0, 0.38, 1.2);
    this.rearRightWheel.castShadow = true;
    car.add(this.rearRightWheel);

    return car;
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private gameLoop(timestamp: number): void {
    const frameDelta = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // 1. Clamp frameDelta to avoid spiral of death
    const clampedDelta = Math.min(frameDelta, this.MAX_ACCUMULATOR);
    this.accumulator += clampedDelta;

    // 2. Poll Input State
    const input = this.inputManager.getInputState();

    if (input.cameraToggleRequested) {
      this.cameraController.toggleMode();
    }

    // 3. Fixed Timestep Physics Simulation Loop (60Hz)
    while (this.accumulator >= this.PHYSICS_STEP) {
      this.vehiclePhysics.update(this.PHYSICS_STEP, input);
      this.accumulator -= this.PHYSICS_STEP;
    }

    // 4. Update Camera Controller with smoothed damping
    this.cameraController.update(this.camera, this.vehiclePhysics.state, clampedDelta);

    // 5. Synchronize 3D Car Visuals with Physics State
    const state = this.vehiclePhysics.state;
    this.carGroup.position.copy(state.position);
    this.carGroup.rotation.y = state.heading;

    // Dynamic chassis roll/tilt during hard cornering
    const cornerRoll = (state.steeringAngle * (state.speedKmh / 180)) * 0.12;
    this.carGroup.rotation.z = -cornerRoll;

    // Steer front wheels
    if (this.frontLeftWheel && this.frontRightWheel) {
      this.frontLeftWheel.rotation.y = state.steeringAngle;
      this.frontRightWheel.rotation.y = state.steeringAngle;
    }

    // Roll wheels according to forward velocity
    this.wheelRoll += (state.forwardSpeed * clampedDelta) / 0.38;
    if (this.frontLeftWheel && this.frontRightWheel && this.rearLeftWheel && this.rearRightWheel) {
      this.frontLeftWheel.rotation.x = this.wheelRoll;
      this.frontRightWheel.rotation.x = this.wheelRoll;
      this.rearLeftWheel.rotation.x = this.wheelRoll;
      this.rearRightWheel.rotation.x = this.wheelRoll;
    }

    // 6. Update HUD Telemetry
    this.hudController.update(state, this.cameraController.currentMode);

    // 7. FPS & Pacing Telemetry
    this.frameCount++;
    this.fpsTimer += clampedDelta;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.currentFps} | Physics: 60Hz Fixed | Arena: 180m`;
      }
    }

    // 8. Render Frame
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new ApexSlipstreamGame();
});
