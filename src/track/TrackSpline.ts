import * as THREE from 'three';
import { TrackData, SurfaceType, isDirtAt } from './TrackDefinitions';

export interface SurfaceEvaluation {
  surface: SurfaceType;
  gripMultiplier: number;
  dragMultiplier: number;
  distanceToCenterline: number;
  trackElevation: number;
  trackT: number;
}

/** Where a position is along the road: findClosestT fills one in */
export interface ClosestPoint {
  t: number;
  distanceToCenterline: number;
  lateralOffset: number;
}

/** A blank result to reuse (P09-R04: the per-frame calls fill one in rather than make one) */
export function blankSurface(): SurfaceEvaluation {
  return { surface: 'asphalt', gripMultiplier: 1, dragMultiplier: 1, distanceToCenterline: 0, trackElevation: 0, trackT: 0 };
}

export interface Checkpoint {
  index: number;
  t: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  isFinishLine: boolean;
  sector: number; // 1, 2, or 3
}

export class TrackSpline {
  /** Dirt road: a little more slide than tarmac and a little more drag (R7) */
  private static readonly DIRT_GRIP = 0.85;
  private static readonly DIRT_DRAG = 1.1;

  public data: TrackData;
  public curve: THREE.CatmullRomCurve3;
  public totalLength: number;
  /** Where the start line is, 0 to 1 along the road: 0 on circuits, past the run-up on sprints */
  public startT = 0;
  public checkpoints: Checkpoint[] = [];

  // Discrete sampled points for fast $O(N)$ / localized closest search
  private readonly SAMPLE_COUNT = 300;
  private readonly samples: { t: number; point: THREE.Vector3; tangent: THREE.Vector3 }[] = [];

  // Pre-allocated scratch vectors for zero GC in update loops
  private readonly _scratchCenter = new THREE.Vector3();
  private readonly _scratchTangent = new THREE.Vector3();
  private readonly _scratchNormal = new THREE.Vector3();
  private readonly _scratchDiff = new THREE.Vector3();
  /** evaluateSurface's own closest-point result, reused */
  private readonly _scratchClosest: ClosestPoint = { t: 0, distanceToCenterline: 0, lateralOffset: 0 };

  constructor(trackData: TrackData) {
    this.data = trackData;
    this.curve = new THREE.CatmullRomCurve3(
      trackData.points,
      trackData.isClosed,
      'catmullrom',
      0.5
    );
    this.totalLength = this.curve.getLength();

    // 1. Pre-sample points along the spline
    for (let i = 0; i < this.SAMPLE_COUNT; i++) {
      const t = i / (this.SAMPLE_COUNT - (trackData.isClosed ? 0 : 1));
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      this.samples.push({ t, point, tangent });
    }

    // 2. Generate Checkpoints, from the start line (after a sprint's run-up) to the finish
    this.startT = trackData.isClosed ? 0 : Math.min(0.5, (trackData.startLineM ?? 0) / this.totalLength);
    this.buildCheckpoints();
  }

  private buildCheckpoints(): void {
    const checkpointCount = 12;
    const isClosed = this.data.isClosed;
    for (let i = 0; i < checkpointCount; i++) {
      // Closed circuits: checkpoint 0 at t = 0 is both start and finish.
      // Sprints: spread from start (t = 0) to the end of the road (t = 1),
      // and the last checkpoint is the finish line.
      const t = isClosed ? i / checkpointCount : this.startT + (i / (checkpointCount - 1)) * (1 - this.startT);
      const pos = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();

      // Sectors: 0-3 -> Sector 1, 4-7 -> Sector 2, 8-11 -> Sector 3
      const sector = i < 4 ? 1 : i < 8 ? 2 : 3;

      this.checkpoints.push({
        index: i,
        t,
        position: pos,
        tangent,
        isFinishLine: isClosed ? i === 0 : i === checkpointCount - 1,
        sector
      });
    }
  }

  public getPointAt(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.curve.getPointAt(t, target);
  }

  public getTangentAt(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.curve.getTangentAt(t, target).normalize();
  }

