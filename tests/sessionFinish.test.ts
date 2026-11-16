import { describe, it, expect } from 'vitest';
import { SessionFinish } from '../src/engine/SessionFinish';
import type { InputState } from '../src/engine/InputManager';

const STEP = 1 / 60;

describe('After the chequered flag (owner, R6)', () => {
  it('rolls on for the cool-down before moving to the next screen, once', () => {
    const finish = new SessionFinish();
    let calls = 0;
    finish.begin(() => calls++);
    expect(finish.isActive).toBe(true);
    // A second crossing of the line while rolling on does not queue another screen
    finish.begin(() => (calls += 10));
    const steps = Math.round(SessionFinish.COOL_DOWN_SECONDS * 60);
    for (let i = 0; i < steps - 2; i++) finish.step(STEP);
    expect(calls).toBe(0);
    for (let i = 0; i < 4; i++) finish.step(STEP);
    expect(calls).toBe(1);
    expect(finish.isActive).toBe(false);
  });

  it('lifts off and brakes lightly while rolling on, keeping the steering', () => {
    const finish = new SessionFinish();
    const input = { throttle: 1, brake: 0, steering: 0.4, handbrake: true } as InputState;
    finish.coast(input);
    expect(input.throttle).toBe(0);
    expect(input.brake).toBeGreaterThan(0);
    expect(input.brake).toBeLessThan(1);
    expect(input.handbrake).toBe(false);
    expect(input.steering).toBe(0.4);
  });

  it('drops the pending screen when the session is abandoned', () => {
    const finish = new SessionFinish();
    let calls = 0;
    finish.begin(() => calls++);
    finish.cancel();
    for (let i = 0; i < 600; i++) finish.step(STEP);
    expect(calls).toBe(0);
  });
});
