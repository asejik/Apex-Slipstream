import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { DIFFICULTY_LIMIT, driverLimit } from '../src/ai/AIRacecraft';
import { AI_DRIVER_ROSTER } from '../src/ai/AIDriverProfiles';
import { DEFAULT_SETTINGS, displaySpeed, parseSettings, VOLUME_LEVELS } from '../src/app/Settings';
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
      reduceMotion: DEFAULT_SETTINGS.reduceMotion,
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
      reduceMotion: ['auto', 'on', 'off'],
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
    // Difficulty is the share of your car's limit the field drives at (R6)
    expect(DIFFICULTY_LIMIT.medium).toBeGreaterThan(DIFFICULTY_LIMIT.easy);
    expect(DIFFICULTY_LIMIT.hard).toBeGreaterThan(DIFFICULTY_LIMIT.medium);
    // The quickest driver on Hard, on a track that suits them, never beats your car's limit
    for (const track of ALL_TRACKS) {
      for (const driver of AI_DRIVER_ROSTER) {
        expect(driverLimit(driver, DIFFICULTY_LIMIT.hard, track)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('changes how fast AI cars actually drive', () => {
    const spline = new TrackSpline(TRACK_6_CYBER_DOCKS);
    const far = new THREE.Vector3(0, 0, 99999);
    const distanceAfter = (limit: number): number => {
      const manager = new AIDriverManager();
      manager.setDifficultyLimit(limit);
      manager.resetGrid(spline);
      const car = manager.cars[0]!;
      let metres = 0;
      let before = car.position.clone();
      // A whole minute, so both cars take every kind of corner (a short window can end
      // with the faster car braking for a hairpin the slower one hasn't reached yet)
      for (let i = 0; i < 60 * 60; i++) {
        manager.update(1 / 60, far);
        metres += car.position.distanceTo(before);
        before = car.position.clone();
      }
      return metres;
    };
    const easy = distanceAfter(DIFFICULTY_LIMIT.easy);
    const hard = distanceAfter(DIFFICULTY_LIMIT.hard);
    expect(hard).toBeGreaterThan(easy * 1.1);
    // Two minutes of racing on a 6 km track (R8): more than the 5 s default under a full run
  }, 30_000);

  it('makes qualifying times quicker in step with the race pace', () => {
    const track = ALL_TRACKS[0]!;
    const easy = QualifyingManager.generateAIBenchmarks(track, 1, DIFFICULTY_LIMIT.easy);
    const medium = QualifyingManager.generateAIBenchmarks(track, 1, DIFFICULTY_LIMIT.medium);
    const hard = QualifyingManager.generateAIBenchmarks(track, 1, DIFFICULTY_LIMIT.hard);
    expect(QualifyingManager.generateAIBenchmarks(track)).toEqual(medium); // the default setting
    // Laps are run on the real speed plan, so times follow the share of the limit closely
    // (not exactly: braking is the car's, the same on every difficulty)
    const ratio = hard[0]!.lapTimeMs / easy[0]!.lapTimeMs;
    expect(ratio).toBeLessThan(1);
    expect(ratio).toBeCloseTo(DIFFICULTY_LIMIT.easy / DIFFICULTY_LIMIT.hard, 1);
  });
});
