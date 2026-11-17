import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { VehiclePhysics, DEFAULT_VEHICLE_CONFIG, PLAYER_VEHICLE_CONFIG } from '../src/engine/VehiclePhysics';
import { CameraController } from '../src/engine/CameraController';
import { InputState } from '../src/engine/InputManager';

describe('VehiclePhysics & CameraController Suite', () => {
  let vehicle: VehiclePhysics;
  const blankInput: InputState = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
    cameraToggleRequested: false,
    trackToggleRequested: false,
    tireSelectRequested: null,
    audioToggleRequested: false,
    restartRequested: false,
    standingsToggleRequested: false,
    ghostToggleRequested: false,
    pauseToggleRequested: false
  };

  beforeEach(() => {
    vehicle = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0, DEFAULT_VEHICLE_CONFIG);
  });

  it('accelerates forward when throttle is applied', () => {
    const input: InputState = { ...blankInput, throttle: 1.0 };
    // Simulate 1.0 second in 60Hz steps
    for (let i = 0; i < 60; i++) {
      vehicle.update(1 / 60, input);
    }
    expect(vehicle.state.speedKmh).toBeGreaterThan(30);
    expect(vehicle.state.forwardSpeed).toBeGreaterThan(8);
  });

  it('decelerates and stops when brakes are applied', () => {
    // 1. Build speed first
    const accelInput: InputState = { ...blankInput, throttle: 1.0 };
    for (let i = 0; i < 60; i++) {
      vehicle.update(1 / 60, accelInput);
    }
    const speedBeforeBrake = vehicle.state.speedKmh;
    expect(speedBeforeBrake).toBeGreaterThan(30);

    // 2. Apply full brake
    const brakeInput: InputState = { ...blankInput, brake: 1.0 };
    for (let i = 0; i < 40; i++) {
      vehicle.update(1 / 60, brakeInput);
    }
    expect(vehicle.state.speedKmh).toBeLessThan(speedBeforeBrake * 0.4);
  });

  it('reduces max steering angle at higher speeds (speed-sensitive steering)', () => {
    // Check steady-state low-speed steer
    const steerInput: InputState = { ...blankInput, steering: 1.0 };
    for (let i = 0; i < 20; i++) {
      vehicle.update(1 / 60, steerInput);
    }
    const lowSpeedSteer = Math.abs(vehicle.state.steeringAngle);

    // Reset vehicle and test steady-state high-speed steer
    const highSpeedVehicle = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0, DEFAULT_VEHICLE_CONFIG);
    highSpeedVehicle.state.velocity.set(0, 0, -45); // ~162 km/h
    for (let i = 0; i < 20; i++) {
      highSpeedVehicle.update(1 / 60, steerInput);
      highSpeedVehicle.state.velocity.set(0, 0, -45); // Maintain speed
    }
    const highSpeedSteer = Math.abs(highSpeedVehicle.state.steeringAngle);

    expect(highSpeedSteer).toBeLessThan(lowSpeedSteer);
    expect(lowSpeedSteer).toBeGreaterThan(0.5); // Close to 0.58 rad
    expect(highSpeedSteer).toBeLessThan(0.3); // Close to 0.22 rad
  });

  it('turns at least 40 degrees in one second at full lock from top speed (U-03, R6)', () => {
    // At 34 degrees a second (an 81 m circle) the car could not be turned into corners
    // (U-03). The owner then asked for a little less grip so tight bends need braking (R6):
    // about 45 degrees a second, still well clear of the old 34.
    const steerInput: InputState = { ...blankInput, throttle: 1.0, steering: 1.0 };
    vehicle.state.velocity.set(0, 0, -DEFAULT_VEHICLE_CONFIG.maxForwardSpeed);
    for (let i = 0; i < 60; i++) {
      vehicle.update(1 / 60, steerInput);
    }
    const turnedDegrees = THREE.MathUtils.radToDeg(Math.abs(vehicle.state.heading));
    expect(turnedDegrees).toBeGreaterThan(40);
  });

  it('holds a turning circle of 55 to 65 m at top speed (U-03, R6 grip limit)', () => {
    const steerInput: InputState = { ...blankInput, throttle: 1.0, steering: 1.0 };
    const topSpeed = DEFAULT_VEHICLE_CONFIG.maxForwardSpeed;
    // Let the steering settle, holding top speed
    for (let i = 0; i < 30; i++) {
      vehicle.state.velocity.setLength(topSpeed);
      if (i === 0) vehicle.state.velocity.set(0, 0, -topSpeed);
      vehicle.update(1 / 60, steerInput);
    }
    const headingBefore = vehicle.state.heading;
    vehicle.update(1 / 60, steerInput);
    const yawRate = Math.abs(vehicle.state.heading - headingBefore) * 60;
    // Under the 81 m that made the car hard to turn (U-03); wider than the 45 m that let
    // it take every bend flat out (owner, R6)
    expect(topSpeed / yawRate).toBeLessThanOrEqual(65);
    expect(topSpeed / yawRate).toBeGreaterThan(55);
  });

  it('stays steady on a straight after a short steering tap at top speed (U-03)', () => {
    const tapInput: InputState = { ...blankInput, throttle: 1.0, steering: 1.0 };
    const straightInput: InputState = { ...blankInput, throttle: 1.0 };
    vehicle.state.velocity.set(0, 0, -DEFAULT_VEHICLE_CONFIG.maxForwardSpeed);
    for (let i = 0; i < 6; i++) vehicle.update(1 / 60, tapInput); // 0.1 s tap
    for (let i = 0; i < 30; i++) vehicle.update(1 / 60, straightInput);
    const turnedDegrees = THREE.MathUtils.radToDeg(Math.abs(vehicle.state.heading));
    expect(turnedDegrees).toBeLessThan(8);
  });

  it('induces drift factor when handbrake is engaged during cornering', () => {
    // Build speed and steer with handbrake
    const driftInput: InputState = { ...blankInput, throttle: 0.8, steering: 1.0, handbrake: true };
    for (let i = 0; i < 30; i++) {
      vehicle.update(1 / 60, driftInput);
    }
    expect(vehicle.state.driftFactor).toBeGreaterThan(0.1);
  });

  it('cycles camera modes properly and maintains distinct offsets', () => {
    const cameraController = new CameraController('high-chase');
    expect(cameraController.currentMode).toBe('high-chase');

    expect(cameraController.toggleMode()).toBe('low-chase');
    expect(cameraController.toggleMode()).toBe('top-down');
    expect(cameraController.toggleMode()).toBe('high-chase');
  });

  it('enforces arena boundary limits and bounces back', () => {
    // Place vehicle outside boundary (boundaryLimit = 5000)
    vehicle.state.position.set(5010, 0, 0);
    vehicle.state.velocity.set(20, 0, 0);
    vehicle.update(1 / 60, blankInput);

    expect(vehicle.state.position.x).toBeLessThanOrEqual(DEFAULT_VEHICLE_CONFIG.boundaryLimit);
    expect(vehicle.state.velocity.x).toBeLessThan(0); // Bounced backward
  });

  it('boostMultiplier increases top speed and acceleration beyond standard limit', () => {
    // Standard vehicle reaches ~180 km/h (50 m/s) with 1000m boundary limit
    const config = { ...DEFAULT_VEHICLE_CONFIG, boundaryLimit: 1000 };
    const normalInput: InputState = { ...blankInput, throttle: 1.0 };
    const standardVehicle = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0, config);
    standardVehicle.state.velocity.set(0, 0, -49); // near top speed (~176.4 km/h)
    for (let i = 0; i < 60; i++) {
      standardVehicle.update(1 / 60, normalInput);
    }
    expect(standardVehicle.state.speedKmh).toBeLessThanOrEqual(180.5);

    // Boosted vehicle (1.10x boost) exceeds 180 km/h and reaches ~195+ km/h
    const boostedVehicle = new VehiclePhysics(new THREE.Vector3(0, 0, 0), 0, config);
    boostedVehicle.state.velocity.set(0, 0, -49);
    for (let i = 0; i < 60; i++) {
      boostedVehicle.update(1 / 60, normalInput, { grip: 1.0, drag: 1.0 }, 1.10);
    }
    expect(boostedVehicle.state.speedKmh).toBeGreaterThan(188);
  });
});

