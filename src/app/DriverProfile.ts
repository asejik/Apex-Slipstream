/**
 * Your driver (R9 part 4, Decision 12): name, race number and livery, saved on this device.
 * Cosmetic only: nothing here changes how the car or the driver performs. The name is
 * cleaned here and only ever shown with textContent (AGENTS.md).
 */

export interface DriverProfile {
  /** Empty: you are shown as "You" */
  name: string;
  /** 1 to 99 */
  number: number;
  liveryId: string;
}

interface Livery {
  id: string;
  name: string;
  /** Car paint (sRGB): the main bodywork and the trim */
  body: number;
  accent: number;
  unlockLevel: number;
}

/**
 * Car paint, unlocked by career level (Decision 14). Broadcast is the design's own
 * player livery (docs/DESIGN.md: white with the accent red).
 */
export const LIVERIES: readonly Livery[] = [
  { id: 'broadcast', name: 'Broadcast', body: 0xf2f3f7, accent: 0xff3347, unlockLevel: 1 },
  { id: 'stealth', name: 'Stealth', body: 0x1c1d24, accent: 0xff3347, unlockLevel: 2 },
  { id: 'ocean', name: 'Ocean', body: 0x1f5fd1, accent: 0xf2f3f7, unlockLevel: 3 },
  { id: 'sunburst', name: 'Sunburst', body: 0xffb81c, accent: 0x1c1d24, unlockLevel: 4 },
  { id: 'emerald', name: 'Emerald', body: 0x0e8a4f, accent: 0xf2f3f7, unlockLevel: 6 },
  { id: 'ultraviolet', name: 'Ultraviolet', body: 0x6c2bd9, accent: 0x19c7c2, unlockLevel: 9 },
  { id: 'inferno', name: 'Inferno', body: 0xff5a1f, accent: 0x1c1d24, unlockLevel: 12 },
  { id: 'gold', name: 'Gold standard', body: 0xd4a017, accent: 0x1c1d24, unlockLevel: 16 }
];

/** The licence on your driver card, by career level (Decision 14) */
const LICENCES: readonly { level: number; name: string }[] = [
  { level: 1, name: 'Rookie' },
  { level: 3, name: 'Club' },
  { level: 5, name: 'National' },
  { level: 8, name: 'International' },
  { level: 12, name: 'Elite' },
  { level: 20, name: 'Legend' }
];

export const NAME_MAX_LENGTH = 16;
const STORAGE_KEY = 'apex_driver_v1';

export const DEFAULT_DRIVER: Readonly<DriverProfile> = { name: '', number: 7, liveryId: 'broadcast' };

/**
 * A name fit to show: letters (any alphabet), digits, spaces and . ' - only, single
 * spaces, at most NAME_MAX_LENGTH characters
 */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[^\p{L}\p{M}\p{N} .'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX_LENGTH)
    .trim();
}

/** A race number from 1 to 99, or the default */
export function cleanNumber(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 99 ? n : DEFAULT_DRIVER.number;
}

function liveryById(id: string): Livery {
  return LIVERIES.find((livery) => livery.id === id) ?? LIVERIES[0]!;
}

/** Your livery, if your level has unlocked it; otherwise Broadcast */
export function activeLivery(profile: DriverProfile, level: number): Livery {
  const livery = liveryById(profile.liveryId);
  return level >= livery.unlockLevel ? livery : LIVERIES[0]!;
}

export function licenceFor(level: number): string {
  let name = LICENCES[0]!.name;
  for (const licence of LICENCES) if (level >= licence.level) name = licence.name;
  return name;
}

/** Your name for tables and results: the name, or "You" */
export function fullName(profile: DriverProfile): string {
  return profile.name || 'You';
}

/** Your name for the timing tower and hub: the last word in capitals, like the AI, or "YOU" */
export function shortName(profile: DriverProfile): string {
  const parts = profile.name.split(' ');
  return (parts[parts.length - 1] || 'You').toUpperCase();
}

export function parseDriverProfile(raw: string | null): DriverProfile {
  if (!raw) return { ...DEFAULT_DRIVER };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return { ...DEFAULT_DRIVER };
    return {
      name: cleanName(data.name),
      number: cleanNumber(data.number),
      liveryId: typeof data.liveryId === 'string' ? liveryById(data.liveryId).id : DEFAULT_DRIVER.liveryId
    };
  } catch {
    return { ...DEFAULT_DRIVER };
  }
}

export function loadDriverProfile(): DriverProfile {
  try {
    return parseDriverProfile(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_DRIVER };
  }
}

export function saveDriverProfile(profile: DriverProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('DriverProfile: could not save your driver', e);
  }
}
