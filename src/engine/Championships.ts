import { ALL_TRACKS } from '../track/TrackDefinitions';

/**
 * A championship: its rounds in order (track ids) and where its season is saved.
 * SeasonManager runs one of these; the round number and the track are looked up here,
 * so a championship need not run every track in ALL_TRACKS order.
 */
export interface Championship {
  id: string;
  name: string;
  /** The rounds, in order, as track ids from ALL_TRACKS */
  trackIds: readonly string[];
  /** localStorage key for this championship's season */
  storageKey: string;
}

/** Every track, in order: the original championship (its save key is unchanged) */
export const GRAND_PRIX: Championship = {
  id: 'grand_prix',
  name: 'Grand Prix',
  trackIds: ALL_TRACKS.map((track) => track.id),
  storageKey: 'apex_season_v1'
};

/** Index into ALL_TRACKS of a track id (0 if it is unknown) */
export function trackIndexOf(trackId: string): number {
  const index = ALL_TRACKS.findIndex((track) => track.id === trackId);
  return index < 0 ? 0 : index;
}
