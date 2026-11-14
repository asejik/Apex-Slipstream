import type { SurfaceType } from '../track/TrackDefinitions';

export type TireCompound = 'street' | 'all_terrain' | 'wet';

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
 * Returns the effective grip modifier for a given tire compound on a specific surface.
 */
export function getTireCompoundGrip(compound: TireCompound, surface: SurfaceType): number {
  const profile = TIRE_PROFILES[compound];
  switch (surface) {
    case 'asphalt':
      return profile.dryGrip;
    case 'curb':
      // Curbs are slightly slippery for street slicks, but all-terrain and wet handle well
      return compound === 'street' ? 0.85 : 0.92;
    case 'gravel':
      return profile.gravelGrip;
    default:
      return profile.dryGrip;
  }
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
