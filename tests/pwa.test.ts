import { describe, it, expect } from 'vitest';
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
