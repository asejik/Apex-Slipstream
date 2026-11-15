import * as THREE from 'three';
import type { TrackSpline } from './TrackSpline';

/** A corner of the track, measured along the centreline in metres from the start line. */
export interface CornerZone {
  startM: number;
  endM: number;
  direction: 'left' | 'right';
  /** Tightest radius inside the corner, in metres */
  minRadius: number;
}

/** A braking marker board: `distance` metres before the corner at `atM` along the lap. */
interface BrakingBoard {
  atM: number;
  distance: 150 | 100 | 50;
}

const STEP_M = 5;
/** Bends at least this tight count as corners and get kerbs */
export const KERB_RADIUS = 160;
/** Corners at least this tight get braking boards */
export const BRAKING_RADIUS = 60;
/** Two same-direction bends closer than this are one corner */
const MERGE_GAP_M = 30;
const BOARD_DISTANCES = [150, 100, 50] as const;

/**
 * Finds the corners of a track from the curvature of its centreline (R5, Decision 9).
 * Runs once when a track loads, never in the frame loop.
 */
export function findCorners(spline: TrackSpline, maxRadius = KERB_RADIUS): CornerZone[] {
  const length = spline.totalLength;
  const isClosed = spline.data.isClosed;
  const steps = Math.max(2, Math.floor(length / STEP_M));
  const stepLength = length / steps;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  // Signed radius of each step: positive turns left, negative right (seen from above)
  const radius: number[] = [];
  const last = isClosed ? steps : steps - 1;
  for (let i = 0; i < last; i++) {
    spline.getTangentAt(i / steps, a);
    spline.getTangentAt(isClosed ? ((i + 1) / steps) % 1 : (i + 1) / steps, b);
    let turn = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    radius.push(Math.abs(turn) < 1e-9 ? Infinity : stepLength / turn);
  }

  const corners: CornerZone[] = [];
  let i = 0;
  while (i < radius.length) {
    const r = radius[i]!;
    if (Math.abs(r) >= maxRadius) {
      i++;
      continue;
    }
    const sign = Math.sign(r);
    const start = i;
    let min = Math.abs(r);
    while (i < radius.length && Math.abs(radius[i]!) < maxRadius && Math.sign(radius[i]!) === sign) {
      min = Math.min(min, Math.abs(radius[i]!));
      i++;
    }
    const zone: CornerZone = {
      startM: start * stepLength,
      endM: i * stepLength,
      direction: sign > 0 ? 'left' : 'right',
      minRadius: min
    };
    const previous = corners[corners.length - 1];
    if (previous && previous.direction === zone.direction && zone.startM - previous.endM < MERGE_GAP_M) {
      previous.endM = zone.endM;
      previous.minRadius = Math.min(previous.minRadius, zone.minRadius);
    } else {
      corners.push(zone);
    }
  }
  return corners;
}

/**
 * Braking boards at 150, 100 and 50 m before each slow corner. A board is left out when
 * another corner sits in the way (a chicane's second part gets none), or on a sprint when
 * it would fall before the start of the road.
 */
export function brakingBoards(spline: TrackSpline, corners: CornerZone[] = findCorners(spline)): BrakingBoard[] {
  const length = spline.totalLength;
  const isClosed = spline.data.isClosed;
  const boards: BrakingBoard[] = [];

  corners.forEach((corner, index) => {
    if (corner.minRadius >= BRAKING_RADIUS) return;
    // How much road leads into this corner since the last slow corner. Faster bends
    // in between are taken at speed and don't count.
    let before: CornerZone | undefined;
    for (let back = 1; back < corners.length; back++) {
      const candidate = corners[(index - back + corners.length) % corners.length];
      if (!isClosed && index - back < 0) break;
      if (candidate && candidate.minRadius < BRAKING_RADIUS) {
        before = candidate;
        break;
      }
    }
    let clear = Infinity;
    if (before && before !== corner) {
      clear = corner.startM - before.endM;
      if (clear < 0) clear = isClosed ? clear + length : Infinity;
    }
    for (const distance of BOARD_DISTANCES) {
      if (distance > clear) continue;
      let atM = corner.startM - distance;
      if (atM < 0) {
        if (!isClosed) continue;
        atM += length;
      }
      boards.push({ atM, distance });
    }
  });
  return boards;
}
