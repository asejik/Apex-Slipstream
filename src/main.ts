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
import { nextTrackIndex, isPracticeTrack } from './engine/TrackSelection';
import { AudioEngine } from './audio/AudioEngine';
import { SeasonManager } from './engine/SeasonManager';
import { WindStreamlines } from './effects/WindStreamlines';
import { WeatherEffects } from './effects/WeatherEffects';
import { PracticeOptions, nextTyre } from './ui/PracticeOptions';
import { CareerManager } from './engine/CareerManager';
import {
  activeChampionship,
  CHAMPIONSHIPS,
  isChampionshipUnlocked,
  loadActiveChampionshipId,
  saveActiveChampionshipId
} from './engine/Championships';
import { pickRival, rivalLabel } from './engine/Rivals';
import { screenAfterInterruption, watchInterruptions } from './app/Interruptions';
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
import { GhostStorage } from './storage/GhostStorage';
import { GhostRecorder } from './replay/GhostRecorder';
import { GhostPlayback } from './replay/GhostPlayback';
import { TouchController } from './ui/TouchController';
import { installErrorBanner, wireFullscreenButton, wireLandscapeLock, registerServiceWorker, onUserGestures } from './app/BrowserSetup';
import { RaceResultsFlow } from './app/RaceResultsFlow';
import { watchGraphicsReset } from './app/GraphicsRecovery';
import { Closeable, HubMenus, closeFirstOpen } from './app/HubMenus';
import { SettingsControl } from './app/SettingsControl';
import { GhostLaps } from './replay/GhostLaps';
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
import { aiTyreFor } from './ai/AIRacecraft';
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
  /** Career XP and level, saved on this device (R9) */
  private readonly career = new CareerManager();
  /** Your settings and driving keys (P09-R02 step 6) */
  private readonly settingsControl: SettingsControl;
  /** Your name, number and livery (R9 part 4) */
  private driver: DriverProfile = loadDriverProfile();
  /** The hub's own screens: setups, Records, Championships, Garage (P09-R02 step 5) */
  private readonly menus: HubMenus;
  /** What Esc closes, first open one first, before it pauses */
  private readonly escScreens: readonly Closeable[];
  /** Your rival this race (R9 part 5): null in practice, qualifying and time trials */
  private rivalId: string | null = null;
  /** The Time Trial being run (R8 part 6); null otherwise */
  private lastTimeTrial: TimeTrialSetup = { trackIndex: 0, tyre: 'street' };
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
  /** Your laps and their ghosts: recording, personal bests, showing them (P09-R02 step 6) */
  private readonly ghosts: GhostLaps;

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
    this.menus = new HubMenus(
      { career: this.career, ghostStorage: this.ghostStorage, season: () => this.seasonManager },
      {
        startQuickRace: (setup) => this.startQuickRace(setup),
        startTimeTrial: (setup) => this.startTimeTrial(setup),
        chooseChampionship: (id) => this.chooseChampionship(id),
        changeDriver: (profile) => this.changeDriver(profile)
      }
    );
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
      () => { this.cameraController.toggleMode(); this.settingsControl.rememberQuickToggles(); },
      () => { this.cycleTrack(); this.resumeRace(); },
      () => { this.audioEngine.toggleMute(); this.settingsControl.rememberQuickToggles(); },
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
        refreshAiDifficulty: () => this.world.aiDriverManager.setDifficultyLimit(this.settingsControl.aiDifficultyLimit)
      }
    );

    this.screens = new ScreenFlow('hub', (to) => this.onScreenChange(to));
    this.hubScreen = new HubScreen(
      () => this.startWeekend(),
      () => this.toggleStandingsModal(),
      () => this.settingsControl.open(),
      () => this.menus.openQuickRace(this.lastQuickRace),
      () => this.menus.openTimeTrial(this.lastTimeTrial),
      () => this.menus.openRecords(),
      () => this.menus.openChampionships(),
      () => this.menus.openGarage(this.driver)
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
      () => this.settingsControl.open()
    );
    this.ghosts = new GhostLaps({
      world: this.world,
      career: this.career,
      hudController: this.hudController,
      ghostStorage: this.ghostStorage,
      ghostRecorder: this.ghostRecorder,
      ghostPlayback: this.ghostPlayback,
      lastLapGhost: this.lastLapGhost,
      session: () => this.session
    });
    this.settingsControl = new SettingsControl({
      world: this.world,
      scene: this.scene,
      renderer: this.renderer,
      cameraController: this.cameraController,
      inputManager: this.inputManager,
      career: this.career,
      audioEngine: this.audioEngine,
      hudController: this.hudController,
      weatherEffects: this.weatherEffects,
      playerCar: this.playerCar,
      frameRenderer: this.frameRenderer,
      ghosts: this.ghosts,
      ghostStorage: this.ghostStorage,
      championshipName: () => this.seasonManager.championship.name,
      restartChampionship: () => this.restartChampionship()
    });
    // Esc closes Settings first, then whichever hub screen is open
    this.escScreens = [this.settingsControl.screen, ...this.menus.closeable];

    wireFullscreenButton();
    // A phone held upright: offer to turn the game sideways where the browser allows it
    wireLandscapeLock();
    registerServiceWorker();

    // 9. Load the first track
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
    // The phone can take the graphics away for a moment: pause, then rebuild (Decision 16)
    watchGraphicsReset(this.canvas, {
      onLost: () => this.onInterrupted(),
      onRestored: () => this.rebuildGraphics()
    });
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
    this.settingsControl.start();
    // Your name and livery from the Garage (R9)
    this.applyDriver();
    this.onScreenChange(this.screens.current);
    // The hub is ready: the loading screen's logo goes once it has had its time
    hideSplash(this.settingsControl.reduceMotion);

    // 12. Start Main Loop
    // A handle for the browser tests and debugging, on the dev server only (P15-17)
    if (import.meta.env.DEV) (window as unknown as { __game?: ApexSlipstreamGame }).__game = this;
    this.lastTime = performance.now();
    requestAnimationFrame(this.boundGameLoop);
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

    // This track's stored ghosts and best lap; a new ghost lap starts
    this.ghosts.loadFor(trackData.id);

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
    this.ghosts.setVisible(!this.ghosts.visible);
    this.settingsControl.rememberQuickToggles();
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
          this.settingsControl.aiDifficultyLimit,
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

  /** Play was interrupted: pause a running race and stop the sound until the next tap */
  private onInterrupted(): void {
    const next = screenAfterInterruption(this.screens.current);
    if (next !== this.screens.current) this.screens.go(next);
    this.audioEngine.suspend();
  }

  /**
   * The graphics are back after a reset. Three.js re-uploads meshes and textures itself; what
   * was drawn into a texture is gone, so the wet road's sky reflection is made again.
   */
  private rebuildGraphics(): void {
    this.weatherEffects.setSkyReflection(createSkyReflection(this.renderer));
    if (this.trackGroup) this.weatherEffects.applyToTrack(this.trackGroup);
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

  /** Races `id` from now on: its own season, where you left it */
  private chooseChampionship(id: string): void {
    const championship = CHAMPIONSHIPS.find((c) => c.id === id);
    if (!championship || !isChampionshipUnlocked(championship, this.career.level)) return;
    saveActiveChampionshipId(championship.id);
    if (championship.id === this.seasonManager.championship.id) return;
    this.seasonManager = new SeasonManager(championship);
    this.returnToHub();
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

  /**
   * Settings → Restart championship (Decision 16): the season you are racing goes back to
   * round 1, and the hub shows it. A race in progress ends without counting.
   */
  private restartChampionship(): void {
    this.seasonManager.resetSeason();
    this.settingsControl.screen.close();
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
      this.settingsControl.aiDifficultyLimit,
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
    this.resultsFlow.show({ session: this.session, rivalId: this.rivalId, bestLapMs: this.ghosts.bestRaceLapMs });
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
      // Esc closes Settings or a hub screen first; otherwise it pauses, unless a modal is open
      if (!closeFirstOpen(this.escScreens) && !this.hudController.isAnyModalOpen()) {
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
      this.settingsControl.rememberQuickToggles();
    }
    if (input.trackToggleRequested) {
      this.cycleTrack();
      this.resumeRace();
    }
    if (input.audioToggleRequested) {
      this.audioEngine.toggleMute();
      this.settingsControl.rememberQuickToggles();
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
    frame.reduceMotion = this.settingsControl.reduceMotion;
    frame.ghostVisible = this.ghosts.visible;
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
