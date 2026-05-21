import { describe, it, expect } from 'vitest';

import { classifySource, filterSourcesByMode } from './sourceKinds';
import { source } from './__fixtures__/matrix';

describe('classifySource — name pattern matching', () => {
  it('an unmatched name is an actual', () => {
    expect(classifySource(source({ displayName: 'Sales' }))).toBe('actual');
  });

  it('a name containing "budget" is a budget', () => {
    expect(classifySource(source({ displayName: 'Budget' }))).toBe('budget');
    expect(classifySource(source({ displayName: 'Annual Budget' }))).toBe('budget');
  });

  it('a name containing "forecast" is a forecast', () => {
    expect(classifySource(source({ displayName: 'Forecast' }))).toBe('forecast');
  });

  it('"fcst" and "plan" are forecast synonyms', () => {
    expect(classifySource(source({ displayName: 'Mar Fcst' }))).toBe('forecast');
    expect(classifySource(source({ displayName: 'Operating Plan' }))).toBe('forecast');
  });

  it('budget is tested before forecast — "Forecast budget" is a budget', () => {
    expect(classifySource(source({ displayName: 'Forecast budget' }))).toBe('budget');
  });

  it('matching is case-insensitive', () => {
    expect(classifySource(source({ displayName: 'BUDGET' }))).toBe('budget');
    expect(classifySource(source({ displayName: 'ForeCast' }))).toBe('forecast');
  });

  it('queryName takes precedence over displayName', () => {
    expect(
      classifySource(source({ displayName: 'X', queryName: 'Budget.Amount' })),
    ).toBe('budget');
  });

  it('an undefined source is an actual', () => {
    expect(classifySource(undefined)).toBe('actual');
  });
});

describe('filterSourcesByMode — single source passthrough', () => {
  it('one source returns itself for every mode', () => {
    const vs = [source({ displayName: 'Sales' })];
    for (const mode of ['priorYear', 'budget', 'forecast', 'forecastVsForecast'] as const) {
      expect(filterSourcesByMode([0], vs, mode)).toEqual([0]);
    }
  });

  it('an empty input returns empty', () => {
    expect(filterSourcesByMode([], [], 'budget')).toEqual([]);
  });
});

describe('filterSourcesByMode — priorYear (AvA)', () => {
  it('picks the single actual', () => {
    const vs = [source({ displayName: 'Budget' }), source({ displayName: 'Sales' })];
    expect(filterSourcesByMode([0, 1], vs, 'priorYear')).toEqual([1]);
  });

  it('falls back to the first source when no actual is bound', () => {
    const vs = [source({ displayName: 'Budget' }), source({ displayName: 'Forecast' })];
    expect(filterSourcesByMode([0, 1], vs, 'priorYear')).toEqual([0]);
  });

  it('undefined mode behaves like priorYear', () => {
    const vs = [source({ displayName: 'Sales' }), source({ displayName: 'Budget' })];
    expect(filterSourcesByMode([0, 1], vs, undefined)).toEqual([0]);
  });
});

describe('filterSourcesByMode — BvA', () => {
  it('pairs actual then budget', () => {
    const vs = [source({ displayName: 'Sales' }), source({ displayName: 'Budget' })];
    expect(filterSourcesByMode([0, 1], vs, 'budget')).toEqual([0, 1]);
  });

  it('keeps actual-then-budget order regardless of binding order', () => {
    const vs = [source({ displayName: 'Budget' }), source({ displayName: 'Sales' })];
    expect(filterSourcesByMode([0, 1], vs, 'budget')).toEqual([1, 0]);
  });

  it('falls back to the first two sources when budget is not bound', () => {
    const vs = [source({ displayName: 'Sales' }), source({ displayName: 'Forecast' })];
    expect(filterSourcesByMode([0, 1], vs, 'budget')).toEqual([0, 1]);
  });
});

describe('filterSourcesByMode — FvA', () => {
  it('pairs actual then forecast', () => {
    const vs = [source({ displayName: 'Sales' }), source({ displayName: 'Forecast' })];
    expect(filterSourcesByMode([0, 1], vs, 'forecast')).toEqual([0, 1]);
  });

  it('falls back to the first two sources when forecast is not bound', () => {
    const vs = [source({ displayName: 'Sales' }), source({ displayName: 'Budget' })];
    expect(filterSourcesByMode([0, 1], vs, 'forecast')).toEqual([0, 1]);
  });
});

describe('filterSourcesByMode — FvF', () => {
  it('picks the two forecasts', () => {
    const vs = [
      source({ displayName: 'Sales' }),
      source({ displayName: 'Forecast Mar' }),
      source({ displayName: 'Forecast Sep' }),
    ];
    expect(filterSourcesByMode([0, 1, 2], vs, 'forecastVsForecast')).toEqual([1, 2]);
  });

  it('falls back to the first two sources with fewer than two forecasts', () => {
    const vs = [source({ displayName: 'Sales' }), source({ displayName: 'Forecast' })];
    expect(filterSourcesByMode([0, 1], vs, 'forecastVsForecast')).toEqual([0, 1]);
  });
});
