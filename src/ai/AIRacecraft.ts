import * as THREE from 'three';
import type { TrackSpline } from '../track/TrackSpline';
import type { TrackData } from '../track/TrackDefinitions';
import { DEFAULT_VEHICLE_CONFIG, VehicleConfig } from '../engine/VehiclePhysics';
import type { AIDriverProfile } from './AIDriverProfiles';
import { tyreTraction, WeatherCondition } from '../tires/TireTypes';
import { forecastLabel, recommendedTyre } from '../tires/TyreAdvice';

/**
 * How the AI drives (R6). The AI drives the same car as the player: the same top speed,
 * acceleration, braking and cornering limit, all worked out from VehiclePhysics' own
 * numbers. A driver uses a share of that limit (`driverLimit`): the difficulty setting,
 * their skill, and a small bonus on tracks that suit them (P15-13).
 *
 * Per track, once: a racing line (outside on the way in, inside at the apex, outside on
 * the way out) and the fastest speed the car can take at each point of that line.
 * Per driver: a speed plan along the line, braking early enough for every corner.
 * Nothing here runs in the frame loop except `planSpeedAt` (a table lookup).
 */

/** Metres between profile samples */
const PROFILE_STEP_M = 5;
/** Curvature is averaged over this distance either side, so the line ignores tiny wiggles */
const CURVE_SMOOTH_M = 20;
/** How far ahead and behind the line looks to set up for a corner and run out of it */
const LINE_LOOK_M = 45;
/** Curvature (1/m) at which the line uses the full width: a 60 m bend */
const FULL_WIDTH_CURVATURE = 1 / 60;
/** The line keeps this far inside each road edge (half the car plus a margin) */
const EDGE_MARGIN_M = 1.6;
/** The line is smoothed over this distance either side, so the car never jinks */
const LINE_SMOOTH_M = 15;
/** AI braking uses this share of the car's brakes, as a tidy driver would */
const BRAKE_SHARE = 0.8;

/**
 * Share of the car's limit each difficulty drives at, for a driver of skill 1.0. Hard is
 * close to a perfect lap; Medium is about the old Medium pace on Coastal; Easy about the
 * old Easy pace, which the owner won every race against.
 */
export const DIFFICULTY_LIMIT: Readonly<Record<'easy' | 'medium' | 'hard', number>> = {
  easy: 0.8,
  medium: 0.89,
  hard: 0.97
};

/** The terrain a race rewards, for drivers' specialties (P15-13): rain beats everything (R7). */
function trackSpecialty(
  track: Pick<TrackData, 'id' | 'biome'>,
  weather: WeatherCondition
): AIDriverProfile['terrainAffinity'] {
  if (weather === 'wet' || track.id === 'track_07_stormy_pass') return 'wet';
  if (track.biome === 'mountain') return 'gravel';
  return 'asphalt';
}

/**
 * The car as the AI drives it in this weather (R7): every driver fits the tyres the forecast
 * recommends, and those tyres' grip on the tarmac scales the cornering and braking limit,
 * exactly as it does for the player's car.
 */
export function conditionsConfig(weather: WeatherCondition): VehicleConfig {
  const tyre = recommendedTyre({ condition: weather, label: forecastLabel(weather) });
  const traction = tyreTraction(tyre, 'asphalt', weather);
  return {
    ...DEFAULT_VEHICLE_CONFIG,
    maxCorneringAccel: DEFAULT_VEHICLE_CONFIG.maxCorneringAccel * traction,
    brakeRate: DEFAULT_VEHICLE_CONFIG.brakeRate * traction
  };
}

/** A driver on a track that suits them is this much quicker */
const SPECIALTY_BONUS = 1.02;

/** Share of the car's limit this driver uses on this track, never more than all of it. */
export function driverLimit(
  profile: Pick<AIDriverProfile, 'skill' | 'terrainAffinity'>,
  difficultyLimit: number,
  track: Pick<TrackData, 'id' | 'biome'>,
  weather: WeatherCondition = 'dry'
): number {
  const specialty = profile.terrainAffinity === trackSpecialty(track, weather) ? SPECIALTY_BONUS : 1;
  return Math.min(1, difficultyLimit * profile.skill * specialty);
}

/**
 * Radius of the circle the player's car drives at full steering lock at `speedMs`, from
 * VehiclePhysics: steering shrinks with speed while yaw gain grows (U-03).
 */
