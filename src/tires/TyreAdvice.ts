import type { TrackData } from '../track/TrackDefinitions';
import { TIRE_PROFILES, TireCompound } from './TireTypes';

/** Race-day weather. Only dry exists until the weather update (R7) adds rain. */
export type WeatherCondition = 'dry' | 'wet';

export interface Forecast {
  condition: WeatherCondition;
  label: string;
}

/** The forecast for a race on `track`. Every track is dry until weather arrives (R7). */
export function forecastFor(_track: TrackData): Forecast {
  return { condition: 'dry', label: 'Dry' };
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
