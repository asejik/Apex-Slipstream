import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AITraffic, PLAYER_SLOT, TrafficDecision } from '../src/ai/AITraffic';
import { AIDriverManager } from '../src/ai/AIDriverManager';
import { DIFFICULTY_LIMIT } from '../src/ai/AIRacecraft';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { TrackSpline } from '../src/track/TrackSpline';

const TOP = 45; // m/s, a driver's top speed
const STEP = 1 / 60;

function decision(): TrafficDecision {
  return { speedCap: Infinity, lateralTarget: 0, lateralRate: 0, boost: 1, isPassing: false, isDefending: false };
}

/** A 6 km circuit with every slot empty; place cars with `put`. */
function road(): AITraffic {
  const traffic = new AITraffic();
  traffic.reset(6000, true, 5.5);
  return traffic;
}

function put(traffic: AITraffic, slot: number, along: number, offset: number, speed: number): void {
  traffic.along[slot] = along;
  traffic.offset[slot] = offset;
  traffic.speed[slot] = speed;
  traffic.active[slot] = 1;
}

describe('AI racecraft in traffic (R6 part 2)', () => {
  it('follows a slower car it cannot pass without running into it', () => {
    const traffic = road();
    put(traffic, 0, 100, 0, 44); // me
    put(traffic, 1, 112, 0, 40); // slower car 12 m ahead in my lane
    // Both sides blocked by cars alongside it
    put(traffic, 2, 112, 3.2, 40);
    put(traffic, 3, 112, -3.2, 40);
    const out = decision();
    traffic.decide(0, 0, TOP, TOP, 0.9, STEP, out);
    expect(out.isPassing).toBe(false);
    // 12 m back it may still close in, a little faster than the car ahead
    expect(out.speedCap).toBeGreaterThan(40);
    expect(out.speedCap).toBeLessThan(47);
    // 9 m back, nearly matching it
    put(traffic, 0, 103, 0, 42);
    traffic.decide(0, 0, TOP, TOP, 0.9, STEP, out);
    expect(out.speedCap).toBeLessThan(43);

    // Too close: back off below the car ahead's speed
    put(traffic, 0, 107, 0, 41);
    traffic.decide(0, 0, TOP, TOP, 0.9, STEP, out);
    expect(out.speedCap).toBeLessThan(40);
  });

  it('pulls out to pass a slower car on the side with room, and the other side when that is taken', () => {
    const traffic = road();
    put(traffic, 0, 100, -1, 44);
    put(traffic, 1, 115, -1, 38); // slower, 15 m ahead, left of centre: more room on the right
    const out = decision();
    traffic.decide(0, -1, TOP, TOP, 0.5, STEP, out);
    expect(out.isPassing).toBe(true);
    expect(out.lateralTarget).toBeCloseTo(-1 + 3.2, 5);

    // Same again with a car already on that side
    const blocked = road();
    put(blocked, 0, 100, -1, 44);
    put(blocked, 1, 115, -1, 38);
    put(blocked, 2, 118, 2.2, 38);
    blocked.decide(0, -1, TOP, TOP, 0.5, STEP, out);
    expect(out.isPassing).toBe(true);
    expect(out.lateralTarget).toBeCloseTo(-1 - 3.2, 5);
  });

  it('lets cautious drivers wait for a straight before passing', () => {
    const traffic = road();
    put(traffic, 0, 100, 0, 30);
    put(traffic, 1, 115, 0, 25);
    const out = decision();
    // In a corner (plan well below top speed)
    traffic.decide(0, 0, 32, TOP, 0.2, STEP, out);
    expect(out.isPassing).toBe(false);
    // A bold driver goes for it
    traffic.decide(0, 0, 32, TOP, 0.8, STEP, out);
    expect(out.isPassing).toBe(true);
  });

  it('gets the same slipstream as the player: 1.5 s in the wake, then 3 s of +10% top speed', () => {
    const traffic = road();
    put(traffic, 0, 100, 0.5, 44);
    put(traffic, 1, 112, 0, 44); // 12 m ahead, in line
    const out = decision();
    for (let i = 0; i < 89; i++) traffic.decide(0, 0, TOP, TOP, 0.1, STEP, out);
    expect(out.boost).toBe(1);
    traffic.decide(0, 0, TOP, TOP, 0.1, STEP, out);
    traffic.decide(0, 0, TOP, TOP, 0.1, STEP, out);
    expect(out.boost).toBeCloseTo(1.1, 5);
    // Out of the wake, the boost runs out after 3 s
    traffic.active[1] = 0;
    for (let i = 0; i < 60 * 3 - 10; i++) traffic.decide(0, 0, TOP, TOP, 0.1, STEP, out);
    expect(out.boost).toBeCloseTo(1.1, 5);
    for (let i = 0; i < 20; i++) traffic.decide(0, 0, TOP, TOP, 0.1, STEP, out);
    expect(out.boost).toBe(1);
  });

  it('defends with one move to cover a faster car, and never once it is alongside', () => {
    const traffic = road();
    put(traffic, 0, 100, 0, 40); // me, on the line
    put(traffic, PLAYER_SLOT, 85, 3, 45); // the player, 15 m behind on the right, faster
    const out = decision();
    traffic.decide(0, 0, TOP, TOP, 0.7, STEP, out);
    expect(out.isDefending).toBe(true);
    expect(out.lateralTarget).toBeCloseTo(3, 5);

    // The attacker switches to the other side: no second move
    traffic.offset[0] = 2.5;
    traffic.offset[PLAYER_SLOT] = -2;
    traffic.decide(0, 0, TOP, TOP, 0.7, STEP, out);
    expect(out.lateralTarget).toBeCloseTo(3, 5);

    // A fresh defender with the attacker already 4 m behind does not move across
    const late = road();
    put(late, 0, 100, 0, 40);
    put(late, PLAYER_SLOT, 96, 3, 45);
    late.decide(0, 0, TOP, TOP, 0.7, STEP, out);
    expect(out.isDefending).toBe(false);
  });

  it('never steers into a car alongside, even when the racing line is over there', () => {
    const traffic = road();
    put(traffic, 0, 100, 0, 44);
    put(traffic, 1, 102, 2.5, 44); // alongside, on my right
    const out = decision();
    traffic.decide(0, 4.5, TOP, TOP, 0.5, STEP, out); // the line is far right
    expect(out.lateralTarget).toBeLessThanOrEqual(2.5 - 2.4 + 1e-6);
  });
});

