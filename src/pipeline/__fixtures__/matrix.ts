// Test fixtures. Hand-built DataViewMatrix inputs plus a flat
// FormatOptions builder for pipeline-stage tests. Power BI's public types
// refuse to expose `.objects` on DataViewMatrixNode / DataViewMetadataColumn
// even though the runtime carries it (a documented type-definition gap), so
// the construction happens behind `as unknown as` casts confined to this
// one file — test code stays type-clean.

import powerbi from 'powerbi-visuals-api';

import type { FormatOptions } from '../../model/formatOptions';

import DataViewMatrix = powerbi.DataViewMatrix;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataViewObjects = powerbi.DataViewObjects;
import PrimitiveValue = powerbi.PrimitiveValue;

export interface SourceInit {
  displayName: string;
  queryName?: string;
  format?: string;
  visible?: boolean;
  groupLabel?: string;
}

export function source(init: SourceInit): DataViewMetadataColumn {
  const objects: Record<string, unknown> = {};
  if (init.visible !== undefined) objects.columnVisibility = { visible: init.visible };
  if (init.groupLabel !== undefined) objects.columnHeaders = { groupLabel: init.groupLabel };
  const col: Record<string, unknown> = { displayName: init.displayName };
  if (init.queryName !== undefined) col.queryName = init.queryName;
  if (init.format !== undefined) col.format = init.format;
  if (Object.keys(objects).length > 0) col.objects = objects;
  return col as unknown as DataViewMetadataColumn;
}

export function leaf(levelSourceIndex: number, level: number, value?: PrimitiveValue): DataViewMatrixNode {
  const node: Record<string, unknown> = { level, levelSourceIndex };
  if (value !== undefined) node.value = value;
  return node as unknown as DataViewMatrixNode;
}

export function group(level: number, value: PrimitiveValue, children: DataViewMatrixNode[]): DataViewMatrixNode {
  return { level, value, children } as unknown as DataViewMatrixNode;
}

// Root carries no level field — buildColumnTree treats an absent level as
// the root sentinel.
export function root(children: DataViewMatrixNode[]): DataViewMatrixNode {
  return { children } as unknown as DataViewMatrixNode;
}

export function matrix(rootNode: DataViewMatrixNode, valueSources: DataViewMetadataColumn[]): DataViewMatrix {
  return { columns: { root: rootNode }, valueSources, rows: { root: { children: [] } } } as unknown as DataViewMatrix;
}

// --- Wave 3 time-intelligence builders -----------------------------------
// buildTimeSeries needs date-stamped column buckets (depth-1 OR depth-2)
// and a rows tree whose leaf nodes carry a `values` cell map. The Wave 2
// builders above only model the column header; these add the date/rows
// dimension without disturbing them.

// A depth-1 column bucket: the node IS the value leaf. `date` is what
// coerceToDate must resolve; an absent levelSourceIndex defaults to 0.
export function dateBucket(date: string | Date, levelSourceIndex = 0): DataViewMatrixNode {
  return { level: 0, levelSourceIndex, value: date } as unknown as DataViewMatrixNode;
}

// A depth-2 column bucket: the date node with one measure-leaf child per
// bound source, each carrying its valueSources index.
export function dateGroup(date: string | Date, sourceIdxs: number[]): DataViewMatrixNode {
  const children = sourceIdxs.map(
    (idx) => ({ level: 1, levelSourceIndex: idx } as unknown as DataViewMatrixNode),
  );
  return { level: 0, value: date, children } as unknown as DataViewMatrixNode;
}

// A row leaf carrying its per-column-leaf value cells, keyed by the
// adapter's leafIdx. `label` becomes the node value the row key derives.
export function rowLeaf(label: PrimitiveValue, cellsByLeafIdx: Record<number, number>): DataViewMatrixNode {
  const values: Record<number, { value: number }> = {};
  for (const k of Object.keys(cellsByLeafIdx)) {
    values[Number(k)] = { value: cellsByLeafIdx[Number(k)] };
  }
  return { level: 0, value: label, values } as unknown as DataViewMatrixNode;
}

// A non-leaf row node (a dimension level above the leaves).
export function rowGroup(label: PrimitiveValue, children: DataViewMatrixNode[]): DataViewMatrixNode {
  return { level: 0, value: label, children } as unknown as DataViewMatrixNode;
}

// A matrix whose rows tree is populated (the Wave 2 `matrix` builder hard-
// codes an empty rows root, which buildTimeSeries needs to be non-empty).
export function matrixWithRows(
  columnsRoot: DataViewMatrixNode,
  valueSources: DataViewMetadataColumn[],
  rowNodes: DataViewMatrixNode[],
): DataViewMatrix {
  return {
    columns: { root: columnsRoot },
    valueSources,
    rows: { root: { children: rowNodes } },
  } as unknown as DataViewMatrix;
}

export interface OptsInit {
  denomination?: 'dollars' | 'thousands' | 'millions';
  decimals?: number;
  showLetter?: boolean;
}

// A flat FormatOptions for pipeline tests. theme/selection are unread by
// these stages so they get inert casts; the scaling knobs are real.
export function opts(init: OptsInit = {}): FormatOptions {
  const out: Record<string, unknown> = {
    theme: {},
    selection: {},
    rowHeight: 24,
    showGrandTotal: false,
    formatHints: new Map(),
  };
  if (init.denomination !== undefined) out.denomination = init.denomination;
  if (init.decimals !== undefined) out.decimals = init.decimals;
  if (init.showLetter !== undefined) out.showLetter = init.showLetter;
  return out as unknown as FormatOptions;
}

// The synthesis stages read compare-against mode, period toggles, the
// fiscal start, the reporting-date override, and the format-hint map off a
// FLAT FormatOptions. This builder exposes exactly those knobs; everything
// the synthesis stages do not read gets an inert cast.
export interface SynthOptsInit {
  compareAgainstMode?: 'priorYear' | 'budget' | 'forecast' | 'forecastVsForecast';
  showMtd?: boolean;
  showQtd?: boolean;
  showYtd?: boolean;
  showFy?: boolean;
  showPriorYear?: boolean;
  showDelta?: boolean;
  showDeltaPct?: boolean;
  fyStartMonth?: number;
  selectedDate?: string;
  denomination?: 'dollars' | 'thousands' | 'millions';
  decimals?: number;
  showLetter?: boolean;
  formatHints?: ReadonlyMap<string, unknown>;
}

export function synthOpts(init: SynthOptsInit = {}): FormatOptions {
  const out: Record<string, unknown> = {
    theme: {},
    selection: {},
    rowHeight: 24,
    showGrandTotal: false,
    formatHints: init.formatHints ?? new Map(),
  };
  const copy: (keyof SynthOptsInit)[] = [
    'compareAgainstMode', 'showMtd', 'showQtd', 'showYtd', 'showFy',
    'showPriorYear', 'showDelta', 'showDeltaPct', 'fyStartMonth',
    'selectedDate', 'denomination', 'decimals', 'showLetter',
  ];
  for (const k of copy) {
    if (init[k] !== undefined) out[k] = init[k];
  }
  return out as unknown as FormatOptions;
}

// Re-export the raw DataViewObjects type for tests that need to assert on
// the objects bag shape directly.
export type { DataViewObjects };
