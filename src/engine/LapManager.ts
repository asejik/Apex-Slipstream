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

  private nextCheckpointIndex = 1;
  private checkpointsPassedInLap = 0;
  private readonly CHECKPOINT_PASS_RADIUS = 18.0; // meters

  // Scratch vectors for zero GC in update
  private readonly _carTangent = new THREE.Vector3();

  constructor(trackSpline: TrackSpline) {
    this.track = trackSpline;
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

  public update(playerPosition: THREE.Vector3, playerVelocity: THREE.Vector3, dt: number): void {
    if (this.state.isRaceCompleted) return;

    // 1. Advance active lap timer
    this.state.currentLapTime += dt;

    // 2. Check next checkpoint in sequence
    const checkpoints = this.track.checkpoints;
    const nextCp = checkpoints[this.nextCheckpointIndex];

    if (nextCp) {
      const distToCp = playerPosition.distanceTo(nextCp.position);
      if (distToCp < this.CHECKPOINT_PASS_RADIUS) {
        this.onCheckpointPassed(nextCp);
      }
    }

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

    if (this.state.bestLapTime === null || lapTime < this.state.bestLapTime) {
      this.state.bestLapTime = lapTime;
    }

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
