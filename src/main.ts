// Fonts from docs/DESIGN.md, bundled with the game (SIL Open Font License); Latin set only
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import * as THREE from 'three';
import { InputManager, InputState } from './engine/InputManager';
import { CameraController } from './engine/CameraController';
import { HUDController } from './ui/HUDController';
import { SurfaceEvaluation } from './track/TrackSpline';
import { TrackGeometryGenerator } from './track/TrackGeometryGenerator';
import { ALL_TRACKS, dirtShare } from './track/TrackDefinitions';
import { countsForFastestLap } from './engine/RaceOrder';
import { nextTrackIndex, isPracticeTrack } from './engine/TrackSelection';
import { AudioEngine } from './audio/AudioEngine';
import { SeasonManager } from './engine/SeasonManager';
import { WindStreamlines } from './effects/WindStreamlines';
import { WeatherEffects } from './effects/WeatherEffects';
import { PracticeOptions, nextTyre } from './ui/PracticeOptions';
import { QuickRaceScreen } from './ui/QuickRaceScreen';
import { CareerManager } from './engine/CareerManager';
import { TimeTrialScreen } from './ui/TimeTrialScreen';
import { RecordsModel, RecordsScreen } from './ui/RecordsScreen';
import { ChampionshipsScreen, championshipRows } from './ui/ChampionshipsScreen';
import {
  activeChampionship,
  CHAMPIONSHIPS,
  isChampionshipUnlocked,
  loadActiveChampionshipId,
  saveActiveChampionshipId
} from './engine/Championships';
import { effectiveDifficulty } from './app/Unlocks';
import { GarageScreen } from './ui/GarageScreen';
import { pickRival, rivalLabel } from './engine/Rivals';
import { screenAfterInterruption, watchInterruptions } from './app/Interruptions';
import { KeyBindings, loadKeyBindings, saveKeyBindings } from './app/KeyBindings';
import { KeyBindingsPanel } from './ui/KeyBindingsPanel';
import {
  activeLivery,
  DriverProfile,
  fullName,
  loadDriverProfile,
  saveDriverProfile,
  shortName
} from './app/DriverProfile';
import { formatLapTime, TimeTrialSetup, timeTrialGrid, timeTrialTrack } from './app/TimeTrial';
import { defaultQuickRace, QuickRaceSetup, quickRaceGrid, quickRaceTrack } from './app/QuickRace';
import { forecastLabel } from './tires/TyreAdvice';
import { TireCompound, WeatherCondition } from './tires/TireTypes';
import { QualifyingManager, QualifyingMode } from './engine/QualifyingManager';
import { GhostStorage, isNewPersonalBest } from './storage/GhostStorage';
import { GhostRecorder } from './replay/GhostRecorder';
import { GhostPlayback } from './replay/GhostPlayback';
import { TouchController } from './ui/TouchController';
import { installErrorBanner, wireFullscreenButton, wireLandscapeLock, registerServiceWorker, onUserGestures } from './app/BrowserSetup';
import { RaceResultsFlow } from './app/RaceResultsFlow';
import { SaveBackupPanel } from './ui/SaveBackupPanel';
import { hideSplash } from './ui/Splash';
import {
  RACE,
  Session,
  canChangeTyresMidSession,
  canQualify,
  countsForSeason,
  isSolo,
  pauseSessionLabel,
  restartIsFree,
  sessionAfterLoad
} from './app/Session';
import { createRenderer, createScene, createCamera, createSkyReflection, SCENE_COLOURS } from './render/SceneSetup';
import { FrameRenderer, FrameState } from './render/FrameRenderer';
import { PlayerCarVisual } from './render/PlayerCarVisual';
import { loadRaceCarModel } from './render/GltfRaceCar';
import { ScreenFlow, Screen, quitToHubCost, restartLabel } from './app/ScreenFlow';
import { HubScreen, HubModel } from './ui/HubScreen';
import { PauseMenu } from './ui/PauseMenu';
import { SettingsScreen } from './ui/SettingsScreen';
import { motionReduced, GameSettings, loadSettings, saveSettings, VOLUME_LEVELS } from './app/Settings';
import { aiTyreFor, DIFFICULTY_LIMIT } from './ai/AIRacecraft';
import { TyreChoiceScreen } from './ui/TyreChoiceScreen';
import { qualifyingSummary } from './ui/ClassificationRows';
import { Forecast, forecastFor } from './tires/TyreAdvice';
import { StartLights } from './engine/StartLights';
import { SessionFinish } from './engine/SessionFinish';
import { TimingTowerView } from './ui/TimingTowerView';
import { MiniMap } from './ui/MiniMap';
import { PHYSICS_STEP, RaceWorld } from './engine/RaceWorld';

installErrorBanner();

