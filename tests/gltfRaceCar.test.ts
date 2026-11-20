import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { flipWinding, liveryColour, paletteColourAt, RACE_CAR_MODEL_URL, withFloatAttributes } from '../src/render/GltfRaceCar';
import { PALETTE_COLOURS, PALETTE_HEIGHT, PALETTE_WIDTH } from '../src/render/raceCarPalette';

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

  it('has a baked colour for every point on the model, so no browser image read is needed', () => {
    // Read every UV in the model file and map it to a palette pixel exactly as the game does
    const bytes = fs.readFileSync(path.resolve(__dirname, '../public', RACE_CAR_MODEL_URL.slice(1)));
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf-8'));
    const binStart = 20 + jsonLength + 8;
    let checked = 0;
    for (const mesh of gltf.meshes) {
      for (const prim of mesh.primitives) {
        const accessor = gltf.accessors[prim.attributes.TEXCOORD_0];
        const view = gltf.bufferViews[accessor.bufferView];
        const stride = view.byteStride ?? 8;
        const base = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        for (let k = 0; k < accessor.count; k++) {
          const u = bytes.readFloatLE(base + k * stride);
          const v = bytes.readFloatLE(base + k * stride + 4);
          const x = Math.min(PALETTE_WIDTH - 1, Math.max(0, Math.floor((u - Math.floor(u)) * PALETTE_WIDTH)));
          const y = Math.min(PALETTE_HEIGHT - 1, Math.max(0, Math.floor((v - Math.floor(v)) * PALETTE_HEIGHT)));
          expect(PALETTE_COLOURS[`${x},${y}`], `${x},${y}`).toBeDefined();
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('paints a livery in several colours, never one flat colour (owner report 2026-11-15)', () => {
    const painted = new Set(
      Object.values(PALETTE_COLOURS).map((hex) => {
        const c = new THREE.Color(hex);
        return liveryColour([c.r, c.g, c.b], BLUE, YELLOW).map((n) => n.toFixed(2)).join(',');
      })
    );
    // Body (blue shades), trim (yellow) and the untouched greys and carbon all appear
    expect(painted.size).toBeGreaterThan(5);
    const asList = [...painted].map((s) => s.split(',').map(Number));
    expect(asList.some(([r, g, b]) => b! > r! && b! > g!)).toBe(true); // blue body
    expect(asList.some(([r, g, b]) => r! > b! && g! > b!)).toBe(true); // yellow trim
    expect(asList.some(([r, g, b]) => Math.abs(r! - g!) < 0.01 && Math.abs(g! - b!) < 0.01)).toBe(true); // grey
  });

  it('falls back to dark carbon, not trim, for a spot missing from the table', () => {
    const [r, g, b] = paletteColourAt(0.9999, 0.9999); // a far corner of the palette, unused
    expect(Math.max(r, g, b)).toBeLessThan(0.1);
    expect(liveryColour([r, g, b], BLUE, YELLOW)).toEqual([r, g, b]);
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

describe('The car model is quantized (P12-R01)', () => {
  it('ships in smaller number types, with the UVs kept exact as floats', () => {
    const bytes = fs.readFileSync(path.resolve(__dirname, '../public', RACE_CAR_MODEL_URL.slice(1)));
    // 243 KB before; quantized about 183 KB
    expect(bytes.length).toBeLessThan(190 * 1024);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf-8'));
    // Read natively by three.js: no decoder, nothing for the security policy to allow
    expect(gltf.extensionsUsed).toEqual(['KHR_mesh_quantization']);
    for (const mesh of gltf.meshes) {
      for (const prim of mesh.primitives) {
        expect(gltf.accessors[prim.attributes.POSITION].componentType).not.toBe(5126); // not 32-bit floats
        // The livery is read from the UVs: rounded UVs moved 47 triangles to the wrong colour
        expect(gltf.accessors[prim.attributes.TEXCOORD_0].componentType).toBe(5126);
      }
    }
    // The tyres are still found by name
    const names = gltf.nodes.map((n: { name?: string }) => n.name).filter(Boolean);
    expect(names.filter((n: string) => /tire/i.test(n))).toHaveLength(4);
  });

  it('turns integer and normalized attributes into floats before they are moved into car space', () => {
    const geometry = new THREE.BufferGeometry();
    // 16-bit integer positions, as quantized, and 8-bit normalized normals
    geometry.setAttribute('position', new THREE.BufferAttribute(new Uint16Array([0, 1000, 16383]), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Int8Array([0, 127, -127]), 3, true));
    withFloatAttributes(geometry);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    expect(position.array).toBeInstanceOf(Float32Array);
    expect(Array.from(position.array)).toEqual([0, 1000, 16383]);
    expect(normal.normalized).toBe(false);
    expect(normal.getY(0)).toBeCloseTo(1, 5);
    expect(normal.getZ(0)).toBeCloseTo(-1, 5);
    // Scaled into car space, nothing is clipped by the old number type
    geometry.applyMatrix4(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001));
    expect(position.getZ(0)).toBeCloseTo(16.383, 3);
  });
});
