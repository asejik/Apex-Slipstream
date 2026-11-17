import { ALL_TRACKS, dirtShare } from '../track/TrackDefinitions';
import { TrackSpline } from '../track/TrackSpline';
import { normaliseQuickRace, QuickRaceSetup } from '../app/QuickRace';
import type { WeatherCondition } from '../tires/TireTypes';

/** One line about a track for the list, for example "5.9 km · Circuit · 33% dirt" */
export function quickRaceTrackDetail(index: number, lengthM: number): string {
  const track = ALL_TRACKS[index]!;
  const parts = [`${(lengthM / 1000).toFixed(1)} km`, track.isClosed ? 'Circuit' : 'Sprint'];
  const dirt = Math.round(dirtShare(track) * 100);
  if (dirt > 0) parts.push(`${dirt}% dirt`);
  if (track.rainChance >= 1) parts.push('Always wet');
  return parts.join(' · ');
}

/**
 * Quick Race setup (R8 part 5, docs/DESIGN.md section 5): choose the track, the weather and
 * the laps, then go to the grid. Opens over the hub. Markup: index.html (#quick-race-screen).
 */
export class QuickRaceScreen {
  private readonly root: HTMLElement | null;
  private readonly trackButtons: HTMLButtonElement[] = [];
  private setup: QuickRaceSetup = { trackIndex: 0, weather: 'dry', laps: 3 };
  /** Track lengths, worked out once when the screen first opens */
  private lengths: number[] | null = null;

  constructor(private readonly onStart: (setup: QuickRaceSetup) => void) {
    this.root = document.getElementById('quick-race-screen');
    const list = document.getElementById('quick-race-tracks');
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
        this.choose({ ...this.setup, trackIndex: index, laps: track.laps });
      });
      list?.appendChild(button);
      this.trackButtons.push(button);
    });

    this.root?.querySelectorAll<HTMLButtonElement>('[data-quick="weather"] button[data-value]').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.choose({ ...this.setup, weather: button.dataset.value as WeatherCondition });
      });
    });
    this.root?.querySelectorAll<HTMLButtonElement>('[data-quick="laps"] button[data-value]').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.choose({ ...this.setup, laps: Number(button.dataset.value) });
      });
    });
    document.getElementById('quick-race-start')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
      this.onStart(this.setup);
    });
    document.getElementById('quick-race-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  public get isOpen(): boolean {
    return this.root?.classList.contains('active') ?? false;
  }

  /** Opens with `setup` chosen (the last Quick Race, or the defaults) */
  public open(setup: QuickRaceSetup): void {
    if (!this.lengths) {
      this.lengths = ALL_TRACKS.map((track) => new TrackSpline(track).totalLength);
      this.trackButtons.forEach((button, index) => {
        const detail = button.querySelector('.qr-track-detail');
        if (detail) detail.textContent = quickRaceTrackDetail(index, this.lengths![index]!);
      });
    }
    this.choose(setup);
    this.root?.classList.add('active');
  }

  public close(): void {
    this.root?.classList.remove('active');
  }

  /** The setup as it stands */
  public get current(): QuickRaceSetup {
    return this.setup;
  }

  private choose(setup: QuickRaceSetup): void {
    this.setup = normaliseQuickRace(setup);
    const track = ALL_TRACKS[this.setup.trackIndex]!;
    this.trackButtons.forEach((button, index) => {
      const on = index === this.setup.trackIndex;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    });
    this.mark('weather', this.setup.weather, false);
    this.mark('laps', String(this.setup.laps), !track.isClosed);
    const note = document.getElementById('quick-race-laps-note');
    if (note) note.textContent = track.isClosed ? '' : 'A sprint is one run';
  }

  private mark(group: string, value: string, disabled: boolean): void {
    this.root?.querySelectorAll<HTMLButtonElement>(`[data-quick="${group}"] button[data-value]`).forEach((button) => {
      const on = button.dataset.value === value;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
      button.disabled = disabled && !on;
    });
  }
}
