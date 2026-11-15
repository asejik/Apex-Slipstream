import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRaceCar, createStaticRaceCar } from '../src/render/RaceCarModel';
import { AIDriverManager } from '../src/ai/AIDriverManager';

/** Draw calls for one object tree: one per material group of each mesh */
function drawCalls(root: THREE.Object3D): number {
  let calls = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    calls += Array.isArray(mesh.material) ? Math.max(1, mesh.geometry.groups.length) : 1;
  });
  return calls;
}

describe('Race car model (U-07)', () => {
  it('is a car-sized open-wheeler: about 4.6 m long, at most 1.9 m wide, on the ground', () => {
    const car = createRaceCar(0xff0000, 0xffffff);
    const box = new THREE.Box3().setFromObject(car.group);
    const size = box.getSize(new THREE.Vector3());

    expect(size.z).toBeGreaterThan(4.2);
    expect(size.z).toBeLessThan(4.9);
    expect(size.x).toBeLessThanOrEqual(1.95); // the barriers allow a 0.9 m half-width
    expect(size.y).toBeLessThan(1.2);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    // Nose points forward (-Z): the front wing is further from the centre than the rear wing
    expect(-box.min.z).toBeGreaterThan(box.max.z);
  });

  it('has four wheels that sit on the ground, fronts ahead of rears', () => {
    const { wheels } = createRaceCar(0x00ff00, 0x000000);
    for (const wheel of [wheels.fl, wheels.fr, wheels.rl, wheels.rr]) {
      const box = new THREE.Box3().setFromObject(wheel);
      // An 18-sided tyre's lowest flat sits a few millimetres above its true radius
      expect(Math.abs(box.min.y)).toBeLessThan(0.02);
    }
    expect(wheels.fl.position.z).toBeLessThan(wheels.rl.position.z);
    expect(wheels.fl.position.x).toBeLessThan(0);
    expect(wheels.fr.position.x).toBeGreaterThan(0);
  });

  it('shares geometry between cars and keeps to about 11 draw calls each', () => {
    const a = createRaceCar(0xff0000, 0xffffff);
    const b = createRaceCar(0x0000ff, 0xffff00);
    const bodyA = a.group.children[0] as THREE.Mesh;
    const bodyB = b.group.children[0] as THREE.Mesh;

    expect(bodyA.geometry).toBe(bodyB.geometry);
    expect(a.wheels.fl.geometry).toBe(b.wheels.fr.geometry);
    expect(a.group.children).toHaveLength(5); // body + 4 wheels
    expect(drawCalls(a.group)).toBeLessThanOrEqual(11);
  });

  it('paints each car in its own livery', () => {
    const a = createRaceCar(0xff0000, 0xffffff);
    const body = a.group.children[0] as THREE.Mesh;
    const [livery, accent] = body.material as THREE.MeshStandardMaterial[];
    expect(livery!.color.getHex()).toBe(0xff0000);
    expect(accent!.color.getHex()).toBe(0xffffff);
  });

  it('bakes the wheels into one mesh for cars whose wheels never move (5 draw calls)', () => {
    const moving = createRaceCar(0xff0000, 0xffffff);
    const still = createStaticRaceCar(0xff0000, 0xffffff);
    expect(still.children).toHaveLength(1);
    expect(drawCalls(still)).toBe(5);
    // Same car, same size
    const a = new THREE.Box3().setFromObject(moving.group).getSize(new THREE.Vector3());
    const b = new THREE.Box3().setFromObject(still).getSize(new THREE.Vector3());
    expect(b.x).toBeCloseTo(a.x, 3);
    expect(b.z).toBeCloseTo(a.z, 3);
  });

  it('builds all 19 AI cars from one shared model, 5 draw calls each', () => {
    const manager = new AIDriverManager();
    const bodies = manager.cars.map((c) => c.mesh.children[0] as THREE.Mesh);
    expect(new Set(bodies.map((b) => b.geometry)).size).toBe(1);
    expect(drawCalls(manager.group)).toBe(19 * 5);
  });
});
