import * as THREE from 'three';
import { createStaticRaceCar } from '../render/RaceCarModel';
import type { LoadedRaceCarModel } from '../render/GltfRaceCar';
import { TrackSpline } from '../track/TrackSpline';
import { AIDriverProfile, AI_DRIVER_ROSTER } from './AIDriverProfiles';
import { countsForFastestLap } from '../engine/RaceOrder';
import { RenderPose } from '../engine/RenderPose';
import type { VehicleConfig } from '../engine/VehiclePhysics';
import type { WeatherCondition } from '../tires/TireTypes';
import {
  buildSpeedPlan,
  buildTrackProfile,
  conditionsConfig,
  DIFFICULTY_LIMIT,
  driverLimit,
  lineOffsetAt,
  planSpeedAt,
  surfaceGripAt,
  TrackProfile
} from './AIRacecraft';
import { AITraffic, PLAYER_SLOT, TrafficDecision } from './AITraffic';
import { AIMistakes, MistakeEffect } from './AIMistakes';

export interface AICarState {
  profile: AIDriverProfile;
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  pitch: number;
  roll: number;
  speedKmh: number;
  splineT: number;
  lateralOffset: number;
  lap: number;
  isSpinningOut: boolean;
  spinTimer: number;
  /** Seconds since the start when this car completed the race distance; null while racing. */
  finishTime: number | null;
  /** Sprint finishers park at the end of the road and leave the race (hidden, no collisions). */
  isParked: boolean;
  /** Race time (s) when the current lap started */
  lapStartTime: number;
  /** Fastest counted lap in seconds (see countsForFastestLap); null until one is completed */
  bestLapTime: number | null;
  /** True from a standing start until the car reaches launch speed (see LAUNCH_END_FRACTION) */
  isLaunching: boolean;
}

/** Gap from the start line to pole position, and between grid slots, in metres. */
const GRID_LINE_GAP = 8;
const GRID_SLOT_SPACING = 8.5;

/**
 * Where grid slot `rank` (1 = pole) sits, in metres along the road from the start line.
 * Every slot is behind the line (U-11): on a circuit at the end of the lap, on a sprint on
 * the run-up before the line (R8).
 */
export function gridSlotOffset(rank: number): number {
  return -(GRID_LINE_GAP + (rank - 1) * GRID_SLOT_SPACING);
}

/**
 * Spline position (0 to 1) of a point `offset` metres from the start line: wrapped round
 * the lap on a circuit, along the run-up on a sprint (never before the road starts).
 */
export function startOffsetToT(offset: number, spline: Pick<TrackSpline, 'totalLength' | 'startT' | 'data'>): number {
  if (spline.data.isClosed) return offsetToSplineT(offset, spline.totalLength);
  if (spline.totalLength <= 0) return 0;
  return Math.min(1, Math.max(0, spline.startT + offset / spline.totalLength));
}

/** Spline position (0 to 1) of a point `offset` metres from the start line, wrapping on circuits. */
export function offsetToSplineT(offset: number, totalLength: number): number {
  if (totalLength <= 0) return 0;
  const t = (offset / totalLength) % 1.0;
  return t < 0 ? t + 1.0 : t;
}

