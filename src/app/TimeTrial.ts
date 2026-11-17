import { ALL_TRACKS, TrackData } from '../track/TrackDefinitions';
import { AI_DRIVER_ROSTER } from '../ai/AIDriverProfiles';
import type { TireCompound } from '../tires/TireTypes';

/**
 * Time Trial (R8 part 6, PROJECT_PLAN US-05): alone on any track in the dry, chasing your
 * best lap. Two ghosts ride along: your personal best and your previous lap.
 */
export interface TimeTrialSetup {
  /** Index into ALL_TRACKS */
  trackIndex: number;
  tyre: TireCompound;
}

/** Laps a time trial circuit is set up for: in practice it never ends, you lap until you stop */
export const TIME_TRIAL_LAPS = 99;

/** The track as run: a circuit you lap without end; a sprint is one run, then you go again */
export function timeTrialTrack(setup: TimeTrialSetup): TrackData {
  const track = ALL_TRACKS[setup.trackIndex] ?? ALL_TRACKS[0]!;
  return { ...track, laps: track.isClosed ? TIME_TRIAL_LAPS : 1 };
}

/** You start from pole; the AI are not on track, but the grid needs every slot filled */
export function timeTrialGrid(): string[] {
  return ['player', ...AI_DRIVER_ROSTER.map((driver) => driver.id)];
}

/** A lap time for the setup list and banners: 1:58.42 */
export function formatLapTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
}
