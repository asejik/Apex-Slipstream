import { ALL_TRACKS } from '../track/TrackDefinitions';
import { QuickRaceScreen } from '../ui/QuickRaceScreen';
import { TimeTrialScreen } from '../ui/TimeTrialScreen';
import { RecordsModel, RecordsScreen } from '../ui/RecordsScreen';
import { ChampionshipsScreen, championshipRows } from '../ui/ChampionshipsScreen';
import { GarageScreen } from '../ui/GarageScreen';
import { CareerManager } from '../engine/CareerManager';
import { SeasonManager } from '../engine/SeasonManager';
import { GhostStorage } from '../storage/GhostStorage';
import { aiTyreFor } from '../ai/AIRacecraft';
import { QuickRaceSetup } from './QuickRace';
import { TimeTrialSetup } from './TimeTrial';
import { DriverProfile } from './DriverProfile';

/** A screen Esc can close */
export interface Closeable {
  readonly isOpen: boolean;
  close(): void;
}

/** Closes the first open screen in `screens`; false when none was open */
export function closeFirstOpen(screens: readonly Closeable[]): boolean {
  for (const screen of screens) {
    if (screen.isOpen) {
      screen.close();
      return true;
    }
  }
  return false;
}

/** What the hub's screens read */
export interface HubMenuParts {
  readonly career: CareerManager;
  readonly ghostStorage: GhostStorage;
  /** The season being raced; a new one replaces it when you choose another championship */
  season(): SeasonManager;
}

/** What the hub's screens ask the game to do */
export interface HubMenuHooks {
  startQuickRace(setup: QuickRaceSetup): void;
  startTimeTrial(setup: TimeTrialSetup): void;
  chooseChampionship(id: string): void;
  changeDriver(profile: DriverProfile): void;
}

/**
 * The hub's own screens (P09-R02 step 5): Quick Race and Time Trial setup, Records,
 * Championships and the Garage. Opens each with what it shows; closes them on Esc.
 */
export class HubMenus {
  private readonly quickRaceScreen: QuickRaceScreen;
  private readonly timeTrialScreen: TimeTrialScreen;
  private readonly recordsScreen = new RecordsScreen();
  private readonly championshipsScreen: ChampionshipsScreen;
  private readonly garageScreen: GarageScreen;
  /** In the order Esc closes them */
  readonly closeable: readonly Closeable[];

  constructor(
    private readonly parts: HubMenuParts,
    hooks: HubMenuHooks
  ) {
    this.quickRaceScreen = new QuickRaceScreen((setup) => hooks.startQuickRace(setup));
    this.garageScreen = new GarageScreen((profile) => hooks.changeDriver(profile));
    this.championshipsScreen = new ChampionshipsScreen((id) => hooks.chooseChampionship(id));
    this.timeTrialScreen = new TimeTrialScreen(
      (setup) => hooks.startTimeTrial(setup),
      (trackIndex) => this.resetBestLap(trackIndex),
      (trackIndex) => aiTyreFor(ALL_TRACKS[trackIndex] ?? ALL_TRACKS[0]!, 'dry')
    );
    this.closeable = [
      this.quickRaceScreen,
      this.timeTrialScreen,
      this.recordsScreen,
      this.championshipsScreen,
      this.garageScreen
    ];
  }

  /** Hub "Quick race": the setup, starting from the last one raced */
  openQuickRace(last: QuickRaceSetup): void {
    this.quickRaceScreen.open(last);
  }

  /** Hub "Time trial": the setup, with your best lap on every track */
  openTimeTrial(last: TimeTrialSetup): void {
    this.timeTrialScreen.open(last, ALL_TRACKS.map(() => null));
    Promise.all(ALL_TRACKS.map((track) => this.parts.ghostStorage.getGhost(track.id, 'pb'))).then((records) => {
      this.timeTrialScreen.setBests(records.map((record) => (record && record.sampleCount > 0 ? record.lapTimeMs : null)));
    });
  }

  /** Hub "Records": career, trophies, and your best lap and finish on every track (R9) */
  openRecords(): void {
    const career = this.parts.career;
    const model: RecordsModel = {
      level: career.level,
      xp: career.xp,
      stats: { ...career.stats },
      bestLaps: ALL_TRACKS.map(() => null),
      bestFinishes: ALL_TRACKS.map((track) => career.bestFinish(track.id)),
      rivalries: career.rivalries()
    };
    this.recordsScreen.open(model);
    Promise.all(ALL_TRACKS.map((track) => this.parts.ghostStorage.getGhost(track.id, 'pb'))).then((records) => {
      model.bestLaps = records.map((record) => (record && record.sampleCount > 0 ? record.lapTimeMs : null));
      this.recordsScreen.update(model);
    });
  }

  /** Hub "Championships": every championship, locked ones with the level they need (R9) */
  openChampionships(): void {
    const current = this.parts.season();
    this.championshipsScreen.open(
      championshipRows(this.parts.career.level, current.championship.id, (championship) => {
        const season = championship.id === current.championship.id ? current : new SeasonManager(championship);
        return { round: season.currentRaceIndex, totalRaces: season.totalRaces };
      })
    );
  }

  /** Hub "Garage": your name, number and livery */
  openGarage(driver: DriverProfile): void {
    this.garageScreen.open(driver, this.parts.career.level);
  }

  /** Deletes your best lap and last lap on a track (Time Trial setup, after a second tap) */
  private resetBestLap(trackIndex: number): void {
    const track = ALL_TRACKS[trackIndex];
    if (!track) return;
    void this.parts.ghostStorage.clearGhost(track.id, 'pb');
    void this.parts.ghostStorage.clearGhost(track.id, 'previous');
  }
}
