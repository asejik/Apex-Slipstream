import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { WeatherEffects, SprayEmitter } from '../src/effects/WeatherEffects';
import { createScene, SCENE_COLOURS } from '../src/render/SceneSetup';

const STEP = 1 / 60;

function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 1000);
  cam.position.set(0, 3, 6);
  return cam;
}

function car(speedKmh: number, x = 0): SprayEmitter {
  return { position: new THREE.Vector3(x, 0, 0), heading: 0, speedKmh };
}

function sunOf(scene: THREE.Scene): THREE.DirectionalLight {
  let sun: THREE.DirectionalLight | null = null;
  scene.traverse((o) => {
    if (o instanceof THREE.DirectionalLight) sun = o;
  });
  return sun!;
}

describe('How rain looks (R7 part 2)', () => {
  it('greys the sky, shortens the view and dims the sun in the rain, and puts it all back in the dry', () => {
    const scene = createScene();
    const effects = new WeatherEffects();
    const fog = scene.fog as THREE.FogExp2;
    const dryDensity = fog.density;
    const dryIntensity = sunOf(scene).intensity;

    effects.setWeather('wet', scene);
    expect(effects.group.visible).toBe(true);
    expect((scene.background as THREE.Color).getHex()).toBe(SCENE_COLOURS.rainSky);
    expect(fog.density).toBeGreaterThan(dryDensity * 2);
    expect(sunOf(scene).intensity).toBeLessThan(dryIntensity);

    effects.setWeather('dry', scene);
    expect(effects.group.visible).toBe(false);
    expect((scene.background as THREE.Color).getHex()).toBe(SCENE_COLOURS.sky);
    expect(fog.density).toBe(dryDensity);
    expect(sunOf(scene).intensity).toBe(dryIntensity);
  });

  it('makes the road dark and glossy when wet', () => {
    const effects = new WeatherEffects();
    const track = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: SCENE_COLOURS.asphalt, roughness: 0.8 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    road.name = 'road';
    track.add(road);
    effects.setWeather('wet', createScene());
    effects.applyToTrack(track);
    expect(material.color.getHex()).toBe(SCENE_COLOURS.wetAsphalt);
    expect(material.roughness).toBeLessThan(0.5);
  });

  it('throws spray behind cars above 40 km/h in the rain, never in the dry', () => {
    const scene = createScene();
    const effects = new WeatherEffects();
    const cam = camera();

    effects.setWeather('dry', scene);
    for (let i = 0; i < 30; i++) effects.update(cam, 720, car(180), [car(180, 5)], STEP, STEP);
    expect(effects.liveSprayParticles).toBe(0);

    effects.setWeather('wet', scene);
    for (let i = 0; i < 30; i++) effects.update(cam, 720, car(20), null, STEP, STEP);
    expect(effects.liveSprayParticles).toBe(0);

    for (let i = 0; i < 30; i++) effects.update(cam, 720, car(180), [car(180, 5)], STEP, STEP);
    // Two cars at top speed for half a second (owner, R7 playtest: lighter spray than at first)
    expect(effects.liveSprayParticles).toBeGreaterThan(20);
  });

  it('keeps the spray a light, low mist (owner, R7 playtest)', () => {
    const scene = createScene();
    const effects = new WeatherEffects();
    const cam = camera();
    effects.setWeather('wet', scene);
    // One car at top speed for 2 s: well under 40 puffs alive at once
    for (let i = 0; i < 120; i++) effects.update(cam, 720, car(180), null, STEP, STEP);
    expect(effects.liveSprayParticles).toBeLessThan(40);
    // None rises above 1.5 m
    const positions = (effects.group.getObjectByName('spray') as THREE.Points).geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) expect(positions.getY(i)).toBeLessThan(1.5);
  });

  it('makes the wet road mirror the sky, and drops the mirror in the dry', () => {
    const effects = new WeatherEffects();
    const reflection = new THREE.Texture();
    effects.setSkyReflection(reflection);
    const track = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    road.name = 'road';
    track.add(road);
    effects.setWeather('wet', createScene());
    effects.applyToTrack(track);
    expect(material.envMap).toBe(reflection);
    expect(material.roughness).toBeLessThan(0.3);
    effects.setWeather('dry', createScene());
    effects.applyToTrack(track);
    expect(material.envMap).toBeNull();
    expect(material.roughness).toBe(0.8);
  });

  it('keeps spray within its pool, fewer puffs and streaks on Low graphics, and none far from the camera', () => {
    const scene = createScene();
    const effects = new WeatherEffects();
    const cam = camera();
    effects.setWeather('wet', scene);
    const field = Array.from({ length: 19 }, (_, i) => car(180, i * 3));
    for (let i = 0; i < 120; i++) effects.update(cam, 720, car(180), field, STEP, STEP);
    const high = effects.liveSprayParticles;
    const highStreaks = effects.rainStreakCount;
    expect(high).toBeLessThanOrEqual(900);

    effects.setQuality(false);
    for (let i = 0; i < 120; i++) effects.update(cam, 720, car(180), field, STEP, STEP);
    expect(effects.liveSprayParticles).toBeLessThanOrEqual(300);
    expect(effects.rainStreakCount).toBeLessThan(highStreaks);

    // A car 1 km away throws no spray you could see
    const far = new WeatherEffects();
    far.setWeather('wet', scene);
    for (let i = 0; i < 30; i++) far.update(cam, 720, car(180, 1000), null, STEP, STEP);
    expect(far.liveSprayParticles).toBe(0);
  });

  it('freezes the spray when the race is not running (paused, hub)', () => {
    const scene = createScene();
    const effects = new WeatherEffects();
    const cam = camera();
    effects.setWeather('wet', scene);
    for (let i = 0; i < 10; i++) effects.update(cam, 720, car(180), null, STEP, STEP);
    const live = effects.liveSprayParticles;
    for (let i = 0; i < 120; i++) effects.update(cam, 720, car(180), null, STEP, 0);
    expect(effects.liveSprayParticles).toBe(live);
  });

  it('lists its colours in docs/DESIGN.md', () => {
    const design = fs.readFileSync(path.resolve(__dirname, '../docs/DESIGN.md'), 'utf-8');
    for (const hex of [SCENE_COLOURS.rainSky, SCENE_COLOURS.wetAsphalt, SCENE_COLOURS.rainStreak, SCENE_COLOURS.spray]) {
      expect(design).toContain(`#${hex.toString(16).padStart(6, '0')}`);
    }
  });
});
