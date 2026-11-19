import { test, expect, Page } from '@playwright/test';
import { openGame, reloadGame, expectNoErrors } from './helpers';

type Renderer = { getPixelRatio(): number; shadowMap: { enabled: boolean } };
type Scene = { getObjectByName(name: string): { shadow: { mapSize: { width: number } } } | undefined };

/** What the renderer draws now */
function drawn(page: Page): Promise<{ pixelRatio: number; shadows: boolean; shadowSize: number | undefined }> {
  return page.evaluate(() => {
    const game = (window as unknown as { __game: { renderer: Renderer; scene: Scene } }).__game;
    return {
      pixelRatio: game.renderer.getPixelRatio(),
      shadows: game.renderer.shadowMap.enabled,
      shadowSize: game.scene.getObjectByName('sun')?.shadow.mapSize.width
    };
  });
}

/** Settings → Graphics (Decision 16): Medium between High and Low, and saved */
test.use({ deviceScaleFactor: 3 });

test('Medium graphics draws 1.5x pixels with half-size shadows, and is kept after a reload', async ({ page }) => {
  const errors = await openGame(page);
  expect(await drawn(page)).toEqual({ pixelRatio: 2, shadows: true, shadowSize: 2048 });

  await page.locator('#hub-tab-settings').click();
  await page.locator('[data-setting="graphics"] button[data-value="medium"]').click();
  expect(await drawn(page)).toEqual({ pixelRatio: 1.5, shadows: true, shadowSize: 1024 });

  await page.locator('[data-setting="graphics"] button[data-value="low"]').click();
  expect((await drawn(page)).pixelRatio).toBe(1);
  expect((await drawn(page)).shadows).toBe(false);

  await page.locator('[data-setting="graphics"] button[data-value="medium"]').click();
  await reloadGame(page);
  expect(await drawn(page)).toEqual({ pixelRatio: 1.5, shadows: true, shadowSize: 1024 });
  expectNoErrors(errors);
});
