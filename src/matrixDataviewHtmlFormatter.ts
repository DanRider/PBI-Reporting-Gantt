// L4 entry. The single seam between a Power BI matrix dataView and the
// rendered DOM. It runs the format-hint pre-pass, folds the three
// hardcoded pipeline stages over EMPTY_TREE to produce the ColumnTree,
// and hands that tree plus the matrix to the L3 render orchestrator.
// This is the only place the pipeline and render layers meet — render
// itself never imports the pipeline; the ColumnTree is the whole
// boundary. An absent matrix yields a valid empty tagged container so
// callers never branch on a missing dataView.

import powerbi from 'powerbi-visuals-api';

import type { ColumnTree } from './model/columnTree';
import type { FormatOptions } from './model/formatOptions';
import { EMPTY_TREE } from './model/pipelineStage';
import { BuildColumnTreeStage } from './pipeline/buildColumnTree';
import { detectFormatHints } from './pipeline/detectFormatHints';
import { SynthesizeDeltaLeavesStage } from './pipeline/synthesizeDeltaLeaves';
import { SynthesizePeriodLeavesStage } from './pipeline/synthesizePeriodLeaves';
import { renderMatrixTable } from './render/matrix/table';

import DataViewMatrix = powerbi.DataViewMatrix;

const ROOT_CLASS = 'rg-matrix-lt2';

// The v0.1 pipeline: build the base tree, append the period synthetics,
// then append the variance synthetics. Plain declaration order is the
// whole composition contract — there is no dependency graph.
const PIPELINE = [
  new BuildColumnTreeStage(),
  new SynthesizePeriodLeavesStage(),
  new SynthesizeDeltaLeavesStage(),
];

function runPipeline(matrix: DataViewMatrix, opts: FormatOptions): ColumnTree {
  return PIPELINE.reduce<ColumnTree>(
    (tree, stage) => stage.apply(tree, matrix, opts),
    EMPTY_TREE,
  );
}

function emptyRoot(): HTMLElement {
  const root = document.createElement('div');
  root.className = ROOT_CLASS;
  return root;
}

export class MatrixDataviewHtmlFormatter {
  // The format-hint pre-pass runs here (not as a stage) because its
  // product is a map the stages READ off opts rather than a transformed
  // tree. The enriched options are local — the caller's object is never
  // mutated.
  public static format(
    matrix: DataViewMatrix | undefined,
    opts: FormatOptions,
  ): HTMLElement {
    if (!matrix) {
      return emptyRoot();
    }
    const enriched: FormatOptions = {
      ...opts,
      formatHints: detectFormatHints(matrix),
    };
    const tree = runPipeline(matrix, enriched);
    return renderMatrixTable(tree, matrix, enriched);
  }
}
