import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RaceCar } from './RaceCarModel';
import { PALETTE_COLOURS, PALETTE_HEIGHT, PALETTE_WIDTH } from './raceCarPalette';

/**
 * The licensed race car model (U-07): "Free, Low Poly 3D Race car model" by mabaci,
 * CC0 1.0 (public domain), from OpenGameArt. See docs/CREDITS.md.
 *
 * The file colours the car from one large palette image. Instead of a recoloured copy of
 * that image per team, each vertex's colour is read from the palette once, and the red
 * bodywork and white trim are swapped for the team's colours. Every car then shares one
 * material, and an AI car is a single mesh: one draw call.
 */
export const RACE_CAR_MODEL_URL = '/models/race-car.glb';

/** Same size as the built-in car (RaceCarModel), so collisions and the camera still fit */
const TARGET_LENGTH = 4.6;

type Rgb = [number, number, number];

/**
 * The colour a vertex gets in a livery. The model's red bodywork becomes `body` and its
 * white trim becomes `accent`, keeping the palette's shading; everything else (carbon,
 * tyres, rims, cockpit) keeps its own colour.
 */
export function liveryColour(sample: Readonly<Rgb>, body: Readonly<Rgb>, accent: Readonly<Rgb>): Rgb {
  // Colours are linear. The model's reds run from about 0.12 (shadowed) to 0.79 on the red
  // channel with almost no green or blue; its main body red is about 0.38.
  const [r, g, b] = sample;
  const isRed = r > 0.08 && r > 4 * g && r > 4 * b;
  const isWhite = r > 0.45 && g > 0.45 && b > 0.45 && Math.max(r, g, b) - Math.min(r, g, b) < 0.1;
  if (isRed) {
    const shade = Math.min(1.6, r / BODY_RED);
    return [Math.min(1, body[0] * shade), Math.min(1, body[1] * shade), Math.min(1, body[2] * shade)];
  }
  if (isWhite) {
    const shade = Math.min(1, (r + g + b) / 3);
    return [accent[0] * shade, accent[1] * shade, accent[2] * shade];
  }
  return [r, g, b];
}

/** The model's main bodywork red (linear red channel): the livery colour is shown as-is here */
const BODY_RED = 0.38;

/** Reverses the winding of every triangle in a non-indexed geometry (after a mirroring transform). */
export function flipWinding(geometry: THREE.BufferGeometry): void {
  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
    const size = attribute.itemSize;
    const array = attribute.array as Float32Array;
    for (let tri = 0; tri < attribute.count; tri += 3) {
      // Swap the 2nd and 3rd vertex of the triangle
      const a = (tri + 1) * size;
      const b = (tri + 2) * size;
      for (let k = 0; k < size; k++) {
        const t = array[a + k]!;
        array[a + k] = array[b + k]!;
        array[b + k] = t;
      }
    }
    attribute.needsUpdate = true;
  }
}

