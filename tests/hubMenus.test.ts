import { describe, it, expect } from 'vitest';
import { Closeable, closeFirstOpen } from '../src/app/HubMenus';

/** A screen that records when Esc closes it */
function screen(open: boolean, closed: string[], name: string): Closeable {
  return {
    isOpen: open,
    close: () => closed.push(name)
  };
}

describe('Esc closes one screen at a time (P09-R02 step 5)', () => {
  it('closes only the first open screen, in list order', () => {
    const closed: string[] = [];
    const screens = [screen(false, closed, 'settings'), screen(true, closed, 'records'), screen(true, closed, 'garage')];
    expect(closeFirstOpen(screens)).toBe(true);
    expect(closed).toEqual(['records']);
  });

  it('closes nothing when no screen is open, so Esc can pause instead', () => {
    const closed: string[] = [];
    expect(closeFirstOpen([screen(false, closed, 'settings'), screen(false, closed, 'garage')])).toBe(false);
    expect(closed).toEqual([]);
  });
});
