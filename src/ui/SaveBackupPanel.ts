import { buildSaveFile, readSaveFile, saveFileName, SAVE_KEYS } from '../app/SaveFile';
import type { GhostStorage } from '../storage/GhostStorage';

/**
 * Settings → Your save (P07-R02): download the save as a file, or load one. Loading
 * replaces your progress, so it asks for a second tap, then restarts the game with it.
 */
export class SaveBackupPanel {
  private readonly note: HTMLElement | null;
  private readonly loadButton: HTMLButtonElement | null;
  private readonly fileInput: HTMLInputElement | null;
  private loadArmed = false;
  private readonly defaultNote: string;

  constructor(
    private readonly ghosts: GhostStorage,
    private readonly restart: () => void = () => window.location.reload()
  ) {
    this.note = document.getElementById('save-note');
    this.loadButton = document.getElementById('save-load') as HTMLButtonElement | null;
    this.fileInput = document.getElementById('save-file') as HTMLInputElement | null;
    this.defaultNote = this.note?.textContent ?? '';

    document.getElementById('save-download')?.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.download();
    });
    this.loadButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.loadArmed) {
        this.loadArmed = true;
        if (this.loadButton) this.loadButton.textContent = 'Tap again to choose a file';
        this.say('Loading a save replaces all your progress here.');
        return;
      }
      this.disarm();
      this.fileInput?.click();
    });
    this.fileInput?.addEventListener('change', () => {
      const file = this.fileInput?.files?.[0];
      if (this.fileInput) this.fileInput.value = '';
      if (file) void this.load(file);
    });
  }

  /** Back to the resting state when Settings closes */
  public reset(): void {
    this.disarm();
    this.say(this.defaultNote);
  }

  private disarm(): void {
    this.loadArmed = false;
    if (this.loadButton) this.loadButton.textContent = 'Load save';
  }

  private say(text: string): void {
    if (this.note) this.note.textContent = text;
  }

  private async download(): Promise<void> {
    const save = buildSaveFile(window.localStorage, await this.ghosts.getAllGhosts());
    const url = URL.createObjectURL(new Blob([JSON.stringify(save)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = saveFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.say(`Saved ${link.download}. Keep it somewhere safe.`);
  }

  private async load(file: File): Promise<void> {
    const contents = readSaveFile(await file.text());
    if ('error' in contents) {
      this.say(contents.error);
      return;
    }
    // The file is valid: replace everything the game stores, then start again with it
    for (const key of SAVE_KEYS) window.localStorage.removeItem(key);
    for (const [key, value] of Object.entries(contents.local)) window.localStorage.setItem(key, value);
    if (!(await this.ghosts.replaceAllGhosts(contents.ghosts))) {
      this.say('Your progress loaded, but the ghost laps could not be saved.');
    } else {
      this.say('Save loaded. Restarting…');
    }
    this.restart();
  }
}