describe('Easier bends for the player (owner, after R7)', () => {
  const NO_INPUT: InputState = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
    cameraToggleRequested: false,
    trackToggleRequested: false,
    tireSelectRequested: null,
    audioToggleRequested: false,
    restartRequested: false,
    standingsToggleRequested: false,
    ghostToggleRequested: false,
    pauseToggleRequested: false
  };
  it('gives the player\'s car 20% more grip in bends than the AI\'s car, and nothing else', () => {
    expect(PLAYER_VEHICLE_CONFIG.maxCorneringAccel).toBeCloseTo(DEFAULT_VEHICLE_CONFIG.maxCorneringAccel * 1.2, 5);
    expect({ ...PLAYER_VEHICLE_CONFIG, maxCorneringAccel: 0 }).toEqual({ ...DEFAULT_VEHICLE_CONFIG, maxCorneringAccel: 0 });
  });

  it('lets the player turn tighter at speed than the AI car', () => {
    const turned = (config: typeof DEFAULT_VEHICLE_CONFIG): number => {
      const car = new VehiclePhysics(new THREE.Vector3(), 0, config);
      for (let i = 0; i < 60; i++) {
        car.state.velocity.set(-Math.sin(car.state.heading) * 38, 0, -Math.cos(car.state.heading) * 38);
        car.update(1 / 60, { ...NO_INPUT, throttle: 1, steering: 1 });
      }
      return Math.abs(car.state.heading);
    };
    expect(turned(PLAYER_VEHICLE_CONFIG) / turned(DEFAULT_VEHICLE_CONFIG)).toBeGreaterThan(1.12);
  });
});
