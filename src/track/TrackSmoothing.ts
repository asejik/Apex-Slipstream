import * as THREE from 'three';

const SAMPLE_SPACING = 10; // metres between working points
const MAX_PASSES = 600;
const RESAMPLE_EVERY = 10;
const MAX_ATTEMPTS = 8;

function buildCurve(points: THREE.Vector3[], isClosed: boolean): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points, isClosed, 'catmullrom', 0.5);
}

/** Evenly spaced points along the curve through `points`. */
function resample(points: THREE.Vector3[], isClosed: boolean): THREE.Vector3[] {
  const curve = buildCurve(points, isClosed);
  const divisions = Math.max(8, Math.round(curve.getLength() / SAMPLE_SPACING));
  const spaced = curve.getSpacedPoints(divisions);
  if (isClosed) spaced.pop(); // the last point repeats the first
  return spaced;
}

/** Radius of the circle through three points, seen from above. */
function radiusThrough(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  const ab = Math.hypot(b.x - a.x, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.z - b.z);
  const ca = Math.hypot(a.x - c.x, a.z - c.z);
  const doubleArea = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z));
  if (doubleArea < 1e-9) return Infinity;
  return (ab * bc * ca) / (2 * doubleArea);
}

/** Tightest radius of the finished centreline, measured over 2 m steps. */
export function tightestCornerRadius(points: THREE.Vector3[], isClosed: boolean): number {
  const curve = buildCurve(points, isClosed);
  const length = curve.getLength();
  const steps = Math.max(2, Math.floor(length / 2));
  const stepLength = length / steps;
  const last = isClosed ? steps : steps - 1;
  let tightest = Infinity;
  let previous = curve.getTangentAt(0);
  for (let i = 0; i < last; i++) {
    const nextT = (i + 1) / steps;
    const next = curve.getTangentAt(isClosed ? nextT % 1 : nextT);
    let turn = Math.atan2(next.x, next.z) - Math.atan2(previous.x, previous.z);
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    if (Math.abs(turn) > 1e-9) tightest = Math.min(tightest, stepLength / Math.abs(turn));
    previous = next;
  }
  return tightest;
}

/** Moves points on bends tighter than `targetRadius` toward their neighbours until none remain. */
function relax(points: THREE.Vector3[], isClosed: boolean, targetRadius: number): THREE.Vector3[] {
  let current = resample(points, isClosed);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const count = current.length;
    const next = current.map((p) => p.clone());
    let moved = false;
    for (let i = 0; i < count; i++) {
      if (!isClosed && (i === 0 || i === count - 1)) continue; // a sprint keeps its start and end
      const before = current[(i - 1 + count) % count];
      const here = current[i];
      const after = current[(i + 1) % count];
      if (!before || !here || !after) continue;
      if (radiusThrough(before, here, after) >= targetRadius) continue;
      const target = next[i];
      if (!target) continue;
      target.set(
        here.x * 0.5 + (before.x + after.x) * 0.25,
        here.y * 0.5 + (before.y + after.y) * 0.25,
        here.z * 0.5 + (before.z + after.z) * 0.25
      );
      moved = true;
    }
    current = next;
    if (!moved) break;
    if (pass % RESAMPLE_EVERY === RESAMPLE_EVERY - 1) current = resample(current, isClosed);
  }
  return current;
}

/**
 * Returns the track's control points with every bend eased to at least `minRadius`
 * metres (U-02). Returns the same array when no bend is too tight.
 * Runs once per track when the game loads, never in the frame loop.
 */
export function easeTightCorners(
  points: THREE.Vector3[],
  isClosed: boolean,
  minRadius: number
): THREE.Vector3[] {
  if (tightestCornerRadius(points, isClosed) >= minRadius) return points;

  let targetRadius = minRadius * 1.1;
  let eased = points;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    eased = relax(points, isClosed, targetRadius);
    if (tightestCornerRadius(eased, isClosed) >= minRadius) break;
    targetRadius *= 1.1;
  }
  return eased;
}
