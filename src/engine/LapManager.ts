import * as THREE from 'three';
import { TrackSpline, Checkpoint } from '../track/TrackSpline';

export interface LapState {
  currentLap: number;
  totalLaps: number;
  isRaceCompleted: boolean;
  currentLapTime: number; // seconds
  lastLapTime: number | null;
  bestLapTime: number | null;
  currentSector: number; // 1, 2, 3
  sector1Time: number | null;
  sector2Time: number | null;
  wrongWay: boolean;
  checkpointProgress: number; // 0 to 1 along current lap
}

export class LapManager {
  public track: TrackSpline;
  public state: LapState;
  public onLapCompleted?: (lapNumber: number, lapTime: number, isPersonalBest: boolean) => void;

  private nextCheckpointIndex = 1;
  private checkpointsPassedInLap = 0;
  /**
   * A checkpoint is a gate across the road. It counts when the car crosses the gate line
   * going forward, anywhere within this distance beyond the road edge (so running wide
   * or cutting a kerb still counts, but a distant part of the track does not).
   */
  private readonly GATE_MARGIN_BEYOND_ROAD = 25.0; // meters

  // Scratch vectors for zero GC in update
  private readonly _carTangent = new THREE.Vector3();
  private readonly _prevPosition = new THREE.Vector3();
  private readonly _gateOffset = new THREE.Vector3();

  constructor(trackSpline: TrackSpline) {
    this.track = trackSpline;
    trackSpline.getPointAt(0, this._prevPosition);
    this.state = {
      currentLap: 1,
      totalLaps: trackSpline.data.laps,
      isRaceCompleted: false,
      currentLapTime: 0,
      lastLapTime: null,
      bestLapTime: null,
      currentSector: 1,
      sector1Time: null,
      sector2Time: null,
      wrongWay: false,
      checkpointProgress: 0
    };
  }

  public reset(trackSpline: TrackSpline): void {
    this.track = trackSpline;
    this.nextCheckpointIndex = 1;
    this.checkpointsPassedInLap = 0;
    trackSpline.getPointAt(0, this._prevPosition);
    this.state = {
      currentLap: 1,
      totalLaps: trackSpline.data.laps,
      isRaceCompleted: false,
      currentLapTime: 0,
      lastLapTime: null,
      bestLapTime: null,
      currentSector: 1,
      sector1Time: null,
      sector2Time: null,
      wrongWay: false,
      checkpointProgress: 0
    };
  }

  /**
   * Call after placing the car on the grid. Grid slots can sit past the first
   * checkpoints, so those are counted as already passed for this lap.
   */
  public setStartPosition(position: THREE.Vector3): void {
    this._prevPosition.copy(position);
    const startT = this.track.findClosestT(position).t;
    const checkpoints = this.track.checkpoints;

    let next = 1;
    while (next < checkpoints.length) {
      const cp = checkpoints[next];
      if (!cp || cp.t > startT) break;
      next++;
    }
    // Closed circuits: past the last checkpoint, the next one is the start/finish line
    this.nextCheckpointIndex = next % checkpoints.length;
    this.checkpointsPassedInLap = next - 1;
  }

  public update(playerPosition: THREE.Vector3, playerVelocity: THREE.Vector3, dt: number): void {
    if (this.state.isRaceCompleted) return;

    // 1. Advance active lap timer
    this.state.currentLapTime += dt;

    // 2. Check whether the car crossed the next checkpoint gate since the last update
    const checkpoints = this.track.checkpoints;
    const nextCp = checkpoints[this.nextCheckpointIndex];

    if (nextCp && this.crossedGate(nextCp, this._prevPosition, playerPosition)) {
      this.onCheckpointPassed(nextCp);
    }
    this._prevPosition.copy(playerPosition);

    // 3. Update checkpoint progress metric
    const totalCps = checkpoints.length;
    this.state.checkpointProgress = (this.checkpointsPassedInLap / totalCps);

    // 4. Wrong-way detection
    const speed = playerVelocity.length();
    if (speed > 5.0) {
      const { t } = this.track.findClosestT(playerPosition);
      this.track.getTangentAt(t, this._carTangent);
      const forwardDot = playerVelocity.dot(this._carTangent);
      this.state.wrongWay = forwardDot < -2.0;
    } else {
      this.state.wrongWay = false;
    }
  }

  /** True when the segment from `from` to `to` crosses the gate line forwards, close enough to the road. */
  private crossedGate(cp: Checkpoint, from: THREE.Vector3, to: THREE.Vector3): boolean {
    const tx = cp.tangent.x;
    const tz = cp.tangent.z;

    const before = (from.x - cp.position.x) * tx + (from.z - cp.position.z) * tz;
    this._gateOffset.subVectors(to, cp.position);
    const after = this._gateOffset.x * tx + this._gateOffset.z * tz;
    if (!(before < 0 && after >= 0)) return false;

    // Sideways distance from the gate centre (perpendicular to the tangent on the ground plane)
    const tangentLen = Math.hypot(tx, tz) || 1;
    const lateral = Math.abs(this._gateOffset.x * tz - this._gateOffset.z * tx) / tangentLen;
    return lateral <= this.track.data.roadWidth / 2 + this.GATE_MARGIN_BEYOND_ROAD;
  }

  private onCheckpointPassed(cp: Checkpoint): void {
    this.checkpointsPassedInLap++;

    // Sector transition tracking
    if (cp.sector === 2 && this.state.currentSector === 1) {
      this.state.sector1Time = this.state.currentLapTime;
      this.state.currentSector = 2;
    } else if (cp.sector === 3 && this.state.currentSector === 2) {
      this.state.sector2Time = this.state.currentLapTime;
      this.state.currentSector = 3;
    }

    // If crossing the Finish Line (Checkpoint 0)
    if (cp.isFinishLine) {
      // Must have passed at least 75% of checkpoints to prevent shortcutting
      if (this.checkpointsPassedInLap >= this.track.checkpoints.length * 0.75) {
        this.completeLap();
      }
    }

    // Advance to next checkpoint target
    const totalCps = this.track.checkpoints.length;
    this.nextCheckpointIndex = (this.nextCheckpointIndex + 1) % totalCps;
  }

  private completeLap(): void {
    const lapTime = this.state.currentLapTime;
    this.state.lastLapTime = lapTime;

    const isPB = this.state.bestLapTime === null || lapTime < this.state.bestLapTime;
    if (isPB) {
      this.state.bestLapTime = lapTime;
    }

    this.onLapCompleted?.(this.state.currentLap, lapTime, isPB);

    if (this.state.currentLap >= this.state.totalLaps) {
      this.state.isRaceCompleted = true;
    } else {
      this.state.currentLap++;
      this.state.currentLapTime = 0;
      this.state.currentSector = 1;
      this.checkpointsPassedInLap = 0;
    }
  }
}
