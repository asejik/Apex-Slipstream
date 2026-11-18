import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fills public/sw.js in with this build (P15-14): the hashed JS, CSS and font files to cache
 * on install, and a cache name made from their names, so each build gets a fresh cache and
 * the old one is dropped. `.woff` files are left out: every browser that runs the game
 * loads the `.woff2` versions.
 */
function precacheServiceWorker(): Plugin {
  let files: string[] = [];
  let outDir = 'dist';
  return {
    name: 'apex-precache-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_options, bundle) {
      files = Object.keys(bundle)
        .filter((file) => /\.(js|css|woff2)$/.test(file))
        .sort()
        .map((file) => `/${file}`);
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      const source = readFileSync(swPath, 'utf-8');
      const version = createHash('sha256').update(files.join('\n')).update(source).digest('hex').slice(0, 12);
      const filled = source
        .replace("const CACHE_NAME = 'apex-slipstream-dev';", `const CACHE_NAME = 'apex-slipstream-${version}';`)
        .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(files)};`);
      if (filled === source || !filled.includes(version) || files.length === 0) {
        throw new Error('precacheServiceWorker: could not fill in sw.js');
      }
      writeFileSync(swPath, filled);
    }
  };
}

export default defineConfig({
  plugins: [precacheServiceWorker()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000
  }
});
