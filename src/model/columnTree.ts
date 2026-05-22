// L1 model. The pipeline-internal value that L2 stages produce and L3
// render consumes — it IS the pipeline-to-render contract boundary. A
// ColumnTree is a flat ordered leaf list plus the column-header level
// matrix above it. Types and aliases only; this file holds no runtime
// code. A leaf carries exactly what render needs to emit one terminal
// column: its matrix node, its row-values index, its bound formatter,
// its label, its visibility, and — when it is a synthesized comparison
// or period column — the indices it computes its value from.

import powerbi from 'powerbi-visuals-api';

import type { PeriodVariant } from '../primitives/timeSeries';

import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import PrimitiveValue = powerbi.PrimitiveValue;

// The two synthesized comparison kinds. `delta` is current − prior in
// absolute terms; `deltaPct` is that difference over the prior value.
export type DeltaSynthesis = 'delta' | 'deltaPct';

// The four synthesized period-aggregation kinds. Each is built by summing
// the date-bucket leaves whose datestamps fall inside the named window.
export type PeriodSynthesis = 'mtd' | 'qtd' | 'ytd' | 'fy';

// A bound per-leaf cell formatter. The leaf's resolved format string is
// closed over at build time, so render passes only the pre-scaled value
// and gets back the display string. Returns "" for absent values so the
// render layer never branches on null.
export type ValueFormatter = (value: PrimitiveValue | null | undefined) => string;

// The two real leaves a delta synthetic subtracts. Carries row-values
// indices, so it only applies when both sides are real (non-synthesized)
// columns the render layer can index directly.
export interface SyntheticPair {
  readonly currentLeafIdx: number;
  readonly priorLeafIdx: number;
}

// The period-source index arrays for a delta synthetic that pairs two
// PERIOD-SYNTHESIS leaves. Those leaves have no single row-values index,
// so render sums each side's source indices then subtracts.
export interface PeriodSourcePair {
  readonly currentLeafIdxs: number[];
  readonly priorLeafIdxs: number[];
}

// One renderable terminal column.
export interface ColumnLeaf {
  node: DataViewMatrixNode;
  // Position of this leaf's value inside each row's values array.
  leafIndex: number;
  formatter: ValueFormatter;
  defaultLabel: string;
  // False only when the source's columnVisibility.visible is explicitly
  // false; such leaves are filtered out before the tree reaches render.
  visible: boolean;
  // The cluster label that drives the synthetic outer-span row. Absent or
  // empty means this leaf contributes no group cell.
  groupLabel?: string;
  // Set on leaves the pipeline synthesizes from a 2-leaf cluster rather
  // than reading from a data row. Real leaves leave this undefined.
  isSynthetic?: DeltaSynthesis;
  // The real-leaf pair a delta synthetic computes from.
  syntheticPair?: SyntheticPair;
  // Set on leaves whose value is the sum of `periodSourceIdxs` — the date
  // buckets inside this leaf's period window.
  isPeriodSynthesis?: PeriodSynthesis;
  // 'current' or the 12-month-shifted 'prior' companion.
  periodVariant?: PeriodVariant;
  // Source row-values indices summed at value-emission time for a period
  // synthetic.
  periodSourceIdxs?: number[];
  // Present instead of `syntheticPair` when a delta synthetic pairs two
  // period synthetics: render sums each side then subtracts.
  periodSourcePair?: PeriodSourcePair;
}

// One header cell at a given tree level. `leafCount` is the column span
// over the leaves beneath it, decremented as hidden leaves are dropped.
export interface ColumnLevelEntry {
  node: DataViewMatrixNode;
  leafCount: number;
}

// One row of the column-header matrix. `levels[depth]` is one of these.
export type ColumnLevel = ColumnLevelEntry[];

// The pipeline-to-render boundary value.
export interface ColumnTree {
  levels: ColumnLevel[];
  leaves: ColumnLeaf[];
}
