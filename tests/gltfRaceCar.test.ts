import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { flipWinding, liveryColour, RACE_CAR_MODEL_URL } from '../src/render/GltfRaceCar';

const BLUE: [number, number, number] = [0.1, 0.2, 0.9];
const YELLOW: [number, number, number] = [1, 0.85, 0.1];

describe('Licensed race car model (U-07)', () => {
  it('repaints the red bodywork in the team colour, keeping its shading', () => {
    // The model's main body red (linear) shows the team colour as-is
    const main = liveryColour([0.38, 0.01, 0.01], BLUE, YELLOW);
    expect(main[0]).toBeCloseTo(BLUE[0], 2);
    expect(main[2]).toBeCloseTo(BLUE[2], 2);
    // Shadowed red stays darker; highlights get brighter (capped at full)
    const shadow = liveryColour([0.13, 0.01, 0.01], BLUE, YELLOW);
    const highlight = liveryColour([0.79, 0.03, 0.05], BLUE, YELLOW);
    expect(shadow[2]).toBeLessThan(main[2]);
    expect(highlight[2]).toBe(1);
  });

  it('repaints the white trim in the accent colour', () => {
    expect(liveryColour([0.95, 0.95, 0.95], BLUE, YELLOW)).toEqual([0.95, 0.8075, 0.095].map((v) => expect.closeTo(v, 3)));
  });

  it('keeps the grey stripe and dark carbon as they are', () => {
    expect(liveryColour([0.22, 0.22, 0.22], BLUE, YELLOW)).toEqual([0.22, 0.22, 0.22]);
    expect(liveryColour([0.03, 0.09, 0.09], BLUE, YELLOW)).toEqual([0.03, 0.09, 0.09]);
  });

  it('leaves carbon, tyres and rims alone', () => {
    expect(liveryColour([0.05, 0.05, 0.06], BLUE, YELLOW)).toEqual([0.05, 0.05, 0.06]); // carbon
    expect(liveryColour([0.4, 0.4, 0.42], BLUE, YELLOW)).toEqual([0.4, 0.4, 0.42]); // rim grey
  });

  it('turns mirrored triangles back the right way out', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 2, 0, 0, 3]), 3));
    flipWinding(g);
    expect(Array.from(g.getAttribute('position').array)).toEqual([0, 0, 0, 0, 1, 0, 1, 0, 0]);
    expect(Array.from(g.getAttribute('normal').array)).toEqual([0, 0, 1, 0, 0, 3, 0, 0, 2]);
  });

  it('ships the model file, credits it, and caches it for offline play', () => {
    const file = path.resolve(__dirname, '../public', RACE_CAR_MODEL_URL.slice(1));
    const bytes = fs.readFileSync(file);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('glTF');
    expect(bytes.length).toBeLessThan(400 * 1024);

    const credits = fs.readFileSync(path.resolve(__dirname, '../docs/CREDITS.md'), 'utf-8');
    expect(credits).toMatch(/race-car\.glb/);
    expect(credits).toMatch(/CC0/);

    const sw = fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf-8');
    expect(sw).toContain(`'${RACE_CAR_MODEL_URL}'`);
  });
});
