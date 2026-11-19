import * as THREE from 'three';
import { InputState } from './InputManager';
import { PLAYER_VEHICLE_CONFIG, VehiclePhysics } from './VehiclePhysics';
import { RenderPose } from './RenderPose';
import { BarrierCollider } from '../track/TrackBarriers';
import { TrackSpline, SurfaceEvaluation } from '../track/TrackSpline';
import { TrackData } from '../track/TrackDefinitions';
import { LapManager } from './LapManager';
import { RaceProgress, playerLapFraction } from './RaceOrder';
import { livePosition } from './RaceResults';
import { SlipstreamManager, SlipstreamState } from './SlipstreamManager';
import { AIDriverManager, startOffsetToT } from '../ai/AIDriverManager';
import { CollisionManager } from './CollisionManager';
import { GhostRecorder } from '../replay/GhostRecorder';
import { DrivingAids } from './DrivingAids';
import {
  TireCompound,
  WeatherCondition,
  getTireCompoundGrip,
  getTireDragMultiplier,
  tyreTraction
} from '../tires/TireTypes';

/** One fixed physics step, in seconds (60 Hz) */
export const PHYSICS_STEP = 1 / 60;

/**
 * The race itself (P09-R02 step 2): the track, your car, the 19 AI cars, and one fixed
 * physics step for all of them. No screens, HUD, sound or drawing: the game reads the state
 * here to show it, and decides what a finished session leads to.
 */
