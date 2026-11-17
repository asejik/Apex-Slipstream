import { ALL_TRACKS } from '../track/TrackDefinitions';
import { formatLapTime, TimeTrialSetup } from '../app/TimeTrial';
import type { TireCompound } from '../tires/TireTypes';

/** The best lap shown for a track in the list */
export function bestLapLabel(bestMs: number | null): string {
  return bestMs === null ? 'No time yet' : `Best ${formatLapTime(bestMs)}`;
}

/**
 * Time Trial setup (R8 part 6, docs/DESIGN.md section 5): choose the track (each shows your
 * best lap) and the tyres, reset a track's best if you want a clean slate, then start.
 * Opens over the hub. Markup: index.html (#time-trial-screen).
 */
export class TimeTrialScreen {
  private readonly root: HTMLElement | null;
  private readonly trackButtons: HTMLButtonElement[] = [];
  private readonly resetButton: HTMLButtonElement | null;
  private setup: TimeTrialSetup = { trackIndex: 0, tyre: 'street' };
  private bests: (number | null)[] = ALL_TRACKS.map(() => null);
  /** The reset button asks once before it deletes anything */
  private resetArmed = false;

  constructor(
    private readonly onStart: (setup: TimeTrialSetup) => void,
    private readonly onReset: (trackIndex: number) => void,
    /** The recommended tyre for a track in the dry */
    private readonly recommendedFor: (trackIndex: number) => TireCompound
  ) {
    this.root = document.getElementById('time-trial-screen');
    const list = document.getElementById('time-trial-tracks');
    ALL_TRACKS.forEach((track, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'qr-track';
      const name = document.createElement('span');
      name.className = 'qr-track-name';
      name.textContent = track.name;
      const detail = document.createElement('small');
      detail.className = 'qr-track-detail';
      button.append(name, detail);
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.choose({ trackIndex: index, tyre: this.recommendedFor(index) });
      });
      list?.appendChild(button);
      this.trackButtons.push(button);
    });

    this.root?.querySelectorAll<HTMLButtonElement>('[data-trial="tyre"] button[data-value]').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.choose({ ...this.setup, tyre: button.dataset.value as TireCompound });
      });
    });
    this.resetButton = document.getElementById('time-trial-reset') as HTMLButtonElement | null;
    this.resetButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.resetArmed) {
        this.resetArmed = true;
        this.render();
        return;
      }
      this.resetArmed = false;
      this.bests[this.setup.trackIndex] = null;
      this.onReset(this.setup.trackIndex);
      this.render();
    });
    document.getElementById('time-trial-start')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
      this.onStart(this.setup);
    });
    document.getElementById('time-trial-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  public get isOpen(): boolean {
    return this.root?.classList.contains('active') ?? false;
  }

  /** Opens with `setup` chosen; `bests` are your best laps per track in ms (null: none yet) */
  public open(setup: TimeTrialSetup, bests: (number | null)[]): void {
    this.bests = bests;
    this.resetArmed = false;
    this.choose(setup);
    this.root?.classList.add('active');
  }

  /** Best laps arrive from storage after the screen opens */
  public setBests(bests: (number | null)[]): void {
    this.bests = bests;
    this.render();
  }

  public close(): void {
    this.root?.classList.remove('active');
  }

  private choose(setup: TimeTrialSetup): void {
    this.setup = { trackIndex: ALL_TRACKS[setup.trackIndex] ? setup.trackIndex : 0, tyre: setup.tyre };
    this.resetArmed = false;
    this.render();
  }

  private render(): void {
    this.trackButtons.forEach((button, index) => {
      const on = index === this.setup.trackIndex;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
      const detail = button.querySelector('.qr-track-detail');
      if (detail) detail.textContent = bestLapLabel(this.bests[index] ?? null);
    });
    const recommended = this.recommendedFor(this.setup.trackIndex);
    this.root?.querySelectorAll<HTMLButtonElement>('[data-trial="tyre"] button[data-value]').forEach((button) => {
      const on = button.dataset.value === this.setup.tyre;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    });
    const note = document.getElementById('time-trial-tyre-note');
    if (note) note.textContent = `Recommended: ${TYRE_NAMES[recommended]}`;
    if (this.resetButton) {
      const hasBest = this.bests[this.setup.trackIndex] !== null;
      this.resetButton.disabled = !hasBest;
      this.resetButton.textContent = this.resetArmed ? 'Tap again to delete your best' : 'Reset best lap';
    }
  }
}

const TYRE_NAMES: Record<TireCompound, string> = {
  street: 'Street',
  all_terrain: 'All-Terrain',
  wet: 'Wet'
};
