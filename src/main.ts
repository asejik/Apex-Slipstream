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
import { RaceProgress, countsForFastestLap, playerLapFraction } from './engine/RaceOrder';
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
import { createRenderer, createScene, createCamera, followWithSun } from './render/SceneSetup';
import { PlayerCarVisual } from './render/PlayerCarVisual';
import { loadRaceCarModel } from './render/GltfRaceCar';
import { ScreenFlow, Screen, quitToHubCost } from './app/ScreenFlow';
import { HubScreen, HubModel } from './ui/HubScreen';
import { PauseMenu } from './ui/PauseMenu';
import { SettingsScreen } from './ui/SettingsScreen';
import { AI_PACE_KMH, GameSettings, loadSettings, saveSettings, VOLUME_LEVELS } from './app/Settings';
import { TyreChoiceScreen } from './ui/TyreChoiceScreen';
import { qualifyingSummary } from './ui/ClassificationRows';
import { forecastFor } from './tires/TyreAdvice';
import { StartLights } from './engine/StartLights';
import { StartLightsView } from './ui/StartLightsView';
import { TimingTower } from './engine/TimingTower';
import { TimingTowerView } from './ui/TimingTowerView';
import { MiniMap } from './ui/MiniMap';
import { offsetToSplineT } from './ai/AIDriverManager';

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
  /** Player settings, saved on this device (R5) */
  private settings: GameSettings = loadSettings();
  private settingsScreen: SettingsScreen;
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
  private tyreScreen: TyreChoiceScreen;
  /** "Pole position · 1:02.45" after a qualifying run, shown on the tyre screen; null after Skip */
  private lastQualifyingSummary: string | null = null;
  /** Lights-out start (U-06): cars are held on the grid until the lights go out */
  private readonly startLights = new StartLights();
  private startLightsView: StartLightsView;
  /** Race HUD timing tower (R5): cars around the player, refreshed TOWER_REFRESH_SECONDS apart */
  private readonly timingTower = new TimingTower();
  private towerView: TimingTowerView;
  private miniMap: MiniMap;
  private towerTimer = 0;
  private static readonly TOWER_REFRESH_SECONDS = 0.25;

  // Championship & Qualifying Lifecycle
  private isQualifying = false;
  private qualifyingMode: QualifyingMode = 'skip';
  private currentGridOrder: string[] = [];
  private raceFinishedHandled = false;
  /** Race time when the player finished; null while racing. Keeps the live position right after the flag */
  private playerFinishTime: number | null = null;
  private loadedAsPractice = false;
  /** How many start lights were lit at the last physics step, to beep as each comes on */
  private lightsLitBefore = 0;
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
      () => { this.cameraController.toggleMode(); this.rememberQuickToggles(); },
      () => { this.cycleTrack(); this.resumeRace(); },
      () => { this.audioEngine.toggleMute(); this.rememberQuickToggles(); },
      () => { this.restartRace(); this.resumeRace(); },
      () => this.toggleStandingsModal(),
      () => this.promptQualifyingSession(),
      () => this.toggleGhost()
    );

    this.screens = new ScreenFlow('hub', (to) => this.onScreenChange(to));
    this.hubScreen = new HubScreen(
      () => this.startWeekend(),
      () => this.toggleStandingsModal(),
      () => this.settingsScreen.open(this.settings)
    );
    this.startLightsView = new StartLightsView();
    this.towerView = new TimingTowerView();
    this.miniMap = new MiniMap();
    this.tyreScreen = new TyreChoiceScreen(
      (compound) => this.selectTyre(compound),
      () => this.screens.go('racing'),
      () => this.returnToHub()
    );
    this.pauseMenu = new PauseMenu(
      () => this.resumeRace(),
      () => this.quitToHub(),
      () => this.screens.togglePause(),
      () => this.settingsScreen.open(this.settings)
    );
    this.settingsScreen = new SettingsScreen(
      (key, value) => this.changeSetting(key, value),
      () => {}
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

    // The licensed race car (U-07) replaces the built-in one once it has loaded;
    // if it can't load, the built-in car stays
    void loadRaceCarModel().then((model) => {
      if (!model) return;
      this.playerCar.applyModel(model);
      this.aiDriverManager.applyModel(model);
    });

    // 11. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    // A call, a notification or switching apps pauses the race
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screens.current === 'racing') {
        this.screens.go('paused');
      }
    });

    // The game opens on the hub, with the next round's track behind it
    // Saved settings apply from the first frame
    this.applySettings();
    this.onScreenChange(this.screens.current);

    // 12. Start Main Loop
    (window as unknown as { __game?: ApexSlipstreamGame }).__game = this;
    this.lastTime = performance.now();
    requestAnimationFrame(this.boundGameLoop);
  }

  private setupLapCompletedHook(): void {
    // Leaving the grid behind the line (U-11): the ghost lap starts where the lap timer does
    this.lapManager.onStartLineCrossed = () => this.ghostRecorder.startLap();
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
    this.miniMap.setTrack(this.trackSpline);
    this.lapManager.reset(this.trackSpline);
    this.slipstreamManager.reset();
    // Every race start has the lights; solo qualifying runs start at once
    if (this.isQualifying) {
      this.startLights.skip();
    } else {
      this.startLights.reset();
      this.lightsLitBefore = 0;
    }
    this.raceFinishedHandled = false;
    this.playerFinishTime = null;
    // Decided when the track loads: recording a result moves the season on to the next
    // round, which must not turn the race just finished into "practice" on the HUD
    this.loadedAsPractice = isPracticeTrack(this.loadedTrackIndex, this.seasonManager.currentRaceIndex);
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

    // Race order on the grid, so the HUD is right while the start lights hold everyone
    this._playerProgress.completedLaps = this.lapManager.isBeforeStartLine ? -1 : 0;
    this._playerProgress.lapFraction = this.trackSpline.findClosestT(this.vehiclePhysics.state.position).t;
    this._playerProgress.finishTime = null;
    this.playerRank = livePosition(
      this._playerProgress,
      this.aiDriverManager.cars,
      this.lapManager.state.totalLaps,
      this._aiProgress
    );
    this.towerTimer = ApexSlipstreamGame.TOWER_REFRESH_SECONDS; // refresh on the next frame
  }

  private spawnAtTrackStart(distAhead = 0, lateralOffset = 0): void {
    const totalLength = this.trackSpline.totalLength;
    // Negative distances are grid slots behind the start line (U-11)
    const t = offsetToSplineT(distAhead, totalLength);
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
    this.rememberQuickToggles();
  }

  private promptQualifyingSession(): void {
    const track = this.seasonManager.currentTrack;
    this.hudController.showQualifyingModal(track, (mode) => {
      this.qualifyingMode = mode;
      if (mode === 'skip') {
        this.isQualifying = false;
        this.aiDriverManager.setVisible(true);
        const benchmarks = QualifyingManager.generateAIBenchmarks(track, 1, AI_PACE_KMH[this.settings.difficulty]);
        const outcome = QualifyingManager.evaluateQualifying('skip', 0, benchmarks);
        this.currentGridOrder = outcome.gridOrder;
        this.loadTrack(this.seasonManager.currentRaceIndex, this.currentGridOrder);
        // Straight to the grid: choose tyres, then the lights
        this.screens.go('grid');
      } else {
        // Start solo qualifying flying lap, from the hub or the pause menu
        this.isQualifying = true;
        this.aiDriverManager.setVisible(false);
        this.loadTrack(this.seasonManager.currentRaceIndex);
        this.screens.go('racing');
        // Say what this run is: alone on track, it can look like the race itself
        this.hudController.showBanner(
          mode === 'sector_sprint' ? 'Qualifying · sector 1 sprint' : 'Qualifying · one flying lap',
          4000
        );
      }
      this.lastQualifyingSummary = null;
    });
  }

  /** Tyre choice before the race (R5): the race grid is lined up behind the screen. */
  private tyreChoiceModel(): Parameters<TyreChoiceScreen['show']>[0] {
    const track = this.seasonManager.currentTrack;
    const round = `Round ${this.seasonManager.currentRaceIndex + 1} of ${this.seasonManager.totalRaces}`;
    return {
      title: `${round} · ${track.name}`,
      gridLabel: `You start P${this.playerRank}`,
      forecast: forecastFor(track),
      selected: this.activeTire,
      qualifying: this.lastQualifyingSummary
    };
  }

  private selectTyre(compound: TireCompound): void {
    this.activeTire = compound;
    this.tyreScreen.setSelected(compound);
  }

  /** On the grid only the tyre keys work: 1 Street, 2 All-terrain, 3 Wet. Tyres are fixed once racing. */
  private handleGridInput(input: InputState): void {
    if (input.tireSelectRequested === 1) this.selectTyre('street');
    else if (input.tireSelectRequested === 2) this.selectTyre('all_terrain');
    else if (input.tireSelectRequested === 3) this.selectTyre('wet');
  }

  // ---------------------------------------------------------------------------
  // Screens (R3 part 3)
  // ---------------------------------------------------------------------------

  private onScreenChange(to: Screen): void {
    const app = document.getElementById('app');
    if (app) app.dataset.screen = to;
    // Car sounds only while a race is running: the hub, tyre screen and pause menu are silent
    this.audioEngine.setActive(to === 'racing');

    if (to === 'hub') {
      this.hubScreen.show(this.hubModel());
    } else {
      this.hubScreen.hide();
    }

    if (to === 'grid') {
      this.tyreScreen.show(this.tyreChoiceModel());
    } else {
      this.tyreScreen.hide();
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

  // ---------------------------------------------------------------------------
  // Settings (R5)
  // ---------------------------------------------------------------------------

  private changeSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.settings[key] = value;
    saveSettings(this.settings);
    this.applySettings();
    this.settingsScreen.show(this.settings);
  }

  /** Puts every setting into effect. Cheap enough to run on each change. */
  private applySettings(): void {
    const s = this.settings;
    this.cameraController.setMode(s.camera);
    this.isGhostVisible = s.ghost;
    this.ghostPlayback.setVisible(s.ghost);
    this.hudController.updateGhostBadge(s.ghost);
    this.audioEngine.setMuted(!s.sound);
    this.audioEngine.setVolume(VOLUME_LEVELS[s.volume]);
    this.hudController.setUnits(s.units);
    this.aiDriverManager.setPace(AI_PACE_KMH[s.difficulty]);
    this.applyGraphics(s.graphics);
    if (this.fpsElement) this.fpsElement.hidden = !s.showFps;
  }

  private appliedGraphics: GameSettings['graphics'] | null = null;

  /** High: shadows and up to 2x pixel density. Low: no shadows, 1x, for slower phones. */
  private applyGraphics(level: GameSettings['graphics']): void {
    if (level === this.appliedGraphics) return;
    this.appliedGraphics = level;
    const high = level === 'high';
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = high;
    // Materials compile their shadow code once; they must rebuild after the switch
    this.scene.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (Array.isArray(material)) material.forEach((m) => (m.needsUpdate = true));
      else if (material) material.needsUpdate = true;
    });
  }

  /** Camera, ghost and sound changed in the pause menu or by key are kept as settings too. */
  private rememberQuickToggles(): void {
    this.settings.camera = this.cameraController.currentMode;
    this.settings.ghost = this.isGhostVisible;
    this.settings.sound = !this.audioEngine.isMuted();
    saveSettings(this.settings);
    if (this.settingsScreen.isOpen) this.settingsScreen.show(this.settings);
  }

  /** A beep as each start light comes on, and a higher, longer one when they go out. */
  private beepForStartLights(): void {
    const lit = this.startLights.litCount;
    if (lit > this.lightsLitBefore) {
      this.audioEngine.beep(440, 0.15);
    } else if (lit === 0 && this.lightsLitBefore > 0) {
      this.audioEngine.beep(880, 0.6);
    }
    this.lightsLitBefore = lit;
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
        this.seasonManager.raceHistory.length,
        this.seasonManager.totalRaces,
        () => {}
      );
    }
  }

  /** True while the track button has loaded a track other than the season round */
  private get isPractice(): boolean {
    return this.loadedAsPractice;
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

  /**
   * Qualifying run finished: place the player against AI times over the same distance,
   * line up the race grid in that order, then choose tyres
   */
  private onQualifyingCompleted(playerTimeMs: number): void {
    this.isQualifying = false;
    const distanceFraction =
      this.qualifyingMode === 'sector_sprint'
        ? (this.trackSpline.checkpoints.find((cp) => cp.sector === 2)?.t ?? 1 / 3)
        : 1;
    const benchmarks = QualifyingManager.generateAIBenchmarks(
      this.seasonManager.currentTrack,
      distanceFraction,
      AI_PACE_KMH[this.settings.difficulty]
    );
    const outcome = QualifyingManager.evaluateQualifying(this.qualifyingMode, playerTimeMs, benchmarks);

    this.currentGridOrder = outcome.gridOrder;
    this.aiDriverManager.setVisible(true);
    this.hudController.showQualifyingResult(outcome);
    this.lastQualifyingSummary = qualifyingSummary(outcome);

    // Line up the full 20-car race with the player in the earned grid slot
    this.loadTrack(this.seasonManager.currentRaceIndex, this.currentGridOrder);
    this.screens.go('grid');
  }

  private onRaceCompleted(): void {
    if (this.raceFinishedHandled) return;
    this.raceFinishedHandled = true;
    this.playerFinishTime = this.totalRaceElapsedSeconds;
    // The engine falls silent at the flag: the results screens are quiet
    this.audioEngine.setActive(false);

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
    // The track just raced: recording the result moves the season on to the next round
    const trackName = this.trackSpline.data.name;
    const result = this.seasonManager.recordRaceResult(finishes);

    const showResults = (): void => {
      this.hudController.showResultsModal(
        finishes,
        trackName,
        () => {
          // Next race: back to the hub, which shows the updated standings
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
          // Standings, then back to these results (not left stranded on the track)
          this.hudController.showStandingsModal(
            result.updatedStandings,
            this.seasonManager.raceHistory.length,
            this.seasonManager.totalRaces,
            showResults
          );
        }
      );
    };
    showResults();
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
    // Never negative: a timestamp from behind the last one (mixed clocks) would make the
    // camera's smoothing run backwards and throw it off the track for good
    const frameDelta = Math.max(0, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    const clampedDelta = Math.min(frameDelta, this.MAX_ACCUMULATOR);
    this.accumulator += clampedDelta;

    // 1. Input. Race shortcuts do nothing on the hub; Esc or P pauses unless a modal is open
    const input = this.inputManager.getInputState();
    if (input.pauseToggleRequested) {
      // Esc closes Settings first; otherwise it pauses, unless a modal is open
      if (this.settingsScreen.isOpen) {
        this.settingsScreen.close();
      } else if (!this.hudController.isAnyModalOpen()) {
        this.screens.togglePause();
      }
    }
    if (this.screens.current === 'grid') {
      this.handleGridInput(input);
    } else if (this.screens.current !== 'hub') {
      this.handleInputRequests(input);
    }

    // 2. Fixed Timestep Physics Simulation Loop (60Hz). Only a running race moves;
    // on the hub and while paused nothing builds up, so resuming never jumps ahead.
    let currentSurface = this.trackSpline.evaluateSurface(this.vehiclePhysics.state.position);
    if (this.screens.isSimulating) {
      while (this.accumulator >= this.PHYSICS_STEP) {
        // While the start lights run, every car is held on the grid and no race time passes
        if (!this.startLights.isHolding) {
          currentSurface = this.simulateStep(input);
        }
        // A step can end the session (qualifying done: on to the tyre choice); stop there
        if (!this.screens.isSimulating) {
          this.accumulator = 0;
          break;
        }
        this.startLights.step(this.PHYSICS_STEP);
        this.beepForStartLights();
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
      this.rememberQuickToggles();
    }
    if (input.trackToggleRequested) {
      this.cycleTrack();
      this.resumeRace();
    }
    if (input.audioToggleRequested) {
      this.audioEngine.toggleMute();
      this.rememberQuickToggles();
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
    // Tyre keys only work on the grid (handleGridInput): tyres are fixed for the race (R5)
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
      // On the grid behind the line the player has not started lap 1 yet, like the AI (lap 0)
      this._playerProgress.completedLaps = this.lapManager.isBeforeStartLine
        ? -1
        : this.lapManager.state.currentLap - 1;
      this._playerProgress.lapFraction = playerLapFraction(
        surface.trackT,
        this.lapManager.state.checkpointProgress,
        this.lapManager.isBeforeStartLine
      );
      // Once you have taken the flag you are classified by your finish time (it used to
      // drop you to P20, because your lap counter stops while the others keep lapping)
      this._playerProgress.finishTime = this.playerFinishTime;
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
    const running = this.screens.isSimulating && !this.startLights.isHolding;
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
    followWithSun(this.scene, renderPose.position);

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

    // Timing tower, a few times a second; solo qualifying has no field to show
    this.towerTimer += frameDelta;
    if (this.towerTimer >= ApexSlipstreamGame.TOWER_REFRESH_SECONDS) {
      this.towerTimer = 0;
      // Qualifying keeps the tower up with its "Qualifying" header, so the session is clear
      if (this.isQualifying) {
        this.towerView.clearRows();
      } else {
        this.timingTower.update(
          this._playerProgress,
          state.speedKmh,
          this.aiDriverManager.cars,
          this.trackSpline.totalLength
        );
        this.towerView.update(this.timingTower);
      }
    }

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
      // The round on track: after a race the season has already moved on to the next one
      this.loadedAsPractice ? this.seasonManager.currentRaceIndex : this.loadedTrackIndex,
      this.seasonManager.totalRaces,
      this.isQualifying,
      this.isPractice
    );

    this.startLightsView.update(this.startLights.litCount, this.startLights.isVisible);
    if (this.screens.current === 'racing') {
      this.miniMap.update(renderPose.position, this.isQualifying ? null : this.aiDriverManager.cars);
    }
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
