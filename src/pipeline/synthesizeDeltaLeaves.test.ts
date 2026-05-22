import { describe, it, expect } from 'vitest';

import type { ColumnLeaf, ColumnTree } from '../model/columnTree';
import { EMPTY_TREE } from '../model/pipelineStage';
import { BuildColumnTreeStage } from './buildColumnTree';
import { SynthesizePeriodLeavesStage } from './synthesizePeriodLeaves';
import { SynthesizeDeltaLeavesStage } from './synthesizeDeltaLeaves';
import {
  dateBucket,
  matrixWithRows,
  rowLeaf,
  root,
  source,
  synthOpts,
} from './__fixtures__/matrix';

const build = new BuildColumnTreeStage();
const periodStage = new SynthesizePeriodLeavesStage();
const delta = new SynthesizeDeltaLeavesStage();

function d(year: number, month1: number): Date {
  return new Date(year, month1 - 1, 1);
}

// A 3-month single-measure AvA matrix — period synthesis turns it into
// current+prior pairs the delta stage then clusters.
function avaMatrix() {
  return matrixWithRows(
    root([dateBucket(d(2026, 1)), dateBucket(d(2026, 2)), dateBucket(d(2026, 3))]),
    [source({ displayName: 'Sales', queryName: 'qSales', format: '$#,##0' })],
    [rowLeaf('USA', { 0: 100, 1: 200, 2: 300 })],
  );
}

function fullPipeline(o: ReturnType<typeof synthOpts>): ColumnTree {
  const m = avaMatrix();
  const a = build.apply(EMPTY_TREE, m, o);
  const b = periodStage.apply(a, m, o);
  return delta.apply(b, m, o);
}

// A hand-built tree of real (non-period) leaves for syntheticPair tests.
function realLeaf(idx: number, groupLabel?: string): ColumnLeaf {
  return {
    node: { levelSourceIndex: 0 } as ColumnLeaf['node'],
    leafIndex: idx,
    formatter: () => '',
    defaultLabel: `L${idx}`,
    visible: true,
    groupLabel,
  };
}

function treeOf(leaves: ColumnLeaf[]): ColumnTree {
  return { levels: [leaves.map((l) => ({ node: l.node, leafCount: 1 }))], leaves };
}

const noColumnsMatrix = matrixWithRows(root([]), [source({ displayName: 'S' })], []);

describe('SynthesizeDeltaLeavesStage — guards', () => {
  it('the stage name is synthesizeDeltaLeaves', () => {
    expect(delta.name).toBe('synthesizeDeltaLeaves');
  });

  it('returns the input tree when both delta toggles are off', () => {
    const o = synthOpts({ showDelta: false, showDeltaPct: false });
    const m = avaMatrix();
    const base = periodStage.apply(build.apply(EMPTY_TREE, m, o), m, o);
    expect(delta.apply(base, m, o)).toBe(base);
  });

  it('returns the input tree when no 2-leaf cluster exists', () => {
    const tree = treeOf([realLeaf(0, 'Solo')]);
    expect(delta.apply(tree, noColumnsMatrix, synthOpts())).toBe(tree);
  });
});

describe('SynthesizeDeltaLeavesStage — cluster detection', () => {
  it('a 1-leaf cluster does not synthesize', () => {
    const tree = treeOf([realLeaf(0, 'A'), realLeaf(1, 'B')]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts());
    expect(out.leaves).toHaveLength(2);
  });

  it('a 3-leaf cluster does not synthesize', () => {
    const tree = treeOf([realLeaf(0, 'A'), realLeaf(1, 'A'), realLeaf(2, 'A')]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts());
    expect(out.leaves).toHaveLength(3);
  });

  it('a label-less 2-leaf run does not synthesize', () => {
    const tree = treeOf([realLeaf(0), realLeaf(1)]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts());
    expect(out.leaves).toHaveLength(2);
  });

  it('a 2-leaf same-label cluster synthesizes Δ and %Δ after it', () => {
    const tree = treeOf([realLeaf(0, 'Q1'), realLeaf(1, 'Q1')]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts());
    expect(out.leaves).toHaveLength(4);
    expect(out.leaves.map((l) => l.isSynthetic)).toEqual([
      undefined, undefined, 'delta', 'deltaPct',
    ]);
  });
});

