import { describe, it, expect } from 'vitest';

import { periodSpec } from './periodSpec';
import { source } from './__fixtures__/matrix';

const SALES = source({ displayName: 'Sales' });
const BUDGET = source({ displayName: 'Budget' });
const FORECAST = source({ displayName: 'Forecast' });

describe('periodSpec — single-source AvA (priorYear)', () => {
  it('mtd with prior-year on renders current + prior on the one source', () => {
    const spec = periodSpec('mtd', 'priorYear', [0], [0], [SALES], true);
    expect(spec.sourceIdxs).toEqual([0]);
    expect(spec.variantsBySource.get(0)).toEqual(['current', 'prior']);
  });

  it('mtd with prior-year off renders current only', () => {
    const spec = periodSpec('mtd', 'priorYear', [0], [0], [SALES], false);
    expect(spec.variantsBySource.get(0)).toEqual(['current']);
  });

  it('qtd and ytd behave the same as mtd for a single source', () => {
    for (const p of ['qtd', 'ytd'] as const) {
      const spec = periodSpec(p, 'priorYear', [0], [0], [SALES], true);
      expect(spec.variantsBySource.get(0)).toEqual(['current', 'prior']);
    }
  });

  it('undefined mode defaults to the single-source pairing', () => {
    const spec = periodSpec('ytd', undefined, [0], [0], [SALES], false);
    expect(spec.sourceIdxs).toEqual([0]);
    expect(spec.variantsBySource.get(0)).toEqual(['current']);
  });
});

describe('periodSpec — paired modes, non-FY periods use the base pair', () => {
  it('BvA mtd renders both base sources current', () => {
    const spec = periodSpec('mtd', 'budget', [0, 1], [0, 1], [SALES, BUDGET], true);
    expect(spec.sourceIdxs).toEqual([0, 1]);
    expect(spec.variantsBySource.get(0)).toEqual(['current']);
    expect(spec.variantsBySource.get(1)).toEqual(['current']);
  });

  it('FvA qtd renders both base sources current', () => {
    const spec = periodSpec('qtd', 'forecast', [0, 1], [0, 1], [SALES, FORECAST], true);
    expect(spec.variantsBySource.get(0)).toEqual(['current']);
    expect(spec.variantsBySource.get(1)).toEqual(['current']);
  });

  it('FvF ytd renders both base sources current', () => {
    const fA = source({ displayName: 'Forecast Mar' });
    const fB = source({ displayName: 'Forecast Sep' });
    const spec = periodSpec('ytd', 'forecastVsForecast', [1, 2], [0, 1, 2], [SALES, fA, fB], true);
    expect(spec.sourceIdxs).toEqual([1, 2]);
    expect(spec.variantsBySource.get(1)).toEqual(['current']);
    expect(spec.variantsBySource.get(2)).toEqual(['current']);
  });

  it('an ad-hoc two-source non-paired binding pairs current then prior', () => {
    // mode undefined but two base sources → first current, second prior.
    const spec = periodSpec('mtd', undefined, [0, 1], [0, 1], [SALES, SALES], true);
    expect(spec.variantsBySource.get(0)).toEqual(['current']);
    expect(spec.variantsBySource.get(1)).toEqual(['prior']);
  });
});

describe('periodSpec — FY paired-mode override', () => {
  it('BvA FY locks Forecast LEFT, Budget RIGHT when both bound', () => {
    const spec = periodSpec('fy', 'budget', [0, 1], [0, 1, 2], [SALES, BUDGET, FORECAST], true);
    expect(spec.sourceIdxs).toEqual([2, 1]); // forecastIdx=2 left, budgetIdx=1 right
    expect(spec.variantsBySource.get(2)).toEqual(['current']);
    expect(spec.variantsBySource.get(1)).toEqual(['current']);
  });

  it('FvA FY also locks Forecast LEFT, Budget RIGHT when both bound', () => {
    const spec = periodSpec('fy', 'forecast', [0, 2], [0, 1, 2], [SALES, BUDGET, FORECAST], true);
    expect(spec.sourceIdxs).toEqual([2, 1]);
  });

  it('BvA FY with no forecast falls back to Budget vs prior-year Actual', () => {
    const spec = periodSpec('fy', 'budget', [0, 1], [0, 1], [SALES, BUDGET], true);
    expect(spec.sourceIdxs).toEqual([1, 0]); // budget current, actual prior
    expect(spec.variantsBySource.get(1)).toEqual(['current']);
    expect(spec.variantsBySource.get(0)).toEqual(['prior']);
  });

  it('FvA FY with no budget falls back to Forecast vs prior-year Actual', () => {
    const spec = periodSpec('fy', 'forecast', [0, 1], [0, 1], [SALES, FORECAST], true);
    expect(spec.sourceIdxs).toEqual([1, 0]); // forecast current, actual prior
    expect(spec.variantsBySource.get(1)).toEqual(['current']);
    expect(spec.variantsBySource.get(0)).toEqual(['prior']);
  });

  it('FY in AvA is NOT overridden — it uses the single-source default', () => {
    const spec = periodSpec('fy', 'priorYear', [0], [0], [SALES], true);
    expect(spec.sourceIdxs).toEqual([0]);
    expect(spec.variantsBySource.get(0)).toEqual(['current', 'prior']);
  });

  it('FY in FvF is NOT overridden — it uses the base pair', () => {
    const fA = source({ displayName: 'Forecast Mar' });
    const fB = source({ displayName: 'Forecast Sep' });
    const spec = periodSpec('fy', 'forecastVsForecast', [1, 2], [0, 1, 2], [SALES, fA, fB], true);
    expect(spec.sourceIdxs).toEqual([1, 2]);
    expect(spec.variantsBySource.get(1)).toEqual(['current']);
    expect(spec.variantsBySource.get(2)).toEqual(['current']);
  });
});
