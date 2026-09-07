import { describe, it, expect } from 'vitest';
import { calculateFinalScore, collisionWithPlayer, damp, isTrafficPlacementSafe, sweptOverlap } from './gameplay.js';

const traffic = (lane, z = -200, ownSpeed = 50) => ({
  id: `car-${lane}`, lane, targetLane: lane, x: lane * 4.5, z,
  ownSpeed, type: 'sedan', isChanging: false,
});

describe('final score rules', () => {
  it('floors classic score without applying the challenge multiplier', () => {
    expect(calculateFinalScore(1234.9, 'classic', true)).toBe(1234);
    expect(calculateFinalScore(0)).toBe(0);
  });

  it('doubles the raw score before rounding only after the level-five unlock', () => {
    expect(calculateFinalScore(1234.9, 'doubleOrNothing', true)).toBe(2469);
    expect(calculateFinalScore(1234.9, 'doubleOrNothing', false)).toBe(0);
  });

  it('never persists invalid, negative or overflowing scores', () => {
    for (const value of [NaN, Infinity, -Infinity, -1, undefined, '100']) {
      expect(calculateFinalScore(value, 'classic')).toBe(0);
    }
    expect(calculateFinalScore(Number.MAX_VALUE, 'doubleOrNothing', true)).toBe(0);
  });
});

describe('continuous collision detection', () => {
  it('catches an object that crosses the player completely between frames', () => {
    expect(sweptOverlap(0, -30, 0, 30, 2, 6)).toBe(true);
  });

  it('leaves room for a clean pass and catches simultaneous lateral movement', () => {
    expect(sweptOverlap(4.5, -30, 4.5, 30, 2.6, 6)).toBe(false);
    expect(sweptOverlap(-4, -10, 4, 10, 2.6, 6)).toBe(true);
    expect(sweptOverlap(4.5, 0, 4.5, 0, 2.6, 6)).toBe(false);
  });

  it('uses truck dimensions and the actual moving player position', () => {
    const truck = { ...traffic(0, -12), type: 'truck' };
    expect(collisionWithPlayer(truck, { ...truck, z: 12 }, -4.5, 0)).toBe(true);
    expect(collisionWithPlayer(truck, { ...truck, z: 12 }, -4.5, -4.5)).toBe(false);
  });
});

describe('traffic route reservations', () => {
  it('rejects a three-lane wall but permits traffic with an escape lane', () => {
    expect(isTrafficPlacementSafe(traffic(1), [traffic(-1), traffic(0)])).toBe(false);
    expect(isTrafficPlacementSafe(traffic(0), [traffic(-1)])).toBe(true);
  });

  it('rejects a future wall formed by vehicles with different speeds', () => {
    expect(isTrafficPlacementSafe(traffic(1, -302), [traffic(-1, -352, 40), traffic(0, -252, 60)])).toBe(false);
  });

  it('reserves both lanes during a signaled lane change', () => {
    const turning = { ...traffic(-1), targetLane: 0, indicator: 1 };
    expect(isTrafficPlacementSafe(turning, [traffic(1)])).toBe(false);
    expect(isTrafficPlacementSafe(traffic(0, -220), [turning])).toBe(false);
  });

  it('enforces longitudinal separation without treating passed cars as walls', () => {
    expect(isTrafficPlacementSafe(traffic(0), [{ ...traffic(0, -180), id: 'other' }])).toBe(false);
    expect(isTrafficPlacementSafe(traffic(1), [traffic(-1, 30), traffic(0, 30)])).toBe(true);
  });
});

it('exponential steering damping is independent of subdivision', () => {
  const oneStep = damp(0, 4.5, 12, 0.1);
  let manySteps = 0;
  for (let i = 0; i < 10; i++) manySteps = damp(manySteps, 4.5, 12, 0.01);
  expect(manySteps).toBeCloseTo(oneStep, 12);
});
