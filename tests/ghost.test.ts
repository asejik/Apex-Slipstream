import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GhostRecorder } from '../src/replay/GhostRecorder';
import { GhostPlayback } from '../src/replay/GhostPlayback';
import { GhostStorage, isNewPersonalBest } from '../src/storage/GhostStorage';
import { VehicleState } from '../src/engine/VehiclePhysics';

describe('Ghost Time Trial Replay Engine & 30Hz Telemetry', () => {
  describe('GhostRecorder 30Hz Buffer Strides', () => {
    it('records 5-float strides per keyframe at 30Hz interval', () => {
      const recorder = new GhostRecorder();
      recorder.startLap();

      const state: VehicleState = {
        position: new THREE.Vector3(10.5, 2.0, -45.0),
        velocity: new THREE.Vector3(0, 0, 0),
        heading: 1.25,
        speedKmh: 120,
        forwardSpeed: 33.3,
        lateralSpeed: 0,
        steeringAngle: -0.15,
        driftFactor: 0,
        rpm: 0.8
      };

      // 1.0 second elapsed at 60Hz physics ticks (60 steps of 1/60s)
      for (let i = 0; i < 60; i++) {
        recorder.update(1 / 60, state);
      }

      // At 30 Hz, 1.0 second yields exactly 30 samples
      expect(recorder.currentSampleCount).toBe(30);

      const result = recorder.finishLap();
      expect(result.sampleCount).toBe(30);
      expect(result.data.length).toBe(30 * 5); // 150 floats

      // Verify stride values of first keyframe
      expect(result.data[0]).toBeCloseTo(10.5, 4);
      expect(result.data[1]).toBeCloseTo(2.0, 4);
      expect(result.data[2]).toBeCloseTo(-45.0, 4);
      expect(result.data[3]).toBeCloseTo(1.25, 4);
      expect(result.data[4]).toBeCloseTo(-0.15, 4);
    });
  });

  describe('GhostPlayback Interpolation & Hologram Mesh', () => {
    it('accurately interpolates spatial position between keyframes', () => {
      const playback = new GhostPlayback();
      // Create a test 2-sample buffer (time 0.0s and time 1/30s = 0.0333s)
      const data = new Float32Array([
        // Frame 0 (t = 0.0s)
        0, 0, 0, 0, 0,
        // Frame 1 (t = 1/30s)
        10, 4, 20, 0, 0
      ]);

      playback.loadGhost(data, 2);
      expect(playback.hasGhost).toBe(true);

      // Sample exactly halfway (t = 0.5 / 30 = 0.01666s)
      const sample = playback.sampleAtTime(0.5 / 30);
      expect(sample).not.toBeNull();
      expect(sample!.position.x).toBeCloseTo(5.0, 3);
      expect(sample!.position.y).toBeCloseTo(2.0, 3);
      expect(sample!.position.z).toBeCloseTo(10.0, 3);
    });

    it('unwraps shortest-arc angles across the +/- PI yaw boundary without flipping', () => {
      const playback = new GhostPlayback();
      // Yaw transitioning across boundary from +3.10 rad to -3.10 rad (small 0.08 rad delta)
      const data = new Float32Array([
        0, 0, 0, 3.10, 0,
        0, 0, 0, -3.10, 0
      ]);

      playback.loadGhost(data, 2);
      const sample = playback.sampleAtTime(0.5 / 30);
      expect(sample).not.toBeNull();
      // Should interpolate smoothly across PI, not spin 355 degrees in reverse!
      expect(Math.abs(sample!.heading)).toBeGreaterThan(3.0);
    });

    it('toggles visibility and hologram mesh state', () => {
      const playback = new GhostPlayback();
      const data = new Float32Array(10);
      playback.loadGhost(data, 2);

      expect(playback.visible).toBe(true);
      playback.setVisible(false);
      expect(playback.visible).toBe(false);
      playback.setVisible(true);
      expect(playback.visible).toBe(true);
    });
  });

  describe('GhostStorage Fallback & Retrieval', () => {
    let storage: GhostStorage;

    beforeEach(() => {
      storage = new GhostStorage();
    });

    it('stores and retrieves ghost replays seamlessly with in-memory fallback', async () => {
      const testData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const saved = await storage.saveGhost('track_01_coastal', 'pb', 45200, testData, 2);
      expect(saved).toBe(true);

      const record = await storage.getGhost('track_01_coastal', 'pb');
      expect(record).not.toBeNull();
      expect(record?.trackId).toBe('track_01_coastal');
      expect(record?.lapTimeMs).toBe(45200);
      expect(record?.sampleCount).toBe(2);

      const retrievedFloats = new Float32Array(record!.frameData);
      expect(retrievedFloats[0]).toBe(1);
      expect(retrievedFloats[4]).toBe(5);
    });

    it('clears ghost replay on request', async () => {
      const testData = new Float32Array(10);
      await storage.saveGhost('track_01_coastal', 'previous', 50000, testData, 2);
      await storage.clearGhost('track_01_coastal', 'previous');

      const record = await storage.getGhost('track_01_coastal', 'previous');
      expect(record).toBeNull();
    });
  });
});

describe('Stored personal best (P15-06)', () => {
  it('the first lap of a session only replaces the stored PB when it is faster', () => {
    expect(isNewPersonalBest(65000, 60000)).toBe(false);
    expect(isNewPersonalBest(59000, 60000)).toBe(true);
  });

  it('any completed lap is a PB when none is stored yet', () => {
    expect(isNewPersonalBest(90000, null)).toBe(true);
  });

  it('an equal lap does not replace the stored PB', () => {
    expect(isNewPersonalBest(60000, 60000)).toBe(false);
  });
});
