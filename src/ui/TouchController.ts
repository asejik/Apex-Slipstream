export interface TouchInputValues {
  steer: number; // -1.0 (left) to +1.0 (right)
  throttle: number; // 0.0 to 1.0
  brake: number; // 0.0 to 1.0
  drift: boolean;
}

export class TouchController {
  private steerValue = 0;
  private throttleValue = 0;
  private brakeValue = 0;
  private isDrifting = false;

  private steerTouchId: number | null = null;
  private steerStartX = 0;
  private steerCurrentX = 0;
  private readonly maxSteerTravelPx = 60; // Max pixels of thumb travel for full lock

  // DOM elements
  private overlayElement: HTMLElement | null = null;
  private steerZoneElement: HTMLElement | null = null;
  private steerKnobElement: HTMLElement | null = null;
  private throttleBtn: HTMLElement | null = null;
  private brakeBtn: HTMLElement | null = null;
  private driftBtn: HTMLElement | null = null;

  private isTouchDevice = false;

  constructor() {
    this.detectTouchCapability();
    this.initDOM();
  }

  private detectTouchCapability(): void {
    if (typeof window === 'undefined') return;
    this.isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error msMaxTouchPoints is non-standard but safe in legacy Edge
      Boolean(navigator.msMaxTouchPoints);
  }

  public get isAvailable(): boolean {
    return this.isTouchDevice;
  }

  private initDOM(): void {
    if (typeof document === 'undefined') return;

    this.overlayElement = document.getElementById('mobile-touch-overlay');
    this.steerZoneElement = document.getElementById('touch-steer-zone');
    this.steerKnobElement = document.getElementById('touch-steer-knob');
    this.throttleBtn = document.getElementById('touch-throttle');
    this.brakeBtn = document.getElementById('touch-brake');
    this.driftBtn = document.getElementById('touch-drift');

    // Only display touch controls if on a touch-capable device or screen width <= 1024
    if (this.overlayElement) {
      if (this.isTouchDevice || window.innerWidth <= 1024) {
        this.overlayElement.classList.add('active');
      }
    }

    this.bindSteerEvents();
    this.bindPedalEvents();
  }

  private bindSteerEvents(): void {
    if (!this.steerZoneElement) return;

    const onTouchStart = (e: TouchEvent): void => {
      e.preventDefault();
      if (this.steerTouchId !== null) return; // Already tracking a steer touch

      const touch = e.changedTouches[0];
      if (!touch) return;

      this.steerTouchId = touch.identifier;
      const rect = this.steerZoneElement?.getBoundingClientRect();
      const centerX = rect ? rect.left + rect.width / 2 : touch.clientX;
      this.steerStartX = centerX;
      this.steerCurrentX = touch.clientX;
      this.updateSteerOffset();
    };

    const onTouchMove = (e: TouchEvent): void => {
      e.preventDefault();
      if (this.steerTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch && touch.identifier === this.steerTouchId) {
          this.steerCurrentX = touch.clientX;
          this.updateSteerOffset();
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent): void => {
      e.preventDefault();
      if (this.steerTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch && touch.identifier === this.steerTouchId) {
          this.resetSteer();
          break;
        }
      }
    };

    this.steerZoneElement.addEventListener('touchstart', onTouchStart, { passive: false });
    this.steerZoneElement.addEventListener('touchmove', onTouchMove, { passive: false });
    this.steerZoneElement.addEventListener('touchend', onTouchEnd, { passive: false });
    this.steerZoneElement.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  private updateSteerOffset(): void {
    const rawDelta = this.steerCurrentX - this.steerStartX;
    const clampedDelta = Math.max(-this.maxSteerTravelPx, Math.min(this.maxSteerTravelPx, rawDelta));
    this.steerValue = clampedDelta / this.maxSteerTravelPx;

    if (this.steerKnobElement) {
      this.steerKnobElement.style.transform = `translateX(${clampedDelta}px)`;
    }
  }

  private resetSteer(): void {
    this.steerTouchId = null;
    this.steerValue = 0;
    if (this.steerKnobElement) {
      this.steerKnobElement.style.transform = 'translateX(0px)';
    }
  }

  private bindPedalEvents(): void {
    // Throttle Button
    if (this.throttleBtn) {
      this.throttleBtn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          this.throttleValue = 1.0;
          this.throttleBtn?.classList.add('pressed');
        },
        { passive: false }
      );

      const releaseThrottle = (e: TouchEvent): void => {
        e.preventDefault();
        this.throttleValue = 0;
        this.throttleBtn?.classList.remove('pressed');
      };
      this.throttleBtn.addEventListener('touchend', releaseThrottle, { passive: false });
      this.throttleBtn.addEventListener('touchcancel', releaseThrottle, { passive: false });
    }

    // Brake Button
    if (this.brakeBtn) {
      this.brakeBtn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          this.brakeValue = 1.0;
          this.brakeBtn?.classList.add('pressed');
        },
        { passive: false }
      );

      const releaseBrake = (e: TouchEvent): void => {
        e.preventDefault();
        this.brakeValue = 0;
        this.brakeBtn?.classList.remove('pressed');
      };
      this.brakeBtn.addEventListener('touchend', releaseBrake, { passive: false });
      this.brakeBtn.addEventListener('touchcancel', releaseBrake, { passive: false });
    }

    // Drift / Handbrake Button
    if (this.driftBtn) {
      this.driftBtn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          this.isDrifting = true;
          this.driftBtn?.classList.add('pressed');
        },
        { passive: false }
      );

      const releaseDrift = (e: TouchEvent): void => {
        e.preventDefault();
        this.isDrifting = false;
        this.driftBtn?.classList.remove('pressed');
      };
      this.driftBtn.addEventListener('touchend', releaseDrift, { passive: false });
      this.driftBtn.addEventListener('touchcancel', releaseDrift, { passive: false });
    }
  }

  /**
   * For testing or programmatic simulation
   */
  public setMockInput(steer: number, throttle: number, brake: number, drift: boolean): void {
    this.steerValue = Math.max(-1, Math.min(1, steer));
    this.throttleValue = Math.max(0, Math.min(1, throttle));
    this.brakeValue = Math.max(0, Math.min(1, brake));
    this.isDrifting = drift;
  }

  public getInput(): TouchInputValues {
    return {
      steer: this.steerValue,
      throttle: this.throttleValue,
      brake: this.brakeValue,
      drift: this.isDrifting
    };
  }
}
