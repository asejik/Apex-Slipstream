/**
 * Settings → Your season (Decision 16): starts the championship you are racing again from
 * round 1. Standings and results go; your career, XP, trophies and best laps stay. It asks
 * for a second tap first, like loading a save.
 */
export class SeasonResetButton {
  private readonly button: HTMLButtonElement | null;
  private readonly note: HTMLElement | null;
  private armed = false;

  constructor(
    /** The championship being raced, for the warning */
    private readonly championshipName: () => string,
    private readonly onReset: () => void
  ) {
    this.button = document.getElementById('season-reset') as HTMLButtonElement | null;
    this.note = document.getElementById('season-reset-note');
    this.button?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.armed) {
        this.armed = true;
        if (this.button) this.button.textContent = 'Tap again to restart';
        this.say(`${this.championshipName()} goes back to round 1. Standings and results are cleared.`);
        return;
      }
      this.reset();
      this.onReset();
    });
  }

  /** Back to the resting state (Settings closed, or the reset done) */
  public reset(): void {
    this.armed = false;
    if (this.button) this.button.textContent = 'Restart championship';
    this.say('Your career, XP, trophies and best laps are kept.');
  }

  private say(text: string): void {
    if (this.note) this.note.textContent = text;
  }
}
