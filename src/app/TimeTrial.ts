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

/**
 * Every lap time in the game, 1:58.42: the HUD, results, Records, Time Trial and banners
 * (P09-R06). Cut to hundredths, never rounded, as race timing does, and worked in whole
 * hundredths so 119,996 ms reads 1:59.99, never 1:60.00.
 */
export function formatLapTime(ms: number): string {
  const hundredths = Math.floor(Math.max(0, ms) / 10 + 1e-6);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  const rest = hundredths % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(rest).padStart(2, '0')}`;
}
