import { RaceWorld } from '../engine/RaceWorld';
import { countsForFastestLap } from '../engine/RaceOrder';
import { CareerManager } from '../engine/CareerManager';
import { HUDController } from '../ui/HUDController';
import { GhostStorage, isNewPersonalBest } from '../storage/GhostStorage';
import { GhostRecorder } from './GhostRecorder';
import { GhostPlayback } from './GhostPlayback';
import { formatLapTime } from '../app/TimeTrial';
import { Session } from '../app/Session';

/** What a finished lap is recorded with and shown on */
export interface GhostLapParts {
  readonly world: RaceWorld;
  readonly career: CareerManager;
  readonly hudController: HUDController;
  readonly ghostStorage: GhostStorage;
  readonly ghostRecorder: GhostRecorder;
  /** Your best lap's ghost */
  readonly ghostPlayback: GhostPlayback;
  /** Time Trial's second ghost: your previous lap, in white */
  readonly lastLapGhost: GhostPlayback;
  /** The session on track, read when a lap ends or a stored ghost arrives */
  session(): Session;
}

/**
 * Your laps and their ghosts (P09-R02 step 6): records each lap, saves a new personal best
 * and your last lap, loads the stored ghosts for a track, keeps your fastest race lap for the
 * bonus, and shows or hides the ghosts.
 */
export class GhostLaps {
  /** Lap time of the PB ghost saved for the loaded track; null when none is stored */
  private storedPbLapMs: number | null = null;
  /** False until the stored PB for the loaded track has been read from storage */
  private storedPbReady = false;
  /** Your fastest lap this race that counts for the fastest-lap bonus (U-09); null if none */
  bestRaceLapMs: number | null = null;
  /** The ghosts are shown (Settings, the pause menu and G) */
  visible = true;

  constructor(private readonly parts: GhostLapParts) {
    const lapManager = parts.world.lapManager;
    // Leaving the grid behind the line (U-11): the ghost lap starts where the lap timer does
    lapManager.onStartLineCrossed = () => parts.ghostRecorder.startLap();
    lapManager.onLapCompleted = (lapNumber, lapTime) => this.onLapCompleted(lapNumber, lapTime);
  }

  private onLapCompleted(lapNumber: number, lapTime: number): void {
    const { world, career, hudController, ghostStorage, ghostRecorder, ghostPlayback, lastLapGhost } = this.parts;
    const session = this.parts.session();
    const timeTrial = session.kind === 'timeTrial';
    // Race laps that count for the fastest-lap bonus, by the same rule as the AI (U-09)
    if (session.kind !== 'qualifying' && countsForFastestLap(lapNumber, world.trackSpline.data.isClosed)) {
      const ms = lapTime * 1000;
      if (this.bestRaceLapMs === null || ms < this.bestRaceLapMs) {
        this.bestRaceLapMs = ms;
      }
    }

    const { data, sampleCount } = ghostRecorder.finishLap();
    // The track on screen, which differs from the season round in practice
    const trackId = world.trackSpline.data.id;
    const lapTimeMs = lapTime * 1000;

    // Time Trial: beating a best lap you had already set earns XP (R9)
    let ghostXp = '';
    if (sampleCount > 0) {
      // Compare with the PB saved for this track, not the lap timer's per-session best
      if (this.storedPbReady && isNewPersonalBest(lapTimeMs, this.storedPbLapMs)) {
        if (timeTrial && this.storedPbLapMs !== null) {
          const award = career.awardGhostBeat();
          ghostXp = ` · ghost beaten, +${award.gained} XP`;
        }
        this.storedPbLapMs = lapTimeMs;
        hudController.showPersonalBestAlert();
        ghostStorage.saveGhost(trackId, 'pb', lapTimeMs, data, sampleCount);
        ghostPlayback.loadGhost(data, sampleCount);
      }
      ghostStorage.saveGhost(trackId, 'previous', lapTimeMs, data, sampleCount);
      // Time Trial: this lap becomes the white ghost for the next one
      if (timeTrial) lastLapGhost.loadGhost(data, sampleCount);
    }
    if (timeTrial && lapNumber > 0) {
      hudController.showBanner(`Lap ${formatLapTime(lapTimeMs)}${ghostXp}`, 3000);
    }

    ghostRecorder.startLap();
  }

  /**
   * A track has loaded: load its stored ghost replay and PB time. Until it arrives, no lap may
   * claim a PB, so a quick first lap can't overwrite a stored ghost it never saw.
   */
  loadFor(trackId: string): void {
    const { world, ghostStorage, ghostRecorder, ghostPlayback, lastLapGhost } = this.parts;
    this.storedPbReady = false;
    this.storedPbLapMs = null;
    this.bestRaceLapMs = null;
    ghostPlayback.clear();
    lastLapGhost.clear();
    const isTimeTrial = (): boolean => this.parts.session().kind === 'timeTrial';
    // Time Trial: your last lap here, from last time, until you set a new one
    if (isTimeTrial()) {
      ghostStorage.getGhost(trackId, 'previous').then((record) => {
        if (world.trackSpline.data.id !== trackId || !isTimeTrial()) return;
        if (record && record.sampleCount > 0) {
          lastLapGhost.loadGhost(new Float32Array(record.frameData), record.sampleCount);
        }
      });
    }
    ghostStorage.getGhost(trackId, 'pb').then((record) => {
      if (world.trackSpline.data.id !== trackId) return; // another track loaded meanwhile
      if (record && record.sampleCount > 0) {
        this.storedPbLapMs = record.lapTimeMs;
        ghostPlayback.loadGhost(new Float32Array(record.frameData), record.sampleCount);
      }
      this.storedPbReady = true;
    });

    ghostRecorder.startLap();
  }

  /** Shows or hides both ghosts and the HUD's ghost badge */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.parts.ghostPlayback.setVisible(visible);
    this.parts.lastLapGhost.setVisible(visible);
    this.parts.hudController.updateGhostBadge(visible);
  }
}
