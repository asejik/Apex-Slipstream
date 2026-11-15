/**
 * Rules for the track button [T] (P15-07). The button steps through every track as a
 * practice session; stepping back round to the season's round returns to the championship.
 */

/** Next track to load, counting from the track currently loaded. */
export function nextTrackIndex(loadedIndex: number, trackCount: number): number {
  return (loadedIndex + 1) % trackCount;
}

/** A track that is not the current season round is practice: results do not count. */
export function isPracticeTrack(loadedIndex: number, seasonRoundIndex: number): boolean {
  return loadedIndex !== seasonRoundIndex;
}
