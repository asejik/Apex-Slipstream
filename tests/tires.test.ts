import { describe, it, expect } from 'vitest';
import { getTireCompoundGrip, getTireDragMultiplier, TIRE_PROFILES, type TireCompound, type WeatherCondition } from '../src/tires/TireTypes';
import { tyreRatings } from '../src/tires/TyreAdvice';
import { VehiclePhysics } from '../src/engine/VehiclePhysics';

describe('Tactical Tire Compounds', () => {
  it('street compound has 100% dry asphalt grip but drops on gravel', () => {
    const dry = getTireCompoundGrip('street', 'asphalt');
    const gravel = getTireCompoundGrip('street', 'gravel');
    expect(dry).toBe(1.0);
    expect(gravel).toBe(0.5);
  });

  it('all-terrain compound maintains high consistency on gravel', () => {
    const dry = getTireCompoundGrip('all_terrain', 'asphalt');
    const gravel = getTireCompoundGrip('all_terrain', 'gravel');
    expect(dry).toBeCloseTo(0.88, 2);
    expect(gravel).toBe(0.85);
    expect(gravel).toBeGreaterThan(getTireCompoundGrip('street', 'gravel'));
  });

  it('wet compound imposes rolling drag penalty on dry asphalt', () => {
    const streetDrag = getTireDragMultiplier('street', 'asphalt');
    const wetDrag = getTireDragMultiplier('wet', 'asphalt');
    expect(wetDrag).toBeGreaterThan(streetDrag);
    expect(wetDrag).toBe(1.10);
  });

  it('profiles define valid display badges and colors', () => {
    for (const compound of ['street', 'all_terrain', 'wet'] as const) {
      const p = TIRE_PROFILES[compound];
      expect(p.badge.length).toBeGreaterThan(0);
      expect(p.colorVar).toContain('var(--color-tire-');
      expect(p.keyShortcut).toMatch(/^[123]$/);
    }
  });
});

describe('Tyres set the top speed on dry tarmac (R10-01)', () => {
  const FULL = { throttle: 1, brake: 0, steering: 0, handbrake: false } as unknown as Parameters<VehiclePhysics['update']>[1];

  /** Top speed in km/h after 40 s flat out on tarmac with `compound` in `weather` */
  function topSpeed(compound: TireCompound, weather: WeatherCondition): number {
    const car = new VehiclePhysics();
    const tyreDrag = getTireDragMultiplier(compound, 'asphalt', weather);
    for (let i = 0; i < 60 * 40; i++) car.update(1 / 60, FULL, { grip: 1, drag: tyreDrag, tyreDrag });
    return car.state.speedKmh;
  }

  it('gives each compound the straight-line speed its rating promises', () => {
    const street = topSpeed('street', 'dry');
    expect(street).toBeCloseTo(180, 0);
    for (const compound of ['all_terrain', 'wet'] as const) {
      expect(Math.round((topSpeed(compound, 'dry') / street) * 100)).toBe(tyreRatings(compound).speed);
    }
    expect(topSpeed('wet', 'dry')).toBeLessThan(topSpeed('all_terrain', 'dry'));
    // A kerb is part of the tarmac: never a faster line
    expect(getTireDragMultiplier('wet', 'curb')).toBe(getTireDragMultiplier('wet', 'asphalt'));
    expect(getTireDragMultiplier('wet', 'gravel')).toBe(1);
  });

  it('holds no compound back on wet tarmac', () => {
    for (const compound of ['street', 'all_terrain', 'wet'] as const) {
      expect(getTireDragMultiplier(compound, 'asphalt', 'wet')).toBe(1);
      expect(topSpeed(compound, 'wet')).toBeCloseTo(180, 0);
    }
  });

  it('a slipstream boost fades once it ends, throttle held (R10-03)', () => {
    const car = new VehiclePhysics();
    for (let i = 0; i < 60 * 40; i++) car.update(1 / 60, FULL, { grip: 1, drag: 1 }, 1.1);
    expect(car.state.speedKmh).toBeGreaterThan(195);
    for (let i = 0; i < 60 * 3; i++) car.update(1 / 60, FULL, { grip: 1, drag: 1 }, 1.0);
    expect(car.state.speedKmh).toBeCloseTo(180, 0);
  });
});
