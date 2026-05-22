// L1 model. The pipeline-stage contract. A stage is a closed transform:
// it takes a ColumnTree plus the source matrix and the resolved format
// options, and returns a fresh ColumnTree. Stages compose by feeding one
// stage's output into the next, in plain declaration order — v0.1 runs a
// three-stage hardcoded pipeline, so there is deliberately no dependency
// graph, no topological sort, and no named exception hierarchy here; the
// orchestrator owns stage order. Root stages (those that build the first
// tree from the matrix) ignore the incoming `tree` and return a freshly
// built one, which is what EMPTY_TREE is for.

import powerbi from 'powerbi-visuals-api';

import type { ColumnTree } from './columnTree';
import type { FormatOptions } from './formatOptions';

import DataViewMatrix = powerbi.DataViewMatrix;

// The single contract every pipeline stage implements. `name` is a stable
// human-readable identifier used only for diagnostics — nothing dispatches
// on it. `apply` is the whole transform.
export interface PipelineStage {
  readonly name: string;
  apply(tree: ColumnTree, matrix: DataViewMatrix, opts: FormatOptions): ColumnTree;
}

// The sentinel handed to root stages, whose `apply` ignores its tree
// argument. Frozen so a stage that wrongly tries to mutate it fails loudly
// instead of corrupting a shared instance; the type assertion keeps the
// frozen object assignable as a ColumnTree without widening the export.
export const EMPTY_TREE: ColumnTree = Object.freeze({
  levels: [],
  leaves: [],
}) as ColumnTree;
