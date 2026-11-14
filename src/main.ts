import * as THREE from 'three';

// Global error banner catcher
window.addEventListener('error', (event) => {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = `Runtime Error: ${event.message}`;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = `Promise Rejection: ${event.reason}`;
  }
});

class WalkingSkeletonGame {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private carGroup: THREE.Group;
  private fpsCounter: HTMLElement | null;

  // Frame timing & FPS tracking (zero per-frame object allocation)
  private lastTime = 0;
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 60;

  constructor() {
    const canvasElement = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvasElement) {
      throw new Error('Canvas element #game-canvas not found');
    }
    this.canvas = canvasElement;
    this.fpsCounter = document.getElementById('fps-counter');

    // 1. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a14);
    this.scene.fog = new THREE.FogExp2(0x0a0a14, 0.02);

    // 3. Camera Setup (High-Chase perspective preview)
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 5, 9);
    this.camera.lookAt(0, 1, 0);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    // 5. Stylized Low-Poly Ground Grid
    const gridHelper = new THREE.GridHelper(60, 30, 0x00e699, 0x1f2338);
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

    // 6. Low-Poly Prototype Car Mesh Group
    this.carGroup = this.createLowPolyCar();
    this.scene.add(this.carGroup);

    // 7. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 8. Start Loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  private createLowPolyCar(): THREE.Group {
    const car = new THREE.Group();

    // Car Body (Stylized wedge shape)
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 3.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00e699,
      roughness: 0.3,
      metalness: 0.2,
      flatShading: true
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.5;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    car.add(bodyMesh);

    // Cabin / Windshield
    const cabinGeo = new THREE.BoxGeometry(1.3, 0.45, 1.8);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      roughness: 0.1,
      metalness: 0.9,
      flatShading: true
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 0.9, -0.2);
    cabinMesh.castShadow = true;
    car.add(cabinMesh);

    // Rear Spoiler
    const spoilerWingGeo = new THREE.BoxGeometry(1.8, 0.08, 0.4);
    const spoilerMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      roughness: 0.4,
      flatShading: true
    });
    const spoilerWing = new THREE.Mesh(spoilerWingGeo, spoilerMat);
    spoilerWing.position.set(0, 1.1, 1.6);
    spoilerWing.castShadow = true;
    car.add(spoilerWing);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x222226,
      roughness: 0.8,
      flatShading: true
    });

    const wheelPositions = [
      [-1.0, 0.38, 1.2],
      [1.0, 0.38, 1.2],
      [-1.0, 0.38, -1.2],
      [1.0, 0.38, -1.2]
    ];

    for (const pos of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0);
      wheel.castShadow = true;
      car.add(wheel);
    }

    return car;
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private renderLoop(timestamp: number): void {
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Smooth showcase rotation of the prototype car
    this.carGroup.rotation.y += 0.8 * dt;

    // Track FPS
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (this.fpsCounter) {
        this.fpsCounter.textContent = `FPS: ${this.currentFps} | Render: Active | WebGL 2.0`;
      }
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.renderLoop.bind(this));
  }
}

// Boot game on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new WalkingSkeletonGame();
});