function hexToRgb(hex: number): Rgb {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/** Dark carbon (sRGB) for any palette spot missing from the table: never mistaken for trim */
const FALLBACK_COLOUR = 0x333333;

/**
 * The palette colour (linear RGB) at a uv. The colours come from a table baked from the
 * model file (raceCarPalette.ts), not from reading the image in the browser: some browsers
 * block or scramble image reads for privacy, which once painted whole cars one colour.
 * glTF textures are not flipped: v = 0 is the top row.
 */
export function paletteColourAt(u: number, v: number): Rgb {
  const x = Math.min(PALETTE_WIDTH - 1, Math.max(0, Math.floor((u - Math.floor(u)) * PALETTE_WIDTH)));
  const y = Math.min(PALETTE_HEIGHT - 1, Math.max(0, Math.floor((v - Math.floor(v)) * PALETTE_HEIGHT)));
  const hex = PALETTE_COLOURS[`${x},${y}`] ?? FALLBACK_COLOUR;
  // THREE.Color converts the sRGB hex to linear, like the livery colours
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

interface PreparedPart {
  /** Positions and normals in car space (nose to -Z, on the ground), non-indexed */
  geometry: THREE.BufferGeometry;
  /** The palette colour of each vertex, linear RGB */
  baseColours: Float32Array;
  /** For wheels: hub position in car space, and radius; null for the body */
  hub: THREE.Vector3 | null;
  radius: number;
  isFront: boolean;
  isLeft: boolean;
}

/** The loaded model, ready to make cars in any livery. */
export class LoadedRaceCarModel {
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.34,
    metalness: 0.34
  });
  /** Body and wheels merged in car space, for cars whose wheels never move (the AI) */
  private readonly merged: PreparedPart;

  constructor(private readonly parts: PreparedPart[]) {
    const placed = parts.map((p) => {
      const g = p.geometry.clone();
      if (p.hub) g.translate(p.hub.x, p.hub.y, p.hub.z);
      return g;
    });
    const merged = mergeGeometries(placed, false);
    if (!merged) throw new Error('GltfRaceCar: could not merge the car');
    const colours = new Float32Array(parts.reduce((n, p) => n + p.baseColours.length, 0));
    let offset = 0;
    for (const p of parts) {
      colours.set(p.baseColours, offset);
      offset += p.baseColours.length;
    }
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    this.merged = { geometry: merged, baseColours: colours, hub: null, radius: 0, isFront: false, isLeft: false };
  }

  /** A geometry that shares positions and normals with `part` but has this livery's colours */
  private painted(part: PreparedPart, body: Rgb, accent: Rgb): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', part.geometry.getAttribute('position'));
    geometry.setAttribute('normal', part.geometry.getAttribute('normal'));
    const colours = new Float32Array(part.baseColours.length);
    for (let i = 0; i < colours.length; i += 3) {
      const c = liveryColour(
        [part.baseColours[i]!, part.baseColours[i + 1]!, part.baseColours[i + 2]!],
        body,
        accent
      );
      colours[i] = c[0];
      colours[i + 1] = c[1];
      colours[i + 2] = c[2];
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geometry.boundingBox = part.geometry.boundingBox;
    geometry.boundingSphere = part.geometry.boundingSphere;
    return geometry;
  }

  /** An AI car: one mesh, one draw call */
  public createStatic(bodyHex: number, accentHex: number): THREE.Mesh {
    const mesh = new THREE.Mesh(this.painted(this.merged, hexToRgb(bodyHex), hexToRgb(accentHex)), this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** The player's car: a body and four wheels that can steer and spin about their hubs */
  public createDriven(bodyHex: number, accentHex: number): RaceCar & { frontRadius: number; rearRadius: number } {
    const body = hexToRgb(bodyHex);
    const accent = hexToRgb(accentHex);
    const group = new THREE.Group();
    const wheels: Partial<RaceCar['wheels']> = {};
    let frontRadius = 0.33;
    let rearRadius = 0.36;
    for (const part of this.parts) {
      const mesh = new THREE.Mesh(this.painted(part, body, accent), this.material);
      if (!part.hub) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      } else {
        mesh.position.copy(part.hub);
        const key = `${part.isFront ? 'f' : 'r'}${part.isLeft ? 'l' : 'r'}` as keyof RaceCar['wheels'];
        wheels[key] = mesh;
        if (part.isFront) frontRadius = part.radius;
        else rearRadius = part.radius;
      }
      group.add(mesh);
    }
    if (!wheels.fl || !wheels.fr || !wheels.rl || !wheels.rr) {
      throw new Error('GltfRaceCar: the model does not have four wheels');
    }
    return { group, wheels: wheels as RaceCar['wheels'], frontRadius, rearRadius };
  }
}

/**
 * The model's geometry is quantized (KHR_mesh_quantization, P12-R01): positions are 16-bit
 * integers scaled by their node, normals 8-bit. Moving them into car space would clip them in
 * those small number types, so every attribute becomes 32-bit floats first (once, at load).
 */
export function withFloatAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name);
    if (attribute.array instanceof Float32Array && !attribute.normalized) continue;
    const { count, itemSize } = attribute;
    const floats = new Float32Array(count * itemSize);
    for (let i = 0; i < count; i++) {
      // getX..getW give the real value: a normalized integer is turned back into -1 to 1
      floats[i * itemSize] = attribute.getX(i);
      if (itemSize > 1) floats[i * itemSize + 1] = attribute.getY(i);
      if (itemSize > 2) floats[i * itemSize + 2] = attribute.getZ(i);
      if (itemSize > 3) floats[i * itemSize + 3] = attribute.getW(i);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(floats, itemSize));
  }
  return geometry;
}

