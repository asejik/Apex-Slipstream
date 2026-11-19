import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createScene, graphicsProfile, setSunShadowSize } from '../src/render/SceneSetup';

describe('Graphics levels (Decision 11 and 16)', () => {
  it('Medium sits between High and Low on every count', () => {
    const high = graphicsProfile('high');
    const medium = graphicsProfile('medium');
    const low = graphicsProfile('low');
    expect(high.maxPixelRatio).toBeGreaterThan(medium.maxPixelRatio);
    expect(medium.maxPixelRatio).toBeGreaterThan(low.maxPixelRatio);
    expect(high.shadowMapSize).toBeGreaterThan(medium.shadowMapSize);
    expect([high.shadows, medium.shadows, low.shadows]).toEqual([true, true, false]);
    // Rain and spray are weather information (Decision 13): only Low thins them
    expect([high.fullWeather, medium.fullWeather, low.fullWeather]).toEqual([true, true, false]);
  });

  it('resizes the sun shadow and drops the old map so it is made again', () => {
    const scene = createScene();
    const sun = scene.getObjectByName('sun') as THREE.DirectionalLight;
    expect(sun.shadow.mapSize.width).toBe(2048);
    const oldMap = new THREE.WebGLRenderTarget(1, 1);
    sun.shadow.map = oldMap;
    setSunShadowSize(scene, 1024);
    expect(sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(sun.shadow.map).toBeNull();
  });
});