function turningRadiusAt(speedMs: number, config: VehicleConfig = DEFAULT_VEHICLE_CONFIG): number {
  if (speedMs <= 0.1) return 0;
  const ratio = Math.min(1, speedMs / config.maxForwardSpeed);
  const steer = config.maxSteerAngle + (config.minSteerAngle - config.maxSteerAngle) * ratio;
  const yawGain = 1 + (config.highSpeedYawGain - 1) * ratio;
  const yawRate = Math.min(steer * config.turnSpeedRate * yawGain, config.maxCorneringAccel / speedMs);
  return speedMs / yawRate;
}

/** Fastest speed (m/s) at which the car can follow a bend of `radius` metres. */
function maxCornerSpeed(radius: number, config: VehicleConfig = DEFAULT_VEHICLE_CONFIG): number {
  const top = config.maxForwardSpeed;
  if (!Number.isFinite(radius) || turningRadiusAt(top, config) <= radius) return top;
  let low = 0.5;
  let high = top;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (turningRadiusAt(mid, config) <= radius) low = mid;
    else high = mid;
  }
  return low;
}

/** What the AI knows about a track. */
export interface TrackProfile {
  length: number;
  isClosed: boolean;
  count: number;
  step: number;
  /** Racing line: metres from the centreline, positive to the right of the direction of travel */
  lineOffset: Float32Array;
  /** Fastest speed of the car along the line at each sample, m/s (at most the car's top speed) */
  cornerSpeed: Float32Array;
}

function boxSmooth(values: Float32Array, halfWindow: number, isClosed: boolean): Float32Array {
  const n = values.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let k = -halfWindow; k <= halfWindow; k++) {
      let j = i + k;
      if (isClosed) j = ((j % n) + n) % n;
      else if (j < 0 || j >= n) continue;
      sum += values[j]!;
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

function at(values: Float32Array, index: number, isClosed: boolean): number {
  const n = values.length;
  if (isClosed) return values[((index % n) + n) % n]!;
  return values[Math.max(0, Math.min(n - 1, index))]!;
}

/** Radius of the circle through three points, seen from above. */
function radiusThrough(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  const ab = Math.hypot(b.x - a.x, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.z - b.z);
  const ca = Math.hypot(a.x - c.x, a.z - c.z);
  const doubleArea = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z));
  if (doubleArea < 1e-9) return Infinity;
  return (ab * bc * ca) / (2 * doubleArea);
}

/** Builds the racing line and the car's speed limit along it. Once per track. */
export function buildTrackProfile(spline: TrackSpline, config: VehicleConfig = DEFAULT_VEHICLE_CONFIG): TrackProfile {
  const isClosed = spline.data.isClosed;
  const length = spline.totalLength;
  const count = Math.max(8, Math.round(length / PROFILE_STEP_M));
  const step = length / count;
  const samples = isClosed ? count : count + 1;
  const tOf = (i: number): number => (isClosed ? i / count : Math.min(1, i / count));

  const centres: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];
  const tangent = new THREE.Vector3();
  const next = new THREE.Vector3();
  const curvature = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = tOf(i);
    centres.push(spline.getPointAt(t));
    spline.getTangentAt(t, tangent);
    // The AI's sideways direction (AIDriverManager): positive is to the right of travel
    normals.push(new THREE.Vector3(-tangent.z, 0, tangent.x).normalize());
    spline.getTangentAt(isClosed ? tOf(i + 1) % 1 : tOf(Math.min(samples - 1, i + 1)), next);
    let turn = Math.atan2(next.x, next.z) - Math.atan2(tangent.x, tangent.z);
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    // Positive when the road bends right, toward +normal (atan2(x, z) falls turning right)
    curvature[i] = -turn / step;
  }

  // Racing line: inside where the road bends, outside where a sharper bend is coming or
  // has just ended. In a long steady bend this keeps the car inside all the way round.
  const smooth = boxSmooth(curvature, Math.round(CURVE_SMOOTH_M / step), isClosed);
  const look = Math.round(LINE_LOOK_M / step);
  const raw = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const here = smooth[i]!;
    const ahead = at(smooth, i + look, isClosed);
    const behind = at(smooth, i - look, isClosed);
    const setUp = Math.max(0, Math.abs(ahead) - Math.abs(here)) * Math.sign(ahead);
    const runOut = Math.max(0, Math.abs(behind) - Math.abs(here)) * Math.sign(behind);
    raw[i] = Math.max(-1, Math.min(1, (here - setUp - runOut) / FULL_WIDTH_CURVATURE));
  }
  const usable = Math.max(0, spline.data.roadWidth / 2 - EDGE_MARGIN_M);
  const lineOffset = boxSmooth(raw, Math.round(LINE_SMOOTH_M / step), isClosed);
  for (let i = 0; i < samples; i++) lineOffset[i] = lineOffset[i]! * usable;

  // Speed limit along the line, from the radius of the line itself (10 m chords)
  const line = centres.map((c, i) => c.clone().addScaledVector(normals[i]!, lineOffset[i]!));
  const cornerSpeed = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const a = line[isClosed ? (i - 2 + samples) % samples : Math.max(0, i - 2)]!;
    const c = line[isClosed ? (i + 2) % samples : Math.min(samples - 1, i + 2)]!;
    const radius = a === line[i] || c === line[i] ? Infinity : radiusThrough(a, line[i]!, c);
    cornerSpeed[i] = maxCornerSpeed(radius, config);
  }

  return { length, isClosed, count: samples, step, lineOffset, cornerSpeed };
}