describe('SynthesizeDeltaLeavesStage — render order + pairing', () => {
  it('within-cluster render order is [delta, deltaPct]', () => {
    const tree = treeOf([realLeaf(0, 'Q1'), realLeaf(1, 'Q1')]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts());
    expect(out.leaves[2].isSynthetic).toBe('delta');
    expect(out.leaves[2].defaultLabel).toBe('Δ');
    expect(out.leaves[3].isSynthetic).toBe('deltaPct');
    expect(out.leaves[3].defaultLabel).toBe('%Δ');
  });

  it('Δ-only when showDeltaPct is off', () => {
    const tree = treeOf([realLeaf(0, 'Q1'), realLeaf(1, 'Q1')]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts({ showDeltaPct: false }));
    expect(out.leaves.map((l) => l.isSynthetic)).toEqual([
      undefined, undefined, 'delta',
    ]);
  });

  it('%Δ-only when showDelta is off', () => {
    const tree = treeOf([realLeaf(0, 'Q1'), realLeaf(1, 'Q1')]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts({ showDelta: false }));
    expect(out.leaves.map((l) => l.isSynthetic)).toEqual([
      undefined, undefined, 'deltaPct',
    ]);
  });

  it('real-leaf clusters carry syntheticPair, not periodSourcePair', () => {
    const tree = treeOf([realLeaf(3, 'Q1'), realLeaf(4, 'Q1')]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts());
    const dl = out.leaves[2];
    expect(dl.syntheticPair).toEqual({ currentLeafIdx: 3, priorLeafIdx: 4 });
    expect(dl.periodSourcePair).toBeUndefined();
  });

  it('two independent 2-leaf clusters each synthesize their own pair', () => {
    const tree = treeOf([
      realLeaf(0, 'Q1'), realLeaf(1, 'Q1'),
      realLeaf(2, 'Q2'), realLeaf(3, 'Q2'),
    ]);
    const out = delta.apply(tree, noColumnsMatrix, synthOpts());
    // Q1, Q1, Δ, %Δ, Q2, Q2, Δ, %Δ
    expect(out.leaves).toHaveLength(8);
    expect(out.leaves.map((l) => l.isSynthetic)).toEqual([
      undefined, undefined, 'delta', 'deltaPct',
      undefined, undefined, 'delta', 'deltaPct',
    ]);
    expect(out.leaves[2].syntheticPair).toEqual({ currentLeafIdx: 0, priorLeafIdx: 1 });
    expect(out.leaves[6].syntheticPair).toEqual({ currentLeafIdx: 2, priorLeafIdx: 3 });
  });
});

describe('SynthesizeDeltaLeavesStage — period-synthetic clusters', () => {
  it('AvA full pipeline pairs each period current+prior into Δ/%Δ', () => {
    const tree = fullPipeline(synthOpts({ compareAgainstMode: 'priorYear' }));
    // MTD pair → Δ,%Δ ; QTD pair → Δ,%Δ ; YTD pair → Δ,%Δ = 6 + 6 = 12.
    expect(tree.leaves).toHaveLength(12);
    const synth = tree.leaves.filter((l) => l.isSynthetic);
    expect(synth).toHaveLength(6);
  });

  it('period-synthetic Δ carries periodSourcePair (sum-then-subtract)', () => {
    const tree = fullPipeline(synthOpts({ compareAgainstMode: 'priorYear' }));
    const dl = tree.leaves.find((l) => l.isSynthetic === 'delta')!;
    expect(dl.periodSourcePair).toBeDefined();
    expect(Array.isArray(dl.periodSourcePair!.currentLeafIdxs)).toBe(true);
    expect(Array.isArray(dl.periodSourcePair!.priorLeafIdxs)).toBe(true);
  });

  it('the MTD Δ pairs the MTD current and prior source indices', () => {
    const tree = fullPipeline(synthOpts({ compareAgainstMode: 'priorYear' }));
    // Render order: mtd-cur, mtd-prior, Δ, %Δ, qtd-cur, ...
    const mtdCur = tree.leaves[0];
    const mtdPrior = tree.leaves[1];
    const mtdDelta = tree.leaves[2];
    expect(mtdDelta.isSynthetic).toBe('delta');
    expect(mtdDelta.periodSourcePair!.currentLeafIdxs).toEqual(mtdCur.periodSourceIdxs);
    expect(mtdDelta.periodSourcePair!.priorLeafIdxs).toEqual(mtdPrior.periodSourceIdxs);
  });

  it('synthetic Δ/%Δ inherit the cluster group label', () => {
    const tree = fullPipeline(synthOpts({ compareAgainstMode: 'priorYear' }));
    const mtdDelta = tree.leaves[2];
    expect(mtdDelta.groupLabel).toBe('MTD · Mar 2026');
  });
});
