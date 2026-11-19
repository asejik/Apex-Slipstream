import * as THREE from 'three';
import { InputState } from './InputManager';
import { PLAYER_VEHICLE_CONFIG, VehicleState } from './VehiclePhysics';
import { TrackSpline } from '../track/TrackSpline';
import { TireCompound, WeatherCondition } from '../tires/TireTypes';
import { TrackProfile, buildSpeedPlan, buildTrackProfile, planSpeedAt } from '../ai/AIRacecraft';

/** Which driving aids are on (Settings, Decision 11 and 16); all off by default */
export interface AidChoices {
  racingLine: boolean;
  brakeAssist: boolean;
  steerAssist: boolean;
}

/** Over the line's planned speed by this much (m/s) before the brake assist acts */
export const BRAKE_ASSIST_MARGIN_MS = 1.5;
/**
 * The brake assist aims this far under the line's limit: you are rarely on the perfect line,
 * and off it a corner needs less speed (measured hands-off: less time at the walls)
 */
const BRAKE_ASSIST_AIM = 0.9;
/** The most brake the assist ever applies: it helps, it never stops the car for you */
export const BRAKE_ASSIST_MAX = 0.6;
/** Every m/s over the margin adds this much brake */
const BRAKE_ASSIST_PER_MS = 0.1;
/** How strongly the steering assist pulls towards the line with your hands off (0 to 1) */
export const STEER_ASSIST_PULL = 0.35;
/** Stronger on a touch screen, where the thumb steers more coarsely */
export const STEER_ASSIST_PULL_TOUCH = 0.5;
/** The line point the steering aims at: this far ahead, at least, and further at speed */
const STEER_LOOK_MIN_M = 10;
const STEER_LOOK_SECONDS = 0.6;
/** Off the aim by this angle (radians) asks for full lock */
const STEER_FULL_LOCK_RAD = 0.35;

/**
 * The driving aids (Decision 11): a racing line to follow, a brake assist and a steering
 * assist. They use the AI's own racing line and the speed your car can carry along it on your
 * tyres in this weather. Assists only ever add to what you do: braking yourself turns the
 * brake assist off, and steering hard fades the steering assist out, so you can always
 * drive against them.
 */
export class DrivingAids {
  readonly choices: AidChoices = { racingLine: false, brakeAssist: false, steerAssist: false };
  /** Set once at start-up from the touch controls */
  touchSteering = false;

  private profile: TrackProfile | null = null;
  private plan: Float32Array | null = null;
  // What the profile and plan were made for, so they are made again only when one changes
  private madeFor: TrackSpline | null = null;
  private madeForWeather: WeatherCondition | null = null;
  private madeForTyre: TireCompound | null = null;
  // Scratch objects reused every step (zero allocations)
  private readonly aim = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();

  /** Any assist that changes the controls is on */
  get assisting(): boolean {
    return this.choices.brakeAssist || this.choices.steerAssist;
  }

  /** The racing line's profile, once made for the track on screen */
  get trackProfile(): TrackProfile | null {
    return this.profile;
  }

  /**
   * Makes the line and its planned speeds for this track, weather and tyre, if not made yet.
   * Runs when one of them changes, never every step.
   */
  prepare(spline: TrackSpline, weather: WeatherCondition, tyre: TireCompound): void {
    if (this.madeFor === spline && this.madeForWeather === weather && this.madeForTyre === tyre) return;
    this.profile = buildTrackProfile(spline, PLAYER_VEHICLE_CONFIG, weather, tyre);
    this.plan = buildSpeedPlan(this.profile, 1, PLAYER_VEHICLE_CONFIG);
    this.madeFor = spline;
    this.madeForWeather = weather;
    this.madeForTyre = tyre;
  }

  /** The speed (m/s) the line asks for `distance` metres along the lap; null before prepare */
  plannedSpeedAt(distance: number): number | null {
    if (!this.profile || !this.plan) return null;
    return planSpeedAt(this.plan, this.profile, distance);
  }

  /** The line's offset from the centreline (metres, + is right of travel) at `distance` */
  lineOffsetAt(distance: number): number {
    const profile = this.profile;
    if (!profile) return 0;
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
   * Writes your controls with the assists into `out` (your own `input` is left as it is).
   * `trackT` is where the car is along the road (0 to 1). Allocates nothing.
   */
  assist(input: InputState, car: VehicleState, spline: TrackSpline, trackT: number, out: InputState): void {
    out.throttle = input.throttle;
    out.brake = input.brake;
    out.steering = input.steering;
    out.handbrake = input.handbrake;
    if (!this.profile || !this.plan) return;
    const distance = trackT * this.profile.length;
    const speed = Math.max(0, car.forwardSpeed);

    if (this.choices.brakeAssist) {
      out.brake = Math.max(out.brake, brakeAssistAmount(input.brake, speed, planSpeedAt(this.plan, this.profile, distance) * BRAKE_ASSIST_AIM));
      if (out.brake > input.brake) out.throttle = input.throttle * (1 - out.brake / BRAKE_ASSIST_MAX);
    }

    if (this.choices.steerAssist && speed > 2) {
      const ahead = distance + Math.max(STEER_LOOK_MIN_M, speed * STEER_LOOK_SECONDS);
      const length = this.profile.length;
      const t = this.profile.isClosed ? (((ahead / length) % 1) + 1) % 1 : Math.min(1, ahead / length);
      spline.getPointAt(t, this.aim);
      spline.getTangentAt(t, this.tangent);
      const offset = this.lineOffsetAt(ahead);
      // Right of travel is (-tangent.z, tangent.x), as for the AI
      this.aim.x += -this.tangent.z * offset;
      this.aim.z += this.tangent.x * offset;
      const pull = this.touchSteering ? STEER_ASSIST_PULL_TOUCH : STEER_ASSIST_PULL;
      out.steering = steerTowards(input.steering, car.position, car.heading, this.aim.x, this.aim.z, pull);
    }
  }
}

/**
 * Brake the assist adds when you are faster than the line's planned speed here: none while
 * you brake yourself, and never more than BRAKE_ASSIST_MAX.
 */
export function brakeAssistAmount(yourBrake: number, speed: number, plannedSpeed: number): number {
  if (yourBrake > 0.05) return 0;
  const over = speed - plannedSpeed - BRAKE_ASSIST_MARGIN_MS;
  if (over <= 0) return 0;
  return Math.min(BRAKE_ASSIST_MAX, over * BRAKE_ASSIST_PER_MS);
}

/**
 * Your steering with a pull towards the aim point (x, z). The pull is `pull` with your hands
 * off and fades to nothing as you steer to full lock, so you can always steer against it.
 * The car faces (-sin heading, -cos heading); positive steering turns right.
 */
export function steerTowards(
  yourSteering: number,
  position: { x: number; z: number },
  heading: number,
  aimX: number,
  aimZ: number,
  pull: number
): number {
  const dx = aimX - position.x;
  const dz = aimZ - position.z;
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  const forward = -dx * sin - dz * cos;
  const right = dx * cos - dz * sin;
  const angle = Math.atan2(right, forward);
  const wanted = Math.max(-1, Math.min(1, angle / STEER_FULL_LOCK_RAD));
  const weight = pull * (1 - Math.min(1, Math.abs(yourSteering)));
  return Math.max(-1, Math.min(1, yourSteering + (wanted - yourSteering) * weight));
}
