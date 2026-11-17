import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ARROW_KEYS,
  assignKey,
  DEFAULT_KEYS,
  DRIVE_ACTIONS,
  keyLabel,
  parseKeyBindings,
  reservedReason
} from '../src/app/KeyBindings';
import { motionReduced, parseSettings } from '../src/app/Settings';

const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf-8');

describe('Remappable driving keys (R9 part 6b)', () => {
  it('starts on W A S D and Space, with the arrows as a fixed second key', () => {
    expect(DEFAULT_KEYS).toEqual({ accelerate: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', drift: 'Space' });
    expect(ARROW_KEYS.accelerate).toBe('ArrowUp');
    expect(ARROW_KEYS.drift).toBeNull();
  });

  it('moves a key to a new action, swapping if another action had it', () => {
    const moved = assignKey(DEFAULT_KEYS, 'accelerate', 'KeyI');
    expect(moved).toEqual({ bindings: { ...DEFAULT_KEYS, accelerate: 'KeyI' } });
    const swapped = assignKey(DEFAULT_KEYS, 'accelerate', 'KeyS');
    expect(swapped).toEqual({ bindings: { ...DEFAULT_KEYS, accelerate: 'KeyS', brake: 'KeyW' } });
    if ('bindings' in swapped) expect(new Set(Object.values(swapped.bindings)).size).toBe(DRIVE_ACTIONS.length);
  });

  it('refuses keys the game already uses, and says why', () => {
    expect(assignKey(DEFAULT_KEYS, 'drift', 'KeyR')).toEqual({ error: 'R is used for Restart' });
    expect(assignKey(DEFAULT_KEYS, 'brake', 'Escape')).toEqual({ error: 'Escape is used for Pause' });
    expect(reservedReason('ArrowLeft')).toBe('Left arrow is used for Steer left');
    expect(reservedReason('KeyJ')).toBeNull();
  });

  it('names keys the way you would', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('ShiftLeft')).toBe('Left Shift');
    expect(keyLabel('ControlRight')).toBe('Right Ctrl');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('ArrowUp')).toBe('Up arrow');
  });

  it('reads a saved set safely: odd, reserved or doubled keys fall back to the defaults', () => {
    expect(parseKeyBindings(JSON.stringify({ ...DEFAULT_KEYS, drift: 'ShiftLeft' })).drift).toBe('ShiftLeft');
    expect(parseKeyBindings(JSON.stringify({ accelerate: 'KeyR' })).accelerate).toBe('KeyW');
    expect(parseKeyBindings(JSON.stringify({ accelerate: '<b>' })).accelerate).toBe('KeyW');
    expect(parseKeyBindings(JSON.stringify({ accelerate: 'KeyS' }))).toEqual(DEFAULT_KEYS);
    expect(parseKeyBindings('{nope')).toEqual(DEFAULT_KEYS);
  });

  it('drives with your keys or the arrows, and the Settings panel listens before the game does', () => {
    const input = read('src/engine/InputManager.ts');
    expect(input).toMatch(/this\.keys\[b\.accelerate\] \|\| this\.keys\['ArrowUp'\]/);
    expect(input).toMatch(/this\.keys\[b\.drift\]/);
    expect(read('src/ui/KeyBindingsPanel.ts')).toMatch(/addEventListener\('keydown', \(e\) => this\.onKey\(e\), \{ capture: true \}\)/);
    expect(read('index.html')).toMatch(/id="settings-keys"/);
  });
});

describe('Reduce motion (R9 part 6b, DESIGN.md section 8)', () => {
  it('follows the device on Auto, and your choice otherwise', () => {
    expect(motionReduced('auto', true)).toBe(true);
    expect(motionReduced('auto', false)).toBe(false);
    expect(motionReduced('on', false)).toBe(true);
    expect(motionReduced('off', true)).toBe(false);
    expect(parseSettings(null).reduceMotion).toBe('auto');
  });

  it('stops the zoom pulse, the car lean and CSS movement', () => {
    const main = read('src/main.ts');
    expect(main).toMatch(/const targetFov = this\.reduceMotion\s*\?\s*58/);
    expect(main).toMatch(/this\.playerCar\.setLean\(!this\.reduceMotion\)/);
    expect(main).toMatch(/classList\.toggle\('reduce-motion', this\.reduceMotion\)/);
    expect(read('src/ui/screens.css')).toMatch(/:root\.reduce-motion \*/);
    expect(read('src/render/PlayerCarVisual.ts')).toMatch(/this\.leans \?/);
  });
});
