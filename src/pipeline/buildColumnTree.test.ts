import { describe, it, expect } from 'vitest';

import { EMPTY_TREE } from '../model/pipelineStage';
import { BuildColumnTreeStage } from './buildColumnTree';
import { group, leaf, matrix, opts, root, source } from './__fixtures__/matrix';

const stage = new BuildColumnTreeStage();

describe('BuildColumnTreeStage — leaf emission', () => {
  it('emits one leaf per non-root data leaf', () => {
    const m = matrix(root([leaf(0, 0, 'Sales'), leaf(1, 0, 'Cost')]), [
      source({ displayName: 'Sales' }),
      source({ displayName: 'Cost' }),
    ]);
    const tree = stage.apply(EMPTY_TREE, m, opts());
    expect(tree.leaves).toHaveLength(2);
    expect(tree.leaves.map((l) => l.leafIndex)).toEqual([0, 1]);
  });

  it('defaultLabel is the source displayName', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'Total Sales' })]);
    const tree = stage.apply(EMPTY_TREE, m, opts());
    expect(tree.leaves[0].defaultLabel).toBe('Total Sales');
  });

  it('visible defaults to true when the source sets no visibility', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'S' })]);
    const tree = stage.apply(EMPTY_TREE, m, opts());
    expect(tree.leaves[0].visible).toBe(true);
  });

  it('the stage name is buildColumnTree', () => {
    expect(stage.name).toBe('buildColumnTree');
  });

  it('ignores the incoming tree (root stage)', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'S' })]);
    const poison = { levels: [[]], leaves: [{}] } as never;
    const tree = stage.apply(poison, m, opts());
    expect(tree.leaves).toHaveLength(1);
  });
});

describe('BuildColumnTreeStage — groupLabel propagation', () => {
  it('source-level groupLabel reaches the leaf', () => {
    const m = matrix(root([leaf(0, 0), leaf(1, 0)]), [
      source({ displayName: 'Act', groupLabel: 'Q1' }),
      source({ displayName: 'Bud', groupLabel: 'Q1' }),
    ]);
    const tree = stage.apply(EMPTY_TREE, m, opts());
    expect(tree.leaves.map((l) => l.groupLabel)).toEqual(['Q1', 'Q1']);
  });

  it('no groupLabel object → undefined on the leaf', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'S' })]);
    expect(stage.apply(EMPTY_TREE, m, opts()).leaves[0].groupLabel).toBeUndefined();
  });
});

describe('BuildColumnTreeStage — hidden-leaf filtering', () => {
  it('a source with visible:false is removed from leaves', () => {
    const m = matrix(root([leaf(0, 0), leaf(1, 0)]), [
      source({ displayName: 'Shown' }),
      source({ displayName: 'Hidden', visible: false }),
    ]);
    const tree = stage.apply(EMPTY_TREE, m, opts());
    expect(tree.leaves).toHaveLength(1);
    expect(tree.leaves[0].defaultLabel).toBe('Shown');
  });

  it('visible:true is kept', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'S', visible: true })]);
    expect(stage.apply(EMPTY_TREE, m, opts()).leaves).toHaveLength(1);
  });

  it('parent level entry leafCount decrements when a child leaf is hidden', () => {
    // One group over two leaves; hide one — the group span must drop to 1.
    const m = matrix(
      root([group(0, 'Region', [leaf(0, 1), leaf(1, 1)])]),
      [source({ displayName: 'Shown' }), source({ displayName: 'Gone', visible: false })],
    );
    const tree = stage.apply(EMPTY_TREE, m, opts());
    expect(tree.leaves).toHaveLength(1);
    const groupEntry = tree.levels[0].find((e) => e.node.value === 'Region');
    expect(groupEntry!.leafCount).toBe(1);
  });

  it('a parent whose every child is hidden is dropped from its level', () => {
    const m = matrix(
      root([group(0, 'AllGone', [leaf(0, 1)])]),
      [source({ displayName: 'X', visible: false })],
    );
    const tree = stage.apply(EMPTY_TREE, m, opts());
    expect(tree.leaves).toHaveLength(0);
    expect(tree.levels[0].some((e) => e.node.value === 'AllGone')).toBe(false);
  });

  it('the level matrix is densified (no undefined level rows)', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'S' })]);
    const tree = stage.apply(EMPTY_TREE, m, opts());
    expect(tree.levels.every((lvl) => Array.isArray(lvl))).toBe(true);
  });
});

describe('BuildColumnTreeStage — denomination-aware formatter', () => {
  it('formatter returns "" for null/undefined values', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'S', format: '$#,##0' })]);
    const f = stage.apply(EMPTY_TREE, m, opts()).leaves[0].formatter;
    expect(f(null)).toBe('');
    expect(f(undefined)).toBe('');
  });

  it('thousands denomination scales the value before formatting (K suffix)', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'S', format: '$#,##0' })]);
    const tree = stage.apply(EMPTY_TREE, m, opts({ denomination: 'thousands' }));
    // mock formatter: scaled 5000 → 5 → "5.00K" (suffix from the K-bearing mask)
    expect(tree.leaves[0].formatter(5000)).toContain('K');
  });

  it('dollars denomination does not scale (no K/M suffix)', () => {
    const m = matrix(root([leaf(0, 0)]), [source({ displayName: 'S', format: '$#,##0' })]);
    const tree = stage.apply(EMPTY_TREE, m, opts({ denomination: 'dollars' }));
    const out = tree.leaves[0].formatter(1234);
    expect(out).not.toContain('K');
    expect(out).not.toContain('M');
  });
});
