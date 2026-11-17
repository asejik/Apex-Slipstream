import { ALL_TRACKS, TrackData } from '../track/TrackDefinitions';
import { AI_DRIVER_ROSTER } from '../ai/AIDriverProfiles';
import type { WeatherCondition } from '../tires/TireTypes';

/**
 * Quick Race (R8 part 5, docs/DESIGN.md section 5): one race on any track, in the weather
 * and over the laps you choose. It never counts for the championship.
 */
export interface QuickRaceSetup {
  /** Index into ALL_TRACKS */
  trackIndex: number;
  weather: WeatherCondition;
  /** Laps on a circuit; a sprint is always one run */
  laps: number;
}

/** Lap counts on offer for a circuit */
const QUICK_RACE_LAPS: readonly number[] = [1, 2, 3, 4, 5];

/** Your grid slot in a Quick Race: mid-field, with the AI lined up by pace */
export const QUICK_RACE_GRID_SLOT = 10;

/** The first setup offered for a track: dry, over the track's usual laps */
export function defaultQuickRace(trackIndex: number): QuickRaceSetup {
  const track = ALL_TRACKS[trackIndex] ?? ALL_TRACKS[0]!;
  return { trackIndex: ALL_TRACKS[trackIndex] ? trackIndex : 0, weather: 'dry', laps: track.laps };
}

/** Keeps a setup valid: a known track, and a lap count on offer (a sprint is one run) */
export function normaliseQuickRace(setup: QuickRaceSetup): QuickRaceSetup {
  const trackIndex = ALL_TRACKS[setup.trackIndex] ? setup.trackIndex : 0;
  const track = ALL_TRACKS[trackIndex]!;
  const laps = !track.isClosed ? 1 : QUICK_RACE_LAPS.includes(setup.laps) ? setup.laps : track.laps;
  return { trackIndex, weather: setup.weather, laps };
}

/** The track as raced: the chosen track over the chosen number of laps */
export function quickRaceTrack(setup: QuickRaceSetup): TrackData {
  const valid = normaliseQuickRace(setup);
  const track = ALL_TRACKS[valid.trackIndex]!;
  return { ...track, laps: valid.laps };
}

/** The grid, P1 first: the AI from fastest to slowest, with you in slot 10 */
export function quickRaceGrid(): string[] {
  const order = [...AI_DRIVER_ROSTER].sort((a, b) => b.skill - a.skill).map((driver) => driver.id);
  order.splice(QUICK_RACE_GRID_SLOT - 1, 0, 'player');
  return order;
}
