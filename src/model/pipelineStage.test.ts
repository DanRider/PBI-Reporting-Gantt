import { describe, it, expect } from 'vitest';

import type { ColumnTree } from './columnTree';
import { EMPTY_TREE, type PipelineStage } from './pipelineStage';

describe('EMPTY_TREE', () => {
  it('is an empty levels + leaves tree', () => {
    expect(EMPTY_TREE.levels).toEqual([]);
    expect(EMPTY_TREE.leaves).toEqual([]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(EMPTY_TREE)).toBe(true);
  });

  it('rejects reassignment of its top-level slots', () => {
    expect(() => {
      (EMPTY_TREE as { levels: unknown }).levels = [['x']];
    }).toThrow();
  });

  it('the same frozen instance is shared across reads', () => {
    expect(EMPTY_TREE).toBe(EMPTY_TREE);
  });
});

describe('PipelineStage contract', () => {
  it('a minimal stage satisfies the interface and composes', () => {
    const passthrough: PipelineStage = {
      name: 'passthrough',
      apply(tree: ColumnTree): ColumnTree {
        return tree;
      },
    };
    expect(passthrough.name).toBe('passthrough');
    const next = passthrough.apply(EMPTY_TREE, undefined as never, undefined as never);
    expect(next).toBe(EMPTY_TREE);
  });

  it('a root-style stage may ignore its incoming tree', () => {
    const built: ColumnTree = { levels: [[]], leaves: [] };
    const rootStage: PipelineStage = {
      name: 'root',
      apply(): ColumnTree {
        return built;
      },
    };
    expect(rootStage.apply(EMPTY_TREE, undefined as never, undefined as never)).toBe(built);
  });
});