/** The car's acceleration at `speed` (m/s) with full throttle, from VehiclePhysics. */
function accelerationAt(speed: number, topSpeed: number, config: VehicleConfig): number {
  const powerCurve = 1 - Math.pow(Math.max(0, speed) / topSpeed, 2) * 0.4;
  return config.accelerationRate * powerCurve;
}

/**
 * A driver's planned speed (m/s) at every sample: the car's corner speed times their
 * limit, braked for early enough to make each corner, and no faster than they can
 * accelerate to. Once per driver per track (and when the difficulty changes).
 */
export function buildSpeedPlan(
  profile: TrackProfile,
  limit: number,
  config: VehicleConfig = DEFAULT_VEHICLE_CONFIG
): Float32Array {
  const n = profile.count;
  const top = config.maxForwardSpeed * limit;
  const brake = config.brakeRate * BRAKE_SHARE;
  const plan = new Float32Array(n);
  for (let i = 0; i < n; i++) plan[i] = Math.min(top, profile.cornerSpeed[i]! * limit);

  // Twice round on a circuit so braking and acceleration carry over the start line
  const passes = profile.isClosed ? 2 : 1;
  for (let pass = 0; pass < passes; pass++) {
    // Backwards: brake early enough for what is coming
    for (let k = n - 1; k >= 0; k--) {
      const nextIndex = k + 1 < n ? k + 1 : profile.isClosed ? 0 : -1;
      if (nextIndex < 0) continue;
      const reachable = Math.sqrt(plan[nextIndex]! ** 2 + 2 * brake * profile.step);
      if (plan[k]! > reachable) plan[k] = reachable;
    }
    // Forwards: no faster than the car can accelerate to
    for (let k = 0; k < n; k++) {
      const previous = k > 0 ? k - 1 : profile.isClosed ? n - 1 : -1;
      if (previous < 0) continue;
      const v = plan[previous]!;
      const reachable = Math.sqrt(v * v + 2 * accelerationAt(v, top, config) * limit * profile.step);
      if (plan[k]! > reachable) plan[k] = reachable;
    }
  }
  return plan;
}

/** Planned speed (m/s) at `distance` metres along the lap. Allocates nothing. */
export function planSpeedAt(plan: Float32Array, profile: TrackProfile, distance: number): number {
  const n = profile.count;
  let x = distance / profile.step;
  if (profile.isClosed) x = ((x % n) + n) % n;
  else x = Math.max(0, Math.min(n - 1, x));
  const i = Math.floor(x);
  const j = profile.isClosed ? (i + 1) % n : Math.min(n - 1, i + 1);
  const f = x - i;
  return plan[i]! * (1 - f) + plan[j]! * f;
}

/** Racing line offset at `distance` metres along the lap. Allocates nothing. */
export function lineOffsetAt(profile: TrackProfile, distance: number): number {
  const n = profile.count;
  let x = distance / profile.step;
  if (profile.isClosed) x = ((x % n) + n) % n;
  else x = Math.max(0, Math.min(n - 1, x));
  const i = Math.floor(x);
  const j = profile.isClosed ? (i + 1) % n : Math.min(n - 1, i + 1);
  const f = x - i;
  return profile.lineOffset[i]! * (1 - f) + profile.lineOffset[j]! * f;
}

/**
 * Seconds for a flying lap (or the first `fraction` of one) at this plan: the time an
 * AI driver posts in qualifying.
 */
export function planLapSeconds(plan: Float32Array, profile: TrackProfile, fraction = 1): number {
  const samples = Math.max(1, Math.round(profile.count * Math.min(1, Math.max(0, fraction))));
  let seconds = 0;
  for (let i = 0; i < samples; i++) {
    const v = Math.max(1, (plan[i]! + plan[(i + 1) % profile.count]!) / 2);
    seconds += profile.step / v;
  }
  return seconds;
}
