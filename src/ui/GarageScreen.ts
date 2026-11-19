import {
  activeLivery,
  cleanName,
  cleanNumber,
  DriverProfile,
  licenceFor,
  LIVERIES,
  shortName
} from '../app/DriverProfile';

/** Paint as a CSS colour, for the swatches and the number badge (car paint, not UI colours) */
function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/**
 * The Garage (R9 part 4, docs/DESIGN.md section 5): your driver card (name, number,
 * licence) and the liveries your level has unlocked. Every change is saved at once.
 * Opens over the hub. Markup: index.html (#garage-screen).
 */
export class GarageScreen {
  private readonly root: HTMLElement | null;
  private readonly nameInput: HTMLInputElement | null;
  private readonly numberInput: HTMLInputElement | null;
  private profile: DriverProfile = { name: '', number: 7, liveryId: 'broadcast' };
  private level = 1;

  constructor(private readonly onChange: (profile: DriverProfile) => void) {
    this.root = document.getElementById('garage-screen');
    this.nameInput = document.getElementById('garage-name') as HTMLInputElement | null;
    this.numberInput = document.getElementById('garage-number') as HTMLInputElement | null;

    this.nameInput?.addEventListener('input', () => {
      this.update({ ...this.profile, name: cleanName(this.nameInput?.value) }, false);
    });
    // Show the cleaned name once you leave the box. Only the box: redrawing the whole screen
    // here replaced the livery buttons mid-tap, so tapping a livery straight after typing a
    // name did nothing (found by the e2e game-rules journey)
    this.nameInput?.addEventListener('change', () => {
      if (this.nameInput) this.nameInput.value = this.profile.name;
    });
    this.numberInput?.addEventListener('change', () => {
      this.update({ ...this.profile, number: cleanNumber(this.numberInput?.value ?? '') }, true);
    });
    this.root?.addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('garage-close')?.addEventListener('click', () => this.close());
  }

  public get isOpen(): boolean {
    return this.root?.classList.contains('active') ?? false;
  }

  public open(profile: DriverProfile, level: number): void {
    this.profile = { ...profile };
    this.level = level;
    if (this.nameInput) this.nameInput.value = profile.name;
    this.render();
    this.root?.classList.add('active');
  }

  public close(): void {
    this.nameInput?.blur();
    this.root?.classList.remove('active');
  }

  private update(profile: DriverProfile, redraw: boolean): void {
    this.profile = profile;
    this.onChange({ ...profile });
    if (redraw) this.render();
    else this.renderCard();
  }

  private renderCard(): void {
    const livery = activeLivery(this.profile, this.level);
    const badge = document.getElementById('garage-number-badge');
    if (badge) {
      badge.textContent = String(this.profile.number);
      badge.style.background = css(livery.body);
      badge.style.color = css(livery.accent);
    }
    const name = document.getElementById('garage-card-name');
    if (name) name.textContent = shortName(this.profile);
    const licence = document.getElementById('garage-licence');
    if (licence) licence.textContent = `${licenceFor(this.level)} licence · Level ${this.level}`;
  }

  private render(): void {
    if (this.nameInput && document.activeElement !== this.nameInput) this.nameInput.value = this.profile.name;
    if (this.numberInput) this.numberInput.value = String(this.profile.number);
    this.renderCard();

    const chosen = activeLivery(this.profile, this.level).id;
    document.getElementById('garage-liveries')?.replaceChildren(
      ...LIVERIES.map((livery) => {
        const locked = this.level < livery.unlockLevel;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'garage-livery';
        button.disabled = locked;
        button.classList.toggle('on', livery.id === chosen);
        button.setAttribute('aria-pressed', String(livery.id === chosen));
        const swatch = document.createElement('i');
        swatch.style.background = `linear-gradient(135deg, ${css(livery.body)} 62%, ${css(livery.accent)} 62%)`;
        const name = document.createElement('span');
        name.textContent = livery.name;
        const note = document.createElement('small');
        note.textContent = locked ? `Level ${livery.unlockLevel}` : livery.id === chosen ? 'On your car' : '';
        button.append(swatch, name, note);
        button.addEventListener('click', () => this.update({ ...this.profile, liveryId: livery.id }, true));
        return button;
      })
    );
  }
}
