import { AI_DRIVER_ROSTER } from '../ai/AIDriverProfiles';
import { TimingTower } from '../engine/TimingTower';
import { teamColourFor } from './HubScreen';

/** "+1.204" ahead of you, "−0.552" behind you, "—" for your own row. */
export function formatGap(gapSeconds: number, isPlayer: boolean): string {
  if (isPlayer) return '—';
  const sign = gapSeconds >= 0 ? '+' : '−';
  return `${sign}${Math.abs(gapSeconds).toFixed(3)}`;
}

/**
 * Draws the timing tower rows into #timing-tower-rows (docs/DESIGN.md section 4).
 * The row elements are built once; each refresh only rewrites what changed.
 */
export class TimingTowerView {
  private readonly rowEls: HTMLElement[] = [];
  private readonly posEls: HTMLElement[] = [];
  private readonly stripEls: HTMLElement[] = [];
  private readonly nameEls: HTMLElement[] = [];
  private readonly gapEls: HTMLElement[] = [];
  /** Surname in capitals and strip colour for every driver id, worked out once */
  private readonly names = new Map<string, string>([['player', 'YOU']]);
  private readonly strips = new Map<string, string>([['player', 'var(--color-text-inverse)']]);

  constructor() {
    const body = document.getElementById('timing-tower-rows');

    for (const driver of AI_DRIVER_ROSTER) {
      const parts = driver.name.trim().split(/\s+/);
      this.names.set(driver.id, (parts[parts.length - 1] ?? driver.name).toUpperCase());
      this.strips.set(driver.id, `var(--color-team-${teamColourFor(driver.id)})`);
    }

    for (let i = 0; i < TimingTower.ROWS; i++) {
      const row = document.createElement('div');
      row.className = 'tower-row';
      const pos = document.createElement('span');
      pos.className = 'tower-pos';
      const strip = document.createElement('span');
      strip.className = 'tower-strip';
      const name = document.createElement('span');
      name.className = 'tower-name';
      const gap = document.createElement('span');
      gap.className = 'tower-value';
      row.append(pos, strip, name, gap);
      body?.append(row);
      this.rowEls.push(row);
      this.posEls.push(pos);
      this.stripEls.push(strip);
      this.nameEls.push(name);
      this.gapEls.push(gap);
    }
  }

  /** No rows: solo qualifying shows only the header ("Qualifying") and the note under it */
  public clearRows(): void {
    for (const row of this.rowEls) row.hidden = true;
  }

  public update(tower: TimingTower): void {
    for (let i = 0; i < TimingTower.ROWS; i++) {
      const rowEl = this.rowEls[i]!;
      if (i >= tower.rowCount) {
        rowEl.hidden = true;
        continue;
      }
      const row = tower.rows[i]!;
      rowEl.hidden = false;
      rowEl.classList.toggle('me', row.isPlayer);
      setText(this.posEls[i]!, String(row.position));
      setText(this.nameEls[i]!, this.names.get(row.driverId) ?? row.driverId);
      setText(this.gapEls[i]!, formatGap(row.gapSeconds, row.isPlayer));
      const strip = this.strips.get(row.driverId) ?? '';
      if (this.stripEls[i]!.style.background !== strip) this.stripEls[i]!.style.background = strip;
    }
  }
}

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
