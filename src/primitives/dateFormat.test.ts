import { describe, it, expect } from 'vitest';
import { formatDate, coerceToDate } from './dateFormat';

// March 5, 2026 — month index 2. Exercises every token's padded vs
// unpadded form (month 3 -> "03"/"3", day 5 -> "05"/"5", year -> "26").
const D = new Date(2026, 2, 5);

describe('formatDate — DAX token subset', () => {
  it('long month + full year tokens', () => {
    expect(formatDate(D, 'MMMM YYYY')).toBe('March 2026');
  });

  it('short month + two-digit year tokens', () => {
    expect(formatDate(D, 'MMM YY')).toBe('Mar 26');
  });

  it('zero-padded numeric tokens with literal separators', () => {
    expect(formatDate(D, 'MM/DD/YYYY')).toBe('03/05/2026');
  });

  it('unpadded single-char tokens', () => {
    expect(formatDate(D, 'M/D/YY')).toBe('3/5/26');
  });

  it('longest-token-first matching (M, MM, MMM, MMMM all distinct)', () => {
    expect(formatDate(D, 'M MM MMM MMMM')).toBe('3 03 Mar March');
  });

  it('non-token characters pass through verbatim (ISO-ish layout)', () => {
    expect(formatDate(D, 'YYYY-MM-DD')).toBe('2026-03-05');
  });
});

describe('coerceToDate — tolerant primitive coercion', () => {
  it('passes a valid Date instance through', () => {
    const d = new Date(2024, 0, 15);
    expect(coerceToDate(d)).toBe(d);
  });

  it('rejects an Invalid Date', () => {
    expect(coerceToDate(new Date(NaN))).toBeNull();
  });

  it('accepts an epoch-ms number for a plausible year', () => {
    const result = coerceToDate(Date.UTC(2022, 5, 1));
    expect(result).not.toBeNull();
    expect((result as Date).getFullYear()).toBe(2022);
  });

  it('rejects a NaN number', () => {
    expect(coerceToDate(NaN)).toBeNull();
  });

  it('rejects a number resolving before the plausible-year floor', () => {
    expect(coerceToDate(-3_000_000_000_000)).toBeNull();
  });

  it('parses "YYYY Mon" to the first of that month', () => {
    const r = coerceToDate('2020 Jun') as Date;
    expect(r.getFullYear()).toBe(2020);
    expect(r.getMonth()).toBe(5);
    expect(r.getDate()).toBe(1);
  });

  it('parses "Mon YYYY" to the first of that month', () => {
    const r = coerceToDate('June 2019') as Date;
    expect(r.getFullYear()).toBe(2019);
    expect(r.getMonth()).toBe(5);
    expect(r.getDate()).toBe(1);
  });

  it('parses an ISO date string via the Date.parse fallback', () => {
    const r = coerceToDate('2021-03-15') as Date;
    expect(r.getFullYear()).toBe(2021);
    expect(r.getMonth()).toBe(2);
  });

  it('returns null for null, undefined, empty, and unparseable input', () => {
    expect(coerceToDate(null)).toBeNull();
    expect(coerceToDate(undefined)).toBeNull();
    expect(coerceToDate('   ')).toBeNull();
    expect(coerceToDate('not a date')).toBeNull();
  });
});
