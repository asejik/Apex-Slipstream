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

/**
 * The player's lap fraction (0 to 1) for the live position, made to agree with the lap
 * counter around the start line. The closest-point search and the line-crossing check can
 * disagree by a metre or two, which for a physics step put the player a whole lap out
 * (U-15: the position flashed P20 at the line).
 * `checkpointProgress` is the share of this lap's checkpoints passed (0 just after the line).
 */
export function playerLapFraction(trackT: number, checkpointProgress: number, beforeStartLine: boolean): number {
  if (beforeStartLine) {
    // On the grid behind the line: the search may already report the first metres of the lap
    return trackT < 0.5 ? 1 : trackT;
  }
  // End of the lap by the checkpoints, but the search already reports the next lap's start
  if (trackT < 0.1 && checkpointProgress > 0.5) return 1;
  // The lap counter has moved on, but the search still reports the end of the old lap
  if (trackT > 0.9 && checkpointProgress < 0.5) return 0;
  return trackT;
}
