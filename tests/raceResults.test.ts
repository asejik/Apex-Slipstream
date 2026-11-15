import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AIDriverManager } from '../src/ai/AIDriverManager';
import { buildRaceParticipants, livePosition } from '../src/engine/RaceResults';
import { RaceProgress } from '../src/engine/RaceOrder';

describe('Race results and live position (R3 extraction)', () => {
  it('lists the player first, then all 19 AI drivers', () => {
    const manager = new AIDriverManager();
    const participants = buildRaceParticipants(
      { finishTimeSeconds: 60, bestLapMs: 19500.4, severeCrashes: 2 },
      manager.cars,
      3
    );

    expect(participants).toHaveLength(20);
    expect(participants[0]).toMatchObject({
      id: 'player',
      isPlayer: true,
      raceTimeMs: 60000,
      fastestLapMs: 19500,
      severeCrashes: 2
    });
    expect(participants.filter((p) => !p.isPlayer)).toHaveLength(19);
  });

  it('gives a driver with no counted lap a fastest lap of zero', () => {
    const manager = new AIDriverManager();
    const participants = buildRaceParticipants(
      { finishTimeSeconds: 60, bestLapMs: null, severeCrashes: 0 },
      manager.cars,
      3
    );
    expect(participants[0]?.fastestLapMs).toBe(0);
    expect(participants[1]?.fastestLapMs).toBe(0);
  });

  it('uses the real finish time and best lap of an AI car that has finished', () => {
    const manager = new AIDriverManager();
    const car = manager.cars[4]!;
    car.finishTime = 55.5;
    car.bestLapTime = 18.25;
    car.lap = 4;

    const participants = buildRaceParticipants(
      { finishTimeSeconds: 60, bestLapMs: null, severeCrashes: 0 },
      manager.cars,
      3
    );
    const entry = participants.find((p) => p.id === car.profile.id);
    expect(entry?.raceTimeMs).toBe(55500);
    expect(entry?.fastestLapMs).toBe(18250);
    // A finisher is classified ahead of every car still racing
    const stillRacing = participants.find((p) => p.id === manager.cars[5]!.profile.id);
    expect(entry!.progress).toBeGreaterThan(stillRacing!.progress);
  });

  it('counts the cars ahead of the player for the live position', () => {
    const manager = new AIDriverManager();
    manager.cars.forEach((car, i) => {
      car.lap = 1;
      car.splineT = i < 5 ? 0.8 : 0.2; // five cars ahead, fourteen behind
      car.finishTime = null;
    });
    const player: RaceProgress = { completedLaps: 0, lapFraction: 0.5, finishTime: null };
    const scratch: RaceProgress = { completedLaps: 0, lapFraction: 0, finishTime: null };

    expect(livePosition(player, manager.cars, 3, scratch)).toBe(6);
  });

  it('finds the closest car still racing, and none when all are too far', () => {
    const manager = new AIDriverManager();
    manager.cars.forEach((car, i) => car.position.set(1000 + i * 50, 0, 0));
    manager.cars[3]!.position.set(10, 0, 0);
    manager.cars[7]!.position.set(0, 0, 5);
    const origin = new THREE.Vector3();

    expect(manager.nearestCar(origin, 28)).toBe(manager.cars[7]);
    manager.cars[7]!.isParked = true;
    expect(manager.nearestCar(origin, 28)).toBe(manager.cars[3]);
    expect(manager.nearestCar(origin, 8)).toBeNull();
  });
});
