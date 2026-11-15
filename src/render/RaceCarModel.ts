import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Open-wheel race car built in code (U-07): tub, nose, sidepods, engine cover with airbox,
 * front and rear wings, halo, helmet, suspension arms and four wheels.
 *
 * Performance: the geometry is built once and shared by every car. Each car is one body
 * mesh (3 materials: livery, accent, carbon) plus 4 wheel meshes (tyre and rim), so about
 * 11 draw calls a car. Forward is -Z, the ground is y = 0, sizes are in metres. The car is
 * 4.6 m long and 1.9 m wide, matching the 0.9 m half-width the barriers use.
 */

/** Wheel hub positions and sizes */
const FRONT_AXLE_Z = -1.55;
const REAR_AXLE_Z = 1.35;
const FRONT_TRACK = 0.78;
const REAR_TRACK = 0.75;
const FRONT_TYRE = { radius: 0.33, width: 0.3 };
const REAR_TYRE = { radius: 0.36, width: 0.4 };

interface WheelSet {
  fl: THREE.Mesh;
  fr: THREE.Mesh;
  rl: THREE.Mesh;
  rr: THREE.Mesh;
}

export interface RaceCar {
  group: THREE.Group;
  wheels: WheelSet;
}

interface SharedParts {
  body: THREE.BufferGeometry;
  /** Body with the four wheels baked in, for cars whose wheels never move (the AI) */
  bodyWithWheels: THREE.BufferGeometry;
  frontWheel: THREE.BufferGeometry;
  rearWheel: THREE.BufferGeometry;
  carbon: THREE.MeshStandardMaterial;
  tyre: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
}

let shared: SharedParts | null = null;

/** Side profile (z along the car, y up) extruded across the car, `width` wide, centred on x. */
function sideProfile(points: ReadonlyArray<[number, number]>, width: number, centreX = 0, bevel = 0.03): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i]![0], points[i]![1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, width - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4
  });
  // Shape x is the car's z, the extrusion runs across the car (x)
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(centreX + width / 2 - bevel, 0, 0);
  return geometry;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, tiltX = 0): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (tiltX !== 0) geometry.rotateX(tiltX);
  geometry.translate(x, y, z);
  return geometry;
}

/** A thin rod from a to b (suspension arms) */
function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const length = a.distanceTo(b);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 6);
  const direction = new THREE.Vector3().subVectors(b, a).normalize();
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geometry;
}

/** Merges parts that share a material; every part must be non-indexed with normals and uvs. */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(flat, false);
  if (!merged) throw new Error('RaceCarModel: could not merge car parts');
  return merged;
}

