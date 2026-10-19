import { describe, expect, it } from 'vitest';
import { CARS } from './garage';
import { GARAGE_STATS, compareCarStats } from './garage-comparison';

const fullBuild = { engine: 3, handling: 3, nitro: 3 };
const byId = rows => Object.fromEntries(rows.map(row => [row.id, row]));

describe('garage vehicle comparison', () => {
  it('compares a stock candidate against the selected car with its installed upgrades', () => {
    const rows = byId(compareCarStats('formula', {}, 'default', fullBuild));
    expect(rows.cruiseSpeed).toMatchObject({ value: 122, selectedValue: 122, difference: 0, relation: 'equal' });
    expect(rows.boostSpeed).toMatchObject({ value: 210, selectedValue: 215, difference: -5, relation: 'worse' });
    expect(rows.acceleration).toMatchObject({ value: 2.65, selectedValue: 2.6, difference: 0.05, relation: 'better' });
    expect(rows.steeringRate).toMatchObject({ value: 16.2, selectedValue: 17.4, difference: -1.2, relation: 'worse' });
    expect(rows.maxNitro).toMatchObject({ value: 85, selectedValue: 145, difference: -60, relation: 'worse' });
    expect(rows.nitroRegenRate).toMatchObject({ value: 4, selectedValue: 7.25, difference: -3.25, relation: 'worse' });
  });

  it('includes the inspected car upgrades and reverses the comparison when the selected car changes', () => {
    const forward = compareCarStats('rally', { engine: 1, handling: 2, nitro: 1 }, 'street', { nitro: 2 });
    const reverse = compareCarStats('street', { nitro: 2 }, 'rally', { engine: 1, handling: 2, nitro: 1 });
    expect(byId(forward).steeringRate).toMatchObject({ value: 18.1, selectedValue: 14.5, difference: 3.6, relation: 'better' });
    expect(byId(forward).maxNitro).toMatchObject({ value: 110, selectedValue: 145, difference: -35, relation: 'worse' });
    for (let index = 0; index < forward.length; index++) {
      expect(reverse[index].value).toBe(forward[index].selectedValue);
      expect(reverse[index].selectedValue).toBe(forward[index].value);
      expect(reverse[index].difference).toBe(-forward[index].difference);
      expect(reverse[index].relation).toBe(forward[index].relation === 'better' ? 'worse' : 'better');
    }
  });

  it('reports identical tuned cars as equal without floating point residue or signed zero', () => {
    for (const car of CARS) {
      const rows = compareCarStats(car.id, fullBuild, car.id, fullBuild);
      expect(rows).toHaveLength(6);
      for (const row of rows) {
        expect(row.value).toBe(row.selectedValue);
        expect(row.difference).toBe(0);
        expect(Object.is(row.difference, -0)).toBe(false);
        expect(row.relation).toBe('equal');
      }
    }
  });

  it('keeps one common bar scale that accommodates every car at every legal upgrade stage', () => {
    expect(Object.fromEntries(GARAGE_STATS.map(row => [row.id, row.max]))).toEqual({
      cruiseSpeed: 134,
      boostSpeed: 225,
      acceleration: 3.25,
      steeringRate: 18.9,
      maxNitro: 170,
      nitroRegenRate: 8.25,
    });
    for (const car of CARS) {
      for (let stage = 0; stage <= 3; stage++) {
        for (const row of compareCarStats(car.id, { engine: stage, handling: stage, nitro: stage }, 'default', {})) {
          expect(row.value).toBeGreaterThan(0);
          expect(row.value).toBeLessThanOrEqual(row.max);
          expect(row.selectedValue).toBeLessThanOrEqual(row.max);
        }
      }
    }
  });

  it('uses gameplay scales instead of claiming physical speed, weight or drift measurements', () => {
    expect(GARAGE_STATS.filter(row => row.unit === 'game units').map(row => row.id)).toEqual(['cruiseSpeed', 'boostSpeed']);
    expect(byId(GARAGE_STATS).nitroRegenRate.unit).toBe('units/s');
    expect(GARAGE_STATS.some(row => ['weight', 'drift'].includes(row.id))).toBe(false);
  });
});
