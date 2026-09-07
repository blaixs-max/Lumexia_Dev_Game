import { describe, expect, it } from 'vitest';
import { getSteeringSide } from './touchSteering';

describe('full-surface touch steering', () => {
  it('gives the exact dividing line to the right half without a dead zone', () => {
    const portrait = { left: 0, width: 390 };
    expect(getSteeringSide(194.99, portrait)).toBe('left');
    expect(getSteeringSide(195, portrait)).toBe('right');
    expect(getSteeringSide(195.01, portrait)).toBe('right');
  });

  it('uses the actual inset surface rather than treating clientX as a local coordinate', () => {
    const inset = { left: 36, width: 756 };
    expect(getSteeringSide(400, inset)).toBe('left');
    expect(getSteeringSide(414, inset)).toBe('right');
    expect(getSteeringSide(36, inset)).toBe('left');
    expect(getSteeringSide(792, inset)).toBe('right');
  });

  it('keeps captured fingers steering when they drift past either edge', () => {
    const surface = { left: 20, width: 350 };
    expect(getSteeringSide(-12, surface)).toBe('left');
    expect(getSteeringSide(900, surface)).toBe('right');
  });

  it('uses fresh bounds after orientation changes', () => {
    const clientX = 300;
    expect(getSteeringSide(clientX, { left: 0, width: 390 })).toBe('right');
    expect(getSteeringSide(clientX, { left: 0, width: 844 })).toBe('left');
  });

  it('preserves fractional CSS pixel boundaries without integer rounding', () => {
    const fractional = { left: -0.75, width: 1.5 };
    expect(getSteeringSide(-0.001, fractional)).toBe('left');
    expect(getSteeringSide(0, fractional)).toBe('right');
  });

  it('rejects missing, collapsed, nonfinite, or string geometry instead of steering accidentally', () => {
    for (const rect of [undefined, null, {}, { left: 0, width: 0 }, { left: 0, width: -390 },
      { left: NaN, width: 390 }, { left: Infinity, width: 390 }, { left: 0, width: Infinity },
      { left: 0, width: '390' }, { left: '0', width: 390 }]) {
      expect(getSteeringSide(100, rect)).toBeNull();
    }
    for (const clientX of [undefined, null, NaN, Infinity, -Infinity, '100']) {
      expect(getSteeringSide(clientX, { left: 0, width: 390 })).toBeNull();
    }
  });
});
