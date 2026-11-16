import * as THREE from 'three';

/** Colours of the 3D scene (docs/DESIGN.md section 10) */
export const SCENE_COLOURS = {
  sky: 0x8aa0b8,
  grass: 0x3d4a35,
  asphalt: 0x4a4d55,
  roadEdge: 0xd9dbe2,
  wall: 0xb8bcc6
} as const;

const SUN_NAME = 'sun';
const SUN_OFFSET = new THREE.Vector3(40, 80, 50);
/** Half the width of the shadowed area around the player's car, in metres */
const SHADOW_REACH = 70;

/**
 * Keeps the sun's shadow area centred on `position` (the player's car), so shadows are
 * drawn wherever you are on the lap. Call once per frame; allocates nothing.
 */
export function followWithSun(scene: THREE.Scene, position: THREE.Vector3): void {
  const sun = scene.getObjectByName(SUN_NAME) as THREE.DirectionalLight | undefined;
  if (!sun) return;
  sun.target.position.copy(position);
  sun.position.copy(position).add(SUN_OFFSET);
}

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** Base FOV = 58 */
export function createCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1000);
}

/** The scene with its background, fog, lights and terrain floor. */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  // Daylight (owner playtest 2026-11-16): the road must stand out from its surroundings.
  // Colours are listed in docs/DESIGN.md section 10.
  scene.background = new THREE.Color(SCENE_COLOURS.sky);
  scene.fog = new THREE.FogExp2(SCENE_COLOURS.sky, 0.0022);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
  sunLight.name = SUN_NAME;
  sunLight.position.copy(SUN_OFFSET);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 400;
  // The shadow area is a box around the player's car, moved each frame (followWithSun).
  // It used to be fixed at the origin, so most of a long lap had no shadows at all.
  sunLight.shadow.camera.left = -SHADOW_REACH;
  sunLight.shadow.camera.right = SHADOW_REACH;
  sunLight.shadow.camera.top = SHADOW_REACH;
  sunLight.shadow.camera.bottom = -SHADOW_REACH;
  scene.add(sunLight);
  scene.add(sunLight.target);

  addTerrainFloor(scene);
  return scene;
}

function addTerrainFloor(scene: THREE.Scene): void {
  // Vast ground plane (3500m x 3500m) covering full circuit envelopes
  const groundGeo = new THREE.PlaneGeometry(3500, 3500, 32, 32);
  const groundMat = new THREE.MeshStandardMaterial({
    color: SCENE_COLOURS.grass,
    roughness: 0.95,
    metalness: 0.1
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -0.35, -400);
  groundMesh.receiveShadow = true;
  groundMesh.frustumCulled = false;
  scene.add(groundMesh);
}