export class AIDriverManager {
  public cars: AICarState[] = [];
  /** One per car, same order as `cars`: where to draw it between physics steps. */
  private readonly renderPoses: RenderPose[] = [];
  /** One per car: extra turn drawn on top of its heading while it is spun (U-05), now and one step ago. */
  private readonly spinAngles: number[] = [];
  private readonly previousSpinAngles: number[] = [];
  public group: THREE.Group;
  private trackSpline: TrackSpline | null = null;
  private raceElapsed = 0;
  /** Share of the car's limit a driver of skill 1.0 uses (Settings: difficulty) */
  private difficultyLimit = DIFFICULTY_LIMIT.medium;
  /** The race's weather (R7), and the car as the AI drive it in that weather */
  private weather: WeatherCondition = 'dry';
  private config: VehicleConfig = conditionsConfig('dry');
  /** Racing line and corner speeds of the loaded track (R6) */
  private profile: TrackProfile | null = null;
  /** Each car's planned speed along the line, m/s; same order as `cars` */
  private plans: Float32Array[] = [];
  /** Each car's share of the car's limit on this track; same order as `cars` */
  private limits: number[] = [];
  /** Following, passing, slipstream and defending (R6 part 2) */
  private readonly traffic = new AITraffic();
  private readonly decision: TrafficDecision = {
    speedCap: Infinity,
    lateralTarget: 0,
    lateralRate: 2.5,
    boost: 1,
    isPassing: false,
    isDefending: false
  };
  /** Passes completed this race, for tuning and tests */
  public overtakes = 0;
  /** Which car each car was behind last step (-1 none), to count passes */
  private readonly lastAhead = new Int8Array(20).fill(-1);
  /** Lock-ups, running wide and spins (R6 part 3) */
  public readonly mistakes = new AIMistakes();
  private readonly mistakeEffect: MistakeEffect = { speedScale: 1, lineShift: 0, startSpin: false };
  /** 1 while a car was passing or defending last step: mistakes come easier under pressure */
  private readonly underPressure = new Uint8Array(20);
  /** Races started, so each race rolls different dice */
  private raceCount = 0;

  /** How long a hit car is out of contention, in seconds (set by the collision). */
  private static readonly SPIN_RECOVERY_SECONDS = 3.0;
  /** How long its single turn takes, in seconds. */
  private static readonly SPIN_TURN_SECONDS = 1.0;
  /** A spun car never slows below this, in km/h. */
  private static readonly SPIN_MIN_SPEED_KMH = 40;
  /** A car is "launching" from the grid until it reaches this share of its top speed */
  private static readonly LAUNCH_END_FRACTION = 0.8;
  /** AI braking uses this share of the car's brakes (as in AIRacecraft) */
  private static readonly BRAKE_SHARE = 0.8;

