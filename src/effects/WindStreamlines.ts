import * as THREE from 'three';

export class WindStreamlines {
  public mesh: THREE.LineSegments;
  private readonly lineCount = 32;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.LineBasicMaterial;

  // Streamline offsets in local vehicle coordinates
  // Each line has a local (X, Y) offset, a head Z, and a tail Z
  private readonly streamData: Array<{ x: number; y: number; z: number; length: number; speed: number }> = [];

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    // 2 vertices per line = lineCount * 2 * 3 floats
    this.positions = new Float32Array(this.lineCount * 2 * 3);
    this.colors = new Float32Array(this.lineCount * 2 * 3);

    for (let i = 0; i < this.lineCount; i++) {
      // Scatter lines around car envelope: X in [-1.4, 1.4], Y in [0.2, 1.6]
      const side = (Math.random() - 0.5) * 2.6;
      const height = 0.25 + Math.random() * 1.35;
      const initialZ = -6 + Math.random() * 14;
      const length = 2.5 + Math.random() * 3.5;
      const speed = 25 + Math.random() * 15;

      this.streamData.push({
        x: side,
        y: height,
        z: initialZ,
        length,
        speed
      });
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.mesh = new THREE.LineSegments(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  /**
   * Updates streamline positions and opacity based on car speed and slipstream state.
   * Runs with zero object allocations.
   */
  public update(
    carPosition: THREE.Vector3,
    carHeading: number,
    speedKmh: number,
    isDrafting: boolean,
    isBoostActive: boolean,
    dt: number
  ): void {
    if (speedKmh < 70) {
      this.material.opacity = 0.0;
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;

    // Base opacity curves
    let targetOpacity = (speedKmh - 70) / 130 * 0.35; // up to 0.35 at 200 km/h
    let r = 0.5;
    let g = 0.9;
    let b = 1.0; // Cyan tint

    if (isBoostActive) {
      targetOpacity = 0.9;
      r = 1.0;
      g = 0.85;
      b = 0.1; // Radiant gold
    } else if (isDrafting) {
      targetOpacity = 0.65;
      r = 0.1;
      g = 1.0;
      b = 0.6; // Aero green
    }

    this.material.opacity = targetOpacity;

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.geometry.attributes.color as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;

    const cosH = Math.cos(carHeading);
    const sinH = Math.sin(carHeading);

    // Car forward is (-sinH, 0, -cosH), right is (cosH, 0, -sinH)
    for (let i = 0; i < this.lineCount; i++) {
      const s = this.streamData[i];
      if (!s) continue;
      // Move streamline rearward relative to car
      s.z += (s.speed + speedKmh * 0.2) * dt;
      if (s.z > 8.0) {
        s.z = -5.0 - Math.random() * 4.0;
        s.x = (Math.random() - 0.5) * 2.6;
        s.y = 0.25 + Math.random() * 1.35;
      }

      const headZ = s.z;
      const tailZ = s.z - s.length;

      // Transform local (x, y, headZ) to world
      // worldPos = carPos + right * x + up * y + forward * z
      const headX = carPosition.x + cosH * s.x + (-sinH) * headZ;
      const headY = carPosition.y + s.y;
      const headZWorld = carPosition.z + (-sinH) * s.x + (-cosH) * headZ;

      const tailX = carPosition.x + cosH * s.x + (-sinH) * tailZ;
      const tailY = carPosition.y + s.y;
      const tailZWorld = carPosition.z + (-sinH) * s.x + (-cosH) * tailZ;

      const idx = i * 6;
      // Head vertex
      posArr[idx] = headX;
      posArr[idx + 1] = headY;
      posArr[idx + 2] = headZWorld;

      // Tail vertex
      posArr[idx + 3] = tailX;
      posArr[idx + 4] = tailY;
      posArr[idx + 5] = tailZWorld;

      // Colors
      colArr[idx] = r;
      colArr[idx + 1] = g;
      colArr[idx + 2] = b;

      colArr[idx + 3] = r * 0.15;
      colArr[idx + 4] = g * 0.15;
      colArr[idx + 5] = b * 0.15;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
