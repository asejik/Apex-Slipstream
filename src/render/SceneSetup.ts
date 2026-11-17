import * as THREE from 'three';

/** Colours of the 3D scene (docs/DESIGN.md section 10) */
export const SCENE_COLOURS = {
  sky: 0x8aa0b8,
  grass: 0x3d4a35,
  asphalt: 0x4a4d55,
  roadEdge: 0xd9dbe2,
  wall: 0xb8bcc6,
  // Rain (R7 part 2)
  rainSky: 0x6e7884,
  rainHorizon: 0xa7b0ba,
  wetAsphalt: 0x2f3239,
  rainStreak: 0xc9d3df,
  spray: 0xc9d0d8,
  // Dirt road (R7 part 3)
  dirt: 0x8a6a48,
  // Ghost cars (Time Trial, R8): your best lap and your last lap
  pbGhost: 0x00f0ff,
  lastLapGhost: 0xf5f5f5
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

/**
 * A blurred grey rain sky for wet roads to mirror (R7): lighter at the horizon, dark below.
 * Made once; costs one small cube render at start-up.
 */
export function createSkyReflection(renderer: THREE.WebGLRenderer): THREE.Texture {
  const sky = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(100, 32, 16);
  const colours: number[] = [];
  const top = new THREE.Color(SCENE_COLOURS.rainSky);
  const horizon = new THREE.Color(SCENE_COLOURS.rainHorizon);
  const ground = new THREE.Color(SCENE_COLOURS.grass).multiplyScalar(0.5);
  const position = geometry.getAttribute('position');
  const colour = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const height = position.getY(i) / 100;
    if (height >= 0) colour.copy(horizon).lerp(top, Math.min(1, height * 2.5));
    else colour.copy(horizon).lerp(ground, Math.min(1, -height * 6));
    colours.push(colour.r, colour.g, colour.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  sky.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(sky, 0.02).texture;
  pmrem.dispose();
  geometry.dispose();
  return texture;
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
