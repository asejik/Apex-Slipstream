import * as THREE from 'three';
import { InputManager } from './engine/InputManager';
import { VehiclePhysics } from './engine/VehiclePhysics';
import { CameraController } from './engine/CameraController';
import { HUDController } from './ui/HUDController';
import { TrackSpline } from './track/TrackSpline';
import { TrackGeometryGenerator } from './track/TrackGeometryGenerator';
import { ALL_TRACKS } from './track/TrackDefinitions';
import { LapManager } from './engine/LapManager';

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

  // Track Subsystems
  private currentTrackIndex = 0;
  private trackSpline: TrackSpline;
  private lapManager: LapManager;
  private trackGroup: THREE.Group | null = null;

  // 3D Vehicle Meshes
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
    this.scene.background = new THREE.Color(0x0a0c16);
    this.scene.fog = new THREE.FogExp2(0x0a0c16, 0.005);

    // 3. Setup Camera
    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
    sunLight.position.set(40, 80, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -180;
    sunLight.shadow.camera.right = 180;
    sunLight.shadow.camera.top = 180;
    sunLight.shadow.camera.bottom = -180;
    this.scene.add(sunLight);

    // 5. Build Environment Terrain Floor
    this.buildTerrainFloor();

    // 6. Build Low-Poly Racecar
    this.carGroup = this.createLowPolyCar();
    this.scene.add(this.carGroup);

    // 7. Initialize Subsystems (Input, Physics, Camera, HUD)
    this.inputManager = new InputManager();
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0);
    this.cameraController = new CameraController('high-chase');
    this.hudController = new HUDController(
      () => this.cameraController.toggleMode(),
      () => this.cycleTrack()
    );

    // 8. Initialize Track Spline & Load Initial Track
    const initialTrackData = ALL_TRACKS[this.currentTrackIndex] ?? ALL_TRACKS[0]!;
    this.trackSpline = new TrackSpline(initialTrackData);
    this.lapManager = new LapManager(this.trackSpline);
    this.loadTrack(this.currentTrackIndex);

    // 9. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 10. Start Main Loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private buildTerrainFloor(): void {
    // Vast ground plane representing coastal terrain / desert landscape
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x11131c,
      roughness: 0.9,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.05;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Stylized horizon perspective grid
    const grid = new THREE.GridHelper(800, 80, 0x00e699, 0x1b1f2e);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  private loadTrack(index: number): void {
    // Remove previous track geometry if present
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
    }

    const trackData = ALL_TRACKS[index] ?? ALL_TRACKS[0]!;
    this.trackSpline = new TrackSpline(trackData);
    this.lapManager.reset(this.trackSpline);

    // Generate new 3D road ribbon, curbs, and gantry arch
    this.trackGroup = TrackGeometryGenerator.buildTrackMeshes(this.trackSpline);
    this.scene.add(this.trackGroup);

    this.spawnAtTrackStart();
  }

  private cycleTrack(): void {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % ALL_TRACKS.length;
    this.loadTrack(this.currentTrackIndex);
  }

  private spawnAtTrackStart(): void {
    const startPoint = this.trackSpline.getPointAt(0);
    const startTangent = this.trackSpline.getTangentAt(0);

    // Calculate heading from tangent vector
    const heading = Math.atan2(-startTangent.x, -startTangent.z);

    this.vehiclePhysics = new VehiclePhysics(startPoint.clone(), heading);
    this.cameraController.teleport(this.camera, this.vehiclePhysics.state);
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
    if (input.trackToggleRequested) {
      this.cycleTrack();
    }

    // 3. Fixed Timestep Physics Simulation Loop (60Hz)
    let currentSurface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);

    while (this.accumulator >= this.PHYSICS_STEP) {
      currentSurface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);

      this.vehiclePhysics.update(
        this.PHYSICS_STEP,
        input,
        { grip: currentSurface.gripMultiplier, drag: currentSurface.dragMultiplier }
      );

      this.lapManager.update(
        this.vehiclePhysics.state.position,
        this.vehiclePhysics.state.velocity,
        this.PHYSICS_STEP
      );

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
    this.hudController.update(
      state,
      this.cameraController.currentMode,
      this.lapManager.state,
      currentSurface,
      this.trackSpline.data.name
    );

    // 7. FPS & Pacing Telemetry
    this.frameCount++;
    this.fpsTimer += clampedDelta;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.currentFps} | Physics: 60Hz Fixed | Surface: ${currentSurface.surface.toUpperCase()}`;
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
