import { ALL_TRACKS } from '../track/TrackDefinitions';

/**
 * A championship: its rounds in order (track ids) and where its season is saved.
 * SeasonManager runs one of these; the round number and the track are looked up here,
 * so a championship need not run every track in ALL_TRACKS order.
 */
export interface Championship {
  id: string;
  name: string;
  /** One line for the championship list, e.g. "Coast roads and open highway" */
  blurb: string;
  /** The rounds, in order, as track ids from ALL_TRACKS */
  trackIds: readonly string[];
  /** localStorage key for this championship's season */
  storageKey: string;
  /** Career level that unlocks it (R9, Decision 14) */
  unlockLevel: number;
}

/** Every track, in order: the original championship (its save key is unchanged) */
export const GRAND_PRIX: Championship = {
  id: 'grand_prix',
  name: 'Grand Prix',
  blurb: 'Every track, eight rounds',
  trackIds: ALL_TRACKS.map((track) => track.id),
  storageKey: 'apex_season_v1',
  unlockLevel: 1
};

/**
 * The short championships unlock in order: highway, then city, then mountain (Decision 14).
 * Three rounds each; every one keeps its own season.
 */
export const CHAMPIONSHIPS: readonly Championship[] = [
  GRAND_PRIX,
  {
    id: 'highway_cup',
    name: 'Highway Cup',
    blurb: 'Coast roads and open highway',
    trackIds: ['track_01_coastal', 'track_02_expressway', 'track_05_desert'],
    storageKey: 'apex_season_highway_v1',
    unlockLevel: 3
  },
  {
    id: 'city_series',
    name: 'City Series',
    blurb: 'Walls, kerbs and night lights',
    trackIds: ['track_03_metropolis', 'track_06_cyber_docks', 'track_08_apex_finale'],
    storageKey: 'apex_season_city_v1',
    unlockLevel: 5
  },
  {
    id: 'mountain_series',
    name: 'Mountain Series',
    blurb: 'Dirt, hairpins and storms',
    trackIds: ['track_04_alpine', 'track_05_desert', 'track_07_stormy_pass'],
    storageKey: 'apex_season_mountain_v1',
    unlockLevel: 8
  }
];

/** Which championship you are racing, kept on this device */
const ACTIVE_KEY = 'apex_championship_v1';

/** Index into ALL_TRACKS of a track id (0 if it is unknown) */
export function trackIndexOf(trackId: string): number {
  const index = ALL_TRACKS.findIndex((track) => track.id === trackId);
  return index < 0 ? 0 : index;
}

export function isChampionshipUnlocked(championship: Championship, level: number): boolean {
  return level >= championship.unlockLevel;
}

/**
 * The championship to race: the saved one if it exists and your level has unlocked it,
 * otherwise the Grand Prix
 */
export function activeChampionship(savedId: string | null, level: number): Championship {
  const saved = CHAMPIONSHIPS.find((championship) => championship.id === savedId);
  return saved && isChampionshipUnlocked(saved, level) ? saved : GRAND_PRIX;
}

export function loadActiveChampionshipId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveChampionshipId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch (e) {
    console.warn('Championships: could not save the championship choice', e);
  }
}
