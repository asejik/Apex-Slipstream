import type { SurfaceType } from '../track/TrackDefinitions';

export type TireCompound = 'street' | 'all_terrain' | 'wet';

/** Race-day weather (R7). The forecast is right: the weather never changes during a race. */
export type WeatherCondition = 'dry' | 'wet';

/** Kerbs in the rain are slicker than the road beside them */
const WET_CURB_FACTOR = 0.85;
/** Gravel turns to mud in the rain */
const WET_GRAVEL_FACTOR = 0.9;

export interface TireProfile {
  id: TireCompound;
  name: string;
  badge: string;
  keyShortcut: string;
  colorVar: string;
  description: string;
  dryGrip: number;
  wetGrip: number;
  gravelGrip: number;
  dryDragMultiplier: number;
}

export const TIRE_PROFILES: Record<TireCompound, TireProfile> = {
  street: {
    id: 'street',
    name: 'Street Slicks',
    badge: 'STREET',
    keyShortcut: '1',
    colorVar: 'var(--color-tire-street)',
    description: 'Optimal asphalt grip (100%). Low friction on gravel/wet (50%).',
    dryGrip: 1.0,
    wetGrip: 0.5,
    gravelGrip: 0.5,
    dryDragMultiplier: 1.0,
  },
  all_terrain: {
    id: 'all_terrain',
    name: 'All-Terrain',
    badge: 'ALL-TERRAIN',
    keyShortcut: '2',
    colorVar: 'var(--color-tire-allterrain)',
    description: 'Balanced compound (85% grip everywhere). Robust off-road.',
    dryGrip: 0.88,
    wetGrip: 0.85,
    gravelGrip: 0.85,
    dryDragMultiplier: 1.02,
  },
  wet: {
    id: 'wet',
    name: 'Wet Grooved',
    badge: 'WET',
    keyShortcut: '3',
    colorVar: 'var(--color-tire-wet)',
    description: 'Superior wet tarmac grip (95%). High rolling drag on dry tarmac (75%).',
    dryGrip: 0.75,
    wetGrip: 0.95,
    gravelGrip: 0.65,
    dryDragMultiplier: 1.10,
  },
};

/**
 * Returns the effective grip modifier for a given tire compound on a specific surface,
 * in the race's weather (R7: wet tarmac uses the compound's wet grip).
 */
export function getTireCompoundGrip(
  compound: TireCompound,
  surface: SurfaceType,
  weather: WeatherCondition = 'dry'
): number {
  const profile = TIRE_PROFILES[compound];
  const isWet = weather === 'wet';
  switch (surface) {
    case 'asphalt':
      return isWet ? profile.wetGrip : profile.dryGrip;
    case 'curb': {
      // Curbs are slightly slippery for street slicks, but all-terrain and wet handle well
      const curb = compound === 'street' ? 0.85 : 0.92;
      return isWet ? curb * WET_CURB_FACTOR : curb;
    }
    case 'gravel':
      return isWet ? profile.gravelGrip * WET_GRAVEL_FACTOR : profile.gravelGrip;
    default:
      return profile.dryGrip;
  }
}

/**
 * How much of the car's cornering and braking limit the tyres give here (R7), 1 for Street
 * on dry tarmac. A kerb is part of the road for this: the tyres' grip on the tarmac counts,
 * so clipping a kerb never shortens the car's reach. On gravel it is the gravel grip.
 */
export function tyreTraction(
  compound: TireCompound,
  surface: SurfaceType,
  weather: WeatherCondition = 'dry'
): number {
  return getTireCompoundGrip(compound, surface === 'curb' ? 'asphalt' : surface, weather);
}

/**
 * Returns rolling drag multiplier imposed by tire compound on a specific surface.
 */
export function getTireDragMultiplier(compound: TireCompound, surface: SurfaceType): number {
  const profile = TIRE_PROFILES[compound];
  if (surface === 'asphalt') {
    return profile.dryDragMultiplier;
  }
  return 1.0;
}
