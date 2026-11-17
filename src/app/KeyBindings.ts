/**
 * Remappable driving keys (R9 part 6b, PROJECT_PLAN accessibility: "remappable keyboard
 * controls"). Each driving action has one key you can change; the arrow keys always work
 * too, so a bad choice never leaves you unable to drive. Saved on this device.
 */

export type DriveAction = 'accelerate' | 'brake' | 'left' | 'right' | 'drift';

export type KeyBindings = Record<DriveAction, string>;

export const DRIVE_ACTIONS: readonly DriveAction[] = ['accelerate', 'brake', 'left', 'right', 'drift'];

export const ACTION_NAMES: Readonly<Record<DriveAction, string>> = {
  accelerate: 'Accelerate',
  brake: 'Brake',
  left: 'Steer left',
  right: 'Steer right',
  drift: 'Drift'
};

export const DEFAULT_KEYS: Readonly<KeyBindings> = {
  accelerate: 'KeyW',
  brake: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  drift: 'Space'
};

/** The fixed second key for each action: the arrows (drift has none) */
export const ARROW_KEYS: Readonly<Record<DriveAction, string | null>> = {
  accelerate: 'ArrowUp',
  brake: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  drift: null
};

/** Keys the game already uses (shortcuts, the arrows), with what they do */
const RESERVED: Readonly<Record<string, string>> = {
  Escape: 'Pause',
  KeyP: 'Pause',
  KeyC: 'Camera',
  KeyT: 'Track',
  KeyM: 'Sound',
  KeyR: 'Restart',
  KeyG: 'Ghost',
  Tab: 'Standings',
  Digit1: 'Tyres',
  Digit2: 'Tyres',
  Digit3: 'Tyres',
  Numpad1: 'Tyres',
  Numpad2: 'Tyres',
  Numpad3: 'Tyres',
  ArrowUp: 'Accelerate',
  ArrowDown: 'Brake',
  ArrowLeft: 'Steer left',
  ArrowRight: 'Steer right'
};

const STORAGE_KEY = 'apex_keys_v1';

/** A key code as shown to you: "KeyW" is W, "Digit7" is 7, "ShiftLeft" is Left Shift */
export function keyLabel(code: string): string {
  if (code.startsWith('Arrow')) return `${code.slice(5)} arrow`;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const side = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  if (side) return `${side[2]} ${side[1] === 'Control' ? 'Ctrl' : side[1]}`;
  return code;
}

/** Why a key cannot drive, or null if it can */
export function reservedReason(code: string): string | null {
  const use = RESERVED[code];
  return use ? `${keyLabel(code)} is used for ${use}` : null;
}

/** A key code the browser could send: letters, digits and words only */
function isKeyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9]{1,24}$/.test(value);
}

/**
 * Puts `code` on `action`. A key already on another action swaps over, so no key drives
 * two things. Returns the new bindings, or the reason the key cannot be used.
 */
export function assignKey(
  bindings: KeyBindings,
  action: DriveAction,
  code: string
): { bindings: KeyBindings } | { error: string } {
  const reason = reservedReason(code);
  if (reason) return { error: reason };
  if (!isKeyCode(code)) return { error: 'That key cannot be used' };
  const next = { ...bindings };
  const other = DRIVE_ACTIONS.find((a) => a !== action && next[a] === code);
  if (other) next[other] = bindings[action];
  next[action] = code;
  return { bindings: next };
}

/** Saved bindings, checked key by key; anything odd, reserved or doubled falls back to the defaults */
export function parseKeyBindings(raw: string | null): KeyBindings {
  if (!raw) return { ...DEFAULT_KEYS };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return { ...DEFAULT_KEYS };
    const bindings = { ...DEFAULT_KEYS };
    for (const action of DRIVE_ACTIONS) {
      const code = data[action];
      if (isKeyCode(code) && !reservedReason(code)) bindings[action] = code;
    }
    return new Set(Object.values(bindings)).size === DRIVE_ACTIONS.length ? bindings : { ...DEFAULT_KEYS };
  } catch {
    return { ...DEFAULT_KEYS };
  }
}

export function loadKeyBindings(): KeyBindings {
  try {
    return parseKeyBindings(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_KEYS };
  }
}

export function saveKeyBindings(bindings: KeyBindings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Storage blocked: the keys still apply for this session
  }
}
