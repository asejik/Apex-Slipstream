/** How long a graphics reset may take before the card offers a reload */
export const RELOAD_OFFER_MS = 5000;

/** What the game does when the graphics go and when they come back */
export interface GraphicsResetHooks {
  /** The graphics are gone: pause a running race and silence it */
  onLost(): void;
  /** The browser has given the graphics back: rebuild what was drawn into textures */
  onRestored(): void;
}

/**
 * A phone can take the graphics away from a page (low memory, another app, a driver reset),
 * which leaves a frozen or black canvas (P09-R05, Decision 16). Three.js already rebuilds its
 * own state when the browser gives them back; this shows a card meanwhile, pauses the race,
 * offers a reload if they don't come back, and lets the game rebuild the rest.
 */
export function watchGraphicsReset(canvas: HTMLCanvasElement, hooks: GraphicsResetHooks): void {
  const card = document.getElementById('graphics-reset');
  const reload = document.getElementById('graphics-reset-reload');
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  reload?.addEventListener('click', () => window.location.reload());

  canvas.addEventListener('webglcontextlost', (event) => {
    // Without this the browser never gives the graphics back
    event.preventDefault();
    if (card) card.hidden = false;
    if (reload) reload.hidden = true;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (reload) reload.hidden = false;
    }, RELOAD_OFFER_MS);
    hooks.onLost();
  });

  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(reloadTimer);
    if (card) card.hidden = true;
    hooks.onRestored();
  });
}
