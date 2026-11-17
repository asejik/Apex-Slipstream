import {
  ACTION_NAMES,
  ARROW_KEYS,
  assignKey,
  DEFAULT_KEYS,
  DRIVE_ACTIONS,
  DriveAction,
  KeyBindings,
  keyLabel
} from '../app/KeyBindings';

const HINT = 'Tap a key to change it. The arrow keys always work too.';

/**
 * The driving keys in Settings (R9 part 6b): each action with its key as a button. Tap
 * one, press the new key (Escape cancels), and it is saved at once. Markup: index.html
 * (#settings-keys, #settings-keys-note).
 */
export class KeyBindingsPanel {
  private readonly list: HTMLElement | null;
  private readonly note: HTMLElement | null;
  private bindings: KeyBindings = { ...DEFAULT_KEYS };
  private listening: DriveAction | null = null;
  private readonly buttons = new Map<DriveAction, HTMLButtonElement>();

  constructor(private readonly onChange: (bindings: KeyBindings) => void) {
    this.list = document.getElementById('settings-keys');
    this.note = document.getElementById('settings-keys-note');
    for (const action of DRIVE_ACTIONS) {
      const label = document.createElement('span');
      label.textContent = ACTION_NAMES[action];
      const button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.listen(action);
      });
      this.buttons.set(action, button);
      this.list?.append(label, button);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'key-reset';
    reset.textContent = 'Reset keys';
    reset.addEventListener('click', (e) => {
      e.stopPropagation();
      this.listening = null;
      this.onChange({ ...DEFAULT_KEYS });
      this.setNote(HINT);
    });
    this.list?.append(reset);

    // Runs before the game's own key handling, so the key pressed is not also a control
    window.addEventListener('keydown', (e) => this.onKey(e), { capture: true });
  }

  public show(bindings: KeyBindings): void {
    this.bindings = { ...bindings };
    for (const action of DRIVE_ACTIONS) {
      const button = this.buttons.get(action);
      if (!button) continue;
      const arrow = ARROW_KEYS[action];
      const listening = this.listening === action;
      button.classList.toggle('listening', listening);
      button.textContent = listening ? 'Press a key' : keyLabel(bindings[action]);
      button.setAttribute(
        'aria-label',
        `${ACTION_NAMES[action]}: ${keyLabel(bindings[action])}${arrow ? ` or ${keyLabel(arrow)}` : ''}. Tap to change`
      );
    }
  }

  private listen(action: DriveAction): void {
    this.listening = action;
    this.setNote(`Press the new key for ${ACTION_NAMES[action]}. Escape cancels.`);
    this.show(this.bindings);
  }

  private onKey(event: KeyboardEvent): void {
    const action = this.listening;
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.listening = null;
    if (event.code === 'Escape') {
      this.setNote(HINT);
      this.show(this.bindings);
      return;
    }
    const result = assignKey(this.bindings, action, event.code);
    if ('error' in result) {
      this.setNote(`${result.error}. Pick another key.`);
      this.show(this.bindings);
      return;
    }
    this.setNote(HINT);
    this.onChange(result.bindings);
  }

  private setNote(text: string): void {
    if (this.note) this.note.textContent = text;
  }
}
