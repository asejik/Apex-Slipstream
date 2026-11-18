import { test, expect } from '@playwright/test';
import { openGame, driveOffTheGrid, completeLap, reloadGame, expectNoErrors } from './helpers';

test('a time trial lap is saved as your best and is still there after a reload', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#hub-time-trial').click();
  await expect(page.locator('#time-trial-screen')).toBeVisible();
  await expect(page.locator('#time-trial-tracks')).toContainText('No time yet');
  await page.locator('#time-trial-start').click();

  // Drive so the ghost records samples, then the lap ends
  await driveOffTheGrid(page, true);
  await completeLap(page, 75.5);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('#pb-indicator')).toBeVisible();

  // The best lap and its ghost were saved in the browser's storage
  await reloadGame(page);
  await page.locator('#hub-time-trial').click();
  await expect(page.locator('#time-trial-tracks')).toContainText('Best 1:15.50');
  expectNoErrors(errors);
});
