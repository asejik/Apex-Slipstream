import * as THREE from 'three';

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
  scene.background = new THREE.Color(0x06080e);
  scene.fog = new THREE.FogExp2(0x06080e, 0.005);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
  sunLight.position.set(40, 80, 50);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.camera.left = -180;
  sunLight.shadow.camera.right = 180;
  sunLight.shadow.camera.top = 180;
  sunLight.shadow.camera.bottom = -180;
  scene.add(sunLight);

  addTerrainFloor(scene);
  return scene;
}

function addTerrainFloor(scene: THREE.Scene): void {
  // Vast ground plane (3500m x 3500m) covering full circuit envelopes
  const groundGeo = new THREE.PlaneGeometry(3500, 3500, 32, 32);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.95,
    metalness: 0.1
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -0.35, -400);
  groundMesh.receiveShadow = true;
  groundMesh.frustumCulled = false;
  scene.add(groundMesh);

  // Stylized horizon perspective grid with cyber cyan tint (3000m)
  const grid = new THREE.GridHelper(3000, 150, 0x00f0ff, 0x172136);
  grid.position.set(0, -0.30, -400);
  grid.frustumCulled = false;
  scene.add(grid);
}
