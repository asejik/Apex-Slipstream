import { TouchController } from '../ui/TouchController';

export interface InputState {
  throttle: number; // 0.0 to 1.0
  brake: number; // 0.0 to 1.0
  steering: number; // -1.0 (left) to 1.0 (right)
  handbrake: boolean;
  cameraToggleRequested: boolean;
  trackToggleRequested: boolean;
  tireSelectRequested: number | null; // 1: Street, 2: All-Terrain, 3: Wet
  audioToggleRequested: boolean;
  restartRequested: boolean;
  standingsToggleRequested: boolean;
  ghostToggleRequested: boolean;
  /** Esc or P: pause during a race, resume from the pause menu */
  pauseToggleRequested: boolean;
}

/** A text box, text area or editable element: keys typed there are text, not controls */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; type?: string; isContentEditable?: boolean } | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'range', 'submit'].includes(el.type ?? 'text');
}

export class InputManager {
  private keys: Record<string, boolean> = {};
  private cameraTogglePending = false;
  private trackTogglePending = false;
  private tireSelectPending: number | null = null;
  private audioTogglePending = false;
  private restartPending = false;
  private standingsTogglePending = false;
  private ghostTogglePending = false;
  private pauseTogglePending = false;
  private gamepadIndex: number | null = null;
  private prevGamepadButtonY = false;
  private touchController?: TouchController;

