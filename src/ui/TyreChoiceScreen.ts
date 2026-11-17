import { TIRE_PROFILES, TireCompound } from '../tires/TireTypes';
import { Forecast, tyreRatings, TyreRatings } from '../tires/TyreAdvice';

/** What the tyre choice screen shows. */
interface TyreChoiceModel {
  /** For example "Round 3 of 8 · Neon City Circuit" */
  title: string;
  /** For example "You start P6" */
  gridLabel: string;
  forecast: Forecast;
  /** Share of the lap that is dirt road, 0 to 1 (R7) */
  dirtShare: number;
  /** The compound for this track and forecast: the fastest flat-out lap (R7, aiTyreFor) */
  recommended: TireCompound;
  selected: TireCompound;
  /** After a qualifying run, for example "Pole position · 1:02.45"; null after Skip */
  qualifying: string | null;
}

const RATING_KEYS: ReadonlyArray<keyof TyreRatings> = ['road', 'offRoad', 'wet', 'speed'];

/**
 * Tyre choice before the race (R5, docs/DESIGN.md section 5): three compounds with how they
 * grip on road, gravel and wet, and the forecast. The markup is in index.html (#tyre-screen).
 */
export class TyreChoiceScreen {
  private readonly root: HTMLElement | null;
  private readonly cards = new Map<TireCompound, HTMLElement>();

  constructor(onSelect: (compound: TireCompound) => void, onConfirm: () => void, onBack: () => void) {
    this.root = document.getElementById('tyre-screen');

    this.root?.querySelectorAll<HTMLElement>('.tyre-card').forEach((card) => {
      const compound = card.dataset.compound as TireCompound | undefined;
      if (!compound || !(compound in TIRE_PROFILES)) return;
      this.cards.set(compound, card);

      // Fill the bars once from the tyre data
      const ratings = tyreRatings(compound);
      for (const key of RATING_KEYS) {
        const row = card.querySelector<HTMLElement>(`[data-rating="${key}"]`);
        if (!row) continue;
        const value = ratings[key];
        const fill = row.querySelector<HTMLElement>('.rating-fill');
        const label = row.querySelector<HTMLElement>('.rating-value');
        if (fill) fill.style.width = `${value}%`;
        if (label) label.textContent = `${value}%`;
      }

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(compound);
      });
    });

    document.getElementById('tyre-confirm')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onConfirm();
    });
    document.getElementById('tyre-back')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onBack();
    });
  }

  public show(model: TyreChoiceModel): void {
    setText('tyre-title', model.title);
    setText('tyre-grid', model.gridLabel);
    setText('tyre-forecast', model.forecast.label);
    // The road surface, so the tyre choice is informed (R7): "Tarmac" or "35% dirt"
    const dirtPercent = Math.round(model.dirtShare * 100);
    setText('tyre-surface', dirtPercent > 0 ? `${dirtPercent}% dirt` : 'Tarmac');
    // Coming straight off a qualifying lap, say so: this screen then opens mid-lap
    const qualifying = document.getElementById('tyre-qualifying');
    if (qualifying) {
      qualifying.hidden = model.qualifying === null;
      qualifying.textContent = model.qualifying ? `Qualifying done · ${model.qualifying}` : '';
    }

    this.cards.forEach((card, compound) => {
      card.classList.toggle('recommended', compound === model.recommended);
    });
    this.setSelected(model.selected);
    this.root?.classList.add('active');
  }

  public hide(): void {
    this.root?.classList.remove('active');
  }

  public setSelected(compound: TireCompound): void {
    this.cards.forEach((card, c) => {
      const on = c === compound;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-pressed', String(on));
    });
  }
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