function buildBody(): THREE.BufferGeometry {
  // --- Livery: tub, nose, sidepods, engine cover ---
  const tub = sideProfile(
    [
      [-1.35, 0.14], [0.9, 0.14], [0.9, 0.5], [0.3, 0.5], [0.25, 0.44],
      [-0.45, 0.44], [-0.55, 0.52], [-1.35, 0.42]
    ],
    0.62
  );
  const nose = new THREE.CylinderGeometry(0.06, 0.2, 0.8, 12);
  nose.rotateX(-Math.PI / 2); // narrow end forward
  nose.scale(1, 0.62, 1);
  nose.translate(0, 0.3, -1.75);
  const sidepod = (side: number): THREE.BufferGeometry =>
    sideProfile(
      [
        [-0.35, 0.16], [1.2, 0.16], [1.2, 0.26], [0.6, 0.36], [-0.2, 0.48], [-0.35, 0.48]
      ],
      0.34,
      side * 0.48
    );
  const engineCover = sideProfile(
    [
      [0.2, 0.45], [1.75, 0.3], [1.75, 0.42], [0.6, 0.66], [0.35, 0.78], [0.2, 0.74]
    ],
    0.34
  );
  const livery = merge([tub, nose, sidepod(-1), sidepod(1), engineCover]);

  // --- Accent: wing flaps and endplates, helmet, airbox rim ---
  const helmet = new THREE.SphereGeometry(0.15, 12, 8);
  helmet.translate(0, 0.6, -0.08);
  const accent = merge([
    box(1.62, 0.03, 0.22, 0, 0.18, -1.95, 0.28), // front flap
    box(0.03, 0.2, 0.56, -0.86, 0.16, -2.0), // front endplates
    box(0.03, 0.2, 0.56, 0.86, 0.16, -2.0),
    box(1.0, 0.03, 0.2, 0, 1.0, 1.8, 0.35), // rear flap
    box(0.03, 0.44, 0.62, -0.51, 0.82, 1.86), // rear endplates
    box(0.03, 0.44, 0.62, 0.51, 0.82, 1.86),
    helmet
  ]);

  // --- Carbon: floor, wings, halo, mirrors, suspension ---
  const halo = new THREE.TorusGeometry(0.32, 0.03, 6, 16, Math.PI);
  halo.rotateX(-Math.PI / 2); // flat, arching forward over the cockpit
  halo.translate(0, 0.74, -0.05);
  const haloPillar = rod(new THREE.Vector3(0, 0.44, -0.5), new THREE.Vector3(0, 0.74, -0.37), 0.03);

  const arms: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (const [axleZ, track] of [[FRONT_AXLE_Z, FRONT_TRACK], [REAR_AXLE_Z, REAR_TRACK]] as const) {
      const hubX = side * (track - 0.12);
      arms.push(rod(new THREE.Vector3(side * 0.28, 0.2, axleZ - 0.12), new THREE.Vector3(hubX, 0.22, axleZ), 0.018));
      arms.push(rod(new THREE.Vector3(side * 0.28, 0.36, axleZ + 0.12), new THREE.Vector3(hubX, 0.34, axleZ), 0.018));
    }
  }

  const carbon = merge([
    box(1.3, 0.05, 3.1, 0, 0.08, 0.4), // floor
    box(1.74, 0.035, 0.42, 0, 0.1, -2.05), // front wing main plane
    box(1.0, 0.04, 0.3, 0, 0.9, 1.9), // rear wing main plane
    box(0.9, 0.03, 0.16, 0, 0.46, 1.9), // beam wing
    box(0.06, 0.42, 0.12, 0, 0.62, 1.8), // rear wing pylon
    box(0.1, 0.05, 0.04, -0.42, 0.6, -0.55), // mirrors
    box(0.1, 0.05, 0.04, 0.42, 0.6, -0.55),
    box(0.14, 0.1, 0.1, 0, 0.74, 0.3), // airbox intake
    halo,
    haloPillar,
    ...arms
  ]);

  const body = mergeGeometries([livery, accent, carbon], true);
  if (!body) throw new Error('RaceCarModel: could not merge the body');
  body.computeBoundingBox();
  body.computeBoundingSphere();
  return body;
}

/** Tyre plus rim with a spoke bar, so rolling shows. Axis along x. */
function buildWheel(radius: number, width: number): THREE.BufferGeometry {
  const tyre = new THREE.CylinderGeometry(radius, radius, width, 18);
  tyre.rotateZ(Math.PI / 2);
  const rimFace = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.01, 12);
  rimFace.rotateZ(Math.PI / 2);
  const spoke = new THREE.BoxGeometry(width + 0.02, radius * 1.1, 0.05);
  const wheel = mergeGeometries([merge([tyre]), merge([rimFace, spoke])], true);
  if (!wheel) throw new Error('RaceCarModel: could not merge a wheel');
  return wheel;
}

/**
 * The body and four wheels as one geometry with five material groups (livery, accent,
 * carbon, tyre, rim): one mesh and five draw calls for a car whose wheels stay still.
 */
