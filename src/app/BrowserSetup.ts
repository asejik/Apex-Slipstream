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

/** The parts of the Screen Orientation API used to turn the game sideways */
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

/**
 * Whether this browser may be able to hold the screen sideways. A web page can't do it on its
 * own: Android browsers allow it only in fullscreen, and iPhones don't allow it at all.
 */
function canLockLandscape(): boolean {
  const orientation = (typeof screen !== 'undefined' ? screen.orientation : undefined) as LockableOrientation | undefined;
  return typeof orientation?.lock === 'function' && typeof document.documentElement.requestFullscreen === 'function';
}

/**
 * The rotate card's "Play in landscape" button: fullscreen, then lock the screen sideways.
 * Shown only where the browser has both; if the lock is refused, fullscreen is left and the
 * card asks you to turn the phone.
 */
export function wireLandscapeLock(): void {
  const button = document.getElementById('rotate-lock') as HTMLButtonElement | null;
  const note = document.getElementById('rotate-lock-note');
  if (!button || !canLockLandscape()) return;
  button.hidden = false;
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    void (async () => {
      try {
        await document.documentElement.requestFullscreen();
        await (screen.orientation as LockableOrientation).lock?.('landscape');
      } catch {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        button.hidden = true;
        if (note) note.textContent = "This browser can't turn the game for you. Please rotate your phone.";
      }
    })();
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

/**
 * Registers the PWA service worker when a built game is served over http(s). The dev server
 * never registers it, and removes one left from an earlier visit, so a reload always runs
 * the code being worked on (U-10).
 */
export function registerServiceWorker(isProduction = import.meta.env.PROD): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    if (!isProduction) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      return;
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('ServiceWorker registration omitted:', err);
      });
    });
  }
}

/**
 * Runs `unlock` on every pointer or key press: Web Audio may only start from a user gesture,
 * and a phone may suspend it again later (a call, locking the screen), so every gesture is
 * a chance to bring the sound back (R9 part 6). `unlock` returns at once when already running.
 */
export function onUserGestures(unlock: () => void): void {
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}
