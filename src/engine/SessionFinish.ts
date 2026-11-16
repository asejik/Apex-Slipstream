import type { InputState } from './InputManager';

/**
 * The few seconds after the chequered flag. The session used to cut to the next screen the
 * instant the car crossed the line, which felt like the game stopping mid-run (owner, R6).
 * Now the car rolls on under light braking while a banner says the session is over, and
 * the next screen follows once the cool-down has run.
 */
export class SessionFinish {
  /** Seconds of rolling on after the flag before the next screen */
  public static readonly COOL_DOWN_SECONDS = 3;
  /** Brake applied while rolling on, so the car slows without a sudden stop */
  private static readonly COAST_BRAKE = 0.35;

  private remaining = 0;
  private action: (() => void) | null = null;

  /** True between the flag and the next screen */
  public get isActive(): boolean {
    return this.action !== null;
  }

  /** Starts the cool-down; `action` runs once it is over. A second flag is ignored. */
  public begin(action: () => void, seconds = SessionFinish.COOL_DOWN_SECONDS): void {
    if (this.action) return;
    this.action = action;
    this.remaining = seconds;
  }

  /** Advances the cool-down by one physics step, and runs the action when it is over. */
  public step(dt: number): void {
    if (!this.action) return;
    this.remaining -= dt;
    if (this.remaining > 0) return;
    const action = this.action;
    this.action = null;
    action();
  }

  /** Drops a pending cool-down, for example when the track is reloaded. */
  public cancel(): void {
    this.action = null;
  }

  /** The player's controls while rolling on: no throttle, light braking, steering kept. */
  public coast(input: InputState): void {
    input.throttle = 0;
    input.brake = Math.max(input.brake, SessionFinish.COAST_BRAKE);
    input.handbrake = false;
  }
}
