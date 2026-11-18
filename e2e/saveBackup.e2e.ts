import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openGame, expectScreen, driveOffTheGrid, takeChequeredFlag, expectNoErrors } from './helpers';

/**
 * A save survives the browser losing it (P07-R02): race, download the save, wipe every
 * bit of storage, load the file, and the career and season are back.
 */
test('a downloaded save brings the career back after the browser is wiped', async ({ page }) => {
  const errors = await openGame(page);

  // Race one championship round, so there is a career and a season to keep
  await page.locator('#hub-start-weekend').click();
  await page.locator('#card-mode-skip').click();
  await page.locator('#btn-start-qualifying').click();
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await driveOffTheGrid(page);
  await takeChequeredFlag(page);
  await page.locator('#btn-next-race').click();
  await expectScreen(page, 'hub');
  await expect(page.locator('#hub-round')).toContainText('Round 2 of 8');
  const level = await page.locator('#hub-level-chip').textContent();
  const season = await page.locator('#hub-season-chip').textContent();

  // Settings → Download save
  await page.locator('#hub-tab-settings').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save-download').click()]);
  expect(download.suggestedFilename()).toMatch(/^apex-slipstream-save-\d{4}-\d{2}-\d{2}\.json$/);
  const savePath = test.info().outputPath('save.json');
  await download.saveAs(savePath);
  const saved = JSON.parse(await readFile(savePath, 'utf-8'));
  expect(Object.keys(saved.local)).toContain('apex_season_v1');

  // The browser loses everything
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('ApexSlipstreamDB');
      request.onsuccess = request.onerror = request.onblocked = resolve;
    });
  });
  await page.reload();
  await expectScreen(page, 'hub');
  await expect(page.locator('#hub-round')).toContainText('Round 1 of 8');

  // Settings → Load save: the first tap asks, the second opens the file picker
  await page.locator('#hub-tab-settings').click();
  await page.locator('#save-load').click();
  await expect(page.locator('#save-note')).toContainText('replaces all your progress');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#save-load').click()]);
  await Promise.all([page.waitForEvent('load'), chooser.setFiles(savePath)]);

  // The game restarts with the save
  await expectScreen(page, 'hub');
  await expect(page.locator('#hub-round')).toContainText('Round 2 of 8');
  await expect(page.locator('#hub-level-chip')).toHaveText(level ?? '');
  await expect(page.locator('#hub-season-chip')).toHaveText(season ?? '');
  expectNoErrors(errors);
});

test('a file that is not a save is refused and changes nothing', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#hub-tab-settings').click();
  await page.locator('#save-load').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#save-load').click()]);
  await chooser.setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('#save-note')).toHaveText("That file isn't an Apex Slipstream save.");
  expectNoErrors(errors);
});
