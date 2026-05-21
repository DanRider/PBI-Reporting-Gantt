import { describe, it, expect } from 'vitest';
import {
  clamp,
  ROW_HEIGHT,
  BODY_FONT_SIZE,
  DECIMALS,
  DECIMALS_INTERNAL,
  FY_START_MONTH,
} from './clamp';

const range = { min: 10, max: 30, default: 20 };

describe('clamp', () => {
  it('returns min when value below min', () => {
    expect(clamp(5, range)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(10, range)).toBe(10);
  });

  it('passes through values strictly inside range', () => {
    expect(clamp(25, range)).toBe(25);
  });

  it('returns max when value equals max', () => {
    expect(clamp(30, range)).toBe(30);
  });

  it('returns max when value above max', () => {
    expect(clamp(100, range)).toBe(30);
  });

  it('returns default when value is undefined', () => {
    expect(clamp(undefined, range)).toBe(20);
  });

  it('returns default when value is null', () => {
    expect(clamp(null, range)).toBe(20);
  });

  it('returns default when value is NaN', () => {
    expect(clamp(NaN, range)).toBe(20);
  });

  it('returns default when value is positive Infinity', () => {
    expect(clamp(Infinity, range)).toBe(20);
  });

  it('returns default when value is negative Infinity', () => {
    expect(clamp(-Infinity, range)).toBe(20);
  });

  it('returns default for non-numeric string input', () => {
    expect(clamp('25', range)).toBe(20);
  });

  it('returns default for boolean input', () => {
    expect(clamp(true, range)).toBe(20);
  });

  it('returns default for Date input', () => {
    expect(clamp(new Date(), range)).toBe(20);
  });

  it('preserves fractional values inside range (caller floors when needed)', () => {
    expect(clamp(15.7, range)).toBeCloseTo(15.7);
  });
});

describe('clamp Range constants', () => {
  it('ROW_HEIGHT spec', () => {
    expect(ROW_HEIGHT).toEqual({ min: 16, max: 60, default: 24 });
  });

  it('BODY_FONT_SIZE spec', () => {
    expect(BODY_FONT_SIZE).toEqual({ min: 8, max: 32, default: 13 });
  });

  it('DECIMALS spec', () => {
    expect(DECIMALS).toEqual({ min: 0, max: 4, default: 0 });
  });

  it('DECIMALS_INTERNAL spec', () => {
    expect(DECIMALS_INTERNAL).toEqual({ min: 0, max: 6, default: 0 });
  });

  it('FY_START_MONTH spec', () => {
    expect(FY_START_MONTH).toEqual({ min: 1, max: 12, default: 1 });
  });
});
