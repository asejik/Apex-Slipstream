import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerServiceWorker } from '../src/app/BrowserSetup';
import * as fs from 'fs';
import * as path from 'path';

describe('PWA & Security Headers Verification Suite', () => {
  const publicDir = path.resolve(__dirname, '../public');

  it('contains a valid manifest.webmanifest with all required PWA fields', () => {
    const manifestPath = path.join(publicDir, 'manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBe('Apex Slipstream: 3D Arcade Championship');
    expect(manifest.short_name).toBe('Apex Slipstream');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.theme_color).toBe('#00f0ff');
    expect(manifest.background_color).toBe('#090d16');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  it('contains public/_headers with strict Content Security Policy and hardening', () => {
    const headersPath = path.join(publicDir, '_headers');
    expect(fs.existsSync(headersPath)).toBe(true);

    const headers = fs.readFileSync(headersPath, 'utf-8');
    expect(headers).toContain('Content-Security-Policy:');
    expect(headers).toContain("default-src 'self'");
    // No inline scripts, and nothing from Google Fonts (the fonts are bundled) (P15-17)
    expect(headers).toContain("script-src 'self';");
    expect(headers).not.toMatch(/googleapis|gstatic/);
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('X-Frame-Options: DENY');
  });

  it('contains public/sw.js with service worker caching handlers', () => {
    const swPath = path.join(publicDir, 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain("addEventListener('install'");
    expect(swContent).toContain("addEventListener('activate'");
    expect(swContent).toContain("addEventListener('fetch'");
    expect(swContent).toContain('caches.match');
  });
});

describe('The service worker runs only in a build (U-10, P15-14)', () => {
  function fakeBrowser(): { registered: string[]; unregistered: number; loadHandlers: (() => void)[] } {
    const state = { registered: [] as string[], unregistered: 0, loadHandlers: [] as (() => void)[] };
    vi.stubGlobal('window', {
      location: { protocol: 'http:' },
      addEventListener: (type: string, handler: () => void) => type === 'load' && state.loadHandlers.push(handler)
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: (url: string) => (state.registered.push(url), Promise.resolve()),
        getRegistrations: () => Promise.resolve([{ unregister: () => (state.unregistered++, Promise.resolve(true)) }])
      }
    });
    return state;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('the dev server never registers it, and removes one left from an earlier visit', async () => {
    const browser = fakeBrowser();
    registerServiceWorker(false);
    await Promise.resolve();
    await Promise.resolve();
    browser.loadHandlers.forEach((handler) => handler());
    expect(browser.registered).toEqual([]);
    expect(browser.unregistered).toBe(1);
  });

  it('a build registers it once the page has loaded', () => {
    const browser = fakeBrowser();
    registerServiceWorker(true);
    browser.loadHandlers.forEach((handler) => handler());
    expect(browser.registered).toEqual(['/sw.js']);
    expect(browser.unregistered).toBe(0);
  });

  it('the build fills in the cache name and the files to keep offline', () => {
    const sw = fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf-8');
    const config = fs.readFileSync(path.resolve(__dirname, '../vite.config.ts'), 'utf-8');
    // The exact lines the build replaces (it fails the build if it can't find them)
    for (const line of ["const CACHE_NAME = 'apex-slipstream-dev';", 'const BUILD_ASSETS = [];']) {
      expect(sw).toContain(line);
      expect(config).toContain(line);
    }
    expect(sw).toContain('PRECACHE_ASSETS.concat(BUILD_ASSETS)');
    expect(config).toMatch(/plugins: \[precacheServiceWorker\(\)\]/);
  });
});

describe('Link previews and the iOS icon (P15-15)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const meta = (attr: string, name: string): string | undefined =>
    html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]+)"`))?.[1];

  /** Width and height of a PNG, from its header */
  function pngSize(file: string): { width: number; height: number } {
    const data = fs.readFileSync(path.resolve(__dirname, '../public', file));
    expect(data.subarray(1, 4).toString('latin1')).toBe('PNG');
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }

  it('point at a 1200×630 PNG by its full address', () => {
    for (const image of [meta('property', 'og:image'), meta('name', 'twitter:image')]) {
      expect(image).toBe('https://apex-slipstream.pages.dev/og-image.png');
    }
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('property', 'og:image:alt')?.length).toBeGreaterThan(10);
    expect(pngSize('og-image.png')).toEqual({ width: 1200, height: 630 });
    // Small enough for every platform's preview limit (WhatsApp is the tightest, about 600 KB)
    expect(fs.statSync(path.resolve(__dirname, '../public/og-image.png')).size).toBeLessThan(600_000);
  });

  it('gives iOS a 180 px PNG home-screen icon', () => {
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
    expect(pngSize('icons/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });
});
