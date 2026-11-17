import type { GameSettings } from '../app/Settings';

type SettingKey = keyof GameSettings;

/** Turns a button's data-value back into the setting's type ("true"/"false" are on/off). */
function parseValue(raw: string): GameSettings[SettingKey] {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw as GameSettings[SettingKey];
}

/**
 * The settings screen (docs/DESIGN.md section 5): segmented controls, each change applied
 * and saved at once. Opens over the hub or the pause menu. Markup: index.html (#settings-screen).
 */
export class SettingsScreen {
  private readonly root: HTMLElement | null;
  private readonly groups: HTMLElement[];

  constructor(
    onChange: <K extends SettingKey>(key: K, value: GameSettings[K]) => void,
    private readonly onClose: () => void
  ) {
    this.root = document.getElementById('settings-screen');
    this.groups = this.root ? Array.from(this.root.querySelectorAll<HTMLElement>('[data-setting]')) : [];

    for (const group of this.groups) {
      const key = group.dataset.setting as SettingKey;
      group.querySelectorAll<HTMLButtonElement>('button[data-value]').forEach((button) => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const value = parseValue(button.dataset.value ?? '');
          onChange(key, value as GameSettings[typeof key]);
        });
      });
    }

    document.getElementById('settings-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  public get isOpen(): boolean {
    return this.root?.classList.contains('active') ?? false;
  }

  /**
   * Opens with `settings` chosen. `level` is your career level: an option with a
   * data-unlock-level above it is locked (R9)
   */
  public open(settings: GameSettings, level = 1): void {
    this.root?.querySelectorAll<HTMLButtonElement>('button[data-unlock-level]').forEach((button) => {
      const needed = Number(button.dataset.unlockLevel);
      const locked = level < needed;
      button.disabled = locked;
      button.title = locked ? `Unlocks at level ${needed}` : '';
    });
    this.show(settings);
    this.root?.classList.add('active');
  }

  public close(): void {
    if (!this.isOpen) return;
    this.root?.classList.remove('active');
    this.onClose();
  }

  /** Marks the chosen option in every row. */
  public show(settings: GameSettings): void {
    for (const group of this.groups) {
      const key = group.dataset.setting as SettingKey;
      const current = String(settings[key]);
      group.querySelectorAll<HTMLButtonElement>('button[data-value]').forEach((button) => {
        const on = button.dataset.value === current;
        button.classList.toggle('on', on);
        button.setAttribute('aria-pressed', String(on));
      });
    }
  }
}
