import { describe, it, expect } from 'vitest';
import { RaceWorld } from '../src/engine/RaceWorld';
import { GhostRecorder } from '../src/replay/GhostRecorder';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { InputState } from '../src/engine/InputManager';
import { BRAKE_ASSIST_MAX, brakeAssistAmount, steerTowards } from '../src/engine/DrivingAids';
import { lineColourFor } from '../src/render/RacingLineView';

function controls(throttle: number, brake = 0, steering = 0): InputState {
  return {
    throttle,
    brake,
    steering,
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
}

/** A world alone on track `trackIndex`, lined up, with these assists */
function worldWith(trackIndex: number, aids: { brakeAssist: boolean; steerAssist: boolean }): RaceWorld {
  const track = ALL_TRACKS[trackIndex]!;
  const world = new RaceWorld(track, new GhostRecorder());
  world.load(track, 'dry');
  world.lineUp();
  world.aids.choices.brakeAssist = aids.brakeAssist;
  world.aids.choices.steerAssist = aids.steerAssist;
  return world;
}

/**
 * Drives alone for `seconds` with these controls: metres along the road, and seconds spent
 * out by the walls (more than 2 m past the road's edge)
 */
function drive(trackIndex: number, aids: { brakeAssist: boolean; steerAssist: boolean }, seconds: number, input: InputState) {
  const world = worldWith(trackIndex, aids);
  const halfRoad = ALL_TRACKS[trackIndex]!.roadWidth / 2;
  let progress = 0;
  let lastT: number | null = null;
  let wallSteps = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const surface = world.step(input, true);
    if (lastT !== null) {
      let dt = surface.trackT - lastT;
      if (dt < -0.5) dt += 1; // over the start line
      progress += dt;
    }
    lastT = surface.trackT;
    if (surface.distanceToCenterline > halfRoad + 2) wallSteps++;
  }
  return { metres: progress * world.trackSpline.totalLength, wallSeconds: wallSteps / 60 };
}

describe('Driving aids (Decision 11 and 16)', () => {
  it('the brake assist acts only when you are over the line’s speed, never while you brake, and never fully', () => {
    expect(brakeAssistAmount(0, 30, 40)).toBe(0);
    expect(brakeAssistAmount(0, 41, 40)).toBe(0); // within the margin
    expect(brakeAssistAmount(0, 45, 40)).toBeGreaterThan(0);
    expect(brakeAssistAmount(0.5, 60, 20)).toBe(0); // you are braking: yours alone
    expect(brakeAssistAmount(0, 90, 20)).toBe(BRAKE_ASSIST_MAX);
  });

  it('the steering assist pulls towards the aim, and fades out as you steer to full lock', () => {
    // Facing -z (heading 0); an aim ahead and to the right (+x)
    const car = { x: 0, z: 0 };
    expect(steerTowards(0, car, 0, 0, -20, 0.35)).toBeCloseTo(0, 5);
    expect(steerTowards(0, car, 0, 5, -20, 0.35)).toBeGreaterThan(0);
    expect(steerTowards(0, car, 0, -5, -20, 0.35)).toBeLessThan(0);
    expect(steerTowards(-1, car, 0, 5, -20, 0.35)).toBe(-1); // full lock against it: yours
    expect(steerTowards(-0.5, car, 0, 5, -20, 0.35)).toBeLessThan(0); // still your way
  });

  it('colours the line white within the planned speed, amber over it, red well over', () => {
    expect(lineColourFor(30, 40)).toBe('white');
    expect(lineColourFor(42, 40)).toBe('amber');
    expect(lineColourFor(50, 40)).toBe('red');
  });

  it('brakes before the slowest corner at top speed, and eases off the throttle with it', () => {
    const world = worldWith(0, { brakeAssist: true, steerAssist: false });
    const aids = world.aids;
    aids.prepare(world.trackSpline, 'dry', 'street');
    const profile = aids.trackProfile!;
    // The slowest point of the line
    let slowest = 0;
    for (let i = 0; i < profile.count; i++) if (profile.cornerSpeed[i]! < profile.cornerSpeed[slowest]!) slowest = i;
    const car = world.vehiclePhysics.state;
    car.forwardSpeed = 50;
    const out = controls(0);
    aids.assist(controls(1), car, world.trackSpline, (slowest * profile.step) / profile.length, out);
    expect(out.brake).toBeGreaterThan(0);
    expect(out.brake).toBeLessThanOrEqual(BRAKE_ASSIST_MAX);
    expect(out.throttle).toBeLessThan(1);
  });

  it('never changes your own controls, and with every aid off drives exactly as before', () => {
    const input = controls(1, 0, 0.2);
    const off = drive(0, { brakeAssist: false, steerAssist: false }, 3, input);
    expect(input).toEqual(controls(1, 0, 0.2));
    drive(0, { brakeAssist: true, steerAssist: true }, 3, input);
    expect(input).toEqual(controls(1, 0, 0.2));
    // Off is the same car as before the aids: the same run twice gives the same distance
    expect(drive(0, { brakeAssist: false, steerAssist: false }, 3, input).metres).toBe(off.metres);
  });

  it('hands off at full throttle, the assists carry the car further and keep it far more off the walls', () => {
    const hands = controls(1);
    // A gentle assist, not an autopilot: it helps a lot, but still needs your hands.
    // Measured over a minute: about 40 s at the walls unaided, under 10 s aided
    for (const trackIndex of [0, 2, 5]) {
      const unaided = drive(trackIndex, { brakeAssist: false, steerAssist: false }, 60, hands);
      const aided = drive(trackIndex, { brakeAssist: true, steerAssist: true }, 60, hands);
      expect(aided.metres).toBeGreaterThan(unaided.metres * 1.1);
      expect(aided.wallSeconds).toBeLessThan(unaided.wallSeconds / 3);
    }
  });
});
