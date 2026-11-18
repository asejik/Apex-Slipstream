import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys (R10 part 2): the real game in a real browser.
 * The files end in .e2e.ts so Vitest's unit run never picks them up.
 */
const PORT = 5199;
/** The built game, for the journeys that need a build: the service worker (U-10), the security policy */
const BUILD_PORT = 5198;

/**
 * How headless Chromium draws WebGL. Its default, SwiftShader, manages 2-5 fps on this game,
 * which slows race time to a crawl (a short journey takes minutes). So:
 * - gpu (default on Windows): the real graphics card through Direct3D, 60 fps
 * - warp (CI, which has no graphics card): Windows' own software renderer, about 14 fps on a
 *   2-core laptop, which keeps race time close to real time
 * - anything else: Chromium's default
 * Set E2E_GL to choose.
 */
const GL = process.env.E2E_GL ?? (process.platform === 'win32' ? 'gpu' : 'default');
const GPU_ARGS =
  GL === 'gpu'
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
    : GL === 'warp'
    ? ['--use-angle=d3d11-warp']
    : [];

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  // A software renderer is 4-20x slower than the graphics card
  timeout: GL === 'gpu' ? 90_000 : 300_000,
  expect: { timeout: GL === 'gpu' ? 15_000 : 60_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // A cached old build must never answer instead of the code under test (U-10)
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      // The built game, as deployed
      name: 'build',
      testMatch: ['offline.e2e.ts', 'securityPolicy.e2e.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: { args: GPU_ARGS },
        baseURL: `http://localhost:${BUILD_PORT}`,
        serviceWorkers: 'allow'
      }
    },
    {
      name: 'desktop',
      testIgnore: ['offline.e2e.ts', 'securityPolicy.e2e.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, launchOptions: { args: GPU_ARGS } }
    }
  ],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: `npx vite build && npx vite preview --port ${BUILD_PORT} --strictPort`,
      url: `http://localhost:${BUILD_PORT}`,
      // Always a fresh build: a server left running would answer with old code
      reuseExistingServer: false,
      timeout: 180_000
    }
  ]
});
