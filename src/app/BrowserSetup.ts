/** Shows uncaught errors and promise rejections in the on-page error banner. */
export function installErrorBanner(): void {
  window.addEventListener('error', (event) => {
    const banner = document.getElementById('error-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.textContent = `Runtime Error: ${event.message}`;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const banner = document.getElementById('error-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.textContent = `Promise Rejection: ${event.reason}`;
    }
  });
}

/** Wires the fullscreen button to the Fullscreen API. */
export function wireFullscreenButton(): void {
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  if (!fullscreenBtn) return;
  fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
}

/** Registers the PWA service worker when served over http(s). */
export function registerServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('ServiceWorker registration omitted:', err);
      });
    });
  }
}

/** Runs `unlock` on the first pointer or key press: Web Audio may only start from a user gesture. */
export function onFirstUserGesture(unlock: () => void): void {
  const handler = (): void => {
    unlock();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}