class ApexSlipstreamGame {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Engine Subsystems
  private inputManager: InputManager;
  private cameraController: CameraController;
  private hudController: HUDController;
  private touchController: TouchController;
  private audioEngine: AudioEngine;
  /** The track, the cars and the physics step (P09-R02 step 2) */
  private readonly world: RaceWorld;
  private seasonManager: SeasonManager;
  private windStreamlines: WindStreamlines;
  /** Rain, spray, sky and wet road (R7 part 2) */
  private readonly weatherEffects = new WeatherEffects();
  /** The Quick Race being run (R8 part 5); null in the championship and in practice */
  /** The last Quick Race set up, offered again next time */
  private lastQuickRace: QuickRaceSetup = defaultQuickRace(0);
  private readonly quickRaceScreen = new QuickRaceScreen((setup) => this.startQuickRace(setup));
  /** Career XP and level, saved on this device (R9) */
  private readonly career = new CareerManager();
  private readonly recordsScreen = new RecordsScreen();
  /** Calmer camera and screens (Settings, R9 accessibility) */
  private reduceMotion = false;
  private readonly deviceReducedMotion =
    typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null : null;
  /** Your driving keys (Settings, R9 accessibility) */
  private keyBindings: KeyBindings = loadKeyBindings();
  private readonly keyBindingsPanel = new KeyBindingsPanel((bindings) => this.changeKeys(bindings));
  /** Your name, number and livery (R9 part 4) */
  private driver: DriverProfile = loadDriverProfile();
  private readonly garageScreen = new GarageScreen((profile) => this.changeDriver(profile));
  private readonly championshipsScreen = new ChampionshipsScreen((id) => this.chooseChampionship(id));
  /** Your rival this race (R9 part 5): null in practice, qualifying and time trials */
  private rivalId: string | null = null;
  /** The Time Trial being run (R8 part 6); null otherwise */
  private lastTimeTrial: TimeTrialSetup = { trackIndex: 0, tyre: 'street' };
  private readonly timeTrialScreen = new TimeTrialScreen(
    (setup) => this.startTimeTrial(setup),
    (trackIndex) => this.resetBestLap(trackIndex),
    (trackIndex) => aiTyreFor(ALL_TRACKS[trackIndex] ?? ALL_TRACKS[0]!, 'dry')
  );
  /** Time Trial's second ghost: your previous lap, in white */
  private readonly lastLapGhost = new GhostPlayback(SCENE_COLOURS.lastLapGhost);
  /** Weather chosen in the pause menu for practice races; null keeps the forecast */
  private practiceWeather: WeatherCondition | null = null;
  private readonly practiceOptions = new PracticeOptions(
    () => this.togglePracticeWeather(),
    () => this.changePracticeTyres(nextTyre(this.world.activeTire))
  );

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
  private trackGroup: THREE.Group | null = null;

  // 3D Vehicle Model
  private playerCar: PlayerCarVisual;

  // Screens (R3 part 3): the hub, a race, and the pause menu over a race
  private screens: ScreenFlow;
  private hubScreen: HubScreen;
  private pauseMenu: PauseMenu;
  private tyreScreen: TyreChoiceScreen;
  /** After the flag: results, points, XP and the season's podium (P09-R02 step 4) */
  private readonly resultsFlow: RaceResultsFlow;
  /** "Pole position · 1:02.45" after a qualifying run, shown on the tyre screen; null after Skip */
  private lastQualifyingSummary: string | null = null;
  /** Lights-out start (U-06): cars are held on the grid until the lights go out */
  private readonly startLights = new StartLights();
  private towerView: TimingTowerView;
  private miniMap: MiniMap;
  /** Everything drawn or heard each frame (P09-R02 step 3) */
  private readonly frameRenderer: FrameRenderer;
  /** This frame's game state for the renderer, refilled every frame (no allocations) */
  private readonly frameState: FrameState = {
    running: false,
    stepAlpha: 1,
    session: RACE,
    solo: false,
    reduceMotion: false,
    ghostVisible: true,
    onRaceScreen: false,
    round: 0,
    totalRaces: 0
  };

  // Championship & Qualifying Lifecycle
  /**
   * What is on track (P09-R02 step 1): one value instead of four flags kept in step by hand.
   * `quickRace`, `timeTrial`, `isQualifying` and `isPractice` below are read-only views of it.
   */
  private session: Session = RACE;
  private qualifyingMode: QualifyingMode = 'skip';
  private currentGridOrder: string[] = [];
  private raceFinishedHandled = false;
  /** The cool-down after the chequered flag, before the next screen */
  private readonly sessionFinish = new SessionFinish();
  /** How many start lights were lit at the last physics step, to beep as each comes on */
  private lightsLitBefore = 0;
  /** Index into ALL_TRACKS of the track on screen; differs from the season round in practice */
  private loadedTrackIndex = 0;
  /** The season round when the track was loaded: the HUD's "round" after the season moves on */
  private loadedRound = 0;

  // Fixed Timestep Accumulator Loop Constants
  private readonly MAX_ACCUMULATOR = 0.1; // 100ms clamp prevents spiral of death
  private accumulator = 0;
  private lastTime = 0;
  /** Bound once: binding every frame would allocate a new function per frame */
  private readonly boundGameLoop = (timestamp: number): void => this.gameLoop(timestamp);

  constructor() {
    const canvasElement = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvasElement) {
      throw new Error('Canvas element #game-canvas not found');
    }
    this.canvas = canvasElement;

    // 1. Renderer, scene (lights and terrain floor) and camera
    this.renderer = createRenderer(this.canvas);
    this.scene = createScene();
    this.camera = createCamera();

    // 2. Player car model
    this.playerCar = new PlayerCarVisual();
    this.scene.add(this.playerCar.group);

    // 7. Initialize Audio & Effects Subsystems
    this.audioEngine = new AudioEngine();
    // The championship you were racing, if your level still has it unlocked (R9)
    this.seasonManager = new SeasonManager(activeChampionship(loadActiveChampionshipId(), this.career.level));
    this.ghostRecorder = new GhostRecorder();
    // The track (the next round's, behind the hub), your car and the AI cars
    this.world = new RaceWorld(this.seasonManager.currentTrack, this.ghostRecorder);
    this.scene.add(this.world.aiDriverManager.group);

