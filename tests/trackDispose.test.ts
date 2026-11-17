import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { TrackGeometryGenerator } from '../src/track/TrackGeometryGenerator';
import { TrackSpline } from '../src/track/TrackSpline';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';

describe('A track frees its GPU memory when it is replaced (P15-10)', () => {
  it('disposes every geometry and material it built, and no shared texture', () => {
    const group = TrackGeometryGenerator.buildTrackMeshes(new TrackSpline(ALL_TRACKS[0]!), 0.3);
    // The wet road's reflection is shared with every track (WeatherEffects): it must survive
    const shared = new THREE.Texture();
    let sharedDisposed = false;
    shared.addEventListener('dispose', () => (sharedDisposed = true));
    const road = group.getObjectByName('road') as THREE.Mesh;
    (road.material as THREE.MeshStandardMaterial).envMap = shared;

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    let instanced = 0;
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m);
      if ((object as THREE.InstancedMesh).isInstancedMesh) instanced++;
    });
    expect(geometries.size).toBeGreaterThan(5);
    expect(instanced).toBeGreaterThan(0);

    const freed = new Set<object>();
    for (const g of geometries) g.addEventListener('dispose', () => freed.add(g));
    for (const m of materials) m.addEventListener('dispose', () => freed.add(m));

    TrackGeometryGenerator.disposeTrackMeshes(group);

    for (const g of geometries) expect(freed.has(g)).toBe(true);
    for (const m of materials) expect(freed.has(m)).toBe(true);
    expect(sharedDisposed).toBe(false);
  }, 30_000);

  it('frees the old track whenever a track loads', () => {
    const main = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');
    expect(main).toMatch(/this\.scene\.remove\(this\.trackGroup\);\s*TrackGeometryGenerator\.disposeTrackMeshes\(this\.trackGroup\);/);
  });
});
