/**
 * The loading screen: only the logo, on the base colour, while the game starts. It is plain
 * HTML in index.html (#splash), so it shows before any script runs. It stays for at least
 * `SPLASH_MIN_SHOW_MS` from the moment the page began loading, then fades out, unless motion is
 * reduced, and is removed from the page.
 */
export const SPLASH_MIN_SHOW_MS = 2500;
/** The fade, as `--transition-panel` in index.html */
const FADE_MS = 200;

/** How much longer the logo stays, given how long the page has been loading */
export function splashRemainingMs(sinceLoadMs: number, minShowMs = SPLASH_MIN_SHOW_MS): number {
  return Math.max(0, minShowMs - sinceLoadMs);
}

/** Fades the loading screen out once the game is ready and the logo has had its time */
export function hideSplash(reduceMotion: boolean): void {
  const splash = document.getElementById('splash');
  if (!splash) return;
  window.setTimeout(() => {
    if (reduceMotion) {
      splash.remove();
      return;
    }
    splash.classList.add('splash-out');
    window.setTimeout(() => splash.remove(), FADE_MS + 50);
  }, splashRemainingMs(performance.now()));
}
