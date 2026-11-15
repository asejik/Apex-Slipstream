// Fonts from docs/DESIGN.md, bundled with the game (SIL Open Font License); Latin set only
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import * as THREE from 'three';
import { InputManager, InputState } from './engine/InputManager';
import { VehiclePhysics } from './engine/VehiclePhysics';
import { CameraController } from './engine/CameraController';
import { RenderPose } from './engine/RenderPose';
import { BarrierCollider } from './track/TrackBarriers';
import { HUDController } from './ui/HUDController';
import { TrackSpline, SurfaceEvaluation } from './track/TrackSpline';
import { TrackGeometryGenerator } from './track/TrackGeometryGenerator';
import { ALL_TRACKS } from './track/TrackDefinitions';
import { LapManager } from './engine/LapManager';
import { RaceProgress, countsForFastestLap } from './engine/RaceOrder';
import { buildRaceParticipants, livePosition } from './engine/RaceResults';
import { nextTrackIndex, isPracticeTrack } from './engine/TrackSelection';
import { AudioEngine } from './audio/AudioEngine';
import { SlipstreamManager, SlipstreamState } from './engine/SlipstreamManager';
import { AIDriverManager } from './ai/AIDriverManager';
import { CollisionManager } from './engine/CollisionManager';
import { SeasonManager } from './engine/SeasonManager';
import { WindStreamlines } from './effects/WindStreamlines';
import { TireCompound, getTireCompoundGrip, getTireDragMultiplier } from './tires/TireTypes';
import { QualifyingManager, QualifyingMode } from './engine/QualifyingManager';
import { ChampionshipEngine, DriverFinish } from './engine/ChampionshipEngine';
import { GhostStorage, isNewPersonalBest } from './storage/GhostStorage';
import { GhostRecorder } from './replay/GhostRecorder';
import { GhostPlayback } from './replay/GhostPlayback';
import { TouchController } from './ui/TouchController';
import { installErrorBanner, wireFullscreenButton, registerServiceWorker, onFirstUserGesture } from './app/BrowserSetup';
import { createRenderer, createScene, createCamera } from './render/SceneSetup';
import { PlayerCarVisual } from './render/PlayerCarVisual';
import { ScreenFlow, Screen, quitToHubCost } from './app/ScreenFlow';
import { HubScreen, HubModel } from './ui/HubScreen';
import { PauseMenu } from './ui/PauseMenu';

