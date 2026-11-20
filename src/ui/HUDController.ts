import { VehicleState } from '../engine/VehiclePhysics';
import { CameraMode } from '../engine/CameraController';
import { LapState } from '../engine/LapManager';
import { SurfaceEvaluation } from '../track/TrackSpline';
import { SlipstreamState } from '../engine/SlipstreamManager';
import { TireCompound, WeatherCondition, getTireCompoundGrip } from '../tires/TireTypes';
import { QualifyingOutcome } from '../engine/QualifyingManager';
import { qualifyingSummary } from './ClassificationRows';
import { displaySpeed, GameSettings } from '../app/Settings';
import { formatLapTime } from '../app/TimeTrial';

/** What the race HUD shows each frame (FrameRenderer fills one in, reused) */
export interface HudReadout {
  vehicle: VehicleState;
  cameraMode: CameraMode;
  lapState: LapState;
  surface: SurfaceEvaluation;
  trackName: string;
  slipstream: SlipstreamState;
  activeTire: TireCompound;
  isAudioMuted: boolean;
  positionRank: number;
  /** The round on track: after a race the season has already moved on to the next one */
  currentRound: number;
  totalRaces: number;
  /** Alone on track: qualifying, or a time trial (R8); null in a race */
  soloSession: 'qualifying' | 'time_trial' | null;
  /** Shown instead of the championship round, e.g. "Practice · results don't count" */
  sessionNote: string | null;
}

/**
 * The race HUD (speed block, lap and timing, slipstream, tyres, position, banners, ghost
 * gap) and the pause menu's buttons. The race pop-ups are RaceModals (P09-R11).
 */
export class HUDController {
  private speedElement: HTMLElement | null;
  /** Speed units from Settings */
  private units: GameSettings['units'] = 'kmh';
  private cameraBadgeElement: HTMLElement | null;
  /** Speed block: gear box and the 9 rev lights, redrawn only when they change */
  private gearElement: HTMLElement | null;
  private shownGear = '';
  private revLights: HTMLElement[];
  private shownRevLights = -1;
  /** Tyre badge in the speed block (tyres are chosen before the race, R5) */
  private tyreBadgeElement: HTMLElement | null;
  private tyreBadgeLetterElement: HTMLElement | null;
  private shownTyre: TireCompound | null = null;
  /** The race's weather, for the grip readout (R7) */
  private weather: WeatherCondition = 'dry';
  private driftBadgeElement: HTMLElement | null;
  private lapCounterElement: HTMLElement | null;
  private lapTimerElement: HTMLElement | null;
  private bestTimerElement: HTMLElement | null;
  private wrongWayElement: HTMLElement | null;
  private surfaceIndicatorElement: HTMLElement | null;
  private trackNameElement: HTMLElement | null;

  // Milestone 4 Elements
  private audioStatusElement: HTMLElement | null;
  private slipstreamCardElement: HTMLElement | null;
  private slipstreamMeterFillElement: HTMLElement | null;
  private slipstreamDistElement: HTMLElement | null;
  private slipstreamBoostBannerElement: HTMLElement | null;
  private tireGripReadoutElement: HTMLElement | null;

  // Milestone 5 Elements
  private racePositionElement: HTMLElement | null;

  // Milestone 6 Elements & Modals
  private seasonRoundBadgeElement: HTMLElement | null;

  // Milestone 7 Elements (Ghost Time Trial)
  private ghostDeltaElement: HTMLElement | null;
  private ghostBadgeElement: HTMLElement | null;
  private pbIndicatorElement: HTMLElement | null;
  private pbTimer: number | null = null;
  private qualifyResultElement: HTMLElement | null;
  private qualifyResultTimer: number | null = null;

  private onCameraToggleCallback?: () => void;
  private onTrackToggleCallback?: () => void;
  private onAudioToggleCallback?: () => void;
  private onRestartCallback?: () => void;
  private onOpenStandingsCallback?: () => void;
  private onOpenQualifyCallback?: () => void;
  private onGhostToggleCallback?: () => void;