    // Milestone 7 Replay Subsystems
    this.ghostStorage = new GhostStorage();
    this.ghostPlayback = new GhostPlayback();
    this.scene.add(this.ghostPlayback.mesh);
    this.scene.add(this.lastLapGhost.mesh);

    this.windStreamlines = new WindStreamlines();
    this.scene.add(this.windStreamlines.mesh);
    this.scene.add(this.weatherEffects.group);
    this.weatherEffects.setSkyReflection(createSkyReflection(this.renderer));

    // 8. Initialize Subsystems (Input, Physics, Camera, HUD, Touch)
    this.touchController = new TouchController();
    this.inputManager = new InputManager(this.touchController);
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

    this.resultsFlow = new RaceResultsFlow(
      {
        world: this.world,
        hudController: this.hudController,
        season: () => this.seasonManager,
        career: this.career,
        audioEngine: this.audioEngine
      },
      {
        returnToHub: () => this.returnToHub(),
        rerunPractice: () => this.loadTrack(this.loadedTrackIndex),
        refreshAiDifficulty: () => this.world.aiDriverManager.setDifficultyLimit(this.aiDifficultyLimit)
      }
    );

    this.screens = new ScreenFlow('hub', (to) => this.onScreenChange(to));
    this.hubScreen = new HubScreen(
      () => this.startWeekend(),
      () => this.toggleStandingsModal(),
      () => this.settingsScreen.open(this.settings, this.career.level),
      () => this.quickRaceScreen.open(this.lastQuickRace),
      () => this.openTimeTrialSetup(),
      () => this.openRecords(),
      () => this.openChampionships(),
      () => this.garageScreen.open(this.driver, this.career.level)
    );
    this.towerView = new TimingTowerView();
    this.miniMap = new MiniMap();
    this.frameRenderer = new FrameRenderer({
      world: this.world,
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      cameraController: this.cameraController,
      playerCar: this.playerCar,
      windStreamlines: this.windStreamlines,
      weatherEffects: this.weatherEffects,
      audioEngine: this.audioEngine,
      hudController: this.hudController,
      towerView: this.towerView,
      miniMap: this.miniMap,
      startLights: this.startLights,
      ghostPlayback: this.ghostPlayback,
      lastLapGhost: this.lastLapGhost
    });
    this.tyreScreen = new TyreChoiceScreen(
      (compound) => this.selectTyre(compound),
      () => this.screens.go('racing'),
      () => this.returnToHub()
    );
    this.pauseMenu = new PauseMenu(
      () => this.resumeRace(),
      () => this.quitToHub(),
      () => this.screens.togglePause(),
      () => this.settingsScreen.open(this.settings, this.career.level)
    );
    // Settings → Your save: download or load the whole save (P07-R02)
    const saveBackup = new SaveBackupPanel(this.ghostStorage);
    this.settingsScreen = new SettingsScreen(
      (key, value) => this.changeSetting(key, value),
      () => saveBackup.reset()
    );

    wireFullscreenButton();
    // A phone held upright: offer to turn the game sideways where the browser allows it
    wireLandscapeLock();
    registerServiceWorker();

    // 9. Load the first track
    this.setupLapCompletedHook();
    this.loadTrack(this.seasonManager.currentTrackIndex);

    // 10. Web Audio may only start from a user gesture (pointer, keyboard, tap)
    onUserGestures(() => this.audioEngine.unlock());

    // The licensed race car (U-07) replaces the built-in one once it has loaded;
    // if it can't load, the built-in car stays
    void loadRaceCarModel().then((model) => {
      if (!model) return;
      this.playerCar.applyModel(model);
      this.world.aiDriverManager.applyModel(model);
    });

    // 11. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    // A call, a notification, switching apps, locking the screen, leaving the window or
    // turning the phone upright pauses a running race and silences the game (R9 part 6)
    watchInterruptions(
      () => this.onInterrupted(),
      () => {
        // Back from the background: no catch-up physics for the time away
        this.lastTime = performance.now();
        this.accumulator = 0;
      }
    );

    // The game opens on the hub, with the next round's track behind it
    // Saved settings apply from the first frame
    this.applySettings();
    // Auto reduce-motion follows the device setting if it changes while playing
    this.deviceReducedMotion?.addEventListener?.('change', () => this.applySettings());
    // Your driving keys (R9)
    this.inputManager.setBindings(this.keyBindings);
    this.keyBindingsPanel.show(this.keyBindings);
    // Your name and livery from the Garage (R9)
    this.applyDriver();
    this.onScreenChange(this.screens.current);
    // The hub is ready: the loading screen's logo goes once it has had its time
    hideSplash(this.reduceMotion);

