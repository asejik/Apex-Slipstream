import { test, expect } from '@playwright/test';
import { openGame, expectScreen, driveOffTheGrid, takeChequeredFlag, expectNoErrors } from './helpers';

test('a quick race shows its result and never touches the championship', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#hub-quick-race').click();
  await expect(page.locator('#quick-race-screen')).toBeVisible();
  await page.locator('#quick-race-start').click();

  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await driveOffTheGrid(page);

  await takeChequeredFlag(page);
  await expect(page.locator('#modal-race-results')).toHaveClass(/active/);
  await expect(page.locator('#modal-race-results')).toContainText("don't count for the championship");
  await page.locator('#btn-next-race').click();

  await expectScreen(page, 'hub');
  await expect(page.locator('#hub-round')).toContainText('Round 1 of 8');
  expectNoErrors(errors);
});
