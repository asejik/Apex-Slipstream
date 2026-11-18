import { expect, type Page } from '@playwright/test';

/**
 * Shared steps for the end-to-end journeys (R10 part 2). Each test gets a fresh browser
 * profile, so every journey starts from a new save unless it seeds one.
 */

type GameScreen = 'hub' | 'grid' | 'racing' | 'paused';

/** Opens the game on the hub and collects page errors for `expectNoErrors` */
export async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expectScreen(page, 'hub');
  return errors;
}

export async function expectScreen(page: Page, screen: GameScreen): Promise<void> {
  await expect(page.locator('#app')).toHaveAttribute('data-screen', screen);
}

/** Reloads and waits for the hub again: a save must survive this */
export async function reloadGame(page: Page): Promise<void> {
  await page.reload();
  await expectScreen(page, 'hub');
}

/** The speed readout in km/h */
async function speed(page: Page): Promise<number> {
  return Number((await page.locator('#speed-value').textContent())?.trim() ?? '0');
}

/**
 * Waits out the start lights, then holds the throttle until the car is clearly moving.
 * This is the real input path: keyboard, physics, HUD. Leaves the throttle held when
 * `keepThrottle` is set.
 */
export async function driveOffTheGrid(page: Page, keepThrottle = false): Promise<void> {
  await expectScreen(page, 'racing');
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => speed(page), { timeout: 30_000 }).toBeGreaterThan(30);
  if (!keepThrottle) await page.keyboard.up('ArrowUp');
}

/**
 * Shortcut to the chequered flag. A full race takes minutes, so the test asks the game to
 * end the session as if the player crossed the line now. Everything after that (the
 * cool-down, results, points, XP, saving) is the real code path.
 */
export async function takeChequeredFlag(page: Page): Promise<void> {
  await page.evaluate(() => {
    const game = (window as unknown as { __game: { onRaceCompleted(): void } }).__game;
    game.onRaceCompleted();
  });
}

/**
 * Shortcut to the end of a time trial lap: the lap timer reports a lap of `seconds` through
 * the hook the start line uses. The ghost samples are the ones really recorded while driving.
 */
export async function completeLap(page: Page, seconds: number): Promise<void> {
  await page.evaluate((lapSeconds) => {
    const game = (window as unknown as {
      __game: { lapManager: { onLapCompleted: (lap: number, time: number) => void } };
    }).__game;
    game.lapManager.onLapCompleted(1, lapSeconds);
  }, seconds);
}

export function expectNoErrors(errors: string[]): void {
  expect(errors, errors.join('\n')).toEqual([]);
}
