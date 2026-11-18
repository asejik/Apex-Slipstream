import { ChampionshipEngine, DriverFinish, DriverStanding } from '../engine/ChampionshipEngine';
import { formatLapTime } from '../app/TimeTrial';
import type { QualifyingOutcome } from '../engine/QualifyingManager';
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

/** Your name from the Garage ("You" if you have not set one), otherwise the driver's full name */
function displayName(isPlayer: boolean, name: string, playerName: string): string {
  return isPlayer ? playerName : name;
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

/** "Pole position · 1:02.45", or "Qualified P6 · 1:03.10 · +0.65s to pole" */
export function qualifyingSummary(outcome: Pick<QualifyingOutcome, 'playerPosition' | 'playerTimeMs' | 'deltaToPoleMs'>): string {
  const time = formatLapTime(outcome.playerTimeMs);
  return outcome.playerPosition === 1
    ? `Pole position · ${time}`
    : `Qualified P${outcome.playerPosition} · ${time} · +${(outcome.deltaToPoleMs / 1000).toFixed(2)}s to pole`;
}


/**
 * Fills the race result table with all 20 cars: position, team strip, driver, team, best lap
 * (purple for the fastest lap of the race) and points. Returns the player's row, if any.
 */
export function renderResultRows(tbody: HTMLElement, finishes: DriverFinish[], playerName = 'You'): HTMLElement | null {
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
        cell(displayName(f.isPlayer, f.driverName, playerName)),
        cell(f.team, 'col-team'),
        cell(f.fastestLapMs > 0 ? formatLapTime(f.fastestLapMs) : '—', f.hasFastestLap ? 'col-num fastest' : 'col-num'),
        cell(f.totalPoints > 0 ? `+${f.totalPoints}` : '0', 'col-num')
      );
      return row;
    })
  );
  return playerRow;
}

/** Fills the championship table, in points order. Returns the player's row, if any. */
export function renderStandingRows(tbody: HTMLElement, standings: DriverStanding[], playerName = 'You'): HTMLElement | null {
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
        cell(displayName(s.isPlayer, s.driverName, playerName)),
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
