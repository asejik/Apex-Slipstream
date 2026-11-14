import { VehicleState } from '../engine/VehiclePhysics';
import { CameraMode } from '../engine/CameraController';
import { LapState } from '../engine/LapManager';
import { SurfaceEvaluation } from '../track/TrackSpline';

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

  private onCameraToggleCallback?: () => void;
  private onTrackToggleCallback?: () => void;

  constructor(onCameraToggle?: () => void, onTrackToggle?: () => void) {
    this.onCameraToggleCallback = onCameraToggle;
    this.onTrackToggleCallback = onTrackToggle;

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
    trackName: string
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
        this.surfaceIndicatorElement.style.color = '#ffaa00';
        this.surfaceIndicatorElement.style.opacity = '1.0';
      } else if (surface.surface === 'curb') {
        this.surfaceIndicatorElement.textContent = 'CURB';
        this.surfaceIndicatorElement.style.color = '#00e699';
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
