import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SlipstreamManager } from '../src/engine/SlipstreamManager';

describe('SlipstreamManager Wake & Boost Physics', () => {
  it('detects player inside 20m wake cone at racing speed', () => {
    const manager = new SlipstreamManager();
    // Facing heading = 0 means forward is -Z
    const leadPos = new THREE.Vector3(0, 0, 90);
    const leadHeading = 0;

    // Player is 10m behind at Z=100, facing -Z (heading 0), speed 120 km/h
    const playerPos = new THREE.Vector3(0, 0, 100);
    const playerHeading = 0;

    const state = manager.update(playerPos, playerHeading, 120, leadPos, leadHeading, 1 / 60);
    expect(state.inWake).toBe(true);
    expect(state.distanceToLead).toBeCloseTo(10, 1);
    expect(state.isBoostActive).toBe(false);
  });

  it('rejects player when ahead of lead car', () => {
    const manager = new SlipstreamManager();
    const leadPos = new THREE.Vector3(0, 0, 90);
    const leadHeading = 0;

    // Player is 5m ahead at Z=85 (more negative Z)
    const playerPos = new THREE.Vector3(0, 0, 85);
    const playerHeading = 0;

    const state = manager.update(playerPos, playerHeading, 120, leadPos, leadHeading, 1 / 60);
    expect(state.inWake).toBe(false);
  });

  it('rejects player when too far laterally outside wake cone', () => {
    const manager = new SlipstreamManager();
    const leadPos = new THREE.Vector3(0, 0, 90);
    const leadHeading = 0;

    // Player is 10m behind at Z=100, but 12m to the right (cone width at 10m is ~4.5m)
    const playerPos = new THREE.Vector3(12, 0, 100);
    const playerHeading = 0;

    const state = manager.update(playerPos, playerHeading, 120, leadPos, leadHeading, 1 / 60);
    expect(state.inWake).toBe(false);
  });

  it('rejects player when speed is below 60 km/h', () => {
    const manager = new SlipstreamManager();
    const leadPos = new THREE.Vector3(0, 0, 90);
    const leadHeading = 0;

    const playerPos = new THREE.Vector3(0, 0, 100);
    const playerHeading = 0;

    const state = manager.update(playerPos, playerHeading, 45, leadPos, leadHeading, 1 / 60);
    expect(state.inWake).toBe(false);
  });

  it('accumulates draft time and triggers +10% boost after 1.5 seconds', () => {
    const manager = new SlipstreamManager();
    const leadPos = new THREE.Vector3(0, 0, 90);
    const playerPos = new THREE.Vector3(0, 0, 100);
    const dt = 1 / 60;

    // Draft for 1.4 seconds (84 ticks)
    for (let i = 0; i < 84; i++) {
      const state = manager.update(playerPos, 0, 130, leadPos, 0, dt);
      expect(state.inWake).toBe(true);
      expect(state.isBoostActive).toBe(false);
    }

    // Advance past 1.5 seconds (another 10 ticks = 1.56s total)
    let state = manager.update(playerPos, 0, 130, leadPos, 0, dt);
    for (let i = 0; i < 10; i++) {
      state = manager.update(playerPos, 0, 130, leadPos, 0, dt);
    }

    expect(state.draftProgress).toBe(1.0);
    expect(state.isBoostActive).toBe(true);
    expect(state.boostFactor).toBeGreaterThan(1.09); // ~1.10
  });

  it('boost decays smoothly over 3.0s after pulling out of wake', () => {
    const manager = new SlipstreamManager();
    const leadPos = new THREE.Vector3(0, 0, 90);
    const playerPos = new THREE.Vector3(0, 0, 100);
    const dt = 1 / 60;

    // Build up boost
    for (let i = 0; i < 100; i++) {
      manager.update(playerPos, 0, 130, leadPos, 0, dt);
    }

    // Pull out of wake (player steers wide)
    const widePos = new THREE.Vector3(20, 0, 100);
    const exitState = manager.update(widePos, 0, 150, leadPos, 0, dt);
    expect(exitState.inWake).toBe(false);
    expect(exitState.isBoostActive).toBe(true);
    expect(exitState.boostFactor).toBeGreaterThan(1.05);

    // Simulate 3.2 seconds passing
    let finalState = exitState;
    for (let i = 0; i < 200; i++) {
      finalState = manager.update(widePos, 0, 150, leadPos, 0, dt);
    }

    expect(finalState.isBoostActive).toBe(false);
    expect(finalState.boostFactor).toBe(1.0);
  });
});
