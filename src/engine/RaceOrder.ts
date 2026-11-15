/**
 * Single source of truth for "who is ahead" in a race, used for the live HUD
 * position and the final classification.
 */
export interface RaceProgress {
  /** Laps fully completed (0 on the first lap). */
  completedLaps: number;
  /** Distance into the current lap, 0 to 1 along the track. */
  lapFraction: number;
  /** Seconds from the start when the car completed the race distance; null while racing. */
  finishTime: number | null;
}

/**
 * Progress value for sorting. Every finisher gets the same value (above any car still
 * racing), so finishers are then separated by finish time.
 */
export function classificationProgress(p: RaceProgress, totalLaps: number): number {
  if (p.finishTime !== null) return totalLaps + 1;
  return p.completedLaps + p.lapFraction;
}

/**
 * Whether a completed lap counts for the fastest-lap bonus (U-09). On circuits lap 1 is
 * excluded: AI cars start rolling and some grid slots sit past the line (U-11), so it is
 * not a fair comparison. A sprint's single lap is the whole run and always counts.
 */
export function countsForFastestLap(lapNumber: number, isClosed: boolean): boolean {
  return !isClosed || lapNumber >= 2;
}

/** True when car `a` is classified ahead of car `b`. */
export function isAhead(a: RaceProgress, b: RaceProgress, totalLaps: number): boolean {
  if (a.finishTime !== null && b.finishTime !== null) {
    return a.finishTime < b.finishTime;
  }
  return classificationProgress(a, totalLaps) > classificationProgress(b, totalLaps);
}
