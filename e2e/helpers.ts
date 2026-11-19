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
  // The loading screen's logo covers the hub for its first seconds
  await expect(page.locator('#splash')).toHaveCount(0);
  return errors;
}

export async function expectScreen(page: Page, screen: GameScreen): Promise<void> {
  await expect(page.locator('#app')).toHaveAttribute('data-screen', screen);
}

/** Reloads and waits for the hub again: a save must survive this */
export async function reloadGame(page: Page): Promise<void> {
  await page.reload();
  await expectScreen(page, 'hub');
  await expect(page.locator('#splash')).toHaveCount(0);
}

/** The speed readout in km/h */
export async function speed(page: Page): Promise<number> {
  return Number((await page.locator('#speed-value').textContent())?.trim() ?? '0');
}

/**
 * Runs `seconds` of game time now, in the game's own 1/60 s physics steps (R10-05).
 *
 * The journeys used to wait in real time for the lights and the car. On CI there is no
 * graphics card and a frame can take a second, so race time crawled and journeys timed out.
 * This calls the real game loop with time stamps 100 ms apart: input, physics, the start
 * lights, the HUD and the session timers all run as in play. Only drawing the 3D scene is
 * skipped, and the browser's own frame loop is held off so it never runs twice.
 */
export async function advance(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => {
    type Game = { gameLoop(t: number): void; lastTime: number; renderer: { render: (...args: unknown[]) => void } };
    const game = (window as unknown as { __game: Game }).__game;
    const draw = game.renderer.render;
    const nextFrame = window.requestAnimationFrame;
    game.renderer.render = () => {};
    window.requestAnimationFrame = () => 0;
    try {
      let t = game.lastTime;
      for (let i = 0; i < Math.round(s * 10); i++) {
        t += 100;
        game.gameLoop(t);
      }
    } finally {
      game.renderer.render = draw;
      window.requestAnimationFrame = nextFrame;
    }
  }, seconds);
}

/**
 * Waits out the start lights, then holds the throttle until the car is clearly moving.
 * The keyboard, physics and HUD are the real path; game time is stepped by `advance`.
 * Leaves the throttle held when `keepThrottle` is set.
 */
export async function driveOffTheGrid(page: Page, keepThrottle = false): Promise<void> {
  await expectScreen(page, 'racing');
  await page.keyboard.down('ArrowUp');
  // The lights take about 6 s; then a second or two to pass 30 km/h
  for (let i = 0; i < 20 && (await speed(page)) <= 30; i++) await advance(page, 1);
  expect(await speed(page)).toBeGreaterThan(30);
  if (!keepThrottle) await page.keyboard.up('ArrowUp');
}

/**
 * Shortcut to the chequered flag. A full race takes minutes, so the test asks the game to
 * end the session as if the player crossed the line now. Everything after that (the
 * cool-down, results, points, XP, saving) is the real code path; the cool-down is stepped.
 */
export async function takeChequeredFlag(page: Page): Promise<void> {
  await page.evaluate(() => {
    const game = (window as unknown as { __game: { onRaceCompleted(): void } }).__game;
    game.onRaceCompleted();
  });
  // The cool-down after the flag is 3 s of race time
  await advance(page, 4);
}

/**
 * Shortcut to the end of a time trial lap: the lap timer reports a lap of `seconds` through
 * the hook the start line uses. The ghost samples are the ones really recorded while driving.
 */
export async function completeLap(page: Page, seconds: number): Promise<void> {
  await page.evaluate((lapSeconds) => {
    const game = (window as unknown as {
      __game: { world: { lapManager: { onLapCompleted: (lap: number, time: number) => void } } };
    }).__game;
    game.world.lapManager.onLapCompleted(1, lapSeconds);
  }, seconds);
}

export function expectNoErrors(errors: string[]): void {
  expect(errors, errors.join('\n')).toEqual([]);
}
