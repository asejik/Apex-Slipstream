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
}

export class InputManager {
  private keys: Record<string, boolean> = {};
  private cameraTogglePending = false;
  private trackTogglePending = false;
  private tireSelectPending: number | null = null;
  private audioTogglePending = false;
  private restartPending = false;
  private gamepadIndex: number | null = null;
  private prevGamepadButtonY = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    window.addEventListener('gamepadconnected', this.onGamepadConnected.bind(this));
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Prevent default browser scrolling on arrow keys or space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
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
    if (this.gamepadIndex !== null) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[this.gamepadIndex];
      if (gp && gp.connected) {
        // Analog stick X steering with 15% deadzone
        const stickX = gp.axes[0] ?? 0;
        if (Math.abs(stickX) > 0.15) {
          steering = Math.sign(stickX) * ((Math.abs(stickX) - 0.15) / 0.85);
        }

        // Triggers: RT (button 7) or button A (button 0) for throttle
        const rt = gp.buttons[7]?.value ?? (gp.buttons[0]?.pressed ? 1.0 : 0.0);
        if (rt > 0.05) {
          throttle = Math.max(throttle, rt);
        }

        // LT (button 6) or button B (button 1) for brake/reverse
        const lt = gp.buttons[6]?.value ?? (gp.buttons[1]?.pressed ? 1.0 : 0.0);
        if (lt > 0.05) {
          brake = Math.max(brake, lt);
        }

        // Button X (button 2) for handbrake
        if (gp.buttons[2]?.pressed) {
          handbrake = true;
        }

        // Button Y (button 3) for camera toggle (edge-triggered)
        const buttonY = gp.buttons[3]?.pressed ?? false;
        if (buttonY && !this.prevGamepadButtonY) {
          this.cameraTogglePending = true;
        }
        this.prevGamepadButtonY = buttonY;
      }
    }

    // Consume toggle triggers
    const cameraToggleRequested = this.cameraTogglePending;
    this.cameraTogglePending = false;

    const trackToggleRequested = this.trackTogglePending;
    this.trackTogglePending = false;

    const tireSelectRequested = this.tireSelectPending;
    this.tireSelectPending = null;

    const audioToggleRequested = this.audioTogglePending;
    this.audioTogglePending = false;

    const restartRequested = this.restartPending;
    this.restartPending = false;

    return {
      throttle: Math.min(1.0, Math.max(0.0, throttle)),
      brake: Math.min(1.0, Math.max(0.0, brake)),
      steering: Math.min(1.0, Math.max(-1.0, steering)),
      handbrake,
      cameraToggleRequested,
      trackToggleRequested,
      tireSelectRequested,
      audioToggleRequested,
      restartRequested
    };
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
  }
}