/**
 * Turns the loaded glTF scene into car-space parts: nose to -Z, 4.6 m long, on the ground,
 * centred, colours read from the palette, and each tyre centred on its own hub.
 */
function prepare(scene: THREE.Group): LoadedRaceCarModel {
  // Face the nose to -Z (the file faces +Z), then scale and place on the ground
  const root = new THREE.Group();
  root.add(scene);
  scene.rotation.y = Math.PI;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = TARGET_LENGTH / Math.max(size.x, size.z);
  const centre = box.getCenter(new THREE.Vector3());
  const toCarSpace = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));

  const parts: PreparedPart[] = [];

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    const matrix = new THREE.Matrix4().multiplyMatrices(toCarSpace, mesh.matrixWorld);
    let geometry = withFloatAttributes(mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone());
    geometry.applyMatrix4(matrix);
    // A mirroring transform (negative scale) turns triangles inside out; turn them back
    if (matrix.determinant() < 0) flipWinding(geometry);

    // Palette colour per vertex
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const count = geometry.getAttribute('position').count;
    const baseColours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const c: Rgb = uv ? paletteColourAt(uv.getX(i), uv.getY(i)) : paletteColourAt(-1, -1);
      baseColours.set(c, i * 3);
    }
    // Only positions and normals are kept: colours come from the livery
    const clean = new THREE.BufferGeometry();
    clean.setAttribute('position', geometry.getAttribute('position'));
    clean.setAttribute('normal', geometry.getAttribute('normal'));
    geometry = clean;

    const isTyre = /tire|tyre|wheel/i.test(mesh.name) || /tire|tyre|wheel/i.test(mesh.parent?.name ?? '');
    let hub: THREE.Vector3 | null = null;
    let radius = 0;
    if (isTyre) {
      geometry.computeBoundingBox();
      const tyreBox = geometry.boundingBox!;
      hub = tyreBox.getCenter(new THREE.Vector3());
      radius = (tyreBox.max.y - tyreBox.min.y) / 2;
      geometry.translate(-hub.x, -hub.y, -hub.z); // spin and steer about its own centre
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    parts.push({ geometry, baseColours, hub, radius, isFront: false, isLeft: false });
  });

  // Which wheel is which: fronts are nearer the nose (-Z), lefts are at -X
  const wheels = parts.filter((p) => p.hub);
  const midZ = wheels.reduce((z, p) => z + p.hub!.z, 0) / Math.max(1, wheels.length);
  for (const w of wheels) {
    w.isFront = w.hub!.z < midZ;
    w.isLeft = w.hub!.x < 0;
  }
  return new LoadedRaceCarModel(parts);
}

/** Loads the model. Resolves null if it can't (offline before it was cached): keep the built-in car. */
export async function loadRaceCarModel(url = RACE_CAR_MODEL_URL): Promise<LoadedRaceCarModel | null> {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = prepare(gltf.scene);
    // The palette image is not drawn (colours come from the baked table): free it
    gltf.scene.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      const image = material?.map?.image as { close?: () => void } | undefined;
      material?.map?.dispose();
      image?.close?.();
      material?.dispose();
    });
    return model;
  } catch (error) {
    console.warn('Race car model not loaded; using the built-in car', error);
    return null;
  }
}