    // 12. Start Main Loop
    // A handle for the browser tests and debugging, on the dev server only (P15-17)
    if (import.meta.env.DEV) (window as unknown as { __game?: ApexSlipstreamGame }).__game = this;
    this.lastTime = performance.now();
    requestAnimationFrame(this.boundGameLoop);
  }

  private setupLapCompletedHook(): void {
    // Leaving the grid behind the line (U-11): the ghost lap starts where the lap timer does
    this.world.lapManager.onStartLineCrossed = () => this.ghostRecorder.startLap();
    this.world.lapManager.onLapCompleted = (lapNumber, lapTime) => {
      // Race laps that count for the fastest-lap bonus, by the same rule as the AI (U-09)
      if (!this.isQualifying && countsForFastestLap(lapNumber, this.world.trackSpline.data.isClosed)) {
        const ms = lapTime * 1000;
        if (this.playerBestRaceLapMs === null || ms < this.playerBestRaceLapMs) {
          this.playerBestRaceLapMs = ms;
        }
      }

      const { data, sampleCount } = this.ghostRecorder.finishLap();
      // The track on screen, which differs from the season round in practice
      const trackId = this.world.trackSpline.data.id;
      const lapTimeMs = lapTime * 1000;

      // Time Trial: beating a best lap you had already set earns XP (R9)
      let ghostXp = '';
      if (sampleCount > 0) {
        // Compare with the PB saved for this track, not the lap timer's per-session best
        if (this.storedPbReady && isNewPersonalBest(lapTimeMs, this.storedPbLapMs)) {
          if (this.timeTrial && this.storedPbLapMs !== null) {
            const award = this.career.awardGhostBeat();
            ghostXp = ` · ghost beaten, +${award.gained} XP`;
          }
          this.storedPbLapMs = lapTimeMs;
          this.hudController.showPersonalBestAlert();
          this.ghostStorage.saveGhost(trackId, 'pb', lapTimeMs, data, sampleCount);
          this.ghostPlayback.loadGhost(data, sampleCount);
        }
        this.ghostStorage.saveGhost(trackId, 'previous', lapTimeMs, data, sampleCount);
        // Time Trial: this lap becomes the white ghost for the next one
        if (this.timeTrial) this.lastLapGhost.loadGhost(data, sampleCount);
      }
      if (this.timeTrial && lapNumber > 0) {
        this.hudController.showBanner(`Lap ${formatLapTime(lapTimeMs)}${ghostXp}`, 3000);
      }

      this.ghostRecorder.startLap();
    };
  }

  private loadTrack(index: number, gridOrder?: string[]): void {
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
      TrackGeometryGenerator.disposeTrackMeshes(this.trackGroup);
      this.trackGroup = null;
    }

    // A Quick Race runs its chosen track over its chosen laps
    const trackData = this.timeTrial
      ? timeTrialTrack(this.timeTrial)
      : this.quickRace
        ? quickRaceTrack(this.quickRace)
        : (ALL_TRACKS[index] ?? ALL_TRACKS[0]!);
    this.loadedTrackIndex = ALL_TRACKS[index] ? index : 0;
    this.loadedRound = this.seasonManager.currentRaceIndex;
    // The race runs in the forecast weather (R7), the AI on the tyres it recommends.
    // Practice can be switched to the other weather from the pause menu.
    const practiceRace = isPracticeTrack(this.loadedTrackIndex, this.seasonManager.currentTrackIndex);
    // A Time Trial is always dry, so best laps compare fairly
    const weather = this.timeTrial
      ? 'dry'
      : this.quickRace
      ? this.quickRace.weather
      : practiceRace && this.practiceWeather !== null
        ? this.practiceWeather
        : this.forecastForTrack(this.loadedTrackIndex).condition;
    // The track, the weather, a fresh lap count and race clock
    this.world.load(trackData, weather);
    this.miniMap.setTrack(this.world.trackSpline);
    this.hudController.setWeather(weather);
    this.weatherEffects.setWeather(weather, this.scene);
    // Every race start has the lights; solo qualifying and time trial runs start at once
    if (this.isSolo) {
      this.startLights.skip();
    } else {
      this.startLights.reset();
      this.lightsLitBefore = 0;
    }
    this.raceFinishedHandled = false;
    this.sessionFinish.cancel();
    // Decided when the track loads: recording a result moves the season on to the next
    // round, which must not turn the race just finished into "practice" on the HUD
    this.session = sessionAfterLoad(this.session, isPracticeTrack(this.loadedTrackIndex, this.seasonManager.currentTrackIndex));
    // Your rival: the driver just ahead of you in the championship, in races that count
    this.rivalId = this.isSolo || this.isPractice ? null : pickRival(this.seasonManager.standings);
    this.towerView.setRival(this.rivalId);

    // Load stored PB ghost replay and time for this track. Until it arrives, no lap may
    // claim a PB, so a quick first lap can't overwrite a stored ghost it never saw.
    this.storedPbReady = false;
    this.storedPbLapMs = null;
    this.playerBestRaceLapMs = null;
    this.ghostPlayback.clear();
    this.lastLapGhost.clear();
    const loadingTrackId = trackData.id;
    // Time Trial: your last lap here, from last time, until you set a new one
    if (this.timeTrial) {
      this.ghostStorage.getGhost(loadingTrackId, 'previous').then((record) => {
        if (this.world.trackSpline.data.id !== loadingTrackId || !this.timeTrial) return;
        if (record && record.sampleCount > 0) {
          this.lastLapGhost.loadGhost(new Float32Array(record.frameData), record.sampleCount);
        }
      });
    }
    this.ghostStorage.getGhost(loadingTrackId, 'pb').then((record) => {
      if (this.world.trackSpline.data.id !== loadingTrackId) return; // another track loaded meanwhile
      if (record && record.sampleCount > 0) {
        this.storedPbLapMs = record.lapTimeMs;
        this.ghostPlayback.loadGhost(new Float32Array(record.frameData), record.sampleCount);
      }
      this.storedPbReady = true;
    });

    this.ghostRecorder.startLap();

    // Generate new 3D road ribbon, curbs, and gantry arch
    this.trackGroup = TrackGeometryGenerator.buildTrackMeshes(
      this.world.trackSpline,
      this.isQualifying && this.qualifyingMode === 'sector_sprint' ? this.sectorSprintFinishT() : undefined
    );
    this.weatherEffects.applyToTrack(this.trackGroup);
    this.scene.add(this.trackGroup);

    // Every car on the grid, in the order given; the camera jumps to your car
    this.world.lineUp(gridOrder);
    this.cameraController.teleport(this.camera, this.world.vehiclePhysics.state);
    this.frameRenderer.refreshTowerNextFrame();
  }

  private toggleGhost(): void {
    this.isGhostVisible = !this.isGhostVisible;
    this.ghostPlayback.setVisible(this.isGhostVisible);
    this.lastLapGhost.setVisible(this.isGhostVisible);
    this.hudController.updateGhostBadge(this.isGhostVisible);
    this.rememberQuickToggles();
  }

  /**
   * Qualifying is part of a championship weekend (and practice, which is on the way to one).
   * From a Quick Race or Time Trial it would run on one track and grid on another (P09-R01).
   */
  private get canQualify(): boolean {
    return canQualify(this.session);
  }

  private promptQualifyingSession(): void {
    if (!this.canQualify) return;
    const track = this.seasonManager.currentTrack;
    this.hudController.showQualifyingModal(track, (mode) => {
      this.qualifyingMode = mode;
      if (mode === 'skip') {
        this.session = RACE;
        this.world.aiDriverManager.setVisible(true);
        const benchmarks = QualifyingManager.generateAIBenchmarks(
          track,
          1,
          this.aiDifficultyLimit,
          this.forecastForTrack(this.seasonManager.currentTrackIndex).condition
        );
        const outcome = QualifyingManager.evaluateQualifying('skip', 0, benchmarks);
        this.currentGridOrder = outcome.gridOrder;
        this.loadTrack(this.seasonManager.currentTrackIndex, this.currentGridOrder);
        // Straight to the grid: choose tyres, then the lights
        this.screens.go('grid');
      } else {
        // Start solo qualifying flying lap, from the hub or the pause menu
        this.session = { kind: 'qualifying' };
        this.world.aiDriverManager.setVisible(false);
        this.loadTrack(this.seasonManager.currentTrackIndex);
        this.screens.go('racing');
        // Say what this run is and where it ends: alone on track, it can look like the race
        const sprintKm = (this.sectorSprintFinishT() * this.world.trackSpline.totalLength) / 1000;
        this.hudController.showBanner(
          mode === 'sector_sprint'
            ? `Qualifying · sector 1 sprint, ${sprintKm.toFixed(1)} km to the gantry`
            : 'Qualifying · one flying lap, start line to start line',
          5000
        );
      }
      this.lastQualifyingSummary = null;
    });
  }

  /**
   * The forecast for track `index` this season: the weather of the round raced there, or for
   * a track outside the championship (practice), the weather keyed by its track index
   */
  private forecastForTrack(index: number): Forecast {
    const track = ALL_TRACKS[index] ?? ALL_TRACKS[0]!;
    return forecastFor(track, this.seasonManager.seasonId, this.seasonManager.roundOfTrack(index) ?? index);
  }

  /** Tyre choice before the race (R5): the race grid is lined up behind the screen. */
  private tyreChoiceModel(): Parameters<TyreChoiceScreen['show']>[0] {
    if (this.quickRace) {
      const track = this.world.trackSpline.data;
      const condition = this.quickRace.weather;
      return {
        title: `Quick race · ${track.name}`,
        gridLabel: `You start P${this.world.playerRank}`,
        forecast: { condition, label: forecastLabel(condition) },
        dirtShare: dirtShare(track),
        recommended: aiTyreFor(track, condition),
        selected: this.world.activeTire,
        qualifying: null
      };
    }
    const track = this.seasonManager.currentTrack;
    const round = `Round ${this.seasonManager.currentRaceIndex + 1} of ${this.seasonManager.totalRaces}`;
    const forecast = this.forecastForTrack(this.seasonManager.currentTrackIndex);
    return {
      title: `${round} · ${track.name}`,
      gridLabel: `You start P${this.world.playerRank}`,
      forecast,
      dirtShare: dirtShare(track),
      recommended: aiTyreFor(track, forecast.condition),
      selected: this.world.activeTire,
      qualifying: this.lastQualifyingSummary
    };
  }

  private selectTyre(compound: TireCompound): void {
    this.world.activeTire = compound;
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
      this.resultsFlow.showSeasonEndIfDue();
    } else {
      this.hubScreen.hide();
    }

    // The route map's size, read once as the race screen opens (not every frame, P15-09)
    if (to === 'racing') this.miniMap.refreshSize();

    if (to === 'grid') {
      this.tyreScreen.show(this.tyreChoiceModel());
    } else {
      this.tyreScreen.hide();
    }

    if (to === 'paused') {
      const lap = this.world.lapManager.state;
      this.pauseMenu.show({
        sessionLabel: pauseSessionLabel(this.session, lap.currentLap, lap.totalLaps),
        quitCost: quitToHubCost(this.isChampionshipRace, this.seasonManager.restartTokensRemaining),
        canQualify: this.canQualify,
        restartLabel: restartLabel(this.restartIsFree, this.seasonManager.restartTokensRemaining)
      });
      this.practiceOptions.show(this.isPractice, this.world.raceWeather, this.world.activeTire);
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
    this.lastLapGhost.setVisible(s.ghost);
    this.hudController.updateGhostBadge(s.ghost);
    this.audioEngine.setMuted(!s.sound);
    this.audioEngine.setVolume(VOLUME_LEVELS[s.volume]);
    this.hudController.setUnits(s.units);
    this.world.aiDriverManager.setDifficultyLimit(this.aiDifficultyLimit);
    this.applyGraphics(s.graphics);
    this.reduceMotion = motionReduced(s.reduceMotion, this.deviceReducedMotion?.matches ?? false);
    document.documentElement.classList.toggle('reduce-motion', this.reduceMotion);
    this.playerCar.setLean(!this.reduceMotion);
    this.frameRenderer.setFpsVisible(s.showFps);
  }

  /** The AI's share of the car's limit: your difficulty, if your level has unlocked it (R9) */
  private get aiDifficultyLimit(): number {
    return DIFFICULTY_LIMIT[effectiveDifficulty(this.settings.difficulty, this.career.level)];
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
    this.weatherEffects.setQuality(high);
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
      championshipName: this.seasonManager.championship.name,
      round: this.seasonManager.currentRaceIndex + 1,
      totalRaces: this.seasonManager.totalRaces,
      trackName: track.name,
      laps: track.laps,
      isCircuit: track.isClosed,
      forecast: this.forecastForTrack(this.seasonManager.currentTrackIndex).label,
      level: this.career.level,
      playerName: shortName(this.driver),
      rival: this.hubRivalLabel(),
      standings: this.seasonManager.standings,
      restartTokens: this.seasonManager.restartTokensRemaining
    };
  }

  /** The Quick Race being raced, or null */
  private get quickRace(): QuickRaceSetup | null {
    return this.session.kind === 'quick' ? this.session.setup : null;
  }

  /** The Time Trial being run, or null */
  private get timeTrial(): TimeTrialSetup | null {
    return this.session.kind === 'timeTrial' ? this.session.setup : null;
  }

  private get isQualifying(): boolean {
    return this.session.kind === 'qualifying';
  }

  /** True during a race that counts for the championship (not qualifying, not practice) */
  private get isChampionshipRace(): boolean {
    return countsForSeason(this.session);
  }

  /** Alone on track, with no AI: qualifying or a time trial */
  private get isSolo(): boolean {
    return isSolo(this.session);
  }

  /** Hub "Time trial": the setup, with your best lap on every track */
  private openTimeTrialSetup(): void {
    this.timeTrialScreen.open(this.lastTimeTrial, ALL_TRACKS.map(() => null));
    Promise.all(ALL_TRACKS.map((track) => this.ghostStorage.getGhost(track.id, 'pb'))).then((records) => {
      this.timeTrialScreen.setBests(records.map((record) => (record && record.sampleCount > 0 ? record.lapTimeMs : null)));
    });
  }

  /** New driving keys from Settings: saved and used at once */
  private changeKeys(bindings: KeyBindings): void {
    this.keyBindings = bindings;
    saveKeyBindings(bindings);
    this.inputManager.setBindings(bindings);
    this.keyBindingsPanel.show(bindings);
  }

  /** Play was interrupted: pause a running race and stop the sound until the next tap */
  private onInterrupted(): void {
    const next = screenAfterInterruption(this.screens.current);
    if (next !== this.screens.current) this.screens.go(next);
    this.audioEngine.suspend();
  }

  /** A Garage change: saved at once, and shown on the car and in the tables */
  private changeDriver(profile: DriverProfile): void {
    this.driver = profile;
    saveDriverProfile(profile);
    this.applyDriver();
  }

  /** Puts your name and livery into effect (on start, after a change, after a level-up) */
  private applyDriver(): void {
    const livery = activeLivery(this.driver, this.career.level);
    this.playerCar.setLivery(livery.body, livery.accent);
    this.towerView.setPlayerName(shortName(this.driver));
    this.hudController.setPlayerName(fullName(this.driver));
    if (this.hubScreen.isVisible) this.hubScreen.show(this.hubModel());
  }

  /** The hub's rival: who is just ahead of you now, and your record against them */
  private hubRivalLabel(): string {
    const rivalId = pickRival(this.seasonManager.standings);
    return rivalId ? rivalLabel(rivalId, this.career.headToHead(rivalId)) : '—';
  }

  /** Hub "Championships": every championship, locked ones with the level they need (R9) */
  private openChampionships(): void {
    this.championshipsScreen.open(
      championshipRows(this.career.level, this.seasonManager.championship.id, (championship) => {
        const season =
          championship.id === this.seasonManager.championship.id ? this.seasonManager : new SeasonManager(championship);
        return { round: season.currentRaceIndex, totalRaces: season.totalRaces };
      })
    );
  }

  /** Races `id` from now on: its own season, where you left it */
  private chooseChampionship(id: string): void {
    const championship = CHAMPIONSHIPS.find((c) => c.id === id);
    if (!championship || !isChampionshipUnlocked(championship, this.career.level)) return;
    saveActiveChampionshipId(championship.id);
    if (championship.id === this.seasonManager.championship.id) return;
    this.seasonManager = new SeasonManager(championship);
    this.returnToHub();
  }

  /** Hub "Records": career, trophies, and your best lap and finish on every track (R9) */
  private openRecords(): void {
    const model: RecordsModel = {
      level: this.career.level,
      xp: this.career.xp,
      stats: { ...this.career.stats },
      bestLaps: ALL_TRACKS.map(() => null),
      bestFinishes: ALL_TRACKS.map((track) => this.career.bestFinish(track.id)),
      rivalries: this.career.rivalries()
    };
    this.recordsScreen.open(model);
    Promise.all(ALL_TRACKS.map((track) => this.ghostStorage.getGhost(track.id, 'pb'))).then((records) => {
      model.bestLaps = records.map((record) => (record && record.sampleCount > 0 ? record.lapTimeMs : null));
      this.recordsScreen.update(model);
    });
  }

  /** Deletes your best lap and last lap on a track (Time Trial setup, after a second tap) */
  private resetBestLap(trackIndex: number): void {
    const track = ALL_TRACKS[trackIndex];
    if (!track) return;
    void this.ghostStorage.clearGhost(track.id, 'pb');
    void this.ghostStorage.clearGhost(track.id, 'previous');
  }

  /**
   * Time Trial (R8 part 6): alone on the chosen track in the dry, from pole with no start
   * lights, lapping until you stop. Your best lap and last lap ride along as ghosts.
   */
  private startTimeTrial(setup: TimeTrialSetup): void {
    this.lastTimeTrial = setup;
    this.session = { kind: 'timeTrial', setup };
    this.selectTyre(setup.tyre);
    this.world.aiDriverManager.setVisible(false);
    this.currentGridOrder = timeTrialGrid();
    this.loadTrack(setup.trackIndex, this.currentGridOrder);
    this.screens.go('racing');
    this.hudController.showBanner(`Time trial · ${this.world.trackSpline.data.name}`, 4000);
  }

  /**
   * Quick Race (R8 part 5): line up the chosen race on the hub's track and go to the tyre
   * choice. It runs like a championship race but never counts for the season.
   */
  private startQuickRace(setup: QuickRaceSetup): void {
    this.lastQuickRace = setup;
    this.session = { kind: 'quick', setup };
    this.lastQualifyingSummary = null;
    this.world.aiDriverManager.setVisible(true);
    this.currentGridOrder = quickRaceGrid();
    this.loadTrack(setup.trackIndex, this.currentGridOrder);
    this.screens.go('grid');
  }

  /** Hub "Start weekend": choose a qualifying session, which then starts on the round's track */
  private startWeekend(): void {
    // Never race a finished season's last round again
    if (this.seasonManager.isSeasonCompleted) {
      this.resultsFlow.showSeasonEnd();
      return;
    }
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
    this.session = RACE;
    this.world.aiDriverManager.setVisible(true);
    this.currentGridOrder = [];
    this.loadTrack(this.seasonManager.currentTrackIndex);
    if (!this.screens.go('hub')) {
      this.hubScreen.show(this.hubModel());
      this.resultsFlow.showSeasonEndIfDue();
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
    return this.session.kind === 'practice';
  }

  /** Practice only: rain if it is dry, dry if it is raining; the practice race restarts */
  private togglePracticeWeather(): void {
    if (!this.isPractice) return;
    this.practiceWeather = this.world.raceWeather === 'wet' ? 'dry' : 'wet';
    this.loadTrack(this.loadedTrackIndex);
    this.resumeRace();
  }

  /** Practice only: race on other tyres; the practice race restarts */
  private changePracticeTyres(compound: TireCompound): void {
    if (!canChangeTyresMidSession(this.session)) return;
    this.selectTyre(compound);
    if (this.timeTrial) this.session = { kind: 'timeTrial', setup: { ...this.timeTrial, tyre: compound } };
    this.loadTrack(this.loadedTrackIndex, this.timeTrial ? this.currentGridOrder : undefined);
    this.resumeRace();
  }

  /** A restart costs a season token only in a championship weekend (Time Trial, Quick Race and practice are free) */
  private get restartIsFree(): boolean {
    return restartIsFree(this.session);
  }

  private restartRace(): void {
    if (this.timeTrial) {
      // A Time Trial run restarts free, from pole
      this.loadTrack(this.timeTrial.trackIndex, this.currentGridOrder);
      return;
    }
    if (this.quickRace) {
      // A Quick Race restarts free, on the same grid
      this.loadTrack(this.quickRace.trackIndex, this.currentGridOrder);
      return;
    }
    if (this.isPractice) {
      // Practice restarts are free: they never touch season tokens
      this.loadTrack(this.loadedTrackIndex);
      return;
    }
    if (this.seasonManager.consumeRestartToken()) {
      this.loadTrack(this.seasonManager.currentTrackIndex, this.currentGridOrder);
    } else {
      console.warn('Restart rejected: 0 seasonal tokens remaining');
    }
  }

  private cycleTrack(): void {
    const nextIdx = nextTrackIndex(this.loadedTrackIndex, ALL_TRACKS.length);
    // The track button leaves a Quick Race for practice
    if (this.quickRace || this.timeTrial) this.currentGridOrder = [];
    // Practice is a full-grid race; leave any Quick Race, Time Trial or qualifying lap.
    // Loading the track decides between practice and the season's race.
    this.session = RACE;
    this.world.aiDriverManager.setVisible(true);
    if (nextIdx === this.seasonManager.currentTrackIndex) {
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
    this.session = RACE;
    const distanceFraction = this.qualifyingMode === 'sector_sprint' ? this.sectorSprintFinishT() : 1;
    const benchmarks = QualifyingManager.generateAIBenchmarks(
      this.seasonManager.currentTrack,
      distanceFraction,
      this.aiDifficultyLimit,
      this.world.raceWeather
    );
    const outcome = QualifyingManager.evaluateQualifying(this.qualifyingMode, playerTimeMs, benchmarks);

    this.currentGridOrder = outcome.gridOrder;
    this.world.aiDriverManager.setVisible(true);
    this.hudController.showQualifyingResult(outcome);
    this.lastQualifyingSummary = qualifyingSummary(outcome);

    // Line up the full 20-car race with the player in the earned grid slot
    this.loadTrack(this.seasonManager.currentTrackIndex, this.currentGridOrder);
    this.screens.go('grid');
  }

  /** Where the sector sprint ends: the first sector 2 gate, as a share of the lap */
  private sectorSprintFinishT(): number {
    return this.world.trackSpline.checkpoints.find((cp) => cp.sector === 2)?.t ?? 1 / 3;
  }

  /** The player took the flag: classified now, results after the cool-down */
  private onRaceCompleted(): void {
    if (this.raceFinishedHandled) return;
    this.raceFinishedHandled = true;
    if (this.timeTrial) {
      // A sprint time trial run is over: show the time, then go again from the start
      const runMs = (this.world.lapManager.state.lastLapTime ?? this.world.totalRaceElapsedSeconds) * 1000;
      this.hudController.showBanner(`Run ${formatLapTime(runMs)} · again from the start`, SessionFinish.COOL_DOWN_SECONDS * 1000);
      this.sessionFinish.begin(() => this.restartRace());
      return;
    }
    this.world.playerFinishTime = this.world.totalRaceElapsedSeconds;
    this.hudController.showBanner(
      this.isPractice ? 'Chequered flag · practice over' : `Chequered flag · you finish P${this.world.playerRank}`,
      SessionFinish.COOL_DOWN_SECONDS * 1000
    );
    this.sessionFinish.begin(() => this.showRaceResults());
  }

  /** Results, points and XP for the race just finished (RaceResultsFlow) */
  private showRaceResults(): void {
    this.resultsFlow.show({ session: this.session, rivalId: this.rivalId, bestLapMs: this.playerBestRaceLapMs });
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
      } else if (this.quickRaceScreen.isOpen) {
        this.quickRaceScreen.close();
      } else if (this.timeTrialScreen.isOpen) {
        this.timeTrialScreen.close();
      } else if (this.recordsScreen.isOpen) {
        this.recordsScreen.close();
      } else if (this.championshipsScreen.isOpen) {
        this.championshipsScreen.close();
      } else if (this.garageScreen.isOpen) {
        this.garageScreen.close();
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
    let currentSurface = this.world.trackSpline.evaluateSurface(this.world.vehiclePhysics.state.position);
    if (this.screens.isSimulating) {
      while (this.accumulator >= PHYSICS_STEP) {
        // While the start lights run, every car is held on the grid and no race time passes
        if (!this.startLights.isHolding) {
          currentSurface = this.simulateStep(input);
        }
        // A step can end the session (qualifying done: on to the tyre choice); stop there
        if (!this.screens.isSimulating) {
          this.accumulator = 0;
          break;
        }
        this.startLights.step(PHYSICS_STEP);
        this.beepForStartLights();
        this.accumulator -= PHYSICS_STEP;
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
    // Tyre keys work on the grid (handleGridInput): tyres are fixed for a race (R5).
    // In practice they change tyres and restart the practice race.
    if (input.tireSelectRequested !== null && canChangeTyresMidSession(this.session)) {
      const compounds: readonly TireCompound[] = ['street', 'all_terrain', 'wet'];
      const compound = compounds[input.tireSelectRequested - 1];
      if (compound) this.changePracticeTyres(compound);
    }
  }

  /**
   * One fixed physics step for the race (RaceWorld), then the end of the session.
   * Returns the surface under the player car, measured before it moved.
   */
  private simulateStep(input: InputState): SurfaceEvaluation {
    // After the flag the car rolls on under light braking until the next screen
    if (this.sessionFinish.isActive) {
      this.sessionFinish.coast(input);
    }
    const surface = this.world.step(input, this.isSolo);

    if (this.isQualifying) {
      const sessionMs = QualifyingManager.sessionTimeMs(this.qualifyingMode, this.world.lapManager.state);
      if (sessionMs !== null && !this.sessionFinish.isActive) {
        this.hudController.showBanner('Chequered flag · qualifying done', SessionFinish.COOL_DOWN_SECONDS * 1000);
        this.sessionFinish.begin(() => this.onQualifyingCompleted(sessionMs));
      }
    } else if (this.world.lapManager.state.isRaceCompleted) {
      this.onRaceCompleted();
    }
    // Runs the next screen once the cool-down after the flag is over
    this.sessionFinish.step(PHYSICS_STEP);

    return surface;
  }

  /** Everything drawn or heard this frame (FrameRenderer). Changes no race state. */
  private drawFrame(input: InputState, currentSurface: SurfaceEvaluation, frameDelta: number): void {
    const frame = this.frameState;
    frame.running = this.screens.isSimulating && !this.startLights.isHolding;
    frame.stepAlpha = frame.running ? this.accumulator / PHYSICS_STEP : 1;
    frame.session = this.session;
    frame.solo = this.isSolo;
    frame.reduceMotion = this.reduceMotion;
    frame.ghostVisible = this.isGhostVisible;
    frame.onRaceScreen = this.screens.current === 'racing';
    frame.round = this.loadedRound;
    frame.totalRaces = this.seasonManager.totalRaces;
    this.frameRenderer.draw(input, currentSurface, frameDelta, frame);
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new ApexSlipstreamGame();
});
