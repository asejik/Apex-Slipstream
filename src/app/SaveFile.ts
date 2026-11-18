import type { GhostRecord } from '../storage/GhostStorage';

/**
 * Your whole save as one file, to keep a copy or move it to another browser (P07-R02).
 * Browsers can clear a website's storage (Safari after 7 days unused), so this is the backup.
 */

/** Every localStorage key the game writes. A save file may contain only these. */
export const SAVE_KEYS = [
  'apex_career_v1',
  'apex_championship_v1',
  'apex_driver_v1',
  'apex_keys_v1',
  'apex_season_v1',
  'apex_season_highway_v1',
  'apex_season_city_v1',
  'apex_season_mountain_v1',
  'apex_settings_v1'
] as const;

const FORMAT = 'apex-slipstream-save';
const VERSION = 1;

/** A ghost lap as it is written in the file: the samples as base64 */
interface SavedGhost extends Omit<GhostRecord, 'frameData'> {
  frameData: string;
}

interface SaveFile {
  format: typeof FORMAT;
  version: number;
  savedAt: string;
  local: Record<string, string>;
  ghosts: SavedGhost[];
}

/** What a save file restores */
interface SaveContents {
  local: Record<string, string>;
  ghosts: GhostRecord[];
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): ArrayBuffer {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** The save in `storage` and `ghosts`, as a file's contents */
export function buildSaveFile(storage: Pick<Storage, 'getItem'>, ghosts: GhostRecord[], now = new Date()): SaveFile {
  const local: Record<string, string> = {};
  for (const key of SAVE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) local[key] = value;
  }
  return {
    format: FORMAT,
    version: VERSION,
    savedAt: now.toISOString(),
    local,
    ghosts: ghosts.map((ghost) => ({ ...ghost, frameData: toBase64(ghost.frameData) }))
  };
}

/** The file name for a save made on `now` */
export function saveFileName(now = new Date()): string {
  return `apex-slipstream-save-${now.toISOString().slice(0, 10)}.json`;
}

function isGhost(value: unknown): value is SavedGhost {
  const g = value as SavedGhost;
  return (
    typeof g === 'object' && g !== null &&
    typeof g.key === 'string' && typeof g.trackId === 'string' &&
    (g.type === 'pb' || g.type === 'previous') && g.key === `${g.trackId}_${g.type}` &&
    Number.isFinite(g.lapTimeMs) && Number.isFinite(g.recordedAt) &&
    Number.isInteger(g.sampleCount) && Number.isFinite(g.sampleRateHz) &&
    typeof g.frameData === 'string'
  );
}

/**
 * Reads a save file's text. Anything that isn't this game's save, or holds keys the game
 * doesn't write, is refused whole: nothing is restored from a file that fails.
 */
export function readSaveFile(text: string): SaveContents | { error: string } {
  let data: Partial<SaveFile>;
  try {
    data = JSON.parse(text) as Partial<SaveFile>;
  } catch {
    return { error: "That file isn't an Apex Slipstream save." };
  }
  if (data?.format !== FORMAT || typeof data.local !== 'object' || data.local === null || !Array.isArray(data.ghosts)) {
    return { error: "That file isn't an Apex Slipstream save." };
  }
  if (data.version !== VERSION) return { error: 'That save is from a different version of the game.' };

  const allowed = new Set<string>(SAVE_KEYS);
  const local: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.local)) {
    if (!allowed.has(key) || typeof value !== 'string') return { error: 'That save file is damaged.' };
    local[key] = value;
  }
  const ghosts: GhostRecord[] = [];
  for (const ghost of data.ghosts) {
    if (!isGhost(ghost)) return { error: 'That save file is damaged.' };
    try {
      ghosts.push({ ...ghost, frameData: fromBase64(ghost.frameData) });
    } catch {
      return { error: 'That save file is damaged.' };
    }
  }
  return { local, ghosts };
}

/**
 * Asks the browser to keep the game's storage instead of clearing it when space runs low
 * or the site goes unused. Browsers decide for themselves; asking is harmless.
 */
export function askToKeepSave(): void {
  if (typeof navigator === 'undefined') return;
  navigator.storage?.persist?.().catch(() => {});
}
