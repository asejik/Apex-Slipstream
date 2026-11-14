import { VehicleState } from '../engine/VehiclePhysics';
import { CameraMode } from '../engine/CameraController';

export class HUDController {
  private speedElement: HTMLElement | null;
  private cameraBadgeElement: HTMLElement | null;
  private rpmBarElement: HTMLElement | null;
  private driftBadgeElement: HTMLElement | null;
  private onCameraToggleCallback?: () => void;

  constructor(onCameraToggle?: () => void) {
    this.onCameraToggleCallback = onCameraToggle;
    this.speedElement = document.getElementById('speed-value');
    this.cameraBadgeElement = document.getElementById('camera-mode-badge');
    this.rpmBarElement = document.getElementById('rpm-bar-fill');
    this.driftBadgeElement = document.getElementById('drift-indicator');

    const toggleBtn = document.getElementById('btn-camera-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCameraToggleCallback?.();
      });
    }
  }

  public update(vehicle: VehicleState, cameraMode: CameraMode): void {
    // 1. Speedometer
    if (this.speedElement) {
      const speed = Math.round(vehicle.speedKmh);
      this.speedElement.textContent = speed.toString();
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

    // 4. Drift indicator
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
}
