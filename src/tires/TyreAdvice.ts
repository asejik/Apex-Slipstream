import type { TrackData } from '../track/TrackDefinitions';
import { TIRE_PROFILES, TireCompound, WeatherCondition } from './TireTypes';

export type { WeatherCondition } from './TireTypes';

export interface Forecast {
  condition: WeatherCondition;
  label: string;
}

/** What the forecast says for a condition */
export function forecastLabel(condition: WeatherCondition): string {
  return condition === 'wet' ? 'Rain' : 'Dry';
}

/** A number in [0, 1) from a string: the same string always gives the same number. */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * The weather for a race on `track` (R7). It rains with the track's `rainChance`; the dice
 * are fixed for each season and round, so the forecast on the hub, the tyre screen and the
 * race itself always agree, and a new season brings new weather. Weather is information,
 * not a surprise (Decision 13): the race runs in the forecast conditions.
 */
export function forecastFor(track: TrackData, seasonId = 'season_01', round = 0): Forecast {
  const isWet = hash01(`${seasonId}|${round}|${track.id}`) < track.rainChance;
  const condition: WeatherCondition = isWet ? 'wet' : 'dry';
  return { condition, label: forecastLabel(condition) };
}

/** How a compound performs, as whole percentages, for the tyre choice screen. */
export interface TyreRatings {
  /** Grip on dry tarmac */
  road: number;
  /** Grip on the gravel run-off */
  offRoad: number;
  /** Grip on wet tarmac */
  wet: number;
  /** Straight-line speed on dry tarmac: 100 with no extra rolling drag */
  speed: number;
}

export function tyreRatings(compound: TireCompound): TyreRatings {
  const p = TIRE_PROFILES[compound];
  return {
    road: Math.round(p.dryGrip * 100),
    offRoad: Math.round(p.gravelGrip * 100),
    wet: Math.round(p.wetGrip * 100),
    speed: Math.round(100 / p.dryDragMultiplier)
  };
}

const COMPOUNDS: readonly TireCompound[] = ['street', 'all_terrain', 'wet'];

/**
 * The compound with the most grip in the forecast conditions on tarmac, ties going to
 * the one with less drag: Street in the dry, Wet in the rain.
 */
export function recommendedTyre(forecast: Forecast): TireCompound {
  let best: TireCompound = 'street';
  let bestScore = -Infinity;
  for (const compound of COMPOUNDS) {
    const p = TIRE_PROFILES[compound];
    const grip = forecast.condition === 'wet' ? p.wetGrip : p.dryGrip;
    const score = grip * 1000 - p.dryDragMultiplier;
    if (score > bestScore) {
      bestScore = score;
      best = compound;
    }
  }
  return best;
}