installErrorBanner();

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
  // Scratch race-progress records reused every physics step (zero allocations)
  private readonly _playerProgress: RaceProgress = { completedLaps: 0, lapFraction: 0, finishTime: null };
  private readonly _aiProgress: RaceProgress = { completedLaps: 0, lapFraction: 0, finishTime: null };

  // Milestone 7 Subsystems (Ghost Time Trial)
  private ghostStorage: GhostStorage;
  private ghostRecorder: GhostRecorder;
  private ghostPlayback: GhostPlayback;
  private isGhostVisible = true;
  /** Lap time of the PB ghost saved for the loaded track; null when none is stored */
  private storedPbLapMs: number | null = null;
  /** False until the stored PB for the loaded track has been read from storage */
  private storedPbReady = false;
  /** Player's fastest lap this race that counts for the fastest-lap bonus (U-09); null if none */
  private playerBestRaceLapMs: number | null = null;

  // Track Subsystems
  private trackSpline: TrackSpline;
  private lapManager: LapManager;
  private trackGroup: THREE.Group | null = null;

  // 3D Vehicle Model
  private playerCar: PlayerCarVisual;

  // Screens (R3 part 3): the hub, a race, and the pause menu over a race
  private screens: ScreenFlow;
  private hubScreen: HubScreen;
  private pauseMenu: PauseMenu;

  // Championship & Qualifying Lifecycle
  private isQualifying = false;
  private qualifyingMode: QualifyingMode = 'skip';
  private currentGridOrder: string[] = [];
  private raceFinishedHandled = false;
  /** Index into ALL_TRACKS of the track on screen; differs from the season round in practice */
  private loadedTrackIndex = 0;
  private severeCrashesThisRace = 0;
  private totalRaceElapsedSeconds = 0;

  // Fixed Timestep Accumulator Loop Constants
  private readonly PHYSICS_STEP = 1 / 60; // 16.666ms
  private readonly MAX_ACCUMULATOR = 0.1; // 100ms clamp prevents spiral of death
  private accumulator = 0;
  private readonly playerRenderPose = new RenderPose();
  private readonly barrierCollider = new BarrierCollider();
  private lastTime = 0;
  /** Bound once: binding every frame would allocate a new function per frame */
  private readonly boundGameLoop = (timestamp: number): void => this.gameLoop(timestamp);

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

  private _scratchTangent = new THREE.Vector3();

  constructor() {
    const canvasElement = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvasElement) {
      throw new Error('Canvas element #game-canvas not found');
    }
    this.canvas = canvasElement;
    this.fpsElement = document.getElementById('fps-counter');

    // 1. Renderer, scene (lights and terrain floor) and camera
    this.renderer = createRenderer(this.canvas);
    this.scene = createScene();
    this.camera = createCamera();

    // 2. Player car model
    this.playerCar = new PlayerCarVisual();
    this.scene.add(this.playerCar.group);

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
    // The track and restart buttons now sit in the pause menu: acting on them resumes the race
    this.hudController = new HUDController(
      () => this.cameraController.toggleMode(),
      () => { this.cycleTrack(); this.resumeRace(); },
      () => this.audioEngine.toggleMute(),
      (compound) => { this.activeTire = compound; },
      () => { this.restartRace(); this.resumeRace(); },
      () => this.toggleStandingsModal(),
      () => this.promptQualifyingSession(),
      () => this.toggleGhost()
    );

    this.screens = new ScreenFlow('hub', (to) => this.onScreenChange(to));
    this.hubScreen = new HubScreen(
      () => this.startWeekend(),
      () => this.toggleStandingsModal()
    );
    this.pauseMenu = new PauseMenu(
      () => this.resumeRace(),
      () => this.quitToHub(),
      () => this.screens.togglePause()
    );

    wireFullscreenButton();
    registerServiceWorker();

    // 9. Initialize Track Spline & Load Initial Track
    const initialTrackData = this.seasonManager.currentTrack;
    this.trackSpline = new TrackSpline(initialTrackData);
    this.lapManager = new LapManager(this.trackSpline);
    this.setupLapCompletedHook();
    this.loadTrack(this.seasonManager.currentRaceIndex);

    // 10. Web Audio may only start from a user gesture (pointer, keyboard, tap)
    onFirstUserGesture(() => this.audioEngine.unlock());

    // 11. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    // A call, a notification or switching apps pauses the race
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screens.current === 'racing') {
        this.screens.go('paused');
      }
    });

    // The game opens on the hub, with the next round's track behind it
    this.onScreenChange(this.screens.current);

    // 12. Start Main Loop
    (window as unknown as { __game?: ApexSlipstreamGame }).__game = this;
    this.lastTime = performance.now();
    requestAnimationFrame(this.boundGameLoop);
  }

  private setupLapCompletedHook(): void {
    this.lapManager.onLapCompleted = (lapNumber, lapTime) => {
      // Race laps that count for the fastest-lap bonus, by the same rule as the AI (U-09)
      if (!this.isQualifying && countsForFastestLap(lapNumber, this.trackSpline.data.isClosed)) {
        const ms = lapTime * 1000;
        if (this.playerBestRaceLapMs === null || ms < this.playerBestRaceLapMs) {
          this.playerBestRaceLapMs = ms;
        }
      }

      const { data, sampleCount } = this.ghostRecorder.finishLap();
      // The track on screen, which differs from the season round in practice
      const trackId = this.trackSpline.data.id;
      const lapTimeMs = lapTime * 1000;

      if (sampleCount > 0) {
        // Compare with the PB saved for this track, not the lap timer's per-session best
        if (this.storedPbReady && isNewPersonalBest(lapTimeMs, this.storedPbLapMs)) {
          this.storedPbLapMs = lapTimeMs;
          this.hudController.showPersonalBestAlert();
          this.ghostStorage.saveGhost(trackId, 'pb', lapTimeMs, data, sampleCount);
          this.ghostPlayback.loadGhost(data, sampleCount);
        }
        this.ghostStorage.saveGhost(trackId, 'previous', lapTimeMs, data, sampleCount);
      }

      this.ghostRecorder.startLap();
    };
  }

  private loadTrack(index: number, gridOrder?: string[]): void {
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
    }

    const trackData = ALL_TRACKS[index] ?? ALL_TRACKS[0]!;
    this.loadedTrackIndex = ALL_TRACKS[index] ? index : 0;
    this.trackSpline = new TrackSpline(trackData);
    this.lapManager.reset(this.trackSpline);
    this.slipstreamManager.reset();
    this.raceFinishedHandled = false;
    this.severeCrashesThisRace = 0;
    this.totalRaceElapsedSeconds = 0;

    // Load stored PB ghost replay and time for this track. Until it arrives, no lap may
    // claim a PB, so a quick first lap can't overwrite a stored ghost it never saw.
    this.storedPbReady = false;
    this.storedPbLapMs = null;
    this.playerBestRaceLapMs = null;
    this.ghostPlayback.clear();
    const loadingTrackId = trackData.id;
    this.ghostStorage.getGhost(loadingTrackId, 'pb').then((record) => {
      if (this.trackSpline.data.id !== loadingTrackId) return; // another track loaded meanwhile
      if (record && record.sampleCount > 0) {
        this.storedPbLapMs = record.lapTimeMs;
        this.ghostPlayback.loadGhost(new Float32Array(record.frameData), record.sampleCount);
      }
      this.storedPbReady = true;
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
    // Grid slots can sit past the first checkpoints; start lap counting from the real spawn point
    this.lapManager.setStartPosition(this.vehiclePhysics.state.position);
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
      // From the hub or the pause menu, the session starts now
      this.screens.go('racing');
    });
  }

  // ---------------------------------------------------------------------------
  // Screens (R3 part 3)
  // ---------------------------------------------------------------------------

  private onScreenChange(to: Screen): void {
    const app = document.getElementById('app');
    if (app) app.dataset.screen = to;

    if (to === 'hub') {
      this.hubScreen.show(this.hubModel());
    } else {
      this.hubScreen.hide();
    }

    if (to === 'paused') {
      const lap = this.lapManager.state;
      this.pauseMenu.show({
        sessionLabel: this.isQualifying
          ? 'Qualifying'
          : this.isPractice
          ? 'Practice'
          : `Lap ${Math.min(lap.currentLap, lap.totalLaps)}/${lap.totalLaps}`,
        quitCost: quitToHubCost(this.isChampionshipRace, this.seasonManager.restartTokensRemaining)
      });
    } else {
      this.pauseMenu.hide();
    }
  }

  private hubModel(): HubModel {
    const track = this.seasonManager.currentTrack;
    return {
      round: this.seasonManager.currentRaceIndex + 1,
      totalRaces: this.seasonManager.totalRaces,
      trackName: track.name,
      laps: track.laps,
      isCircuit: track.isClosed,
      standings: this.seasonManager.standings,
      restartTokens: this.seasonManager.restartTokensRemaining
    };
  }

  /** True during a race that counts for the championship (not qualifying, not practice) */
  private get isChampionshipRace(): boolean {
    return !this.isQualifying && !this.isPractice;
  }

  /** Hub "Start weekend": choose a qualifying session, which then starts on the round's track */
  private startWeekend(): void {
    this.hubScreen.hide();
    this.promptQualifyingSession();
  }

  private resumeRace(): void {
    if (this.screens.current === 'paused') {
      this.screens.go('racing');
    }
  }

  /** Pause menu "Quit to hub". A championship race costs a restart token (see quitToHubCost). */
  private quitToHub(): void {
    const cost = quitToHubCost(this.isChampionshipRace, this.seasonManager.restartTokensRemaining);
    if (cost === 'blocked') return;
    if (cost === 'token' && !this.seasonManager.consumeRestartToken()) return;
    this.returnToHub();
  }

  /** Lines up the season's next round behind the hub and shows it */
  private returnToHub(): void {
    this.isQualifying = false;
    this.aiDriverManager.setVisible(true);
    this.currentGridOrder = [];
    this.loadTrack(this.seasonManager.currentRaceIndex);
    if (!this.screens.go('hub')) {
      this.hubScreen.show(this.hubModel());
    }
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

  /** True while the track button has loaded a track other than the season round */
  private get isPractice(): boolean {
    return isPracticeTrack(this.loadedTrackIndex, this.seasonManager.currentRaceIndex);
  }

  private restartRace(): void {
    if (this.isPractice) {
      // Practice restarts are free: they never touch season tokens
      this.loadTrack(this.loadedTrackIndex);
      return;
    }
    if (this.seasonManager.consumeRestartToken()) {
      this.loadTrack(this.seasonManager.currentRaceIndex, this.currentGridOrder);
    } else {
      console.warn('Restart rejected: 0 seasonal tokens remaining');
    }
  }

  private cycleTrack(): void {
    const nextIdx = nextTrackIndex(this.loadedTrackIndex, ALL_TRACKS.length);
    // Practice is a full-grid race; leave any qualifying lap in progress
    this.isQualifying = false;
    this.aiDriverManager.setVisible(true);
    if (nextIdx === this.seasonManager.currentRaceIndex) {
      // Back round to the championship round, on the grid earned in qualifying
      this.loadTrack(nextIdx, this.currentGridOrder);
    } else {
      this.loadTrack(nextIdx);
    }
  }

  /** Qualifying run finished: place the player against AI times over the same distance, then start the race */
  private onQualifyingCompleted(playerTimeMs: number): void {
    this.isQualifying = false;
    const distanceFraction =
      this.qualifyingMode === 'sector_sprint'
        ? (this.trackSpline.checkpoints.find((cp) => cp.sector === 2)?.t ?? 1 / 3)
        : 1;
    const benchmarks = QualifyingManager.generateAIBenchmarks(this.seasonManager.currentTrack, distanceFraction);
    const outcome = QualifyingManager.evaluateQualifying(this.qualifyingMode, playerTimeMs, benchmarks);

    this.currentGridOrder = outcome.gridOrder;
    this.aiDriverManager.setVisible(true);
    this.hudController.showQualifyingResult(outcome);

    // Launch the full 20-car race with the player in the earned grid slot
    this.loadTrack(this.seasonManager.currentRaceIndex, this.currentGridOrder);
  }

  private onRaceCompleted(): void {
    if (this.raceFinishedHandled) return;
    this.raceFinishedHandled = true;

    if (this.isPractice) {
      // Practice results never count toward the season: line up again on the same track
      this.loadTrack(this.loadedTrackIndex);
      return;
    }

    // Main 20-Car Grand Prix completed: compute official points and standing
    const participants = buildRaceParticipants(
      {
        finishTimeSeconds: this.totalRaceElapsedSeconds,
        bestLapMs: this.playerBestRaceLapMs,
        severeCrashes: this.severeCrashesThisRace
      },
      this.aiDriverManager.cars,
      this.lapManager.state.totalLaps
    );

    const finishes: DriverFinish[] = ChampionshipEngine.computeRaceFinishes(participants);
    const result = this.seasonManager.recordRaceResult(finishes);

    this.hudController.showResultsModal(
      finishes,
      () => {
        // Next Grand Prix handler: back to the hub, which shows the updated standings
        if (result.isSeasonFinale) {
          this.hudController.showPodiumModal(result.trophy, () => {
            this.seasonManager.resetSeason();
            this.returnToHub();
          });
        } else {
          this.returnToHub();
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

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /** One drawn frame: read input, run the fixed physics steps due, then draw. */
  private gameLoop(timestamp: number): void {
    const frameDelta = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    const clampedDelta = Math.min(frameDelta, this.MAX_ACCUMULATOR);
    this.accumulator += clampedDelta;

    // 1. Input. Race shortcuts do nothing on the hub; Esc or P pauses unless a modal is open
    const input = this.inputManager.getInputState();
    if (input.pauseToggleRequested && !this.hudController.isAnyModalOpen()) {
      this.screens.togglePause();
    }
    if (this.screens.current !== 'hub') {
      this.handleInputRequests(input);
    }

    // 2. Fixed Timestep Physics Simulation Loop (60Hz). Only a running race moves;
    // on the hub and while paused nothing builds up, so resuming never jumps ahead.
    let currentSurface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);
    if (this.screens.isSimulating) {
      while (this.accumulator >= this.PHYSICS_STEP) {
        currentSurface = this.simulateStep(input);
        this.accumulator -= this.PHYSICS_STEP;
      }
    } else {
      this.accumulator = 0;
    }

    // 3. Drawing, sound and HUD
    this.drawFrame(input, currentSurface, clampedDelta);
    requestAnimationFrame(this.boundGameLoop);
  }

  /** Acts on the one-shot button and key presses read this frame. */
  private handleInputRequests(input: InputState): void {
    if (input.cameraToggleRequested) {
      this.cameraController.toggleMode();
    }
    if (input.trackToggleRequested) {
      this.cycleTrack();
      this.resumeRace();
    }
    if (input.audioToggleRequested) {
      this.audioEngine.toggleMute();
    }
    if (input.restartRequested) {
      this.restartRace();
      this.resumeRace();
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
  }

  /**
   * One fixed physics step of PHYSICS_STEP seconds for every car, then lap and race
   * checks. Returns the surface under the player car, measured before it moved.
   */
  private simulateStep(input: InputState): SurfaceEvaluation {
    this.totalRaceElapsedSeconds += this.PHYSICS_STEP;
    this.playerRenderPose.savePrevious(
      this.vehiclePhysics.state.position,
      this.vehiclePhysics.state.heading
    );

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
    const surface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);

    // Closest AI car, to evaluate the slipstream drafting wake
    const lead = this.isQualifying
      ? null
      : this.aiDriverManager.nearestCar(this.vehiclePhysics.state.position, 28.0);

    this.latestSlipstream = this.slipstreamManager.update(
      this.vehiclePhysics.state.position,
      this.vehiclePhysics.state.heading,
      this.vehiclePhysics.state.speedKmh,
      lead ? lead.position : null,
      lead ? lead.heading : 0,
      this.PHYSICS_STEP
    );

    // Calculate real-time race position rank across all 20 cars
    if (!this.isQualifying) {
      this._playerProgress.completedLaps = this.lapManager.state.currentLap - 1;
      this._playerProgress.lapFraction = surface.trackT;
      this._playerProgress.finishTime = null;
      this.playerRank = livePosition(
        this._playerProgress,
        this.aiDriverManager.cars,
        this.lapManager.state.totalLaps,
        this._aiProgress
      );
    }

    // Combine terrain surface modifiers with active tactical tire compound
    const baseSurfaceGrip = surface.gripMultiplier;
    const tireGrip = getTireCompoundGrip(this.activeTire, surface.surface);
    const tireDrag = getTireDragMultiplier(this.activeTire, surface.surface);

    const effectiveGrip = baseSurfaceGrip * tireGrip;
    const effectiveDrag = surface.dragMultiplier * tireDrag;

    // Update vehicle physics with slipstream boost and track elevation
    this.vehiclePhysics.update(
      this.PHYSICS_STEP,
      input,
      { grip: effectiveGrip, drag: effectiveDrag },
      this.latestSlipstream.boostFactor,
      surface.trackElevation
    );

    // Keep the car between the walls at the road edges (U-04)
    this.barrierCollider.resolve(
      this.trackSpline,
      surface.trackT,
      this.vehiclePhysics.state,
      this.PHYSICS_STEP
    );

    // Update lap manager
    this.lapManager.update(
      this.vehiclePhysics.state.position,
      this.vehiclePhysics.state.velocity,
      this.PHYSICS_STEP
    );

    if (this.isQualifying) {
      const sessionMs = QualifyingManager.sessionTimeMs(this.qualifyingMode, this.lapManager.state);
      if (sessionMs !== null) {
        this.onQualifyingCompleted(sessionMs);
      }
    } else if (this.lapManager.state.isRaceCompleted) {
      this.onRaceCompleted();
    }

    return surface;
  }

  /** Everything drawn or heard this frame. Changes no race state. */
  private drawFrame(input: InputState, currentSurface: SurfaceEvaluation, frameDelta: number): void {
    // Camera FOV pulses with the slipstream
    const targetFov = this.latestSlipstream.isBoostActive
      ? 64
      : this.latestSlipstream.inWake
      ? 61
      : 58;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 5.0 * frameDelta);
    this.camera.updateProjectionMatrix();

    // Draw the cars between physics steps so motion is smooth at any refresh rate (U-03).
    // When the race is not running (hub, paused) they are drawn where they stand.
    const running = this.screens.isSimulating;
    const stepAlpha = running ? this.accumulator / this.PHYSICS_STEP : 1;
    const motionDelta = running ? frameDelta : 0;
    const renderPose = this.playerRenderPose;
    renderPose.sample(
      this.vehiclePhysics.state.position,
      this.vehiclePhysics.state.heading,
      stepAlpha
    );
    if (!this.isQualifying) {
      this.aiDriverManager.render(stepAlpha);
    }

    this.cameraController.update(this.camera, renderPose, frameDelta);

    // Ghost hologram and the time gap to it
    const ghostDeltaSeconds = this.updateGhost(currentSurface);
    this.hudController.updateGhostTelemetry(
      this.ghostPlayback.hasGhost,
      this.isGhostVisible,
      ghostDeltaSeconds
    );

    // Player car model
    const state = this.vehiclePhysics.state;
    const trackTangent = this.trackSpline.getTangentAt(currentSurface.trackT, this._scratchTangent);
    const slopePitch = Math.atan2(trackTangent.y, Math.hypot(trackTangent.x, trackTangent.z));
    this.playerCar.update(renderPose.position, renderPose.heading, state, slopePitch, motionDelta);

    // Aerodynamic wind streamlines
    this.windStreamlines.update(
      renderPose.position,
      renderPose.heading,
      state.speedKmh,
      this.latestSlipstream.inWake,
      this.latestSlipstream.isBoostActive,
      motionDelta
    );

    // Procedural Web Audio engine; the engine idles when the race is not running
    this.audioEngine.update({
      speedKmh: running ? state.speedKmh : 0,
      rpmRatio: running ? state.rpm : 0,
      throttle: running ? input.throttle : 0,
      driftIntensity: running ? state.driftFactor : 0,
      isDrafting: running && this.latestSlipstream.inWake,
      isDraftBoostActive: running && this.latestSlipstream.isBoostActive,
      isOnCurb: running && currentSurface.surface === 'curb',
      isOnGravel: running && currentSurface.surface === 'gravel'
    });

    // HUD telemetry
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
      this.isQualifying,
      this.isPractice
    );

    this.updateFpsCounter(frameDelta);

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Moves the ghost hologram to its place at the current lap time. Returns the gap to it
   * in seconds (negative = ahead of the ghost), or null when no ghost is shown.
   */
  private updateGhost(currentSurface: SurfaceEvaluation): number | null {
    const ghostSample = this.ghostPlayback.update(this.lapManager.state.currentLapTime);
    if (!this.ghostPlayback.hasGhost || !this.ghostPlayback.visible || !ghostSample) {
      return null;
    }

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

    return tDiff >= 0 ? -timeOffset : timeOffset;
  }

  /** FPS and pacing readout, refreshed twice a second. */
  private updateFpsCounter(frameDelta: number): void {
    this.frameCount++;
    this.fpsTimer += frameDelta;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.currentFps} | Physics: 60Hz Fixed | Compound: ${this.activeTire.toUpperCase()}`;
      }
    }
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new ApexSlipstreamGame();
});
