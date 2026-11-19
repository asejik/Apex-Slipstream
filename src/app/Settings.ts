import type { CameraMode } from '../engine/CameraController';

/** Player settings (R5, docs/DESIGN.md section 5), saved on this device only. */
export interface GameSettings {
  camera: CameraMode;
  ghost: boolean;
  sound: boolean;
  volume: 'low' | 'medium' | 'high';
  units: 'kmh' | 'mph';
  graphics: 'high' | 'medium' | 'low';
  showFps: boolean;
  /** Calmer camera and screens (R9 accessibility): auto follows the device's own setting */
  reduceMotion: 'auto' | 'on' | 'off';
  /** Pro and Legend unlock with your career level (src/app/Unlocks.ts) */
  difficulty: 'easy' | 'medium' | 'hard' | 'pro' | 'legend';
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
  camera: 'high-chase',
  ghost: true,
  sound: true,
  volume: 'medium',
  units: 'kmh',
  graphics: 'high',
  showFps: false,
  reduceMotion: 'auto',
  difficulty: 'medium'
};

/** Whether to reduce motion: your choice, or with auto the device's prefers-reduced-motion */
export function motionReduced(setting: GameSettings['reduceMotion'], devicePrefersReduced: boolean): boolean {
  return setting === 'on' || (setting === 'auto' && devicePrefersReduced);
}

const STORAGE_KEY = 'apex_settings_v1';

/** Master volume for each setting (the engine's mix was tuned at 0.75) */
export const VOLUME_LEVELS: Readonly<Record<GameSettings['volume'], number>> = {
  low: 0.4,
  medium: 0.75,
  high: 1.0
};

const KMH_TO_MPH = 0.621371;

/** Speed for the HUD in the chosen units, rounded */
export function displaySpeed(speedKmh: number, units: GameSettings['units']): number {
  return Math.round(units === 'mph' ? speedKmh * KMH_TO_MPH : speedKmh);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Reads saved settings. Anything missing, unknown or corrupted falls back to the default,
 * one field at a time, so an old or hand-edited save never breaks the game.
 */
export function parseSettings(raw: string | null): GameSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    data = parsed as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  const d = DEFAULT_SETTINGS;
  return {
    camera: oneOf(data.camera, ['high-chase', 'low-chase', 'top-down'] as const, d.camera),
    ghost: bool(data.ghost, d.ghost),
    sound: bool(data.sound, d.sound),
    volume: oneOf(data.volume, ['low', 'medium', 'high'] as const, d.volume),
    units: oneOf(data.units, ['kmh', 'mph'] as const, d.units),
    graphics: oneOf(data.graphics, ['high', 'medium', 'low'] as const, d.graphics),
    showFps: bool(data.showFps, d.showFps),
    reduceMotion: oneOf(data.reduceMotion, ['auto', 'on', 'off'] as const, d.reduceMotion),
    difficulty: oneOf(data.difficulty, ['easy', 'medium', 'hard', 'pro', 'legend'] as const, d.difficulty)
  };
}

export function loadSettings(): GameSettings {
  try {
    return parseSettings(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked (private mode): the settings still apply for this session
  }
}
