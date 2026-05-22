import { describe, it, expect } from 'vitest';

import { periodSum } from '../primitives/timeSeries';
import {
  buildTimeSeries,
  inspectColumnLeaves,
  rowKeyForNode,
} from './buildTimeSeries';
import {
  dateBucket,
  dateGroup,
  matrix,
  matrixWithRows,
  rowGroup,
  rowLeaf,
  root,
  source,
} from './__fixtures__/matrix';

const SEP = '';

// coerceToDate parses ISO strings as UTC midnight, which shifts back a day
// (hence a month, at a month boundary) in a negative-offset zone. Fixtures
// pass real local-time Date objects so the bucket month is unambiguous.
function d(year: number, month1: number): Date {
  return new Date(year, month1 - 1, 1);
}

describe('rowKeyForNode — stable hierarchy path', () => {
  it('joins ancestor then node values with the unit separator', () => {
    const usa = { value: 'USA' } as never;
    const east = { value: 'Sales East' } as never;
    expect(rowKeyForNode(east, [usa])).toBe(`USA${SEP}Sales East`);
  });

  it('a top-level node with no ancestors keys to its own value', () => {
    expect(rowKeyForNode({ value: 'USA' } as never, [])).toBe('USA');
  });

  it('skips null-valued ancestor segments', () => {
    const blank = { value: null } as never;
    const leaf = { value: 'Leaf' } as never;
    expect(rowKeyForNode(leaf, [blank])).toBe('Leaf');
  });

  it('round-trips: same node + ancestors produce the same key', () => {
    const a = { value: 'A' } as never;
    const b = { value: 'B' } as never;
    expect(rowKeyForNode(b, [a])).toBe(rowKeyForNode(b, [a]));
  });
});

describe('inspectColumnLeaves — shape folding', () => {
  it('depth-1: each level-0 child is a leaf at source 0', () => {
    const m = matrix(root([dateBucket(d(2026, 1)), dateBucket(d(2026, 2))]), [
      source({ displayName: 'Sales' }),
    ]);
    const desc = inspectColumnLeaves(m)!;
    expect(desc).toHaveLength(2);
    expect(desc.map((x) => x.leafIdx)).toEqual([0, 1]);
    expect(desc.every((x) => x.sourceIdx === 0)).toBe(true);
    expect(desc[0].date.getFullYear()).toBe(2026);
  });

  it('depth-2: each bucket fans out to its measure leaves with source idx', () => {
    const m = matrix(
      root([dateGroup(d(2026, 1), [0, 1]), dateGroup(d(2026, 2), [0, 1])]),
      [source({ displayName: 'Sales' }), source({ displayName: 'Budget' })],
    );
    const desc = inspectColumnLeaves(m)!;
    expect(desc).toHaveLength(4);
    expect(desc.map((x) => x.sourceIdx)).toEqual([0, 1, 0, 1]);
    expect(desc.map((x) => x.leafIdx)).toEqual([0, 1, 2, 3]);
  });

  it('returns null when a level-0 child is not date-coercible', () => {
    const m = matrix(root([dateBucket('not-a-date')]), [source({ displayName: 'S' })]);
    expect(inspectColumnLeaves(m)).toBeNull();
  });

  it('returns null when the column root has no children', () => {
    const m = matrix(root([]), [source({ displayName: 'S' })]);
    expect(inspectColumnLeaves(m)).toBeNull();
  });
});