export class RaceWorld {
  trackSpline: TrackSpline;
  readonly lapManager: LapManager;
  vehiclePhysics: VehiclePhysics;
  readonly aiDriverManager = new AIDriverManager();
  private readonly collisionManager = new CollisionManager();
  private readonly slipstreamManager = new SlipstreamManager();
  private readonly barrierCollider = new BarrierCollider();
  /** Your car's pose at the last step and this one, to draw between them */
  readonly playerRenderPose = new RenderPose();
  /** Racing line, braking and steering assists (Decision 11 and 16); all off by default */
  readonly aids = new DrivingAids();
  /** Your controls with the assists, when one is on (your own input is never changed) */
  private readonly assisted: InputState = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
    cameraToggleRequested: false,
    trackToggleRequested: false,
    tireSelectRequested: null,
    audioToggleRequested: false,
    restartRequested: false,
    standingsToggleRequested: false,
    ghostToggleRequested: false,
    pauseToggleRequested: false
  };

  /** Your tyres: chosen on the grid, or changed in practice and Time Trial */
  activeTire: TireCompound = 'street';
  /** The loaded race's weather (R7): the forecast for that round */
  raceWeather: WeatherCondition = 'dry';
  /** Latest slipstream state, for the HUD, camera and sound */
  latestSlipstream: SlipstreamState = {
    inWake: false,
    draftProgress: 0,
    isBoostActive: false,
    boostFactor: 1.0,
    distanceToLead: 999
  };
  /** Your live position in the race */
  playerRank = 20;
  /** Your grid slot when the race was lined up, for places gained (R9) */
  raceGridPosition = 20;
  /** Race time when you finished; null while racing. Keeps the live position right after the flag */
  playerFinishTime: number | null = null;
  severeCrashesThisRace = 0;
  totalRaceElapsedSeconds = 0;
  // Scratch race-progress records reused every physics step (zero allocations)
  readonly playerProgress: RaceProgress = { completedLaps: 0, lapFraction: 0, finishTime: null };
  private readonly aiProgress: RaceProgress = { completedLaps: 0, lapFraction: 0, finishTime: null };
  /** Where you were along the road last step (0 to 1), so the AI can race you as traffic */
  private playerTrackT = Number.NaN;

  /** `ghostRecorder` records your lap each step, after contact with other cars */
  constructor(initialTrack: TrackData, private readonly ghostRecorder: GhostRecorder) {
    this.vehiclePhysics = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0, PLAYER_VEHICLE_CONFIG);
    this.trackSpline = new TrackSpline(initialTrack);
    this.lapManager = new LapManager(this.trackSpline);
  }

  /** A new track in this weather: the lap count, slipstream and race clock start again */
  load(trackData: TrackData, weather: WeatherCondition): void {
    this.trackSpline = new TrackSpline(trackData);
    this.raceWeather = weather;
    this.aiDriverManager.setWeather(weather);
    this.lapManager.reset(this.trackSpline);
    this.slipstreamManager.reset();
    this.playerFinishTime = null;
    this.severeCrashesThisRace = 0;
    this.totalRaceElapsedSeconds = 0;
  }

  /** Lines every car up on the grid (in `gridOrder` when given) and places you in your slot */
  lineUp(gridOrder?: string[]): void {
    this.playerTrackT = Number.NaN;
    const { playerSpawnDist, playerLateralOffset } = this.aiDriverManager.resetGrid(this.trackSpline, gridOrder);
    this.spawnAtTrackStart(playerSpawnDist, playerLateralOffset);
    // Grid slots can sit past the first checkpoints; start lap counting from the real spawn point
    this.lapManager.setStartPosition(this.vehiclePhysics.state.position);

    // Race order on the grid, so the HUD is right while the start lights hold everyone
    this.playerProgress.completedLaps = this.lapManager.isBeforeStartLine ? -1 : 0;
    this.playerProgress.lapFraction = this.trackSpline.findClosestT(this.vehiclePhysics.state.position).t;
    this.playerProgress.finishTime = null;
    this.playerRank = livePosition(
      this.playerProgress,
      this.aiDriverManager.cars,
      this.lapManager.state.totalLaps,
      this.aiProgress
    );
    this.raceGridPosition = this.playerRank;
  }

  private spawnAtTrackStart(distAhead: number, lateralOffset: number): void {
    // Negative distances are grid slots behind the start line (U-11), on a sprint's run-up
    const t = startOffsetToT(distAhead, this.trackSpline);
    const startPoint = this.trackSpline.getPointAt(t);
    const startTangent = this.trackSpline.getTangentAt(t);

    // Apply lateral offset
    const normal = new THREE.Vector3(-startTangent.z, 0, startTangent.x).normalize();
    const spawnPos = startPoint.clone().addScaledVector(normal, lateralOffset);
    spawnPos.y = startPoint.y + 0.05;

    const heading = Math.atan2(-startTangent.x, -startTangent.z);

    // The player's car has a little extra grip in bends (PLAYER_CORNERING_ASSIST)
    this.vehiclePhysics = new VehiclePhysics(spawnPos, heading, PLAYER_VEHICLE_CONFIG);
  }

  /**
   * One fixed physics step of PHYSICS_STEP seconds for every car, then the lap count.
   * `solo` runs you alone (qualifying, Time Trial). Returns the surface under your car,
   * measured before it moved.
   */
  step(input: InputState, solo: boolean): SurfaceEvaluation {
    const car = this.vehiclePhysics;
    this.totalRaceElapsedSeconds += PHYSICS_STEP;
    this.playerRenderPose.savePrevious(car.state.position, car.state.heading);

    if (!solo) {
      // Advance all 19 AI drivers along track spline
      this.aiDriverManager.update(PHYSICS_STEP, car.state.position, this.playerTrackT, car.state.forwardSpeed);

      // Resolve hybrid vehicle collisions (player vs AI, AI vs AI)
      const collisionEvent = this.collisionManager.resolveCollisions(car, this.aiDriverManager.cars);
      if (collisionEvent && collisionEvent.type === 'severe') {
        this.severeCrashesThisRace++;
      }
    }

    // Record telemetry into 30Hz buffer
    this.ghostRecorder.update(PHYSICS_STEP, car.state);

    // Evaluate surface physics
    const surface = this.trackSpline.evaluateSurface(car.state.position);
    this.playerTrackT = surface.trackT;

    // Closest AI car, to evaluate the slipstream drafting wake
    const lead = solo ? null : this.aiDriverManager.nearestCar(car.state.position, 28.0);

    this.latestSlipstream = this.slipstreamManager.update(
      car.state.position,
      car.state.heading,
      car.state.speedKmh,
      lead ? lead.position : null,
      lead ? lead.heading : 0,
      PHYSICS_STEP
    );

    // Calculate real-time race position rank across all 20 cars
    if (!solo) {
      // On the grid behind the line the player has not started lap 1 yet, like the AI (lap 0)
      this.playerProgress.completedLaps = this.lapManager.isBeforeStartLine
        ? -1
        : this.lapManager.state.currentLap - 1;
      this.playerProgress.lapFraction = playerLapFraction(
        surface.trackT,
        this.lapManager.state.checkpointProgress,
        this.lapManager.isBeforeStartLine
      );
      // Once you have taken the flag you are classified by your finish time (it used to
      // drop you to P20, because your lap counter stops while the others keep lapping)
      this.playerProgress.finishTime = this.playerFinishTime;
      this.playerRank = livePosition(
        this.playerProgress,
        this.aiDriverManager.cars,
        this.lapManager.state.totalLaps,
        this.aiProgress
      );
    }

    // Combine terrain surface modifiers with active tactical tire compound
    const tireGrip = getTireCompoundGrip(this.activeTire, surface.surface, this.raceWeather);
    const tireDrag = getTireDragMultiplier(this.activeTire, surface.surface, this.raceWeather);
    // How much of the car's cornering and braking limit these tyres give here (R7)
    const traction = tyreTraction(this.activeTire, surface.surface, this.raceWeather);

    const effectiveGrip = surface.gripMultiplier * tireGrip;
    const effectiveDrag = surface.dragMultiplier * tireDrag;

    // The driving aids add to your controls when one is on (they never act on the AI)
    let driven = input;
    const aids = this.aids;
    if (aids.assisting) {
      aids.prepare(this.trackSpline, this.raceWeather, this.activeTire);
      aids.assist(input, car.state, this.trackSpline, surface.trackT, this.assisted);
      driven = this.assisted;
    }

    // Update vehicle physics with slipstream boost and track elevation
    car.update(
      PHYSICS_STEP,
      driven,
      { grip: effectiveGrip, drag: effectiveDrag, traction, tyreDrag: tireDrag },
      this.latestSlipstream.boostFactor,
      surface.trackElevation
    );

    // Keep the car between the walls at the road edges (U-04)
    this.barrierCollider.resolve(this.trackSpline, surface.trackT, car.state, PHYSICS_STEP);

    // Update lap manager
    this.lapManager.update(car.state.position, car.state.velocity, PHYSICS_STEP);

    return surface;
  }
}
