import { ChampionshipEngine, DriverFinish, DriverStanding } from '../engine/ChampionshipEngine';
import { teamColourFor } from './HubScreen';

/** "12 for P4 · +1 fastest lap · +2 clean driving" */
export function pointsBreakdown(finish: DriverFinish): string {
  const parts = [`${finish.basePoints} for P${finish.finishPosition}`];
  if (finish.hasFastestLap) parts.push('+1 fastest lap');
  if (finish.isCleanDriver) parts.push('+2 clean driving');
  return parts.join(' · ');
}

/** "After round 3 of 8", or "Season start" before any round */
export function standingsProgressLabel(completedRounds: number, totalRaces: number): string {
  return completedRounds <= 0 ? 'Season start' : `After round ${Math.min(completedRounds, totalRaces)} of ${totalRaces}`;
}

/** "YOU" for the player, otherwise the full name */
function displayName(isPlayer: boolean, name: string): string {
  return isPlayer ? 'You' : name;
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function stripCell(driverId: string, isPlayer: boolean): HTMLTableCellElement {
  const td = cell('', 'col-strip');
  td.style.background = isPlayer ? 'var(--color-text-inverse)' : `var(--color-team-${teamColourFor(driverId)})`;
  return td;
}

/** Lap time as 0:41.27 */
function formatLap(ms: number): string {
  const total = ms / 1000;
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60).toString().padStart(2, '0');
  const hundredths = Math.floor((total * 100) % 100).toString().padStart(2, '0');
  return `${mins}:${secs}.${hundredths}`;
}

/**
 * Fills the race result table with all 20 cars: position, team strip, driver, team, best lap
 * (purple for the fastest lap of the race) and points. Returns the player's row, if any.
 */
export function renderResultRows(tbody: HTMLElement, finishes: DriverFinish[]): HTMLElement | null {
  let playerRow: HTMLElement | null = null;
  tbody.replaceChildren(
    ...finishes.map((f) => {
      const row = document.createElement('tr');
      if (f.isPlayer) {
        row.className = 'player-row';
        playerRow = row;
      }
      row.append(
        cell(String(f.finishPosition), 'col-pos'),
        stripCell(f.driverId, f.isPlayer),
        cell(displayName(f.isPlayer, f.driverName)),
        cell(f.team, 'col-team'),
        cell(f.fastestLapMs > 0 ? formatLap(f.fastestLapMs) : '—', f.hasFastestLap ? 'col-num fastest' : 'col-num'),
        cell(f.totalPoints > 0 ? `+${f.totalPoints}` : '0', 'col-num')
      );
      return row;
    })
  );
  return playerRow;
}

/** Fills the championship table, in points order. Returns the player's row, if any. */
export function renderStandingRows(tbody: HTMLElement, standings: DriverStanding[]): HTMLElement | null {
  let playerRow: HTMLElement | null = null;
  tbody.replaceChildren(
    ...ChampionshipEngine.sortStandings(standings).map((s, i) => {
      const row = document.createElement('tr');
      if (s.isPlayer) {
        row.className = 'player-row';
        playerRow = row;
      }
      row.append(
        cell(String(i + 1), 'col-pos'),
        stripCell(s.driverId, s.isPlayer),
        cell(displayName(s.isPlayer, s.driverName)),
        cell(s.team, 'col-team'),
        cell(String(s.wins), 'col-num'),
        cell(String(s.podiums), 'col-num col-podiums'),
        cell(String(s.points), 'col-num')
      );
      return row;
    })
  );
  return playerRow;
}
