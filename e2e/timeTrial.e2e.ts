import { test, expect } from '@playwright/test';
import { openGame, driveOffTheGrid, completeLap, reloadGame, expectNoErrors } from './helpers';

test('a time trial lap is saved as your best and is still there after a reload', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#hub-time-trial').click();
  await expect(page.locator('#time-trial-screen')).toBeVisible();
  await expect(page.locator('#time-trial-tracks')).toContainText('No time yet');
  await page.locator('#time-trial-start').click();

  // Drive over the start line (the car starts behind it), so the lap timer runs and the
  // ghost records samples; then the lap ends
  await driveOffTheGrid(page, true);
  await expect
    .poll(async () => (await page.locator('#lap-timer-value').textContent())?.trim(), { timeout: 30_000 })
    .toMatch(/^0:0[1-9]|^0:[1-5]\d/);
  await completeLap(page, 75.5);
  await page.keyboard.up('ArrowUp');
  // The alert is always in the page; it shows by its class
  await expect(page.locator('#pb-indicator')).toHaveClass(/visible/);
  // Saving to IndexedDB takes a moment: wait for it, as a player would before closing
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const game = (window as unknown as {
          __game: { ghostStorage: { getGhost(track: string, type: 'pb'): Promise<{ lapTimeMs: number } | null> } };
        }).__game;
        return (await game.ghostStorage.getGhost('track_01_coastal', 'pb'))?.lapTimeMs ?? null;
      })
    )
    .toBe(75_500);

  // The best lap and its ghost were saved in the browser's storage
  await reloadGame(page);
  await page.locator('#hub-time-trial').click();
  await expect(page.locator('#time-trial-tracks')).toContainText('Best 1:15.50');
  expectNoErrors(errors);
});
