import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ALL_TRACKS, MIN_CORNER_RADIUS, TRACK_6_CYBER_DOCKS } from '../src/track/TrackDefinitions';
import { TrackSpline } from '../src/track/TrackSpline';
import { tightestCornerRadius } from '../src/track/TrackSmoothing';
import { barrierOffset } from '../src/track/TrackBarriers';
import { brakingBoards, BRAKING_RADIUS, findCorners, KERB_RADIUS } from '../src/track/TrackFurniture';
import { TrackGeometryGenerator } from '../src/track/TrackGeometryGenerator';
import { gridSlotOffset } from '../src/ai/AIDriverManager';
import { buildSpeedPlan, buildTrackProfile, DIFFICULTY_LIMIT, planLapSeconds } from '../src/ai/AIRacecraft';

const coastal = ALL_TRACKS[0]!;
const spline = new TrackSpline(coastal);

describe('Coastal Highway redesign (R5, U-02, Decisions 9 and 15)', () => {
  it('is about 6 km, as the owner asked (Decision 15), with no bend tighter than the minimum', () => {
    expect(spline.totalLength).toBeGreaterThan(5800);
    expect(spline.totalLength).toBeLessThan(6600);
    expect(tightestCornerRadius(coastal.points, true)).toBeGreaterThanOrEqual(MIN_CORNER_RADIUS);
  });

  it('takes the AI field two to three minutes per lap on Medium', () => {
    // AI cars drive the difficulty's share of the car's limit times skill (0.90 to 1.05)
    const profile = buildTrackProfile(spline);
    const lap = (skill: number): number =>
      planLapSeconds(buildSpeedPlan(profile, Math.min(1, DIFFICULTY_LIMIT.medium * skill)), profile);
    const slowest = lap(0.9);
    const fastest = lap(1.05);
    expect(fastest).toBeGreaterThan(120);
    expect(slowest).toBeLessThan(180);
  });

  it('kept its corners when the straights were stretched from 4 km', () => {
    const corners = findCorners(spline, 200);
    const hairpin = corners
      .filter((c) => c.direction === 'left')
      .reduce((x, y) => (x.endM - x.startM > y.endM - y.startM ? x : y));
    expect(hairpin.minRadius).toBeLessThan(40); // 34 m on the 4 km layout
  });

  it('has a main straight of at least 500 m with room for the whole grid behind the line', () => {
    const corners = findCorners(spline);
    const first = corners[0]!;
    const last = corners[corners.length - 1]!;
    const straight = first.startM + (spline.totalLength - last.endM);
    expect(straight).toBeGreaterThan(500);
    // P20 sits 169.5 m behind the line, still on the straight
    expect(spline.totalLength - last.endM).toBeGreaterThan(-gridSlotOffset(20, true) + 10);
  });

  it('has corner variety: a hairpin, a slow chicane, medium corners and a long fast sweeper', () => {
    const corners = findCorners(spline, 200);
    const slow = corners.filter((c) => c.minRadius < 45);
    const medium = corners.filter((c) => c.minRadius >= 45 && c.minRadius < BRAKING_RADIUS);
    const fast = corners.filter((c) => c.minRadius >= BRAKING_RADIUS);
    expect(slow.length).toBeGreaterThanOrEqual(3); // hairpin + two halves of the chicane
    expect(medium.length).toBeGreaterThanOrEqual(3);
    expect(fast.length).toBeGreaterThanOrEqual(3);
    expect(corners.some((c) => c.direction === 'left')).toBe(true);
    expect(corners.some((c) => c.direction === 'right')).toBe(true);
    // The carousel: one corner at least 250 m long
    expect(corners.some((c) => c.endM - c.startM >= 250)).toBe(true);
    // A chicane: a left and a right slow corner within 60 m of each other
    expect(
      slow.some((a) => slow.some((b) => a.direction !== b.direction && Math.abs(b.startM - a.endM) < 60))
    ).toBe(true);
  });

  it('keeps separate parts of the lap far enough apart that their walls never meet', () => {
    const steps = Math.floor(spline.totalLength / 10);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < steps; i++) points.push(spline.getPointAt(i / steps));
    const wallToWall = 2 * barrierOffset(coastal.roadWidth);
    let closest = Infinity;
    for (let a = 0; a < steps; a++) {
      for (let b = a + 1; b < steps; b++) {
        const along = Math.min(b - a, steps - (b - a)) * 10;
        if (along < 150) continue; // the same stretch of road
        closest = Math.min(closest, Math.hypot(points[a]!.x - points[b]!.x, points[a]!.z - points[b]!.z));
      }
    }
    expect(closest).toBeGreaterThan(wallToWall + 40);
  });
});

describe('Trackside furniture (R5)', () => {
  it('finds no corners on a straight and merges nothing across a direction change', () => {
    for (const corner of findCorners(spline)) {
      expect(corner.endM).toBeGreaterThan(corner.startM);
      expect(corner.minRadius).toBeLessThan(KERB_RADIUS);
    }
  });

  it('puts braking boards 150, 100 and 50 m before slow corners only', () => {
    const corners = findCorners(spline);
    const boards = brakingBoards(spline, corners);
    // Hairpin, T6 and T8 have a clear run (three boards each); the chicane and T11 have two each
    expect(boards.length).toBeGreaterThanOrEqual(13);
    const slowStarts = corners.filter((c) => c.minRadius < BRAKING_RADIUS).map((c) => c.startM);
    for (const board of boards) {
      const cornerAt = (board.atM + board.distance) % spline.totalLength;
      expect(slowStarts.some((s) => Math.abs(s - cornerAt) < 0.01), `${board.atM}`).toBe(true);
    }
    // The hairpin, at the end of the back straight, has all three
    const hairpin = corners
      .filter((c) => c.direction === 'left' && c.minRadius < BRAKING_RADIUS)
      .reduce((a, b) => (a.endM - a.startM > b.endM - b.startM ? a : b));
    const forHairpin = boards.filter((b) => Math.abs(((b.atM + b.distance) % spline.totalLength) - hairpin.startM) < 0.01);
    expect(forHairpin.map((b) => b.distance).sort((a, b) => a - b)).toEqual([50, 100, 150]);
  });

  it('draws kerbs and boards as a handful of instanced meshes, not hundreds of objects', () => {
    const group = TrackGeometryGenerator.buildTrackMeshes(spline);
    const kerbs = group.getObjectByName('kerbs')!;
    const boards = group.getObjectByName('braking-boards')!;
    expect(kerbs.children).toHaveLength(2);
    expect(boards.children).toHaveLength(2);
    const red = kerbs.children[0] as THREE.InstancedMesh;
    expect(red.isInstancedMesh).toBe(true);
    expect(red.count).toBeGreaterThan(200);

    let meshes = 0;
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBeLessThan(20); // it was about 190 with one mesh per kerb block
  });

  it('still gives a short circuit kerbs at its corners', () => {
    const short = new TrackSpline(TRACK_6_CYBER_DOCKS);
    expect(findCorners(short).length).toBeGreaterThan(2);
  });
});
