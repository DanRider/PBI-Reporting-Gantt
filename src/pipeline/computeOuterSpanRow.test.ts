import { describe, it, expect } from 'vitest';

import type { ColumnLeaf, ColumnTree } from '../model/columnTree';
import { computeOuterSpanRow } from './computeOuterSpanRow';

// Minimal leaf factory — computeOuterSpanRow reads only groupLabel.
function leaf(groupLabel?: string): ColumnLeaf {
  return {
    node: {} as ColumnLeaf['node'],
    leafIndex: 0,
    formatter: () => '',
    defaultLabel: '',
    visible: true,
    groupLabel,
  };
}

function tree(leaves: ColumnLeaf[], levelCount: number): ColumnTree {
  return { levels: Array.from({ length: levelCount }, () => []), leaves };
}

describe('computeOuterSpanRow — position branch', () => {
  it("no leaf has a groupLabel → position 'none', no spans", () => {
    const spec = computeOuterSpanRow(tree([leaf(), leaf()], 1));
    expect(spec.position).toBe('none');
    expect(spec.spans).toEqual([]);
  });

  it("an empty-string groupLabel is treated as no group → 'none'", () => {
    const spec = computeOuterSpanRow(tree([leaf(''), leaf('')], 1));
    expect(spec.position).toBe('none');
  });

  it("single-level header with group labels → position 'top'", () => {
    const spec = computeOuterSpanRow(tree([leaf('A'), leaf('B')], 1));
    expect(spec.position).toBe('top');
  });

  it("two-level header with group labels → position 'belowOuter'", () => {
    const spec = computeOuterSpanRow(tree([leaf('A'), leaf('B')], 2));
    expect(spec.position).toBe('belowOuter');
  });

  it("three-level header → still 'belowOuter'", () => {
    const spec = computeOuterSpanRow(tree([leaf('A')], 3));
    expect(spec.position).toBe('belowOuter');
  });
});

describe('computeOuterSpanRow — adjacent cluster merge', () => {
  it('two adjacent same-label leaves merge into one span of colspan 2', () => {
    const spec = computeOuterSpanRow(tree([leaf('Q1'), leaf('Q1')], 1));
    expect(spec.spans).toEqual([{ label: 'Q1', colspan: 2 }]);
  });

  it('distinct adjacent labels produce separate spans', () => {
    const spec = computeOuterSpanRow(tree([leaf('Q1'), leaf('Q2')], 1));
    expect(spec.spans).toEqual([
      { label: 'Q1', colspan: 1 },
      { label: 'Q2', colspan: 1 },
    ]);
  });

  it('same label split by a different label does NOT merge across the gap', () => {
    const spec = computeOuterSpanRow(tree([leaf('A'), leaf('B'), leaf('A')], 1));
    expect(spec.spans).toEqual([
      { label: 'A', colspan: 1 },
      { label: 'B', colspan: 1 },
      { label: 'A', colspan: 1 },
    ]);
  });

  it('a run of label-less leaves collapses into one empty span', () => {
    const spec = computeOuterSpanRow(tree([leaf('G'), leaf(), leaf()], 1));
    expect(spec.spans).toEqual([
      { label: 'G', colspan: 1 },
      { label: '', colspan: 2 },
    ]);
  });

  it('spans cover every leaf exactly once', () => {
    const spec = computeOuterSpanRow(
      tree([leaf('A'), leaf('A'), leaf('A'), leaf('B')], 1),
    );
    const total = spec.spans.reduce((n, s) => n + s.colspan, 0);
    expect(total).toBe(4);
    expect(spec.spans).toEqual([
      { label: 'A', colspan: 3 },
      { label: 'B', colspan: 1 },
    ]);
  });
});
