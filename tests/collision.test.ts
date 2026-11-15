import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CollisionManager } from '../src/engine/CollisionManager';
import { VehiclePhysics, DEFAULT_VEHICLE_CONFIG } from '../src/engine/VehiclePhysics';
import { AICarState } from '../src/ai/AIDriverManager';
import { AI_DRIVER_ROSTER } from '../src/ai/AIDriverProfiles';

describe('Hybrid Collision Engine', () => {
  it('detects and resolves glancing contact with elastic bounce', () => {
    const collision = new CollisionManager();
    const player = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0, DEFAULT_VEHICLE_CONFIG);
    player.state.velocity.set(0, 0, -20); // 72 km/h

    // Place an AI car 1.5m to the right (inside 2.2m radius)
    const aiCar: AICarState = {
      profile: AI_DRIVER_ROSTER[0]!,
      mesh: new THREE.Group(),
      position: new THREE.Vector3(1.5, 0, 0),
      velocity: new THREE.Vector3(0, 0, -20),
      heading: 0,
      pitch: 0,
      roll: 0,
      speedKmh: 72,
      splineT: 0.1,
      lateralOffset: 1.5,
      lap: 1,
      isSpinningOut: false,
      spinTimer: 0,
      finishTime: null,
      isParked: false
    };

    const event = collision.resolveCollisions(player, [aiCar]);
    expect(event).not.toBeNull();
    expect(event?.type).toBe('glance');

    // Player and AI pushed apart laterally
    expect(player.state.position.x).toBeLessThan(0);
    expect(aiCar.position.x).toBeGreaterThan(1.5);
  });

  it('triggers severe impact and spin-out penalty on high delta collision', () => {
    const collision = new CollisionManager();
    const player = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0, DEFAULT_VEHICLE_CONFIG);
    player.state.velocity.set(0, 0, -45); // ~162 km/h

    // Stationary AI car in front
    const aiCar: AICarState = {
      profile: AI_DRIVER_ROSTER[1]!,
      mesh: new THREE.Group(),
      position: new THREE.Vector3(0, 0, -1.0),
      velocity: new THREE.Vector3(0, 0, 0),
      heading: 0,
      pitch: 0,
      roll: 0,
      speedKmh: 0,
      splineT: 0.1,
      lateralOffset: 0,
      lap: 1,
      isSpinningOut: false,
      spinTimer: 0,
      finishTime: null,
      isParked: false
    };

    const event = collision.resolveCollisions(player, [aiCar]);
    expect(event).not.toBeNull();
    expect(event?.type).toBe('severe');
    expect(aiCar.isSpinningOut).toBe(true);
    expect(aiCar.spinTimer).toBe(3.0);
  });
});