describe('buildTimeSeries — depth-1 single measure', () => {
  it('builds a per-row series and answers a YTD sum', () => {
    const m = matrixWithRows(
      root([dateBucket(d(2026, 1)), dateBucket(d(2026, 2)), dateBucket(d(2026, 3))]),
      [source({ displayName: 'Sales', format: '$#,##0' })],
      [rowLeaf('USA', { 0: 100, 1: 200, 2: 300 })],
    );
    const ts = buildTimeSeries(m, { reportingDateOverride: new Date(2026, 2, 1) })!;
    expect(ts).not.toBeNull();
    expect(ts.kind).toBe('date-bucketed');
    expect(periodSum(ts, 'USA', 'ytd')).toBe(600);
  });

  it('reportingDate defaults to the latest bound bucket', () => {
    const m = matrixWithRows(
      root([dateBucket(d(2026, 1)), dateBucket(d(2026, 5))]),
      [source({ displayName: 'S' })],
      [rowLeaf('R', { 0: 10, 1: 20 })],
    );
    const ts = buildTimeSeries(m)!;
    expect(ts.reportingDate.getMonth()).toBe(4);
  });

  it('omits a row whose cells are all non-numeric', () => {
    const m = matrixWithRows(
      root([dateBucket(d(2026, 1))]),
      [source({ displayName: 'S' })],
      [rowLeaf('Empty', {})],
    );
    const ts = buildTimeSeries(m)!;
    expect(ts.series.has('Empty')).toBe(false);
  });
});

describe('buildTimeSeries — depth-2 multi measure', () => {
  it('extracts only the requested source index', () => {
    const m = matrixWithRows(
      root([dateGroup(d(2026, 1), [0, 1]), dateGroup(d(2026, 2), [0, 1])]),
      [source({ displayName: 'Sales' }), source({ displayName: 'Budget' })],
      // leafIdx layout: 0=Jan/Sales 1=Jan/Budget 2=Feb/Sales 3=Feb/Budget
      [rowLeaf('USA', { 0: 100, 1: 90, 2: 110, 3: 95 })],
    );
    const sales = buildTimeSeries(m, { sourceIdx: 0, reportingDateOverride: new Date(2026, 1, 1) })!;
    const budget = buildTimeSeries(m, { sourceIdx: 1, reportingDateOverride: new Date(2026, 1, 1) })!;
    expect(periodSum(sales, 'USA', 'ytd')).toBe(210);
    expect(periodSum(budget, 'USA', 'ytd')).toBe(185);
  });

  it('depth-1 and depth-2 of the same data produce identical sums', () => {
    const d1 = buildTimeSeries(
      matrixWithRows(
        root([dateBucket(d(2026, 1)), dateBucket(d(2026, 2))]),
        [source({ displayName: 'S' })],
        [rowLeaf('R', { 0: 5, 1: 7 })],
      ),
      { reportingDateOverride: new Date(2026, 1, 1) },
    )!;
    const d2 = buildTimeSeries(
      matrixWithRows(
        root([dateGroup(d(2026, 1), [0]), dateGroup(d(2026, 2), [0])]),
        [source({ displayName: 'S' })],
        [rowLeaf('R', { 0: 5, 1: 7 })],
      ),
      { reportingDateOverride: new Date(2026, 1, 1) },
    )!;
    expect(periodSum(d1, 'R', 'ytd')).toBe(periodSum(d2, 'R', 'ytd'));
  });
});

describe('buildTimeSeries — null and edge returns', () => {
  it('returns null when columns are not date-driven', () => {
    const m = matrixWithRows(
      root([dateBucket('Sales')]),
      [source({ displayName: 'S' })],
      [rowLeaf('R', { 0: 1 })],
    );
    expect(buildTimeSeries(m)).toBeNull();
  });

  it('returns null when the requested source has no leaves', () => {
    const m = matrixWithRows(
      root([dateBucket(d(2026, 1), 0)]),
      [source({ displayName: 'S' })],
      [rowLeaf('R', { 0: 1 })],
    );
    expect(buildTimeSeries(m, { sourceIdx: 9 })).toBeNull();
  });

  it('date-driven columns with no rows still return a series (empty map)', () => {
    const m = matrix(root([dateBucket(d(2026, 1))]), [source({ displayName: 'S' })]);
    const ts = buildTimeSeries(m)!;
    expect(ts).not.toBeNull();
    expect(ts.series.size).toBe(0);
  });

  it('nested row groups key children by their full path', () => {
    const m = matrixWithRows(
      root([dateBucket(d(2026, 1))]),
      [source({ displayName: 'S' })],
      [rowGroup('USA', [rowLeaf('East', { 0: 50 })])],
    );
    const ts = buildTimeSeries(m)!;
    expect(ts.series.has(`USA${SEP}East`)).toBe(true);
  });
});
