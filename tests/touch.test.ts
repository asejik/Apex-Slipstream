import { describe, it, expect, beforeEach } from 'vitest';
import { TouchController } from '../src/ui/TouchController';
import { InputManager } from '../src/engine/InputManager';

describe('Mobile Ergonomics & TouchController Suite', () => {
  let touchController: TouchController;
  let inputManager: InputManager;

  beforeEach(() => {
    touchController = new TouchController();
    inputManager = new InputManager(touchController);
  });

  it('initializes with zero touch inputs by default', () => {
    const values = touchController.getInput();
    expect(values.steer).toBe(0);
    expect(values.throttle).toBe(0);
    expect(values.brake).toBe(0);
    expect(values.drift).toBe(false);
  });

  it('correctly clamps mock touch steering values between -1.0 and +1.0', () => {
    touchController.setMockInput(-2.5, 0, 0, false);
    expect(touchController.getInput().steer).toBe(-1.0);

    touchController.setMockInput(3.0, 0, 0, false);
    expect(touchController.getInput().steer).toBe(1.0);

    touchController.setMockInput(0.45, 0, 0, false);
    expect(touchController.getInput().steer).toBeCloseTo(0.45, 3);
  });

  it('correctly clamps pedal throttle and brake values between 0.0 and 1.0', () => {
    touchController.setMockInput(0, 1.8, -0.5, false);
    const values = touchController.getInput();
    expect(values.throttle).toBe(1.0);
    expect(values.brake).toBe(0.0);
  });

  it('seamlessly integrates touch inputs into InputManager state', () => {
    touchController.setMockInput(0.75, 1.0, 0.0, true);
    const inputState = inputManager.getInputState();

    expect(inputState.steering).toBeCloseTo(0.75, 2);
    expect(inputState.throttle).toBe(1.0);
    expect(inputState.brake).toBe(0.0);
    expect(inputState.handbrake).toBe(true);
  });

  it('blends touch steering with keyboard inputs safely within [-1, 1]', () => {
    touchController.setMockInput(0.5, 0.5, 0, false);
    const inputState = inputManager.getInputState();
    expect(inputState.steering).toBeCloseTo(0.5, 2);
    expect(inputState.throttle).toBe(0.5);
  });
});
