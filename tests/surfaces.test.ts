import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { ALL_TRACKS, dirtShare, isDirtAt, TrackData } from '../src/track/TrackDefinitions';
import { TrackSpline } from '../src/track/TrackSpline';
import { TrackGeometryGenerator } from '../src/track/TrackGeometryGenerator';
import { getTireCompoundGrip, TIRE_PROFILES, tyreTraction, WeatherCondition } from '../src/tires/TireTypes';
import { aiTyreFor, buildSpeedPlan, buildTrackProfile, planLapSeconds } from '../src/ai/AIRacecraft';
import { DEFAULT_VEHICLE_CONFIG } from '../src/engine/VehiclePhysics';
import { SCENE_COLOURS } from '../src/render/SceneSetup';

const alpine = ALL_TRACKS.find((t) => t.id === 'track_04_alpine')!;
const desert = ALL_TRACKS.find((t) => t.id === 'track_05_desert')!;

/** The weathers a track can have */
function weathersOf(track: TrackData): WeatherCondition[] {
  if (track.rainChance >= 1) return ['wet'];
  if (track.rainChance <= 0) return ['dry'];
  return ['dry', 'wet'];
}

/** Flat-out lap on `tyre`, with the car's own physics */
function lapOn(track: TrackData, tyre: 'street' | 'all_terrain' | 'wet', weather: WeatherCondition): number {
  const traction = tyreTraction(tyre, 'asphalt', weather);
  const config = {
    ...DEFAULT_VEHICLE_CONFIG,
    maxCorneringAccel: DEFAULT_VEHICLE_CONFIG.maxCorneringAccel * traction,
    brakeRate: DEFAULT_VEHICLE_CONFIG.brakeRate * traction
  };
  const profile = buildTrackProfile(new TrackSpline(track), config, weather, tyre);
  return planLapSeconds(buildSpeedPlan(profile, 1, config), profile, 1);
}

