import { describe, it, expect } from 'vitest';
import { forecastFor, recommendedTyre, tyreRatings } from '../src/tires/TyreAdvice';
import { ALL_TRACKS } from '../src/track/TrackDefinitions';
import { TIRE_PROFILES } from '../src/tires/TireTypes';
import { ScreenFlow } from '../src/app/ScreenFlow';

describe('Tyre advice (R5 tyre choice)', () => {
  it('forecasts from the track rain chance since R7: the desert always dry, Stormy Summit always wet', () => {
    for (const track of ALL_TRACKS) {
      const forecast = forecastFor(track);
      expect(forecast.label).toBe(forecast.condition === 'wet' ? 'Rain' : 'Dry');
      if (track.rainChance === 0) expect(forecast.condition).toBe('dry');
      if (track.rainChance === 1) expect(forecast.condition).toBe('wet');
    }
  });

  it('recommends Street in the dry and Wet in the rain', () => {
    expect(recommendedTyre({ condition: 'dry', label: 'Dry' })).toBe('street');
    expect(recommendedTyre({ condition: 'wet', label: 'Rain' })).toBe('wet');
  });

  it('rates each compound from its real grip and drag numbers', () => {
    expect(tyreRatings('street')).toEqual({ road: 100, offRoad: 50, wet: 50, speed: 100 });
    expect(tyreRatings('all_terrain')).toEqual({
      road: Math.round(TIRE_PROFILES.all_terrain.dryGrip * 100),
      offRoad: 85,
      wet: 85,
      speed: Math.round(100 / TIRE_PROFILES.all_terrain.dryDragMultiplier)
    });
    // Wet tyres are slowest on a dry road
    expect(tyreRatings('wet').speed).toBeLessThan(tyreRatings('all_terrain').speed);
    expect(tyreRatings('wet').wet).toBeGreaterThan(tyreRatings('street').wet);
  });
});

describe('Grid screen in the screen flow (R5 tyre choice)', () => {
  it('goes hub → grid → racing, and the race only runs once racing', () => {
    const flow = new ScreenFlow('hub');
    expect(flow.go('grid')).toBe(true);
    expect(flow.isSimulating).toBe(false);
    expect(flow.togglePause()).toBe(false); // nothing to pause on the grid
    expect(flow.go('racing')).toBe(true);
    expect(flow.isSimulating).toBe(true);
  });

  it('reaches the grid after qualifying, and the hub from the grid', () => {
    const flow = new ScreenFlow('racing');
    expect(flow.go('grid')).toBe(true); // qualifying lap done
    expect(flow.go('hub')).toBe(true); // "Back to hub"
    expect(flow.go('paused')).toBe(false);
  });
});