  constructor(touchController?: TouchController) {
    this.touchController = touchController;
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown.bind(this));
      window.addEventListener('keyup', this.onKeyUp.bind(this));
      window.addEventListener('gamepadconnected', this.onGamepadConnected.bind(this));
      window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected.bind(this));
    }
  }

  public setTouchController(touchController: TouchController): void {
    this.touchController = touchController;
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Typing in a text box (the Garage name) is not driving: only Escape still counts
    if (isTextEntry(event.target) && event.code !== 'Escape') return;

    // Prevent default browser scrolling or tab focus loss
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'KeyC' && !this.keys[event.code]) {
      this.cameraTogglePending = true;
    }
    if (event.code === 'KeyT' && !this.keys[event.code]) {
      this.trackTogglePending = true;
    }
    if (event.code === 'KeyM' && !this.keys[event.code]) {
      this.audioTogglePending = true;
    }
    if (event.code === 'KeyR' && !this.keys[event.code]) {
      this.restartPending = true;
    }
    if (event.code === 'KeyG' && !this.keys[event.code]) {
      this.ghostTogglePending = true;
    }
    if ((event.code === 'Escape' || event.code === 'KeyP') && !this.keys[event.code]) {
      this.pauseTogglePending = true;
    }
    if (event.code === 'Tab' && !this.keys[event.code]) {
      this.standingsTogglePending = true;
    }
    if ((event.code === 'Digit1' || event.code === 'Numpad1') && !this.keys[event.code]) {
      this.tireSelectPending = 1;
    }
    if ((event.code === 'Digit2' || event.code === 'Numpad2') && !this.keys[event.code]) {
      this.tireSelectPending = 2;
    }
    if ((event.code === 'Digit3' || event.code === 'Numpad3') && !this.keys[event.code]) {
      this.tireSelectPending = 3;
    }

    this.keys[event.code] = true;
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys[event.code] = false;
  }

  private onGamepadConnected(event: GamepadEvent): void {
    this.gamepadIndex = event.gamepad.index;
    console.info(`Gamepad connected: ${event.gamepad.id} at index ${event.gamepad.index}`);
  }

  private onGamepadDisconnected(event: GamepadEvent): void {
    if (this.gamepadIndex === event.gamepad.index) {
      this.gamepadIndex = null;
      console.info('Gamepad disconnected');
    }
  }

  public triggerCameraToggle(): void {
    this.cameraTogglePending = true;
  }

  public triggerTrackToggle(): void {
    this.trackTogglePending = true;
  }

  public triggerTireSelect(index: number): void {
    this.tireSelectPending = index;
  }

  public triggerAudioToggle(): void {
    this.audioTogglePending = true;
  }

  public triggerRestart(): void {
    this.restartPending = true;
  }

  public triggerStandingsToggle(): void {
    this.standingsTogglePending = true;
  }

  public triggerGhostToggle(): void {
    this.ghostTogglePending = true;
  }

  public getInputState(): InputState {
    let throttle = 0;
    let brake = 0;
    let steering = 0;
    let handbrake = false;

    // 1. Keyboard mappings
    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      throttle = 1.0;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      brake = 1.0;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      steering -= 1.0;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      steering += 1.0;
    }
    if (this.keys['Space']) {
      handbrake = true;
    }

    // 2. Gamepad API polling
    if (this.gamepadIndex !== null && typeof navigator.getGamepads === 'function') {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[this.gamepadIndex];

      if (gp && gp.connected) {
        // Standard Gamepad mapping:
        // Button 7: Right Trigger (Throttle)
        // Button 6: Left Trigger (Brake)
        // Button 0: A (Throttle fallback)
        // Button 1: B (Brake fallback)
        // Button 2: X (Handbrake)
        // Button 3: Y (Camera Toggle)
        // Axis 0: Left Stick X (-1.0 to 1.0)
        const rt = gp.buttons[7]?.value ?? (gp.buttons[0]?.pressed ? 1.0 : 0);
        const lt = gp.buttons[6]?.value ?? (gp.buttons[1]?.pressed ? 1.0 : 0);

        if (rt > 0.05) throttle = Math.max(throttle, rt);
        if (lt > 0.05) brake = Math.max(brake, lt);

        // Left stick X with 0.1 deadzone
        const stickX = gp.axes[0] ?? 0;
        if (Math.abs(stickX) > 0.1) {
          steering = stickX;
        }

        // Handbrake: X button or A button
        if (gp.buttons[2]?.pressed) {
          handbrake = true;
        }

        // Camera toggle: Y button (rising edge detection)
        const buttonY = gp.buttons[3]?.pressed ?? false;
        if (buttonY && !this.prevGamepadButtonY) {
          this.cameraTogglePending = true;
        }
        this.prevGamepadButtonY = buttonY;
      }
    }

    // 3. Mobile Touch Controller inputs
    if (this.touchController) {
      const touch = this.touchController.getInput();
      if (Math.abs(touch.steer) > 0.001) {
        steering = Math.max(-1.0, Math.min(1.0, steering + touch.steer));
      }
      if (touch.throttle > 0) {
        throttle = Math.max(throttle, touch.throttle);
      }
      if (touch.brake > 0) {
        brake = Math.max(brake, touch.brake);
      }
      if (touch.drift) {
        handbrake = true;
      }
    }

    const cameraToggleRequested = this.cameraTogglePending;
    this.cameraTogglePending = false;

    const trackToggleRequested = this.trackTogglePending;
    this.trackTogglePending = false;

    const audioToggleRequested = this.audioTogglePending;
    this.audioTogglePending = false;

    const restartRequested = this.restartPending;
    this.restartPending = false;

    const standingsToggleRequested = this.standingsTogglePending;
    this.standingsTogglePending = false;

    const ghostToggleRequested = this.ghostTogglePending;
    this.ghostTogglePending = false;

    const tireSelectRequested = this.tireSelectPending;
    this.tireSelectPending = null;

    const pauseToggleRequested = this.pauseTogglePending;
    this.pauseTogglePending = false;

    return {
      throttle,
      brake,
      steering: Math.max(-1.0, Math.min(1.0, steering)),
      handbrake,
      cameraToggleRequested,
      trackToggleRequested,
      tireSelectRequested,
      audioToggleRequested,
      restartRequested,
      standingsToggleRequested,
      ghostToggleRequested,
      pauseToggleRequested
    };
  }
}