  // Reusable scratch objects for zero GC in 60Hz loop
  private readonly _scratchCenter = new THREE.Vector3();
  private readonly _scratchTangent = new THREE.Vector3();
  private readonly _scratchNormal = new THREE.Vector3();
  private readonly _scratchDiff = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();
    this.initCars();
  }

  /**
   * Sets the share of the car's limit the field drives at (Settings: difficulty,
   * DIFFICULTY_LIMIT). Takes effect at once, mid-race included.
   */
  public setDifficultyLimit(limit: number): void {
    this.difficultyLimit = limit;
    this.buildPlans();
  }

  /**
   * Sets the race's weather (R7): the AI fit the forecast's tyres, corner and brake within
   * their grip, and wet specialists get their bonus in the rain. Call before `resetGrid`;
   * mid-race it takes effect at once.
   */
  public setWeather(weather: WeatherCondition): void {
    if (weather === this.weather) return;
    this.weather = weather;
    if (this.trackSpline) {
      this.config = conditionsConfig(weather, this.trackSpline.data);
      this.profile = buildTrackProfile(this.trackSpline, this.config, weather);
      this.buildPlans();
    }
  }

  /** Each driver's speed plan for the loaded track, from their share of the car's limit. */
  private buildPlans(): void {
    if (!this.profile || !this.trackSpline) return;
    const track = this.trackSpline.data;
    this.limits = this.cars.map((car) => driverLimit(car.profile, this.difficultyLimit, track, this.weather));
    this.plans = this.limits.map((limit) => buildSpeedPlan(this.profile!, limit, this.config));
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  private initCars(): void {
    for (const profile of AI_DRIVER_ROSTER) {
      const mesh = this.createCarMesh(profile);
      this.group.add(mesh);

      this.renderPoses.push(new RenderPose());
      this.spinAngles.push(0);
      this.previousSpinAngles.push(0);
      this.cars.push({
        profile,
        mesh,
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        heading: 0,
        pitch: 0,
        roll: 0,
        speedKmh: 120 * profile.skill,
        splineT: 0,
        lateralOffset: profile.preferredLateralOffset,
        lap: 1,
        isSpinningOut: false,
        spinTimer: 0,
        finishTime: null,
        isParked: false,
        lapStartTime: 0,
        bestLapTime: null,
        isLaunching: false
      });
    }
  }

  /**
   * Positions all 19 AI drivers on the starting grid staggered based on grid order.
   * Returns player's assigned spawn distance and lateral offset.
   */
  public resetGrid(
    spline: TrackSpline,
    gridOrder?: string[],
    mistakeSeed?: number
  ): { playerSpawnDist: number; playerLateralOffset: number } {
    this.trackSpline = spline;
    const totalLength = spline.totalLength;
    this.raceElapsed = 0;
    this.config = conditionsConfig(this.weather, spline.data);
    this.profile = buildTrackProfile(spline, this.config, this.weather);
    this.buildPlans();
    // Cars keep 1.5 m from the road edge (centre of the car to the edge)
    this.traffic.reset(totalLength, spline.data.isClosed, spline.data.roadWidth / 2 - 1.5);
    this.overtakes = 0;
    // Same seed, same mistakes: tests pass one; otherwise every race rolls new dice
    this.raceCount++;
    this.mistakes.reset(mistakeSeed ?? Math.floor(Math.random() * 0xffffffff) ^ (this.raceCount * 0x9e3779b9));
    this.underPressure.fill(0);
    for (const car of this.cars) {
      car.finishTime = null;
      car.isParked = false;
      car.lapStartTime = 0;
      car.bestLapTime = null;
      car.mesh.visible = true;
    }

    let playerSpawnDist = 0;
    let playerLateralOffset = 0;
    const isClosed = spline.data.isClosed;

    // Default order: the AI roster from P1 to P19, the player last
    const order =
      gridOrder && gridOrder.length === 20
        ? gridOrder
        : [...this.cars.map((c) => c.profile.id), 'player'];

    // Ordered grid slots: order[0] is P1, order[19] is P20. Everyone starts from a standstill.
    for (let rank = 1; rank <= 20; rank++) {
      const driverId = order[rank - 1];
      const offset = gridSlotOffset(rank);
      const lateral = (rank % 2 === 0 ? 1 : -1) * 2.2;

      if (driverId === 'player') {
        playerSpawnDist = offset;
        playerLateralOffset = lateral;
      } else {
        const car = this.cars.find((c) => c.profile.id === driverId);
        if (car) {
          car.splineT = startOffsetToT(offset, spline);
          car.speedKmh = 0;
          car.isLaunching = true;
          // Behind the line on a circuit: crossing it starts lap 1. A sprint is one run from
          // the grid to the end of the road (progress is measured along the whole road)
          car.lap = isClosed && offset < 0 ? 0 : 1;
          car.isSpinningOut = false;
          car.spinTimer = 0;
          car.lateralOffset = lateral;
          this.updateCarTransform(car, 0);
        }
      }
    }

    return { playerSpawnDist, playerLateralOffset };
  }

  /**
   * Fixed 60Hz update loop for all 19 AI agents with zero heap allocations.
   * `playerTrackT` (0 to 1 along the road) and `playerSpeedMs` let the AI race the player
   * as traffic; without them the player is invisible to the AI's racecraft.
   */
  public update(dt: number, playerPos: THREE.Vector3, playerTrackT = Number.NaN, playerSpeedMs = 0): void {
    if (!this.trackSpline || !this.group.visible) return;
    const totalLength = this.trackSpline.totalLength;
    const isClosed = this.trackSpline.data.isClosed;
    this.raceElapsed += dt;
    this.snapshotTraffic(playerPos, playerTrackT, playerSpeedMs);

    // Remember where each car was, including any collision push since the last step (U-03)
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const pose = this.renderPoses[i];
      if (car && pose) pose.savePrevious(car.position, car.heading);
      this.previousSpinAngles[i] = this.spinAngles[i] ?? 0;
    }

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car || car.isParked) continue;

      // Spin-out recovery (U-05): the car turns once while sliding on down the road,
      // then picks its speed back up. It no longer stops and spins on the spot.
      this.spinAngles[i] = 0;
      let isSliding = false;
      if (car.isSpinningOut) {
        const sinceHit = AIDriverManager.SPIN_RECOVERY_SECONDS - car.spinTimer;
        car.spinTimer -= dt;
        if (sinceHit < AIDriverManager.SPIN_TURN_SECONDS) {
          isSliding = true;
          const progress = sinceHit / AIDriverManager.SPIN_TURN_SECONDS;
          // Ease in and out over one full turn
          this.spinAngles[i] = Math.PI * 2 * progress * progress * (3 - 2 * progress);
          car.speedKmh = Math.max(AIDriverManager.SPIN_MIN_SPEED_KMH, car.speedKmh - 45 * dt);
        }
        if (car.spinTimer <= 0) {
          car.isSpinningOut = false;
        }
      }

      // 1. Racecraft in traffic (R6 part 2): follow, pass, draft or defend
      const distance = car.splineT * totalLength;
      const limit = this.limits[i] ?? this.difficultyLimit;
      const plan = this.plans[i];
      const top = this.config.maxForwardSpeed * limit;
      const planMs = plan && this.profile ? planSpeedAt(plan, this.profile, distance) : top;
      const cleanLine = this.profile ? lineOffsetAt(this.profile, distance) : 0;

      // Mistakes (R6 part 3): on the way into a corner a driver may lock up, run wide or spin
      const mistake = this.mistakeEffect;
      this.mistakes.update(
        i, planMs, top, cleanLine, this.difficultyLimit, car.profile.skill, car.profile.aggression,
        this.underPressure[i] === 1, dt, mistake
      );
      if (mistake.startSpin && !car.isSpinningOut) {
        car.isSpinningOut = true;
        car.spinTimer = AIDriverManager.SPIN_RECOVERY_SECONDS;
      }
      const line = cleanLine + mistake.lineShift;

      const decision = this.decision;
      // After the flag a driver only keeps clear of the others: no aggression, so it never
      // defends against a car still racing, you included (R10-02)
      const aggression = car.finishTime === null ? car.profile.aggression : 0;
      this.traffic.decide(i, line, planMs * mistake.speedScale, top, aggression, dt, decision);
      this.underPressure[i] = decision.isPassing || decision.isDefending ? 1 : 0;

      // 2. Speed: the driver's plan along the racing line (R6), with the slipstream's extra
      // top speed on straights, and never faster than the car ahead allows
      const boostedTop = top * decision.boost;
      let targetMs = planMs >= top * 0.98 ? boostedTop : planMs * mistake.speedScale;
      targetMs = Math.min(targetMs, decision.speedCap);
      const targetSpeed = targetMs * 3.6;
      if (car.isLaunching && car.speedKmh >= top * 3.6 * AIDriverManager.LAUNCH_END_FRACTION) {
        car.isLaunching = false;
      }
      if (!isSliding) {
        const speedMs = car.speedKmh / 3.6;
        if (speedMs < targetMs) {
          // Accelerate like the player's car, with the same extra pull while boosted
          const powerCurve = 1 - Math.pow(Math.max(0, speedMs) / boostedTop, 2) * 0.4;
          const boostPull = 1 + (decision.boost - 1) * 1.5;
          const accel = this.config.accelerationRate * powerCurve * boostPull * limit;
          car.speedKmh = Math.min(targetSpeed, car.speedKmh + accel * 3.6 * dt);
        } else {
          const surfaceGrip = this.profile ? surfaceGripAt(this.profile, distance) : 1;
          const brake = this.config.brakeRate * AIDriverManager.BRAKE_SHARE * surfaceGrip;
          car.speedKmh = Math.max(targetSpeed, car.speedKmh - brake * 3.6 * dt);
        }
      }

      // 3. Steer towards the racing line, or wherever traffic needs the car
      car.lateralOffset = THREE.MathUtils.lerp(
        car.lateralOffset,
        decision.lateralTarget,
        Math.min(1, decision.lateralRate * dt)
      );

      // 4. Advance spline position
      const speedMs = (car.speedKmh * 1000) / 3600;
      const distTraveled = speedMs * dt;
      const deltaT = distTraveled / totalLength;

      if (!isClosed && car.splineT + deltaT >= 1.0) {
        // Sprint finish: park at the end of the road and leave the race
        car.splineT = 1.0;
        this.recordLap(car, isClosed);
        car.lap++;
        car.finishTime = this.raceElapsed;
        car.isParked = true;
        car.speedKmh = 0;
        this.updateCarTransform(car, dt);
        car.mesh.visible = false;
        continue;
      }

      const previousT = car.splineT;
      car.splineT = (car.splineT + deltaT) % 1.0;

      if (car.splineT < previousT) {
        // Cool-down laps after the finish do not count
        if (car.finishTime === null) this.recordLap(car, isClosed);
        car.lap++;
        // Circuit finish: record the time, then keep driving a cool-down lap
        if (car.finishTime === null && car.lap > this.trackSpline.data.laps) {
          car.finishTime = this.raceElapsed;
        }
      }

      this.updateCarTransform(car, dt);
    }
  }

  /**
   * Copies every car's place on the road into the traffic snapshot, and counts passes:
   * a car that was behind another last step and is now ahead of it, on the same lap.
   */
  private snapshotTraffic(playerPos: THREE.Vector3, playerTrackT: number, playerSpeedMs: number): void {
    const spline = this.trackSpline!;
    const totalLength = spline.totalLength;
    const traffic = this.traffic;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i]!;
      traffic.along[i] = car.splineT * totalLength;
      traffic.offset[i] = car.lateralOffset;
      traffic.speed[i] = car.speedKmh / 3.6;
      // A finished car on its cool-down lap is still on the road: others keep clear of it (R10-02)
      traffic.active[i] = car.isParked ? 0 : 1;
    }
    if (Number.isFinite(playerTrackT)) {
      spline.getPointAt(playerTrackT, this._scratchCenter);
      spline.getTangentAt(playerTrackT, this._scratchTangent);
      this._scratchNormal.set(-this._scratchTangent.z, 0, this._scratchTangent.x).normalize();
      this._scratchDiff.subVectors(playerPos, this._scratchCenter);
      traffic.along[PLAYER_SLOT] = playerTrackT * totalLength;
      traffic.offset[PLAYER_SLOT] = this._scratchDiff.dot(this._scratchNormal);
      traffic.speed[PLAYER_SLOT] = playerSpeedMs;
      traffic.active[PLAYER_SLOT] = 1;
    } else {
      traffic.active[PLAYER_SLOT] = 0;
    }

    // Count passes between AI cars still racing: the nearest car ahead last step is now behind
    for (let i = 0; i < this.cars.length; i++) {
      const before = this.lastAhead[i]!;
      if (before >= 0 && traffic.active[i] === 1 && traffic.active[before] === 1 &&
          this.cars[i]!.finishTime === null && this.cars[before]!.finishTime === null) {
        const g = traffic.gap(i, before);
        if (g < 0 && g > -20) this.overtakes++;
      }
      let nearest = -1;
      let nearestGap = 20;
      for (let j = 0; j < this.cars.length; j++) {
        if (j === i || traffic.active[j] === 0) continue;
        const g = traffic.gap(i, j);
        if (g > 0 && g < nearestGap) {
          nearest = j;
          nearestGap = g;
        }
      }
      this.lastAhead[i] = nearest;
    }
  }

  /** The closest car still racing within `maxDistance` metres of `position` on the ground, or null. */
  public nearestCar(position: THREE.Vector3, maxDistance: number): AICarState | null {
    let nearest: AICarState | null = null;
    let nearestDistance = maxDistance;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car || car.isParked) continue;
      const distance = Math.hypot(car.position.x - position.x, car.position.z - position.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = car;
      }
    }
    return nearest;
  }

  /**
   * Draws every car between its last two physics steps (U-03). Call once per frame.
   * `alpha` is how far the frame is into the next physics step, 0 to 1.
   */
  public render(alpha: number): void {
    if (!this.group.visible) return;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const pose = this.renderPoses[i];
      if (!car || !pose || car.isParked) continue;
      pose.sample(car.position, car.heading, alpha);
      car.mesh.position.copy(pose.position);
      const spinNow = this.spinAngles[i] ?? 0;
      const spinBefore = this.previousSpinAngles[i] ?? 0;
      // A finished turn snaps from a full circle back to zero: the same direction
      const spin = spinNow === 0 ? 0 : spinBefore + (spinNow - spinBefore) * Math.min(1, Math.max(0, alpha));
      car.mesh.rotation.y = pose.heading + spin;
    }
  }

  /** Closes the car's current lap (car.lap is the lap just completed) and keeps its best (U-09). */
  private recordLap(car: AICarState, isClosed: boolean): void {
    const lapTime = this.raceElapsed - car.lapStartTime;
    car.lapStartTime = this.raceElapsed;
    if (!countsForFastestLap(car.lap, isClosed)) return;
    if (car.bestLapTime === null || lapTime < car.bestLapTime) {
      car.bestLapTime = lapTime;
    }
  }

  private updateCarTransform(car: AICarState, dt: number): void {
    if (!this.trackSpline) return;

    this.trackSpline.getPointAt(car.splineT, this._scratchCenter);
    this.trackSpline.getTangentAt(car.splineT, this._scratchTangent);

    // Lateral normal vector
    this._scratchNormal.set(-this._scratchTangent.z, 0, this._scratchTangent.x).normalize();

    // Position along spline + lateral offset + elevation clearance
    car.position.copy(this._scratchCenter);
    car.position.addScaledVector(this._scratchNormal, car.lateralOffset);
    car.position.y = this._scratchCenter.y + 0.05;

    // Heading aligned with tangent
    const targetHeading = Math.atan2(-this._scratchTangent.x, -this._scratchTangent.z);
    if (dt > 0) {
      let angleDiff = targetHeading - car.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      car.heading += angleDiff * Math.min(1, 10.0 * dt);
    } else {
      car.heading = targetHeading;
    }

    // Road slope pitch
    const slopePitch = Math.atan2(
      this._scratchTangent.y,
      Math.hypot(this._scratchTangent.x, this._scratchTangent.z)
    );
    car.pitch = slopePitch;

    this.applyMeshTransform(car);
  }

  private applyMeshTransform(car: AICarState): void {
    car.mesh.position.copy(car.position);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.x = car.pitch;
    car.mesh.rotation.z = car.roll;
  }

  /**
   * Swaps every AI car to the licensed model (U-07) in its team colours. Each car keeps its
   * group, so its position, visibility and spin are untouched; only what is drawn changes.
   */
  public applyModel(model: LoadedRaceCarModel): void {
    for (const car of this.cars) {
      car.mesh.clear();
      car.mesh.add(model.createStatic(car.profile.colorHex, car.profile.secondaryColorHex));
    }
  }

  /** The race car model (U-07) in this driver's team colours; geometry is shared by all cars. */
  private createCarMesh(profile: AIDriverProfile): THREE.Group {
    return createStaticRaceCar(profile.colorHex, profile.secondaryColorHex);
  }
}
