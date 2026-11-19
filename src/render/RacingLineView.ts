import * as THREE from 'three';
import { TrackSpline } from '../track/TrackSpline';
import { TrackProfile } from '../ai/AIRacecraft';
import { SCENE_COLOURS } from './SceneSetup';
import type { DrivingAids } from '../engine/DrivingAids';

/** How far ahead of the car the line is drawn */
export const LINE_AHEAD_M = 220;
/** The line starts a little behind the car, so it runs out from under it */
const LINE_BEHIND_M = 6;
/** Half the painted line's width */
const HALF_WIDTH_M = 0.35;
/** Just above the road (asphalt at 0.05, edge lines at 0.07: TrackGeometryGenerator) */
const LIFT_M = 0.08;
/** Faster than the planned speed by this share: amber, then red (brake now) */
export const AMBER_OVER = 0.0;
export const RED_OVER = 0.12;

const WHITE = new THREE.Color(SCENE_COLOURS.racingLine);
const AMBER = new THREE.Color(SCENE_COLOURS.racingLineAmber);
const RED = new THREE.Color(SCENE_COLOURS.racingLineRed);

/** The colour the line ahead takes: white below the planned speed, amber over it, red well over */
export function lineColourFor(speed: number, plannedSpeed: number): 'white' | 'amber' | 'red' {
  if (speed <= plannedSpeed * (1 + AMBER_OVER)) return 'white';
  return speed > plannedSpeed * (1 + RED_OVER) ? 'red' : 'amber';
}

/**
 * The racing-line guide (Decision 11): a painted line along the AI's racing line, drawn
 * from just behind the car to LINE_AHEAD_M ahead. Each stretch is white where your speed now
 * is within what the line plans there, amber where you are over it, and red where you must
 * brake. Built once per track; recoloured each frame without allocating.
 */
export class RacingLineView {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.BufferGeometry();
  private colours: Float32Array = new Float32Array(0);
  private colourAttribute: THREE.BufferAttribute | null = null;
  private profile: TrackProfile | null = null;

  constructor() {
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      // Seen from above whichever way the ribbon was wound
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.name = 'racing-line';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Builds the line for a track from its racing-line profile (DrivingAids) */
  build(spline: TrackSpline, profile: TrackProfile): void {
    // The last track's line is let go first
    this.geometry.dispose();
    this.profile = profile;
    const n = profile.count;
    const positions = new Float32Array(n * 2 * 3);
    this.colours = new Float32Array(n * 2 * 4);
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const t = profile.isClosed ? i / n : Math.min(1, (i * profile.step) / profile.length);
      spline.getPointAt(t, point);
      spline.getTangentAt(t, tangent);
      const rx = -tangent.z;
      const rz = tangent.x;
      const cx = point.x + rx * profile.lineOffset[i]!;
      const cz = point.z + rz * profile.lineOffset[i]!;
      const y = point.y + LIFT_M;
      positions.set([cx - rx * HALF_WIDTH_M, y, cz - rz * HALF_WIDTH_M, cx + rx * HALF_WIDTH_M, y, cz + rz * HALF_WIDTH_M], i * 6);
    }
    const index: number[] = [];
    const segments = profile.isClosed ? n : n - 1;
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = ((i + 1) % n) * 2;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.colourAttribute = new THREE.BufferAttribute(this.colours, 4);
    this.colourAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('color', this.colourAttribute);
    this.geometry.setIndex(index);
  }

  /**
   * Recolours the line for the car `distance` metres along the lap at `speed` m/s, against
   * the speeds the line plans (`aids`). Allocates nothing.
   */
  update(distance: number, speed: number, aids: DrivingAids): void {
    const profile = this.profile;
    const attribute = this.colourAttribute;
    if (!profile || !attribute || !this.mesh.visible) return;
    const colours = this.colours;
    colours.fill(0);
    const n = profile.count;
    const first = Math.floor((distance - LINE_BEHIND_M) / profile.step);
    const last = Math.ceil((distance + LINE_AHEAD_M) / profile.step);
    for (let k = first; k <= last; k++) {
      let i = k;
      if (profile.isClosed) i = ((k % n) + n) % n;
      else if (k < 0 || k >= n) continue;
      const planned = aids.plannedSpeedAt(k * profile.step) ?? speed;
      const kind = lineColourFor(speed, planned);
      const colour = kind === 'red' ? RED : kind === 'amber' ? AMBER : WHITE;
      // Fades in behind the car and out towards the far end
      const along = k * profile.step - distance;
      const alpha = 0.75 * Math.min(1, (along + LINE_BEHIND_M) / LINE_BEHIND_M) * Math.min(1, (LINE_AHEAD_M - along) / 40);
      // Both edges of the line at this sample: 8 values from (i * 2) * 4
      const o = i * 8;
      const a = Math.max(0, alpha);
      colours[o] = colours[o + 4] = colour.r;
      colours[o + 1] = colours[o + 5] = colour.g;
      colours[o + 2] = colours[o + 6] = colour.b;
      colours[o + 3] = colours[o + 7] = a;
    }
    attribute.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
}
