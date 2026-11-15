/** What the pause menu needs to show each time it opens. */
interface PauseMenuModel {
  /** For example "Lap 2/3", "Qualifying" or "Practice" */
  sessionLabel: string;
  quitCost: 'free' | 'token' | 'blocked';
}

/**
 * The pause menu (docs/DESIGN.md section 5). It holds the controls that used to sit in the
 * top-right button stack (U-12): those buttons keep their ids and are wired by HUDController.
 * This class adds Resume and Quit to hub. The markup is in index.html (#pause-menu).
 */
export class PauseMenu {
  private readonly root: HTMLElement | null;
  private readonly quitButton: HTMLButtonElement | null;

  constructor(onResume: () => void, onQuit: () => void, onPauseButton: () => void, onSettings: () => void) {
    this.root = document.getElementById('pause-menu');
    this.quitButton = document.getElementById('pause-quit') as HTMLButtonElement | null;

    document.getElementById('pause-resume')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onResume();
    });
    this.quitButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.quitButton?.disabled) onQuit();
    });
    document.getElementById('pause-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onSettings();
    });
    document.getElementById('btn-pause')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onPauseButton();
    });
  }

  public show(model: PauseMenuModel): void {
    const session = document.getElementById('pause-session');
    if (session) session.textContent = model.sessionLabel;

    if (this.quitButton) {
      this.quitButton.disabled = model.quitCost === 'blocked';
      const note = this.quitButton.querySelector('small');
      if (note) {
        note.textContent =
          model.quitCost === 'token' ? 'Uses 1 restart' : model.quitCost === 'blocked' ? 'No restarts left' : '';
      }
    }
    this.root?.classList.add('active');
  }

  public hide(): void {
    this.root?.classList.remove('active');
  }
}
