import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PORTRAIT_QUERY, screenAfterInterruption } from '../src/app/Interruptions';

const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf-8');

describe('Phone interruptions (R9 part 6)', () => {
  it('pauses only a running race; every other screen stays as it is', () => {
    expect(screenAfterInterruption('racing')).toBe('paused');
    for (const screen of ['hub', 'grid', 'paused', 'results']) expect(screenAfterInterruption(screen)).toBe(screen);
  });

  it('treats a tab switch, screen lock, lost focus, page close and turning upright as interruptions', () => {
    const source = read('src/app/Interruptions.ts');
    expect(source).toMatch(/addEventListener\('visibilitychange'/);
    expect(source).toMatch(/addEventListener\('blur', onInterrupt\)/);
    expect(source).toMatch(/addEventListener\('pagehide', onInterrupt\)/);
    // The same rule as the rotate prompt that covers the game
    expect(read('index.html')).toContain(`@media screen and ${PORTRAIT_QUERY.replace(/\)$/, '')}`);
  });

  it('silences the game while away, skips catch-up physics on return, and wakes the sound on any later tap', () => {
    const setup = read('src/app/BrowserSetup.ts');
    expect(setup).not.toMatch(/once: true/);
    // iOS reports "interrupted" after a call, not "suspended": both are resumed
    expect(read('src/audio/AudioEngine.ts')).toMatch(/this\.ctx\.state !== 'running' && this\.ctx\.state !== 'closed'/);
  });
});
