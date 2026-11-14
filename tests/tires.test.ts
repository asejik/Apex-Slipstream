import { describe, it, expect } from 'vitest';
import { getTireCompoundGrip, getTireDragMultiplier, TIRE_PROFILES } from '../src/tires/TireTypes';

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
