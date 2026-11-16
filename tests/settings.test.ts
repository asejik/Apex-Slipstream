import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { AI_PACE_KMH, DEFAULT_SETTINGS, displaySpeed, parseSettings, VOLUME_LEVELS } from '../src/app/Settings';
import { AIDriverManager } from '../src/ai/AIDriverManager';
import { QualifyingManager } from '../src/engine/QualifyingManager';
import { TrackSpline } from '../src/track/TrackSpline';
import { ALL_TRACKS, TRACK_6_CYBER_DOCKS } from '../src/track/TrackDefinitions';

describe('Saved settings (R5 part 5)', () => {
  it('uses the defaults when nothing is saved or the save is unreadable', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid saved values and replaces bad ones field by field', () => {
    const saved = JSON.stringify({
      camera: 'top-down',
      ghost: false,
      sound: 'yes', // wrong type: default
      volume: 'high',
      units: 'furlongs', // unknown: default
      graphics: 'low',
      showFps: true,
      extra: 'ignored'
    });
    expect(parseSettings(saved)).toEqual({
      camera: 'top-down',
      ghost: false,
      sound: DEFAULT_SETTINGS.sound,
      volume: 'high',
      units: DEFAULT_SETTINGS.units,
      graphics: 'low',
      showFps: true,
      difficulty: DEFAULT_SETTINGS.difficulty
    });
  });

  it('shows speed in km/h or mph', () => {
    expect(displaySpeed(180, 'kmh')).toBe(180);
    expect(displaySpeed(180, 'mph')).toBe(112);
    expect(displaySpeed(0, 'mph')).toBe(0);
  });

  it('keeps the tuned mix at medium volume', () => {
    expect(VOLUME_LEVELS.medium).toBe(0.75);
    expect(VOLUME_LEVELS.low).toBeLessThan(VOLUME_LEVELS.medium);
    expect(VOLUME_LEVELS.high).toBeLessThanOrEqual(1);
  });
});

describe('Settings screen markup (R5 part 5)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const screen = html.slice(html.indexOf('id="settings-screen"'), html.indexOf('<!-- Tyre choice before the race'));

  it('has a row with a button for every value of every setting', () => {
    const values: Record<string, string[]> = {
      camera: ['high-chase', 'low-chase', 'top-down'],
      ghost: ['true', 'false'],
      sound: ['true', 'false'],
      volume: ['low', 'medium', 'high'],
      units: ['kmh', 'mph'],
      graphics: ['high', 'low'],
      showFps: ['true', 'false'],
      difficulty: ['easy', 'medium', 'hard']
    };
    expect(Object.keys(values).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    for (const [key, options] of Object.entries(values)) {
      const start = screen.indexOf(`data-setting="${key}"`);
      expect(start, key).toBeGreaterThan(-1);
      const row = screen.slice(start, screen.indexOf('</div>', start));
      for (const option of options) expect(row, `${key}=${option}`).toContain(`data-value="${option}"`);
    }
  });

  it('opens from the hub and the pause menu', () => {
    expect(html).toMatch(/id="hub-tab-settings"/);
    expect(html).not.toMatch(/Settings <small>Soon<\/small>/);
    expect(html).toMatch(/id="pause-settings"/);
  });
});

describe('Difficulty (owner playtest 2026-11-16)', () => {
  it('defaults to medium and reads a saved choice', () => {
    expect(DEFAULT_SETTINGS.difficulty).toBe('medium');
    expect(parseSettings(JSON.stringify({ difficulty: 'hard' })).difficulty).toBe('hard');
    expect(parseSettings(JSON.stringify({ difficulty: 'impossible' })).difficulty).toBe('medium');
  });

  it('makes the field faster at each step, and never faster than your car', () => {
    expect(AI_PACE_KMH.easy).toBe(AIDriverManager.DEFAULT_PACE_KMH); // the pace before difficulty existed
    expect(AI_PACE_KMH.medium).toBeGreaterThan(AI_PACE_KMH.easy);
    expect(AI_PACE_KMH.hard).toBeGreaterThan(AI_PACE_KMH.medium);
    // The quickest driver (skill 1.05) on Hard still cruises below your 180 km/h top speed
    expect(AI_PACE_KMH.hard * 1.05).toBeLessThan(180);
  });

  it('changes how fast AI cars actually drive', () => {
    const spline = new TrackSpline(TRACK_6_CYBER_DOCKS);
    const far = new THREE.Vector3(0, 0, 99999);
    const distanceAfter = (pace: number): number => {
      const manager = new AIDriverManager();
      manager.setPace(pace);
      manager.resetGrid(spline);
      const car = manager.cars[0]!;
      let metres = 0;
      let before = car.position.clone();
      for (let i = 0; i < 60 * 20; i++) {
        manager.update(1 / 60, far);
        metres += car.position.distanceTo(before);
        before = car.position.clone();
      }
      return metres;
    };
    const easy = distanceAfter(AI_PACE_KMH.easy);
    const hard = distanceAfter(AI_PACE_KMH.hard);
    expect(hard).toBeGreaterThan(easy * 1.1);
  });

  it('makes qualifying times quicker in step with the race pace', () => {
    const track = ALL_TRACKS[0]!;
    const easy = QualifyingManager.generateAIBenchmarks(track, 1, AI_PACE_KMH.easy);
    const hard = QualifyingManager.generateAIBenchmarks(track, 1, AI_PACE_KMH.hard);
    expect(QualifyingManager.generateAIBenchmarks(track)).toEqual(easy); // default unchanged
    expect(hard[0]!.lapTimeMs / easy[0]!.lapTimeMs).toBeCloseTo(AI_PACE_KMH.easy / AI_PACE_KMH.hard, 3);
  });
});