describe('Mixed surfaces (R7 part 3)', () => {
  it('has dirt stretches on Alpine Ridge (30%) and Desert Dunes (35%), none on the tarmac tracks', () => {
    expect(dirtShare(alpine)).toBeCloseTo(0.3, 5);
    expect(dirtShare(desert)).toBeCloseTo(0.35, 5);
    expect(dirtShare(ALL_TRACKS[0]!)).toBe(0);
    expect(isDirtAt(alpine, 0.25)).toBe(true);
    expect(isDirtAt(alpine, 0.45)).toBe(false);
  });

  it('reads the road as dirt on a dirt stretch, with each compound\'s off-road grip', () => {
    const spline = new TrackSpline(alpine);
    const onDirt = spline.getPointAt(0.27);
    const onTarmac = spline.getPointAt(0.45);
    expect(spline.evaluateSurface(onDirt).surface).toBe('dirt');
    expect(spline.evaluateSurface(onTarmac).surface).toBe('asphalt');
    for (const compound of ['street', 'all_terrain', 'wet'] as const) {
      expect(getTireCompoundGrip(compound, 'dirt')).toBe(TIRE_PROFILES[compound].gravelGrip);
      expect(getTireCompoundGrip(compound, 'dirt', 'wet')).toBeLessThan(getTireCompoundGrip(compound, 'dirt'));
    }
    // All-Terrain is the compound for dirt
    expect(tyreTraction('all_terrain', 'dirt')).toBeGreaterThan(tyreTraction('wet', 'dirt'));
    expect(tyreTraction('wet', 'dirt')).toBeGreaterThan(tyreTraction('street', 'dirt'));
  });

  it('makes each compound the right choice on at least one track (R7 done-when)', () => {
    const rightOn = new Map<string, string[]>();
    for (const track of ALL_TRACKS) {
      for (const weather of weathersOf(track)) {
        const tyre = aiTyreFor(track, weather);
        rightOn.set(tyre, [...(rightOn.get(tyre) ?? []), `${track.name} (${weather})`]);
      }
    }
    expect(rightOn.get('street')?.length).toBeGreaterThan(0);
    expect(rightOn.get('wet')?.length).toBeGreaterThan(0);
    expect(rightOn.get('all_terrain')?.length).toBeGreaterThan(0);
    expect(aiTyreFor(ALL_TRACKS[0]!, 'dry')).toBe('street');
    expect(aiTyreFor(ALL_TRACKS[0]!, 'wet')).toBe('wet');
    expect(aiTyreFor(alpine, 'dry')).toBe('all_terrain');
  }, 60_000);

  it('recommends a tyre no slower than the fastest flat-out lap (within a 0.3% tie)', () => {
    for (const track of ALL_TRACKS) {
      for (const weather of weathersOf(track)) {
        const laps = (['street', 'all_terrain', 'wet'] as const).map((tyre) => lapOn(track, tyre, weather));
        const best = Math.min(...laps);
        const advised = aiTyreFor(track, weather);
        const advisedLap = laps[['street', 'all_terrain', 'wet'].indexOf(advised)]!;
        expect(advisedLap).toBeLessThanOrEqual(best * 1.003 + 1e-9);
      }
    }
    // On Alpine, All-Terrain beats Street by more than half a second a lap
    expect(lapOn(alpine, 'street', 'dry') - lapOn(alpine, 'all_terrain', 'dry')).toBeGreaterThan(0.5);
  }, 120_000);

  it('slows the AI through dirt corners on Street-grip tyres', () => {
    const spline = new TrackSpline(alpine);
    const street = buildTrackProfile(spline, DEFAULT_VEHICLE_CONFIG, 'dry', 'street');
    const allTerrain = buildTrackProfile(spline, DEFAULT_VEHICLE_CONFIG, 'dry', 'all_terrain');
    let dirtSamples = 0;
    for (let i = 0; i < street.count; i++) {
      if (street.surfaceGrip[i]! < 1) dirtSamples++;
      expect(street.cornerSpeed[i]!).toBeLessThanOrEqual(allTerrain.cornerSpeed[i]! / allTerrain.surfaceGrip[i]! + 1e-3);
    }
    expect(dirtSamples / street.count).toBeGreaterThan(0.25);
  });

  it('draws dirt stretches brown and without kerbs', () => {
    const spline = new TrackSpline(alpine);
    const group = TrackGeometryGenerator.buildTrackMeshes(spline);
    const road = group.getObjectByName('road') as THREE.Mesh;
    const colours = road.geometry.getAttribute('color') as THREE.BufferAttribute;
    const material = road.material as THREE.MeshStandardMaterial;
    const segments = colours.count / 2 - 1;
    const sample = (t: number): THREE.Color => {
      const i = Math.round(t * segments) * 2;
      return new THREE.Color(colours.getX(i), colours.getY(i), colours.getZ(i)).multiply(material.color);
    };
    const dirt = new THREE.Color(SCENE_COLOURS.dirt);
    expect(sample(0.27).r).toBeCloseTo(dirt.r, 2);
    expect(sample(0.27).b).toBeCloseTo(dirt.b, 2);
    expect(sample(0.45).getHex()).toBe(SCENE_COLOURS.asphalt);

    // No kerb block sits inside a dirt stretch (a 2 m block may straddle where one starts)
    const halfBlock = 1.0 / spline.totalLength;
    const kerbs = group.getObjectByName('kerbs')!;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    kerbs.traverse((o) => {
      if (!(o instanceof THREE.InstancedMesh)) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        const t = spline.findClosestT(position).t;
        expect(isDirtAt(alpine, t - halfBlock) && isDirtAt(alpine, t + halfBlock)).toBe(false);
      }
    });
  });

  it('shows the road surface on the tyre screen and lists the dirt colour in DESIGN.md', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    expect(html).toMatch(/id="tyre-surface"/);
    const design = fs.readFileSync(path.resolve(__dirname, '../docs/DESIGN.md'), 'utf-8');
    expect(design).toContain(`#${SCENE_COLOURS.dirt.toString(16)}`);
  });
});
