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
import { AIDriverManager } from './ai/AIDriverManager';
import { CollisionManager } from './engine/CollisionManager';
import { SeasonManager } from './engine/SeasonManager';
import { WindStreamlines } from './effects/WindStreamlines';
import { TireCompound, getTireCompoundGrip, getTireDragMultiplier } from './tires/TireTypes';
import { QualifyingManager, QualifyingMode } from './engine/QualifyingManager';
import { ChampionshipEngine, DriverFinish, RawRaceParticipant } from './engine/ChampionshipEngine';
import { GhostStorage } from './storage/GhostStorage';
import { GhostRecorder } from './replay/GhostRecorder';
import { GhostPlayback } from './replay/GhostPlayback';
import { TouchController } from './ui/TouchController';

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
  private touchController: TouchController;
  private audioEngine: AudioEngine;
  private slipstreamManager: SlipstreamManager;
  private aiDriverManager: AIDriverManager;
  private collisionManager: CollisionManager;
  private seasonManager: SeasonManager;
  private windStreamlines: WindStreamlines;
  private activeTire: TireCompound = 'street';
  private playerRank = 20;

  // Milestone 7 Subsystems (Ghost Time Trial)
  private ghostStorage: GhostStorage;
  private ghostRecorder: GhostRecorder;
  private ghostPlayback: GhostPlayback;
  private isGhostVisible = true;

  // Track Subsystems
  private trackSpline: TrackSpline;
  private lapManager: LapManager;
  private trackGroup: THREE.Group | null = null;

  // 3D Vehicle Meshes
  private carGroup: THREE.Group;
  private frontLeftWheel: THREE.Mesh | null = null;
  private frontRightWheel: THREE.Mesh | null = null;
  private rearLeftWheel: THREE.Mesh | null = null;
  private rearRightWheel: THREE.Mesh | null = null;

  // Championship & Qualifying Lifecycle
  private isQualifying = false;
  private qualifyingMode: QualifyingMode = 'skip';
  private currentGridOrder: string[] = [];
  private raceFinishedHandled = false;
  private severeCrashesThisRace = 0;
  private totalRaceElapsedSeconds = 0;

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
  private _scratchTangent = new THREE.Vector3();

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
    this.aiDriverManager = new AIDriverManager();
    this.scene.add(this.aiDriverManager.group);

    this.collisionManager = new CollisionManager();
    this.seasonManager = new SeasonManager();

    // Milestone 7 Replay Subsystems
    this.ghostStorage = new GhostStorage();
    this.ghostRecorder = new GhostRecorder();
    this.ghostPlayback = new GhostPlayback();
    this.scene.add(this.ghostPlayback.mesh);

    this.windStreamlines = new WindStreamlines();
    this.scene.add(this.windStreamlines.mesh);

    // 8. Initialize Subsystems (Input, Physics, Camera, HUD, Touch)
    this.touchController = new TouchController();
    this.inputManager = new InputManager(this.touchController);
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0);
    this.cameraController = new CameraController('high-chase');
    this.hudController = new HUDController(
      () => this.cameraController.toggleMode(),
      () => this.cycleTrack(),
      () => this.audioEngine.toggleMute(),
      (compound) => { this.activeTire = compound; },
      () => this.restartRace(),
      () => this.toggleStandingsModal(),
      () => this.promptQualifyingSession(),
      () => this.toggleGhost()
    );

    // Fullscreen API toggle
    const fullscreenBtn = document.getElementById('btn-fullscreen');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Register PWA Service Worker in browser environment
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('ServiceWorker registration omitted:', err);
        });
      });
    }

    // 9. Initialize Track Spline & Load Initial Track
    const initialTrackData = this.seasonManager.currentTrack;
    this.trackSpline = new TrackSpline(initialTrackData);
    this.lapManager = new LapManager(this.trackSpline);
    this.setupLapCompletedHook();
    this.loadTrack(this.seasonManager.currentRaceIndex);

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
    (window as unknown as { __game?: ApexSlipstreamGame }).__game = this;
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private setupLapCompletedHook(): void {
    this.lapManager.onLapCompleted = (_lapNumber, lapTime, isPersonalBest) => {
      const { data, sampleCount } = this.ghostRecorder.finishLap();
      const track = this.seasonManager.currentTrack;

      if (sampleCount > 0) {
        if (isPersonalBest) {
          this.hudController.showPersonalBestAlert();
          this.ghostStorage.saveGhost(track.id, 'pb', lapTime * 1000, data, sampleCount);
          this.ghostPlayback.loadGhost(data, sampleCount);
        }
        this.ghostStorage.saveGhost(track.id, 'previous', lapTime * 1000, data, sampleCount);
      }

      this.ghostRecorder.startLap();
    };
  }

  private buildTerrainFloor(): void {
    // Vast ground plane (3500m x 3500m) covering full circuit envelopes
    const groundGeo = new THREE.PlaneGeometry(3500, 3500, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.95,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, -0.35, -400);
    groundMesh.receiveShadow = true;
    groundMesh.frustumCulled = false;
    this.scene.add(groundMesh);

    // Stylized horizon perspective grid with cyber cyan tint (3000m)
    const grid = new THREE.GridHelper(3000, 150, 0x00f0ff, 0x172136);
    grid.position.set(0, -0.30, -400);
    grid.frustumCulled = false;
    this.scene.add(grid);
  }

  private loadTrack(index: number, gridOrder?: string[]): void {
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
    }

    const trackData = ALL_TRACKS[index] ?? ALL_TRACKS[0]!;
    this.trackSpline = new TrackSpline(trackData);
    this.lapManager.reset(this.trackSpline);
    this.slipstreamManager.reset();
    this.raceFinishedHandled = false;
    this.severeCrashesThisRace = 0;
    this.totalRaceElapsedSeconds = 0;

    // Load stored PB ghost replay for this track
    this.ghostStorage.getGhost(trackData.id, 'pb').then((record) => {
      if (record && record.sampleCount > 0) {
        this.ghostPlayback.loadGhost(new Float32Array(record.frameData), record.sampleCount);
      } else {
        this.ghostPlayback.clear();
      }
    });

    this.ghostRecorder.startLap();

    // Reset grid formation with assigned slots
    const { playerSpawnDist, playerLateralOffset } = this.aiDriverManager.resetGrid(
      this.trackSpline,
      gridOrder
    );

    // Generate new 3D road ribbon, curbs, and gantry arch
    this.trackGroup = TrackGeometryGenerator.buildTrackMeshes(this.trackSpline);
    this.scene.add(this.trackGroup);

    this.spawnAtTrackStart(playerSpawnDist, playerLateralOffset);
  }

  private spawnAtTrackStart(distAhead = 0, lateralOffset = 0): void {
    const totalLength = this.trackSpline.totalLength;
    const t = totalLength > 0 ? (distAhead / totalLength) % 1.0 : 0;
    const startPoint = this.trackSpline.getPointAt(t);
    const startTangent = this.trackSpline.getTangentAt(t);

    // Apply lateral offset
    const normal = new THREE.Vector3(-startTangent.z, 0, startTangent.x).normalize();
    const spawnPos = startPoint.clone().addScaledVector(normal, lateralOffset);
    spawnPos.y = startPoint.y + 0.05;

    const heading = Math.atan2(-startTangent.x, -startTangent.z);

    this.vehiclePhysics = new VehiclePhysics(spawnPos, heading);
    this.cameraController.teleport(this.camera, this.vehiclePhysics.state);
  }

  private toggleGhost(): void {
    this.isGhostVisible = !this.isGhostVisible;
    this.ghostPlayback.setVisible(this.isGhostVisible);
    this.hudController.updateGhostBadge(this.isGhostVisible);
  }

  private promptQualifyingSession(): void {
    const track = this.seasonManager.currentTrack;
    this.hudController.showQualifyingModal(track, (mode) => {
      this.qualifyingMode = mode;
      if (mode === 'skip') {
        this.isQualifying = false;
        this.aiDriverManager.setVisible(true);
        const benchmarks = QualifyingManager.generateAIBenchmarks(track);
        const outcome = QualifyingManager.evaluateQualifying('skip', 0, benchmarks);
        this.currentGridOrder = outcome.gridOrder;
        this.loadTrack(this.seasonManager.currentRaceIndex, this.currentGridOrder);
      } else {
        // Start solo qualifying flying lap
        this.isQualifying = true;
        this.aiDriverManager.setVisible(false);
        this.loadTrack(this.seasonManager.currentRaceIndex);
      }
    });
  }

  private toggleStandingsModal(): void {
    if (this.hudController.isAnyModalOpen()) {
      this.hudController.hideStandingsModal();
    } else {
      this.hudController.showStandingsModal(
        this.seasonManager.standings,
        this.seasonManager.currentRaceIndex,
        this.seasonManager.totalRaces,
        () => {}
      );
    }
  }

  private restartRace(): void {
    if (this.seasonManager.consumeRestartToken()) {
      this.loadTrack(this.seasonManager.currentRaceIndex, this.currentGridOrder);
    } else {
      console.warn('Restart rejected: 0 seasonal tokens remaining');
    }
  }

  private cycleTrack(): void {
    const nextIdx = (this.seasonManager.currentRaceIndex + 1) % ALL_TRACKS.length;
    this.loadTrack(nextIdx);
  }

  private onRaceCompleted(): void {
    if (this.raceFinishedHandled) return;
    this.raceFinishedHandled = true;

    if (this.isQualifying) {
      // Qualifying lap completed: evaluate player time against AI benchmarks
      const playerLapTimeMs = (this.lapManager.state.bestLapTime ?? this.lapManager.state.currentLapTime) * 1000;
      const benchmarks = QualifyingManager.generateAIBenchmarks(this.seasonManager.currentTrack);
      const outcome = QualifyingManager.evaluateQualifying(
        this.qualifyingMode,
        playerLapTimeMs,
        benchmarks
      );

      this.currentGridOrder = outcome.gridOrder;
      this.isQualifying = false;
      this.aiDriverManager.setVisible(true);

      // Launch full 20-car race with player in earned starting grid slot!
      this.loadTrack(this.seasonManager.currentRaceIndex, this.currentGridOrder);
      return;
    }

    // Main 20-Car Grand Prix completed: compute official points and standing
    const currentSurface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);
    const playerProgress = this.lapManager.state.totalLaps + currentSurface.trackT;
    const playerBestLapMs = (this.lapManager.state.bestLapTime ?? 45.0) * 1000;

    const participants: RawRaceParticipant[] = [
      {
        id: 'player',
        name: 'Player (You)',
        team: 'Apex Slipstream GP',
        isPlayer: true,
        progress: playerProgress,
        raceTimeMs: Math.round(this.totalRaceElapsedSeconds * 1000),
        fastestLapMs: Math.round(playerBestLapMs),
        severeCrashes: this.severeCrashesThisRace
      },
      ...this.aiDriverManager.cars.map((ai) => ({
        id: ai.profile.id,
        name: ai.profile.name,
        team: ai.profile.team,
        isPlayer: false,
        progress: ai.lap + ai.splineT,
        raceTimeMs: Math.round(this.totalRaceElapsedSeconds * 1000 + (1.02 - ai.profile.skill) * 4000),
        fastestLapMs: Math.round(playerBestLapMs * (1.04 / ai.profile.skill)),
        severeCrashes: ai.isSpinningOut ? 1 : 0
      }))
    ];

    const finishes: DriverFinish[] = ChampionshipEngine.computeRaceFinishes(participants);
    const result = this.seasonManager.recordRaceResult(finishes);

    this.hudController.showResultsModal(
      finishes,
      () => {
        // Next Grand Prix handler
        if (result.isSeasonFinale) {
          this.hudController.showPodiumModal(result.trophy, () => {
            this.seasonManager.resetSeason();
            this.currentGridOrder = [];
            this.loadTrack(0);
          });
        } else {
          this.currentGridOrder = [];
          this.loadTrack(this.seasonManager.currentRaceIndex);
          this.promptQualifyingSession();
        }
      },
      () => {
        // View Full Standings handler
        this.hudController.showStandingsModal(
          result.updatedStandings,
          this.seasonManager.currentRaceIndex,
          this.seasonManager.totalRaces,
          () => {}
        );
      }
    );
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
    if (input.restartRequested) {
      this.restartRace();
    }
    if (input.standingsToggleRequested) {
      this.toggleStandingsModal();
    }
    if (input.ghostToggleRequested) {
      this.toggleGhost();
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
      this.totalRaceElapsedSeconds += this.PHYSICS_STEP;

      if (!this.isQualifying) {
        // Advance all 19 AI drivers along track spline
        this.aiDriverManager.update(this.PHYSICS_STEP, this.vehiclePhysics.state.position);

        // Resolve hybrid vehicle collisions (player vs AI, AI vs AI)
        const collisionEvent = this.collisionManager.resolveCollisions(
          this.vehiclePhysics,
          this.aiDriverManager.cars
        );
        if (collisionEvent && collisionEvent.type === 'severe') {
          this.severeCrashesThisRace++;
        }
      }

      // Record telemetry into 30Hz buffer
      this.ghostRecorder.update(this.PHYSICS_STEP, this.vehiclePhysics.state);

      // Evaluate surface physics
      currentSurface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);

      // Identify closest AI car ahead to evaluate forward slipstream drafting wake
      let nearestLeadPos: THREE.Vector3 | null = null;
      let nearestLeadHeading = 0;
      let minAheadDist = 28.0;

      if (!this.isQualifying) {
        for (let i = 0; i < this.aiDriverManager.cars.length; i++) {
          const ai = this.aiDriverManager.cars[i];
          if (!ai) continue;
          const dx = ai.position.x - this.vehiclePhysics.state.position.x;
          const dz = ai.position.z - this.vehiclePhysics.state.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < minAheadDist) {
            minAheadDist = dist;
            nearestLeadPos = ai.position;
            nearestLeadHeading = ai.heading;
          }
        }
      }

      this.latestSlipstream = this.slipstreamManager.update(
        this.vehiclePhysics.state.position,
        this.vehiclePhysics.state.heading,
        this.vehiclePhysics.state.speedKmh,
        nearestLeadPos,
        nearestLeadHeading,
        this.PHYSICS_STEP
      );

      // Calculate real-time race position rank across all 20 cars
      if (!this.isQualifying) {
        let rank = 1;
        const playerScore = this.lapManager.state.currentLap * 1000 + currentSurface.trackT * 1000;
        for (let i = 0; i < this.aiDriverManager.cars.length; i++) {
          const ai = this.aiDriverManager.cars[i];
          if (!ai) continue;
          const aiScore = ai.lap * 1000 + ai.splineT * 1000;
          if (aiScore > playerScore) {
            rank++;
          }
        }
        this.playerRank = rank;
      }

      // Combine terrain surface modifiers with active tactical tire compound
      const baseSurfaceGrip = currentSurface.gripMultiplier;
      const tireGrip = getTireCompoundGrip(this.activeTire, currentSurface.surface);
      const tireDrag = getTireDragMultiplier(this.activeTire, currentSurface.surface);

      const effectiveGrip = baseSurfaceGrip * tireGrip;
      const effectiveDrag = currentSurface.dragMultiplier * tireDrag;

      // Update vehicle physics with slipstream boost and track elevation
      this.vehiclePhysics.update(
        this.PHYSICS_STEP,
        input,
        { grip: effectiveGrip, drag: effectiveDrag },
        this.latestSlipstream.boostFactor,
        currentSurface.trackElevation
      );

      // Update lap manager
      this.lapManager.update(
        this.vehiclePhysics.state.position,
        this.vehiclePhysics.state.velocity,
        this.PHYSICS_STEP
      );

      if (this.lapManager.state.isRaceCompleted) {
        this.onRaceCompleted();
      }

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

    // 4. Update Ghost Playback and Hologram Mesh
    const ghostSample = this.ghostPlayback.update(this.lapManager.state.currentLapTime);
    let ghostDeltaSeconds: number | null = null;

    if (this.ghostPlayback.hasGhost && this.ghostPlayback.visible && ghostSample) {
      const playerPos = this.vehiclePhysics.state.position;
      const ghostPos = ghostSample.position;
      const dx = playerPos.x - ghostPos.x;
      const dz = playerPos.z - ghostPos.z;
      const dist = Math.hypot(dx, dz);
      const speedMs = Math.max(10.0, (this.vehiclePhysics.state.speedKmh * 1000) / 3600);
      const timeOffset = dist / speedMs;

      // Compare progress along spline
      const playerT = currentSurface.trackT;
      const ghostSurface = this.trackSpline.evaluateSurface(ghostPos);
      let tDiff = playerT - ghostSurface.trackT;
      if (tDiff > 0.5) tDiff -= 1.0;
      if (tDiff < -0.5) tDiff += 1.0;

      ghostDeltaSeconds = tDiff >= 0 ? -timeOffset : timeOffset;
    }

    this.hudController.updateGhostTelemetry(
      this.ghostPlayback.hasGhost,
      this.isGhostVisible,
      ghostDeltaSeconds
    );

    // 5. Synchronize 3D Car Visuals with Physics State
    const state = this.vehiclePhysics.state;
    this.carGroup.position.copy(state.position);
    this.carGroup.rotation.y = state.heading;

    // Road slope pitch & cornering roll
    const trackTangent = this.trackSpline.getTangentAt(currentSurface.trackT, this._scratchTangent);
    const slopePitch = Math.atan2(trackTangent.y, Math.hypot(trackTangent.x, trackTangent.z));
    this.carGroup.rotation.x = slopePitch;

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

    // 6. Update Aerodynamic Wind Streamlines
    this.windStreamlines.update(
      state.position,
      state.heading,
      state.speedKmh,
      this.latestSlipstream.inWake,
      this.latestSlipstream.isBoostActive,
      clampedDelta
    );

    // 7. Update Procedural Web Audio Engine
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

    // 8. Update HUD Telemetry
    this.hudController.update(
      state,
      this.cameraController.currentMode,
      this.lapManager.state,
      currentSurface,
      this.trackSpline.data.name,
      this.latestSlipstream,
      this.activeTire,
      this.audioEngine.isMuted(),
      this.playerRank,
      this.seasonManager.restartTokensRemaining,
      this.seasonManager.currentRaceIndex,
      this.seasonManager.totalRaces,
      this.isQualifying
    );

    // 9. FPS & Pacing Telemetry
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

    // 10. Render Frame
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new ApexSlipstreamGame();
});