describe('A race in traffic (R6 part 2)', () => {
  it('lets fast drivers come through from the back with no contact between cars', () => {
    const spline = new TrackSpline(ALL_TRACKS[0]!);
    const manager = new AIDriverManager();
    manager.setDifficultyLimit(DIFFICULTY_LIMIT.medium);
    // Slowest at the front, fastest at the back
    const order = [...manager.cars].sort((a, b) => a.profile.skill - b.profile.skill).map((c) => c.profile.id);
    // A fixed seed, so the drivers' mistakes (R6 part 3) are the same every run
    manager.resetGrid(spline, [...order, 'player'], 7);
    const fastest = order[order.length - 1]!;
    const far = new THREE.Vector3(0, 0, 99999);
    const L = spline.totalLength;
    let contacts = 0;
    for (let step = 0; step < 60 * 150; step++) {
      manager.update(STEP, far);
      const cars = manager.cars;
      for (let a = 0; a < cars.length; a++) {
        expect(Math.abs(cars[a]!.lateralOffset)).toBeLessThanOrEqual(5.5 + 1e-6);
        for (let b = a + 1; b < cars.length; b++) {
          let g = (cars[b]!.splineT - cars[a]!.splineT) * L;
          if (g > L / 2) g -= L;
          if (g < -L / 2) g += L;
          // Car bodies are 4.6 m long and 1.9 m wide
          if (Math.abs(g) < 4.6 && Math.abs(cars[a]!.lateralOffset - cars[b]!.lateralOffset) < 1.9) contacts++;
        }
      }
    }
    expect(contacts).toBe(0);
    expect(manager.overtakes).toBeGreaterThan(30);
    // After one lap and a bit, the fastest driver has passed most of the field
    const progress = (id: string): number => {
      const car = manager.cars.find((c) => c.profile.id === id)!;
      return car.lap + car.splineT;
    };
    const ahead = manager.cars.filter((c) => progress(c.profile.id) > progress(fastest)).length;
    expect(ahead).toBeLessThan(6);
    // A 150 s race at 60 Hz: under a full parallel test run it needs more than the 5 s default
  }, 30_000);
});

describe('After the flag (R10-02)', () => {
  it('finished cars still keep out of each other on the cool-down lap, and passes only count while racing', () => {
    const spline = new TrackSpline(ALL_TRACKS[0]!);
    const manager = new AIDriverManager();
    manager.setDifficultyLimit(DIFFICULTY_LIMIT.medium);
    manager.resetGrid(spline, undefined, 7);
    const far = new THREE.Vector3(0, 0, 99999);
    const L = spline.totalLength;
    let finishedContacts = 0;
    let overtakesWhenAllFinished = -1;
    let stepsAfterAllFinished = 0;
    for (let step = 0; step < 60 * 900 && stepsAfterAllFinished < 60 * 40; step++) {
      manager.update(STEP, far);
      const cars = manager.cars;
      if (cars.every((c) => c.finishTime !== null)) {
        if (stepsAfterAllFinished === 0) overtakesWhenAllFinished = manager.overtakes;
        stepsAfterAllFinished++;
      }
      for (let a = 0; a < cars.length; a++) {
        if (cars[a]!.finishTime === null) continue;
        for (let b = a + 1; b < cars.length; b++) {
          if (cars[b]!.finishTime === null) continue;
          let g = (cars[b]!.splineT - cars[a]!.splineT) * L;
          if (g > L / 2) g -= L;
          if (g < -L / 2) g += L;
          if (Math.abs(g) < 4.6 && Math.abs(cars[a]!.lateralOffset - cars[b]!.lateralOffset) < 1.9) finishedContacts++;
        }
      }
    }
    expect(stepsAfterAllFinished).toBe(60 * 40);
    expect(finishedContacts).toBe(0);
    // Passing on the cool-down lap is not an overtake
    expect(manager.overtakes).toBe(overtakesWhenAllFinished);
  }, 120_000);

  it('a driver with no aggression never defends (how finished cars drive)', () => {
    const traffic = road();
    put(traffic, 0, 100, 0, 40);
    put(traffic, 1, 70, 0, 46); // faster car closing behind on a straight
    const out = decision();
    for (let s = 0; s < 60; s++) traffic.decide(0, 0, TOP, TOP, 0, STEP, out);
    expect(out.isDefending).toBe(false);
  });
});
