import * as THREE from 'three';
import { InputManager } from './engine/InputManager';
import { VehiclePhysics } from './engine/VehiclePhysics';
import { CameraController } from './engine/CameraController';
import { HUDController } from './ui/HUDController';
import { TrackSpline } from './track/TrackSpline';
import { TrackGeometryGenerator } from './track/TrackGeometryGenerator';
import { ALL_TRACKS } from './track/TrackDefinitions';
import { LapManager } from './engine/LapManager';
import { AudioEngine } from './audio/AudioEngine';
import { SlipstreamManager, SlipstreamState } from './engine/SlipstreamManager';
import { RivalDrone } from './engine/RivalDrone';
import { WindStreamlines } from './effects/WindStreamlines';
import { TireCompound, getTireCompoundGrip, getTireDragMultiplier } from './tires/TireTypes';

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
  private audioEngine: AudioEngine;
  private slipstreamManager: SlipstreamManager;
  private rivalDrone: RivalDrone;
  private windStreamlines: WindStreamlines;
  private activeTire: TireCompound = 'street';

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

  // Latest slipstream telemetry state
  private latestSlipstream: SlipstreamState = {
    inWake: false,
    draftProgress: 0,
    isBoostActive: false,
    boostFactor: 1.0,
    distanceToLead: 999
  };

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
    this.scene.background = new THREE.Color(0x06080e);
    this.scene.fog = new THREE.FogExp2(0x06080e, 0.005);

    // 3. Setup Camera (Base FOV = 58)
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

    // 7. Initialize Audio & Effects Subsystems
    this.audioEngine = new AudioEngine();
    this.slipstreamManager = new SlipstreamManager();
    this.rivalDrone = new RivalDrone();
    this.scene.add(this.rivalDrone.mesh);

    this.windStreamlines = new WindStreamlines();
    this.scene.add(this.windStreamlines.mesh);

    // 8. Initialize Subsystems (Input, Physics, Camera, HUD)
    this.inputManager = new InputManager();
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0);
    this.cameraController = new CameraController('high-chase');
    this.hudController = new HUDController(
      () => this.cameraController.toggleMode(),
      () => this.cycleTrack(),
      () => this.audioEngine.toggleMute(),
      (compound) => { this.activeTire = compound; }
    );

    // 9. Initialize Track Spline & Load Initial Track
    const initialTrackData = ALL_TRACKS[this.currentTrackIndex] ?? ALL_TRACKS[0]!;
    this.trackSpline = new TrackSpline(initialTrackData);
    this.lapManager = new LapManager(this.trackSpline);
    this.loadTrack(this.currentTrackIndex);

    // 10. Web Audio User Gesture Unlock Listeners (Pointer, Keyboard, Tap)
    const unlockAudio = (): void => {
      this.audioEngine.unlock();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // 11. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 12. Start Main Loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private buildTerrainFloor(): void {
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.95,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.05;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Stylized horizon perspective grid with cyber cyan tint
    const grid = new THREE.GridHelper(800, 80, 0x00f0ff, 0x172136);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  private loadTrack(index: number): void {
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
    }

    const trackData = ALL_TRACKS[index] ?? ALL_TRACKS[0]!;
    this.trackSpline = new TrackSpline(trackData);
    this.lapManager.reset(this.trackSpline);
    this.slipstreamManager.reset();

    // Position rival drone ahead along the spline
    this.rivalDrone.setTrack(this.trackSpline, 0.04);

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

    const heading = Math.atan2(-startTangent.x, -startTangent.z);

    this.vehiclePhysics = new VehiclePhysics(startPoint.clone(), heading);
    this.cameraController.teleport(this.camera, this.vehiclePhysics.state);
  }

  private createLowPolyCar(): THREE.Group {
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
    const wingGeo = new THREE.BoxGeometry(1.9, 0.08, 0.4);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e17,
      roughness: 0.4,
      flatShading: true
    });
    const wing = new THREE.Mesh(wingGeo, wingMat);
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
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1c1d24,
      roughness: 0.8,
      flatShading: true
    });

    this.frontLeftWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.frontLeftWheel.position.set(-1.0, 0.38, -1.2);
    this.frontLeftWheel.castShadow = true;
    car.add(this.frontLeftWheel);

    this.frontRightWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.frontRightWheel.position.set(1.0, 0.38, -1.2);
    this.frontRightWheel.castShadow = true;
    car.add(this.frontRightWheel);

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

    const clampedDelta = Math.min(frameDelta, this.MAX_ACCUMULATOR);
    this.accumulator += clampedDelta;

    // 1. Poll Input State
    const input = this.inputManager.getInputState();

    if (input.cameraToggleRequested) {
      this.cameraController.toggleMode();
    }
    if (input.trackToggleRequested) {
      this.cycleTrack();
    }
    if (input.audioToggleRequested) {
      this.audioEngine.toggleMute();
    }
    if (input.tireSelectRequested === 1) {
      this.activeTire = 'street';
    } else if (input.tireSelectRequested === 2) {
      this.activeTire = 'all_terrain';
    } else if (input.tireSelectRequested === 3) {
      this.activeTire = 'wet';
    }

    // 2. Fixed Timestep Physics Simulation Loop (60Hz)
    let currentSurface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);

    while (this.accumulator >= this.PHYSICS_STEP) {
      // Advance rival drone along track spline
      this.rivalDrone.update(this.PHYSICS_STEP);

      // Evaluate surface physics
      currentSurface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);

      // Evaluate slipstream drafting behind rival drone
      this.latestSlipstream = this.slipstreamManager.update(
        this.vehiclePhysics.state.position,
        this.vehiclePhysics.state.heading,
        this.vehiclePhysics.state.speedKmh,
        this.rivalDrone.position,
        this.rivalDrone.heading,
        this.PHYSICS_STEP
      );

      // Combine terrain surface modifiers with active tactical tire compound
      const baseSurfaceGrip = currentSurface.gripMultiplier;
      const tireGrip = getTireCompoundGrip(this.activeTire, currentSurface.surface);
      const tireDrag = getTireDragMultiplier(this.activeTire, currentSurface.surface);

      const effectiveGrip = baseSurfaceGrip * tireGrip;
      const effectiveDrag = currentSurface.dragMultiplier * tireDrag;

      // Update vehicle physics with slipstream boost
      this.vehiclePhysics.update(
        this.PHYSICS_STEP,
        input,
        { grip: effectiveGrip, drag: effectiveDrag },
        this.latestSlipstream.boostFactor
      );

      // Update lap manager
      this.lapManager.update(
        this.vehiclePhysics.state.position,
        this.vehiclePhysics.state.velocity,
        this.PHYSICS_STEP
      );

      this.accumulator -= this.PHYSICS_STEP;
    }

    // 3. Update Camera Controller with Dynamic FOV Speed Pulse
    const targetFov = this.latestSlipstream.isBoostActive
      ? 64
      : this.latestSlipstream.inWake
      ? 61
      : 58;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 5.0 * clampedDelta);
    this.camera.updateProjectionMatrix();

    this.cameraController.update(this.camera, this.vehiclePhysics.state, clampedDelta);

    // 4. Synchronize 3D Car Visuals with Physics State
    const state = this.vehiclePhysics.state;
    this.carGroup.position.copy(state.position);
    this.carGroup.rotation.y = state.heading;

    const cornerRoll = (state.steeringAngle * (state.speedKmh / 180)) * 0.12;
    this.carGroup.rotation.z = -cornerRoll;

    if (this.frontLeftWheel && this.frontRightWheel) {
      this.frontLeftWheel.rotation.y = state.steeringAngle;
      this.frontRightWheel.rotation.y = state.steeringAngle;
    }

    this.wheelRoll += (state.forwardSpeed * clampedDelta) / 0.38;
    if (this.frontLeftWheel && this.frontRightWheel && this.rearLeftWheel && this.rearRightWheel) {
      this.frontLeftWheel.rotation.x = this.wheelRoll;
      this.frontRightWheel.rotation.x = this.wheelRoll;
      this.rearLeftWheel.rotation.x = this.wheelRoll;
      this.rearRightWheel.rotation.x = this.wheelRoll;
    }

    // 5. Update Aerodynamic Wind Streamlines
    this.windStreamlines.update(
      state.position,
      state.heading,
      state.speedKmh,
      this.latestSlipstream.inWake,
      this.latestSlipstream.isBoostActive,
      clampedDelta
    );

    // 6. Update Procedural Web Audio Engine
    this.audioEngine.update({
      speedKmh: state.speedKmh,
      rpmRatio: state.rpm,
      throttle: input.throttle,
      driftIntensity: state.driftFactor,
      isDrafting: this.latestSlipstream.inWake,
      isDraftBoostActive: this.latestSlipstream.isBoostActive,
      isOnCurb: currentSurface.surface === 'curb',
      isOnGravel: currentSurface.surface === 'gravel'
    });

    // 7. Update HUD Telemetry
    this.hudController.update(
      state,
      this.cameraController.currentMode,
      this.lapManager.state,
      currentSurface,
      this.trackSpline.data.name,
      this.latestSlipstream,
      this.activeTire,
      this.audioEngine.isMuted()
    );

    // 8. FPS & Pacing Telemetry
    this.frameCount++;
    this.fpsTimer += clampedDelta;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.currentFps} | Physics: 60Hz Fixed | Compound: ${this.activeTire.toUpperCase()}`;
      }
    }

    // 9. Render Frame
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new ApexSlipstreamGame();
});