  public getNormalAt(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    // Normal vector perpendicular to tangent on XZ plane: (tangent.z, 0, -tangent.x)
    this.getTangentAt(t, this._scratchTangent);
    target.set(this._scratchTangent.z, 0, -this._scratchTangent.x).normalize();
    return target;
  }

  /**
   * Fast localized search for closest T along the track. Fills in `out` (a new one if not
   * given): pass a reused one in per-frame code, which allocates nothing (P09-R04).
   */
  public findClosestT(
    position: THREE.Vector3,
    out: ClosestPoint = { t: 0, distanceToCenterline: 0, lateralOffset: 0 }
  ): ClosestPoint {
    let closestIndex = 0;
    let minDistanceSq = Infinity;

    // 1. Find nearest pre-sampled waypoint
    for (let i = 0; i < this.SAMPLE_COUNT; i++) {
      const sample = this.samples[i];
      if (!sample) continue;
      const dSq = position.distanceToSquared(sample.point);
      if (dSq < minDistanceSq) {
        minDistanceSq = dSq;
        closestIndex = i;
      }
    }

    const bestSample = this.samples[closestIndex];
    if (!bestSample) {
      out.t = 0;
      out.distanceToCenterline = 0;
      out.lateralOffset = 0;
      return out;
    }

    // 2. Refine t around bestSample
    let bestT = bestSample.t;
    let minFineDistSq = minDistanceSq;
    const dtStep = 1 / this.SAMPLE_COUNT;

    for (let s = -5; s <= 5; s++) {
      const candidateT = (bestSample.t + (s / 10) * dtStep + 1.0) % 1.0;
      this.getPointAt(candidateT, this._scratchCenter);
      const dSq = position.distanceToSquared(this._scratchCenter);
      if (dSq < minFineDistSq) {
        minFineDistSq = dSq;
        bestT = candidateT;
      }
    }

    // 3. Compute lateral distance from track centerline
    const trackCenter = this.getPointAt(bestT, this._scratchCenter);
    const trackNormal = this.getNormalAt(bestT, this._scratchNormal);
    this._scratchDiff.subVectors(position, trackCenter);
    this._scratchDiff.y = 0; // Project to XZ ground plane

    out.t = bestT;
    out.distanceToCenterline = this._scratchDiff.length();
    out.lateralOffset = this._scratchDiff.dot(trackNormal);
    return out;
  }

  /**
   * Evaluates surface type, grip/drag multipliers, and road elevation for a given world
   * position. Fills in `out` (a new one if not given): per-frame code passes a reused one.
   */
  public evaluateSurface(position: THREE.Vector3, out: SurfaceEvaluation = blankSurface()): SurfaceEvaluation {
    const { t, distanceToCenterline } = this.findClosestT(position, this._scratchClosest);
    const halfWidth = this.data.roadWidth / 2;
    const curbOuterEdge = halfWidth + 1.8;
    const trackPoint = this.getPointAt(t, this._scratchCenter);
    // Smooth elevation dropoff if car is far off-road
    const elevation = distanceToCenterline <= curbOuterEdge + 4.0
      ? trackPoint.y
      : THREE.MathUtils.lerp(trackPoint.y, 0.0, Math.min(1.0, (distanceToCenterline - curbOuterEdge) / 8.0));

    out.distanceToCenterline = distanceToCenterline;
    out.trackElevation = elevation;
    out.trackT = t;
    // A dirt stretch of the road (R7): the road and its edges are dirt, with no kerbs
    if (distanceToCenterline <= curbOuterEdge && isDirtAt(this.data, t)) {
      out.surface = 'dirt';
      out.gripMultiplier = TrackSpline.DIRT_GRIP;
      out.dragMultiplier = TrackSpline.DIRT_DRAG;
    } else if (distanceToCenterline <= halfWidth) {
      out.surface = 'asphalt';
      out.gripMultiplier = 1.0;
      out.dragMultiplier = 1.0;
    } else if (distanceToCenterline <= curbOuterEdge) {
      out.surface = 'curb';
      out.gripMultiplier = 0.82;
      out.dragMultiplier = 1.3;
    } else {
      out.surface = 'gravel';
      out.gripMultiplier = 0.45;
      out.dragMultiplier = 2.6;
    }
    return out;
  }
}