  constructor(
    onCameraToggle?: () => void,
    onTrackToggle?: () => void,
    onAudioToggle?: () => void,
    onRestart?: () => void,
    onOpenStandings?: () => void,
    onOpenQualify?: () => void,
    onGhostToggle?: () => void
  ) {
    this.onCameraToggleCallback = onCameraToggle;
    this.onTrackToggleCallback = onTrackToggle;
    this.onAudioToggleCallback = onAudioToggle;
    this.onRestartCallback = onRestart;
    this.onOpenStandingsCallback = onOpenStandings;
    this.onOpenQualifyCallback = onOpenQualify;
    this.onGhostToggleCallback = onGhostToggle;

    this.speedElement = document.getElementById('speed-value');
    this.cameraBadgeElement = document.getElementById('camera-mode-badge');
    this.gearElement = document.getElementById('gear-value');
    this.tyreBadgeElement = document.getElementById('tyre-badge');
    this.tyreBadgeLetterElement = document.getElementById('tyre-badge-letter');
    this.revLights = Array.from(document.querySelectorAll<HTMLElement>('#rev-lights i'));
    this.driftBadgeElement = document.getElementById('drift-indicator');
    this.lapCounterElement = document.getElementById('lap-counter-value');
    this.lapTimerElement = document.getElementById('lap-timer-value');
    this.bestTimerElement = document.getElementById('best-timer-value');
    this.wrongWayElement = document.getElementById('wrong-way-indicator');
    this.surfaceIndicatorElement = document.getElementById('surface-indicator');
    this.trackNameElement = document.getElementById('track-name-badge');

    // Milestone 4 UI hooks
    this.audioStatusElement = document.getElementById('audio-status-badge');
    this.slipstreamCardElement = document.getElementById('slipstream-card');
    this.slipstreamMeterFillElement = document.getElementById('slipstream-meter-fill');
    this.slipstreamDistElement = document.getElementById('slipstream-dist');
    this.slipstreamBoostBannerElement = document.getElementById('slipstream-boost-banner');
    this.tireGripReadoutElement = document.getElementById('tire-grip-readout');

    // Milestone 5 UI hooks
    this.racePositionElement = document.getElementById('race-position-value');

    // Milestone 6 UI hooks
    this.seasonRoundBadgeElement = document.getElementById('badge-season-round');

    // Milestone 7 UI hooks
    this.ghostDeltaElement = document.getElementById('ghost-delta-value');
    this.ghostBadgeElement = document.getElementById('ghost-status-badge');
    this.pbIndicatorElement = document.getElementById('pb-indicator');
    this.qualifyResultElement = document.getElementById('qualify-result-indicator');

    this.bindButtons();
  }

