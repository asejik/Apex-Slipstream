import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { forecastFor, recommendedTyre } from '../src/tires/TyreAdvice';
import { getTireCompoundGrip, TIRE_PROFILES, tyreTraction } from '../src/tires/TireTypes';
import { VehiclePhysics, DEFAULT_VEHICLE_CONFIG } from '../src/engine/VehiclePhysics';
import type { InputState } from '../src/engine/InputManager';
import { conditionsConfig, DIFFICULTY_LIMIT, driverLimit } from '../src/ai/AIRacecraft';
import { AI_DRIVER_ROSTER } from '../src/ai/AIDriverProfiles';
import { QualifyingManager } from '../src/engine/QualifyingManager';

const STEP = 1 / 60;

function input(throttle: number, brake: number, steering: number): InputState {
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

/** A car at `speedMs` heading north */
function carAt(speedMs: number): VehiclePhysics {
  const car = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0);
  car.state.velocity.set(0, 0, -speedMs);
  return car;
}

describe('Weather forecast (R7)', () => {
  it('is the same for the same season and round, and differs between seasons', () => {
    const coastal = ALL_TRACKS[0]!;
    expect(forecastFor(coastal, 'season_x', 0)).toEqual(forecastFor(coastal, 'season_x', 0));
    let wet = 0;
    const seasons = 600;
    for (let s = 0; s < seasons; s++) {
      if (forecastFor(coastal, `season_${s}`, 0).condition === 'wet') wet++;
    }
    // It rains about as often as the track's chance of rain
    expect(wet / seasons).toBeGreaterThan(coastal.rainChance - 0.07);
    expect(wet / seasons).toBeLessThan(coastal.rainChance + 0.07);
  });

  it('never rains in the desert and always on Stormy Summit', () => {
    const desert = ALL_TRACKS.find((t) => t.id === 'track_05_desert')!;
    const stormy = ALL_TRACKS.find((t) => t.id === 'track_07_stormy_pass')!;
    for (let s = 0; s < 50; s++) {
      expect(forecastFor(desert, `season_${s}`, 4).condition).toBe('dry');
      expect(forecastFor(stormy, `season_${s}`, 6).condition).toBe('wet');
    }
  });

  it('is shown on the hub', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    expect(html).toMatch(/id="hub-forecast"/);
  });
});

describe('Wet grip (R7, P15-05)', () => {
  it('wet tarmac uses each compound\'s wet grip, and the Wet compound is best in the rain', () => {
    for (const compound of ['street', 'all_terrain', 'wet'] as const) {
      expect(getTireCompoundGrip(compound, 'asphalt', 'wet')).toBe(TIRE_PROFILES[compound].wetGrip);
      expect(getTireCompoundGrip(compound, 'asphalt', 'dry')).toBe(TIRE_PROFILES[compound].dryGrip);
      // Kerbs and gravel are slicker still in the rain
      expect(getTireCompoundGrip(compound, 'curb', 'wet')).toBeLessThan(getTireCompoundGrip(compound, 'curb', 'dry'));
      expect(getTireCompoundGrip(compound, 'gravel', 'wet')).toBeLessThan(getTireCompoundGrip(compound, 'gravel', 'dry'));
      // A kerb is part of the road for the car's reach
      expect(tyreTraction(compound, 'curb', 'wet')).toBe(tyreTraction(compound, 'asphalt', 'wet'));
    }
    expect(tyreTraction('wet', 'asphalt', 'wet')).toBeGreaterThan(tyreTraction('all_terrain', 'asphalt', 'wet'));
    expect(tyreTraction('all_terrain', 'asphalt', 'wet')).toBeGreaterThan(tyreTraction('street', 'asphalt', 'wet'));
    expect(recommendedTyre(forecastFor(ALL_TRACKS.find((t) => t.rainChance === 1)!))).toBe('wet');
  });

  it('limits how tight the car can turn at speed: Street in the rain turns about half as hard', () => {
    const turnedIn = (traction: number): number => {
      const car = carAt(40);
      for (let i = 0; i < 60; i++) {
        car.update(STEP, input(1, 0, 1), { grip: 1, drag: 1, traction });
        car.state.velocity.set(-Math.sin(car.state.heading) * 40, 0, -Math.cos(car.state.heading) * 40);
      }
      return Math.abs(car.state.heading);
    };
    const dry = turnedIn(1);
    const streetWet = turnedIn(tyreTraction('street', 'asphalt', 'wet'));
    const wetWet = turnedIn(tyreTraction('wet', 'asphalt', 'wet'));
    expect(streetWet / dry).toBeCloseTo(0.5, 1);
    expect(wetWet / dry).toBeCloseTo(0.95, 1);
    // Unchanged in the dry on Street: the turn the owner approved in R6
    expect(dry).toBeCloseTo(DEFAULT_VEHICLE_CONFIG.maxCorneringAccel / 40, 1);
  });

  it('stops the car later in the rain on Street than on Wet tyres', () => {
    const stoppingDistance = (traction: number): number => {
      const car = carAt(45);
      let steps = 0;
      while (car.state.velocity.length() > 1 && steps < 60 * 20) {
        car.update(STEP, input(0, 1, 0), { grip: 1, drag: 1, traction });
        steps++;
      }
      return -car.state.position.z;
    };
    const street = stoppingDistance(tyreTraction('street', 'asphalt', 'wet'));
    const wet = stoppingDistance(tyreTraction('wet', 'asphalt', 'wet'));
    const dry = stoppingDistance(1);
    expect(street).toBeGreaterThan(wet * 1.6);
    expect(wet).toBeGreaterThan(dry);
  });
});

describe('The AI in the rain (R7)', () => {
  it('fits Wet tyres and corners and brakes within their grip; the dry car is unchanged', () => {
    expect(conditionsConfig('dry')).toEqual(DEFAULT_VEHICLE_CONFIG);
    const wet = conditionsConfig('wet');
    const grip = TIRE_PROFILES.wet.wetGrip;
    expect(wet.maxCorneringAccel).toBeCloseTo(DEFAULT_VEHICLE_CONFIG.maxCorneringAccel * grip, 5);
    expect(wet.brakeRate).toBeCloseTo(DEFAULT_VEHICLE_CONFIG.brakeRate * grip, 5);
  });

  it('gives wet specialists their bonus in the rain', () => {
    const coastal = ALL_TRACKS[0]!;
    const wetDriver = AI_DRIVER_ROSTER.find((d) => d.terrainAffinity === 'wet' && d.skill < 0.99)!;
    const dry = driverLimit(wetDriver, DIFFICULTY_LIMIT.medium, coastal, 'dry');
    const rain = driverLimit(wetDriver, DIFFICULTY_LIMIT.medium, coastal, 'wet');
    expect(rain).toBeGreaterThan(dry);
  });

  it('sets slower qualifying times in the rain', () => {
    const coastal = ALL_TRACKS[0]!;
    const pole = (weather: 'dry' | 'wet'): number =>
      Math.min(...QualifyingManager.generateAIBenchmarks(coastal, 1, DIFFICULTY_LIMIT.medium, weather).map((r) => r.lapTimeMs));
    expect(pole('wet')).toBeGreaterThan(pole('dry') * 1.01);
  });
});
