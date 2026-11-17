/**
 * Phone interruptions (R9 part 6, PROJECT_PLAN failure table "Mobile Tab Switch / Screen
 * Lock"): a call, a notification, switching apps, locking the screen, the window losing
 * focus, or turning a phone upright (the rotate prompt covers the game) all interrupt.
 */

/** Same rule as the rotate prompt in index.html: a phone or tablet held upright */
export const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 1024px)';

/** What an interruption does to the screen you are on: only a running race pauses */
export function screenAfterInterruption<S extends string>(current: S): S | 'paused' {
  return current === 'racing' ? 'paused' : current;
}

/** Calls `onInterrupt` whenever play is interrupted, and `onReturn` when the page is back */
export function watchInterruptions(onInterrupt: () => void, onReturn: () => void): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onInterrupt();
    else onReturn();
  });
  window.addEventListener('blur', onInterrupt);
  window.addEventListener('pagehide', onInterrupt);
  const portrait = window.matchMedia?.(PORTRAIT_QUERY);
  portrait?.addEventListener?.('change', (event) => {
    if (event.matches) onInterrupt();
  });
}