  private bindButtons(): void {
    const restartBtn = document.getElementById('btn-restart-race');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onRestartCallback?.();
      });
    }

    const standingsBtn = document.getElementById('btn-standings-toggle');
    if (standingsBtn) {
      standingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onOpenStandingsCallback?.();
      });
    }

    const qualifyBtn = document.getElementById('btn-qualify-toggle');
    if (qualifyBtn) {
      qualifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onOpenQualifyCallback?.();
      });
    }

    const ghostBtn = document.getElementById('btn-ghost-toggle');
    if (ghostBtn) {
      ghostBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onGhostToggleCallback?.();
      });
    }

    const audioBtn = document.getElementById('btn-audio-toggle');
    if (audioBtn) {
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAudioToggleCallback?.();
      });
    }

    const cameraBtn = document.getElementById('btn-camera-toggle');
    if (cameraBtn) {
      cameraBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCameraToggleCallback?.();
      });
    }

    const trackBtn = document.getElementById('btn-track-toggle');
    if (trackBtn) {
      trackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTrackToggleCallback?.();
      });
    }
  }

  /** Shows where the player qualified for a few seconds as the race grid forms */
  public showQualifyingResult(outcome: QualifyingOutcome): void {
    this.showBanner(qualifyingSummary(outcome), 5000);
  }

  /** The race's weather (R7): the grip readout shows the tyres' grip in it */
  public setWeather(weather: WeatherCondition): void {
    this.weather = weather;
  }

  /** A short band across the HUD, for example at the start of a qualifying run */
  public showBanner(text: string, durationMs: number): void {
    const el = this.qualifyResultElement;
    if (!el) return;
    el.textContent = text;
    el.classList.add('visible');
    if (this.qualifyResultTimer !== null) {
      window.clearTimeout(this.qualifyResultTimer);
    }
    this.qualifyResultTimer = window.setTimeout(() => {
      el.classList.remove('visible');
      this.qualifyResultTimer = null;
    }, durationMs);
  }

  public showPersonalBestAlert(): void {
    if (this.pbIndicatorElement) {
      this.pbIndicatorElement.classList.add('visible');
      if (this.pbTimer !== null) {
        window.clearTimeout(this.pbTimer);
      }
      this.pbTimer = window.setTimeout(() => {
        this.pbIndicatorElement?.classList.remove('visible');
        this.pbTimer = null;
      }, 3500);
    }
  }

  public updateGhostTelemetry(
    hasGhost: boolean,
    isGhostVisible: boolean,
    deltaSeconds: number | null
  ): void {
    if (!this.ghostDeltaElement) return;

    if (!hasGhost) {
      this.ghostDeltaElement.textContent = 'No ghost';
      this.ghostDeltaElement.className = 'ghost-delta';
      return;
    }

    if (!isGhostVisible) {
      this.ghostDeltaElement.textContent = 'Ghost off';
      this.ghostDeltaElement.className = 'ghost-delta';
      return;
    }

    if (deltaSeconds === null) {
      this.ghostDeltaElement.textContent = '0.00';
      this.ghostDeltaElement.className = 'ghost-delta';
      return;
    }

    // Gap to your best-lap ghost: negative (green) when ahead, positive (red) when behind
    const sign = deltaSeconds >= 0 ? '+' : '−';
    const absVal = Math.abs(deltaSeconds).toFixed(2);
    this.ghostDeltaElement.textContent = `${sign}${absVal}`;

    if (deltaSeconds <= -0.05) {
      this.ghostDeltaElement.className = 'ghost-delta ahead'; // Ahead in lime green
    } else if (deltaSeconds >= 0.05) {
      this.ghostDeltaElement.className = 'ghost-delta behind'; // Behind in crimson
    } else {
      this.ghostDeltaElement.className = 'ghost-delta';
    }
  }

  public updateGhostBadge(isGhostVisible: boolean): void {
    if (this.ghostBadgeElement) {
      this.ghostBadgeElement.textContent = isGhostVisible
        ? 'Ghost: On'
        : 'Ghost: Off';
    }
  }

  /** km/h or mph for the speed block (Settings) */
  public setUnits(units: GameSettings['units']): void {
    this.units = units;
    const label = document.querySelector('.speedometer-card .speed-unit');
    if (label) label.textContent = units === 'mph' ? 'mph' : 'km/h';
  }

  /** Shows this frame's readout (P09-R11: one object, refilled each frame, not 14 arguments) */
  public update(readout: HudReadout): void {
    const {
      vehicle,
      cameraMode,
      lapState,
      surface,
      trackName,
      slipstream,
      activeTire,
      isAudioMuted,
      positionRank,
      currentRound,
      totalRaces,
      soloSession,
      sessionNote
    } = readout;
    // 1. Speedometer
    if (this.speedElement) {
      this.speedElement.textContent = displaySpeed(vehicle.speedKmh, this.units).toString();
    }

    // 2. Rev lights and gear (Broadcast speed block); the page changes only when they do
    const lit = Math.round(Math.min(1, Math.max(0, vehicle.rpm)) * this.revLights.length);
    if (lit !== this.shownRevLights) {
      this.shownRevLights = lit;
      for (let i = 0; i < this.revLights.length; i++) {
        this.revLights[i]?.classList.toggle('on', i < lit);
      }
    }
    const gear = gearLabel(vehicle.forwardSpeed, vehicle.speedKmh);
    if (this.gearElement && gear !== this.shownGear) {
      this.shownGear = gear;
      this.gearElement.textContent = gear;
    }

    // 3. Camera Mode Badge
    if (this.cameraBadgeElement) {
      const modeLabel = cameraMode === 'high-chase' ? 'High chase'
        : cameraMode === 'low-chase' ? 'Low chase'
        : 'Top down';
      this.cameraBadgeElement.textContent = `Camera: ${modeLabel}`;
    }

    // 4. Track Name Badge
    if (this.trackNameElement) {
      this.trackNameElement.textContent = `Track: ${trackName}`;
    }

    // 5. Lap & Timers
    if (this.lapCounterElement) {
      if (soloSession === 'qualifying') {
        this.lapCounterElement.textContent = 'Qualifying';
      } else if (soloSession === 'time_trial') {
        this.lapCounterElement.textContent = `Lap ${lapState.currentLap}`;
      } else if (lapState.isRaceCompleted) {
        this.lapCounterElement.textContent = 'Finished';
      } else {
        this.lapCounterElement.textContent = `Lap ${lapState.currentLap}/${lapState.totalLaps}`;
      }
    }

    if (this.lapTimerElement) {
      this.lapTimerElement.textContent = this.formatTime(lapState.currentLapTime);
    }

    if (this.bestTimerElement) {
      this.bestTimerElement.textContent =
        lapState.bestLapTime !== null ? `Best ${this.formatTime(lapState.bestLapTime)}` : 'Best —';
    }

    // 6. Surface band (kerb / off track on gravel); colours come from the stylesheet
    if (this.surfaceIndicatorElement) {
      if (surface.surface === 'gravel') {
        this.surfaceIndicatorElement.textContent = 'Off track · gravel';
        this.surfaceIndicatorElement.classList.remove('curb');
        this.surfaceIndicatorElement.style.opacity = '1';
      } else if (surface.surface === 'dirt') {
        this.surfaceIndicatorElement.textContent = 'Dirt road';
        this.surfaceIndicatorElement.classList.add('curb');
        this.surfaceIndicatorElement.style.opacity = '1';
      } else if (surface.surface === 'curb') {
        this.surfaceIndicatorElement.textContent = 'Kerb';
        this.surfaceIndicatorElement.classList.add('curb');
        this.surfaceIndicatorElement.style.opacity = '1';
      } else {
        this.surfaceIndicatorElement.style.opacity = '0';
      }
    }

    // 7. Wrong Way Warning
    if (this.wrongWayElement) {
      this.wrongWayElement.classList.toggle('active', lapState.wrongWay);
    }

    // 8. Drift indicator
    if (this.driftBadgeElement) {
      this.driftBadgeElement.style.opacity = vehicle.driftFactor > 0.35 && vehicle.speedKmh > 20 ? '1' : '0';
    }

    // 9. Slipstream Drafting Card
    if (this.slipstreamCardElement) {
      const showCard = slipstream.inWake || slipstream.isBoostActive;
      if (showCard) {
        this.slipstreamCardElement.classList.add('visible');
      } else {
        this.slipstreamCardElement.classList.remove('visible');
      }

      if (this.slipstreamMeterFillElement) {
        const percent = slipstream.isBoostActive ? 100 : Math.round(slipstream.draftProgress * 100);
        this.slipstreamMeterFillElement.style.width = `${percent}%`;
      }

      if (this.slipstreamDistElement) {
        if (slipstream.distanceToLead < 100) {
          this.slipstreamDistElement.textContent = `${slipstream.distanceToLead.toFixed(1)}m`;
        } else {
          this.slipstreamDistElement.textContent = '--';
        }
      }

      if (this.slipstreamBoostBannerElement) {
        this.slipstreamBoostBannerElement.style.display = slipstream.isBoostActive ? 'block' : 'none';
      }
    }

    // 10. Tyre badge and grip readout (tyres are chosen before the race)
    if (this.tyreBadgeElement && activeTire !== this.shownTyre) {
      this.shownTyre = activeTire;
      this.tyreBadgeElement.dataset.compound = activeTire;
      if (this.tyreBadgeLetterElement) {
        this.tyreBadgeLetterElement.textContent = activeTire === 'street' ? 'S' : activeTire === 'wet' ? 'W' : 'A';
      }
    }

    if (this.tireGripReadoutElement) {
      const effectiveGrip = getTireCompoundGrip(activeTire, surface.surface, this.weather);
      const gripPercent = Math.round(effectiveGrip * 100);
      this.tireGripReadoutElement.textContent = `Grip ${gripPercent}%`;
    }

    // 11. Audio Status
    if (this.audioStatusElement) {
      this.audioStatusElement.textContent = isAudioMuted
        ? 'Sound: Off'
        : 'Sound: On';
    }

    // 12. Race position (the restart label is the pause menu's, P09-R09)
    if (this.racePositionElement) {
      this.racePositionElement.textContent = soloSession ? '' : `P${positionRank}/20`;
    }
    if (this.seasonRoundBadgeElement) {
      this.seasonRoundBadgeElement.textContent = soloSession === 'qualifying'
        ? 'Your time sets the grid'
        : sessionNote ?? `Round ${currentRound + 1} of ${totalRaces}`;
    }
  }

  /** Broadcast style lap time: 0:41.27 */
  /** The HUD's lap times, by the game's one lap-time format (P09-R06) */
  private formatTime(totalSeconds: number): string {
    return formatLapTime(totalSeconds * 1000);
  }
}

/**
 * The gear shown in the speed block. The engine sound and rev lights use four 45 km/h
 * bands (VehiclePhysics rpm), so the gear follows the same bands: R when reversing,
 * N at a standstill, then 1 to 4.
 */
export function gearLabel(forwardSpeedMs: number, speedKmh: number): string {
  if (forwardSpeedMs < -0.5) return 'R';
  if (speedKmh < 1) return 'N';
  return String(Math.min(4, Math.floor(speedKmh / 45) + 1));
}
