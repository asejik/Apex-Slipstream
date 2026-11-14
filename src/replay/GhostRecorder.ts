import * as THREE from 'three';
import { VehicleState } from '../engine/VehiclePhysics';

export class GhostRecorder {
  public static readonly SAMPLE_RATE_HZ = 30;
  public static readonly SAMPLE_INTERVAL = 1 / GhostRecorder.SAMPLE_RATE_HZ; // ~0.03333s
  public static readonly STRIDE = 5; // [posX, posY, posZ, yawAngle, steerAngle]
  private static readonly MAX_DURATION_SECONDS = 600; // 10 minutes max buffer
  private static readonly MAX_FLOATS =
    GhostRecorder.MAX_DURATION_SECONDS * GhostRecorder.SAMPLE_RATE_HZ * GhostRecorder.STRIDE;

  private buffer: Float32Array;
  private sampleCount = 0;
  private sampleTimer = 0;
  private isRecording = false;

  constructor() {
    this.buffer = new Float32Array(GhostRecorder.MAX_FLOATS);
  }

  public startLap(): void {
    this.sampleCount = 0;
    this.sampleTimer = 0;
    this.isRecording = true;
  }

  public stop(): void {
    this.isRecording = false;
  }

  /**
   * Advances the recording accumulator. Samples keyframe at exactly 30 Hz.
   */
  public update(dt: number, state: VehicleState): void {
    if (!this.isRecording) return;

    this.sampleTimer += dt;
    while (this.sampleTimer >= GhostRecorder.SAMPLE_INTERVAL) {
      this.recordSample(state.position, state.heading, state.steeringAngle);
      this.sampleTimer -= GhostRecorder.SAMPLE_INTERVAL;
    }
  }

  /**
   * Writes a 5-float keyframe directly into the pre-allocated buffer with zero allocation.
   */
  public recordSample(position: THREE.Vector3, yaw: number, steer: number): void {
    const offset = this.sampleCount * GhostRecorder.STRIDE;
    if (offset + GhostRecorder.STRIDE > this.buffer.length) {
      console.warn('GhostRecorder: buffer capacity reached');
      return;
    }

    this.buffer[offset + 0] = position.x;
    this.buffer[offset + 1] = position.y;
    this.buffer[offset + 2] = position.z;
    this.buffer[offset + 3] = yaw;
    this.buffer[offset + 4] = steer;

    this.sampleCount++;
  }

  public get currentSampleCount(): number {
    return this.sampleCount;
  }

  /**
   * Returns a copy of the recorded lap data trimmed to the exact sample length.
   */
  public finishLap(): { data: Float32Array; sampleCount: number } {
    this.isRecording = false;
    const totalFloats = this.sampleCount * GhostRecorder.STRIDE;
    const trimmed = new Float32Array(totalFloats);
    trimmed.set(this.buffer.subarray(0, totalFloats));

    return {
      data: trimmed,
      sampleCount: this.sampleCount
    };
  }
}
