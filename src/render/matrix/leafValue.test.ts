import { describe, it, expect } from 'vitest';

import { resolveLeafValue, type ValuesBag } from './leafValue';
import { leaf } from './__fixtures__/tree';

function bag(cells: Record<number, number | string | null>): ValuesBag {
  const out: ValuesBag = {};
  for (const k of Object.keys(cells)) {
    out[Number(k)] = { value: cells[Number(k)] } as ValuesBag[number];
  }
  return out;
}

describe('resolveLeafValue — branch 4: a plain leaf reads its own index', () => {
  it('returns the indexed number', () => {
    const l = leaf({ label: 'Sales', leafIndex: 2 });
    expect(resolveLeafValue(l, bag({ 2: 410 }))).toBe(410);
  });

  it('a non-number slot reads as null', () => {
    const l = leaf({ label: 'Sales', leafIndex: 0 });
    expect(resolveLeafValue(l, bag({ 0: 'n/a' }))).toBeNull();
  });
});

describe('resolveLeafValue — branch 1: period synthesis sums its source indices', () => {
  it('sums the in-window buckets', () => {
    const l = leaf({ label: 'YTD', isPeriodSynthesis: 'ytd', periodSourceIdxs: [0, 1, 2] });
    expect(resolveLeafValue(l, bag({ 0: 100, 1: 200, 2: 300 }))).toBe(600);
  });

  it('an all-empty window is null, not zero', () => {
    const l = leaf({ label: 'YTD', isPeriodSynthesis: 'ytd', periodSourceIdxs: [5, 6] });
    expect(resolveLeafValue(l, bag({ 0: 1 }))).toBeNull();
  });
});

describe('resolveLeafValue — branch 3: delta over two real leaves', () => {
  it('delta subtracts the paired indices', () => {
    const l = leaf({
      label: 'Δ',
      isSynthetic: 'delta',
      syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 1 },
    });
    expect(resolveLeafValue(l, bag({ 0: 500, 1: 350 }))).toBe(150);
  });

  it('deltaPct divides the difference by the prior', () => {
    const l = leaf({
      label: '%Δ',
      isSynthetic: 'deltaPct',
      syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 1 },
    });
    expect(resolveLeafValue(l, bag({ 0: 150, 1: 100 }))).toBeCloseTo(0.5);
  });

  it('deltaPct guards a zero prior with null', () => {
    const l = leaf({
      label: '%Δ',
      isSynthetic: 'deltaPct',
      syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 1 },
    });
    expect(resolveLeafValue(l, bag({ 0: 150, 1: 0 }))).toBeNull();
  });

  it('a missing side yields null', () => {
    const l = leaf({
      label: 'Δ',
      isSynthetic: 'delta',
      syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 9 },
    });
    expect(resolveLeafValue(l, bag({ 0: 500 }))).toBeNull();
  });
});

describe('resolveLeafValue — branch 2: delta over two period synthetics', () => {
  it('sums each side then subtracts (periodSourcePair wins over syntheticPair)', () => {
    const l = leaf({
      label: 'Δ',
      isSynthetic: 'delta',
      periodSourcePair: { currentLeafIdxs: [0, 1], priorLeafIdxs: [2, 3] },
      syntheticPair: { currentLeafIdx: -1, priorLeafIdx: -1 },
    });
    expect(resolveLeafValue(l, bag({ 0: 100, 1: 100, 2: 60, 3: 40 }))).toBe(100);
  });

  it('deltaPct over period pairs divides by the prior sum', () => {
    const l = leaf({
      label: '%Δ',
      isSynthetic: 'deltaPct',
      periodSourcePair: { currentLeafIdxs: [0], priorLeafIdxs: [1] },
    });
    expect(resolveLeafValue(l, bag({ 0: 120, 1: 100 }))).toBeCloseTo(0.2);
  });

  it('an empty prior side yields null', () => {
    const l = leaf({
      label: 'Δ',
      isSynthetic: 'delta',
      periodSourcePair: { currentLeafIdxs: [0], priorLeafIdxs: [7] },
    });
    expect(resolveLeafValue(l, bag({ 0: 50 }))).toBeNull();
  });
});
