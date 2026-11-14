import { VehicleState } from '../engine/VehiclePhysics';
import { CameraMode } from '../engine/CameraController';
import { LapState } from '../engine/LapManager';
import { SurfaceEvaluation } from '../track/TrackSpline';
import { SlipstreamState } from '../engine/SlipstreamManager';
import { TireCompound, getTireCompoundGrip } from '../tires/TireTypes';

export class HUDController {
  private speedElement: HTMLElement | null;
  private cameraBadgeElement: HTMLElement | null;
  private rpmBarElement: HTMLElement | null;
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
  private tirePills: Map<TireCompound, HTMLElement> = new Map();

  private onCameraToggleCallback?: () => void;
  private onTrackToggleCallback?: () => void;
  private onAudioToggleCallback?: () => void;
  private onTireSelectCallback?: (compound: TireCompound) => void;

  constructor(
    onCameraToggle?: () => void,
    onTrackToggle?: () => void,
    onAudioToggle?: () => void,
    onTireSelect?: (compound: TireCompound) => void
  ) {
    this.onCameraToggleCallback = onCameraToggle;
    this.onTrackToggleCallback = onTrackToggle;
    this.onAudioToggleCallback = onAudioToggle;
    this.onTireSelectCallback = onTireSelect;

    this.speedElement = document.getElementById('speed-value');
    this.cameraBadgeElement = document.getElementById('camera-mode-badge');
    this.rpmBarElement = document.getElementById('rpm-bar-fill');
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

    const streetBtn = document.getElementById('btn-tire-street');
    const allTerrainBtn = document.getElementById('btn-tire-allterrain');
    const wetBtn = document.getElementById('btn-tire-wet');

    if (streetBtn) {
      this.tirePills.set('street', streetBtn);
      streetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTireSelectCallback?.('street');
      });
    }
    if (allTerrainBtn) {
      this.tirePills.set('all_terrain', allTerrainBtn);
      allTerrainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTireSelectCallback?.('all_terrain');
      });
    }
    if (wetBtn) {
      this.tirePills.set('wet', wetBtn);
      wetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTireSelectCallback?.('wet');
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

  public update(
    vehicle: VehicleState,
    cameraMode: CameraMode,
    lapState: LapState,
    surface: SurfaceEvaluation,
    trackName: string,
    slipstream: SlipstreamState,
    activeTire: TireCompound,
    isAudioMuted: boolean
  ): void {
    // 1. Speedometer
    if (this.speedElement) {
      this.speedElement.textContent = Math.round(vehicle.speedKmh).toString();
    }

    // 2. RPM Bar Fill
    if (this.rpmBarElement) {
      const percent = Math.min(100, Math.round(vehicle.rpm * 100));
      this.rpmBarElement.style.width = `${percent}%`;
    }

    // 3. Camera Mode Badge
    if (this.cameraBadgeElement) {
      const modeLabel = cameraMode === 'high-chase' ? 'High-Chase'
        : cameraMode === 'low-chase' ? 'Low-Chase'
        : 'Top-Down';
      this.cameraBadgeElement.textContent = `Camera [C]: ${modeLabel}`;
    }

    // 4. Track Name Badge
    if (this.trackNameElement) {
      this.trackNameElement.textContent = `Track [T]: ${trackName}`;
    }

    // 5. Lap & Timers
    if (this.lapCounterElement) {
      if (lapState.isRaceCompleted) {
        this.lapCounterElement.textContent = 'FINISHED';
      } else {
        this.lapCounterElement.textContent = `LAP ${lapState.currentLap}/${lapState.totalLaps}`;
      }
    }

    if (this.lapTimerElement) {
      this.lapTimerElement.textContent = this.formatTime(lapState.currentLapTime);
    }

    if (this.bestTimerElement) {
      if (lapState.bestLapTime !== null) {
        this.bestTimerElement.textContent = `BEST: ${this.formatTime(lapState.bestLapTime)}`;
      } else {
        this.bestTimerElement.textContent = 'BEST: --:--.--';
      }
    }

    // 6. Surface Indicator (Asphalt / Curb / Off-road Gravel)
    if (this.surfaceIndicatorElement) {
      if (surface.surface === 'gravel') {
        this.surfaceIndicatorElement.textContent = '⚠️ OFF-ROAD (GRAVEL)';
        this.surfaceIndicatorElement.style.color = '#eab308';
        this.surfaceIndicatorElement.style.opacity = '1.0';
      } else if (surface.surface === 'curb') {
        this.surfaceIndicatorElement.textContent = 'CURB';
        this.surfaceIndicatorElement.style.color = '#00f0ff';
        this.surfaceIndicatorElement.style.opacity = '0.8';
      } else {
        this.surfaceIndicatorElement.style.opacity = '0.0';
      }
    }

    // 7. Wrong Way Warning
    if (this.wrongWayElement) {
      this.wrongWayElement.style.opacity = lapState.wrongWay ? '1.0' : '0.0';
    }

    // 8. Drift indicator
    if (this.driftBadgeElement) {
      if (vehicle.driftFactor > 0.35 && vehicle.speedKmh > 20) {
        this.driftBadgeElement.style.opacity = '1.0';
        this.driftBadgeElement.style.transform = 'scale(1.05)';
      } else {
        this.driftBadgeElement.style.opacity = '0.0';
        this.driftBadgeElement.style.transform = 'scale(0.9)';
      }
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

    // 10. Tactical Tires Active Pill & Grip Readout
    this.tirePills.forEach((el, compound) => {
      if (compound === activeTire) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    if (this.tireGripReadoutElement) {
      const effectiveGrip = getTireCompoundGrip(activeTire, surface.surface);
      const gripPercent = Math.round(effectiveGrip * 100);
      this.tireGripReadoutElement.textContent = `GRIP: ${gripPercent}%`;
    }

    // 11. Audio Status
    if (this.audioStatusElement) {
      this.audioStatusElement.textContent = isAudioMuted
        ? 'Audio [M]: 🔇 MUTED'
        : 'Audio [M]: 🔊 UNMUTED';
    }
  }

  private formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds * 100) % 100);

    const mm = mins.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    const xx = ms.toString().padStart(2, '0');
    return `${mm}:${ss}.${xx}`;
  }
}
