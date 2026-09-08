import { describe, expect, it } from 'vitest';
import { DAY_CYCLE, DAY_CYCLE_SECONDS, sampleDayCycle } from './day-cycle';

describe('race day/night cycle', () => {
  it('starts with five full minutes of daylight and repeats after nine minutes thirty seconds', () => {
    expect(DAY_CYCLE).toEqual({ day: 300, sunset: 45, night: 180, sunrise: 45 });
    expect(DAY_CYCLE_SECONDS).toBe(570);
    expect(sampleDayCycle(0)).toMatchObject({ phase: 'day', day: 1, night: 0 });
    expect(sampleDayCycle(299.999)).toMatchObject({ phase: 'day', night: 0 });
    expect(sampleDayCycle(570)).toEqual(sampleDayCycle(0));
    expect(sampleDayCycle(570 * 300 + 322.5)).toEqual(sampleDayCycle(322.5));
  });

  it('uses the requested sunset, night and sunrise boundaries', () => {
    expect(sampleDayCycle(300)).toMatchObject({ phase: 'sunset', progress: 0, night: 0 });
    expect(sampleDayCycle(345)).toMatchObject({ phase: 'night', progress: 0, night: 1 });
    expect(sampleDayCycle(524.999)).toMatchObject({ phase: 'night', night: 1 });
    expect(sampleDayCycle(525)).toMatchObject({ phase: 'sunrise', progress: 0, night: 1 });
    expect(sampleDayCycle(322.5)).toMatchObject({ phase: 'sunset', day: 0.5, night: 0.5, twilight: 1 });
    expect(sampleDayCycle(547.5)).toMatchObject({ phase: 'sunrise', day: 0.5, night: 0.5, twilight: 1 });
  });

  it('has continuous factors and zero transition slope at phase boundaries', () => {
    const epsilon = 0.001;
    for (const boundary of [300, 345, 525, 570]) {
      const before = sampleDayCycle(boundary - epsilon);
      const after = sampleDayCycle(boundary + epsilon);
      for (const key of ['day', 'night', 'twilight']) {
        expect(Math.abs(after[key] - before[key])).toBeLessThan(1e-7);
        expect(Math.abs(after[key] - sampleDayCycle(boundary)[key]) / epsilon).toBeLessThan(1e-4);
      }
    }
  });

  it('stays bounded and complementary throughout the loop', () => {
    const target = {};
    for (let time = 0; time <= DAY_CYCLE_SECONDS; time += 0.37) {
      sampleDayCycle(time, target);
      for (const key of ['day', 'night', 'twilight', 'progress']) {
        expect(target[key]).toBeGreaterThanOrEqual(0);
        expect(target[key]).toBeLessThanOrEqual(1);
      }
      expect(target.day + target.night).toBeCloseTo(1, 12);
    }
  });

  it('reuses a target and has no accumulated clock state across pause, restart or seeks', () => {
    const target = { phase: 'old' };
    expect(sampleDayCycle(400, target)).toBe(target);
    const paused = { ...target };
    expect(sampleDayCycle(400, target)).toEqual(paused);
    expect(sampleDayCycle(0, target)).toEqual(sampleDayCycle(0));
    expect(sampleDayCycle(547.5, target)).toEqual(sampleDayCycle(547.5));
  });

  it('treats invalid and negative elapsed time as a new daytime run', () => {
    for (const time of [-20, NaN, Infinity, -Infinity, undefined, null, '400']) {
      expect(sampleDayCycle(time)).toEqual(sampleDayCycle(0));
    }
  });
});