function buildBodyWithWheels(body: THREE.BufferGeometry, front: THREE.BufferGeometry, rear: THREE.BufferGeometry): THREE.BufferGeometry {
  // Split each multi-material geometry back into its groups
  const byGroup = (geometry: THREE.BufferGeometry): THREE.BufferGeometry[] =>
    geometry.groups.map((group) => {
      const part = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv'] as const) {
        const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
        const size = attribute.itemSize;
        part.setAttribute(
          name,
          new THREE.BufferAttribute(
            (attribute.array as Float32Array).slice(group.start * size, (group.start + group.count) * size),
            size
          )
        );
      }
      return part;
    });

  const [livery, accent, carbon] = byGroup(body);
  const tyres: THREE.BufferGeometry[] = [];
  const rims: THREE.BufferGeometry[] = [];
  const place = (wheel: THREE.BufferGeometry, x: number, radius: number, z: number): void => {
    const [tyre, rim] = byGroup(wheel);
    tyres.push(tyre!.translate(x, radius, z));
    rims.push(rim!.translate(x, radius, z));
  };
  place(front, -FRONT_TRACK, FRONT_TYRE.radius, FRONT_AXLE_Z);
  place(front.clone(), FRONT_TRACK, FRONT_TYRE.radius, FRONT_AXLE_Z);
  place(rear, -REAR_TRACK, REAR_TYRE.radius, REAR_AXLE_Z);
  place(rear.clone(), REAR_TRACK, REAR_TYRE.radius, REAR_AXLE_Z);

  const merged = mergeGeometries([livery!, accent!, carbon!, merge(tyres), merge(rims)], true);
  if (!merged) throw new Error('RaceCarModel: could not merge the static car');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function sharedParts(): SharedParts {
  if (!shared) {
    const body = buildBody();
    const frontWheel = buildWheel(FRONT_TYRE.radius, FRONT_TYRE.width);
    const rearWheel = buildWheel(REAR_TYRE.radius, REAR_TYRE.width);
    shared = {
      body,
      bodyWithWheels: buildBodyWithWheels(body, frontWheel, rearWheel),
      frontWheel,
      rearWheel,
      carbon: new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.55, metalness: 0.35 }),
      tyre: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9, metalness: 0 }),
      rim: new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.35, metalness: 0.8 })
    };
  }
  return shared;
}

/** A race car in the given livery: `bodyColour` for the bodywork, `accentColour` for wings and helmet. */
export function createRaceCar(bodyColour: number, accentColour: number): RaceCar {
  const parts = sharedParts();
  const group = new THREE.Group();

  const livery = new THREE.MeshStandardMaterial({ color: bodyColour, roughness: 0.32, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: accentColour, roughness: 0.4, metalness: 0.2 });

  const body = new THREE.Mesh(parts.body, [livery, accent, parts.carbon]);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Wheels cast no shadow: the body's shadow covers them, and it saves four shadow draws a car
  const wheel = (geometry: THREE.BufferGeometry, x: number, radius: number, z: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, [parts.tyre, parts.rim]);
    mesh.position.set(x, radius, z);
    group.add(mesh);
    return mesh;
  };

  const wheels: WheelSet = {
    fl: wheel(parts.frontWheel, -FRONT_TRACK, FRONT_TYRE.radius, FRONT_AXLE_Z),
    fr: wheel(parts.frontWheel, FRONT_TRACK, FRONT_TYRE.radius, FRONT_AXLE_Z),
    rl: wheel(parts.rearWheel, -REAR_TRACK, REAR_TYRE.radius, REAR_AXLE_Z),
    rr: wheel(parts.rearWheel, REAR_TRACK, REAR_TYRE.radius, REAR_AXLE_Z)
  };

  return { group, wheels };
}

/**
 * A race car whose wheels never turn or spin (the AI cars, seen at a distance): one mesh
 * with the wheels baked in, five draw calls instead of eleven.
 */
export function createStaticRaceCar(bodyColour: number, accentColour: number): THREE.Group {
  const parts = sharedParts();
  const livery = new THREE.MeshStandardMaterial({ color: bodyColour, roughness: 0.32, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: accentColour, roughness: 0.4, metalness: 0.2 });
  const mesh = new THREE.Mesh(parts.bodyWithWheels, [livery, accent, parts.carbon, parts.tyre, parts.rim]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

/** Rear tyre radius, for turning distance travelled into wheel spin */
export const REAR_WHEEL_RADIUS = REAR_TYRE.radius;
