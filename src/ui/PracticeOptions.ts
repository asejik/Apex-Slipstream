import type { TireCompound, WeatherCondition } from '../tires/TireTypes';

const TYRE_NAMES: Record<TireCompound, string> = {
  street: 'Street',
  all_terrain: 'All-Terrain',
  wet: 'Wet'
};

const TYRE_ORDER: readonly TireCompound[] = ['street', 'all_terrain', 'wet'];

/** The compound after `tyre` in the order Street, All-Terrain, Wet, then back to Street */
export function nextTyre(tyre: TireCompound): TireCompound {
  return TYRE_ORDER[(TYRE_ORDER.indexOf(tyre) + 1) % TYRE_ORDER.length]!;
}

/**
 * Weather and tyre rows in the pause menu, shown only in practice (owner, R7 playtest):
 * try any track in the dry or the rain, on any tyres. Championship rounds keep their
 * forecast and the tyres chosen on the grid. The markup is in index.html (#pause-menu).
 */
export class PracticeOptions {
  private readonly weatherButton: HTMLElement | null;
  private readonly tyreButton: HTMLElement | null;

  constructor(onWeather: () => void, onTyres: () => void) {
    this.weatherButton = document.getElementById('btn-practice-weather');
    this.tyreButton = document.getElementById('btn-practice-tyres');
    this.weatherButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      onWeather();
    });
    this.tyreButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      onTyres();
    });
  }

  /** Shows the rows in practice with the current choices, and hides them otherwise */
  public show(isPractice: boolean, weather: WeatherCondition, tyre: TireCompound): void {
    for (const button of [this.weatherButton, this.tyreButton]) {
      if (button) button.hidden = !isPractice;
    }
    const weatherLabel = this.weatherButton?.querySelector('span');
    if (weatherLabel) weatherLabel.textContent = `Weather: ${weather === 'wet' ? 'Rain' : 'Dry'}`;
    const tyreLabel = this.tyreButton?.querySelector('span');
    if (tyreLabel) tyreLabel.textContent = `Tyres: ${TYRE_NAMES[tyre]}`;
  }
}
