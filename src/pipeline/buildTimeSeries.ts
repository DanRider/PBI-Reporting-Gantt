// L2 pipeline. The adapter that turns a Power BI DataViewMatrix into the
// L1 TimeSeries primitive for one value source. Power BI materializes a
// date-bucketed column binding in one of two shapes: depth-1, where each
// level-0 column child IS the value leaf (its single measure implicit at
// source index 0), and depth-2, where each level-0 date bucket has measure
// children carrying an explicit source index. inspectColumnLeaves folds
// both shapes into one flat (leafIdx, date, sourceIdx) descriptor list so
// no consumer ever branches on tree depth again. A row is keyed by its
// hierarchy path; the same derivation is used building and reading the
// series so keys round-trip. The whole file is pure — it never mutates the
// matrix and returns null (not an exception) when the binding is not
// date-driven, signalling callers to skip time intelligence.

import powerbi from 'powerbi-visuals-api';

import { coerceToDate } from '../primitives/dateFormat';
import type {
  DatePoint,
  FyStartMonth,
  Granularity,
  RowKey,
  TimeSeries,
} from '../primitives/timeSeries';

import DataViewMatrix = powerbi.DataViewMatrix;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewMatrixNodeValue = powerbi.DataViewMatrixNodeValue;

const ONE_DAY = 24 * 60 * 60 * 1000;

// Inter-bucket spacing thresholds (in days) that name the granularity. The
// gaps are deliberately loose so a 28–31-day month or a 90–92-day quarter
// all bucket to the same kind regardless of which two adjacent points the
// detector happened to sample.
const DAY_MAX = 1.5;
const MONTH_MAX = 35;
const QUARTER_MAX = 100;

// ASCII unit separator. Safe inside a row key because no user-entered
// dimension value contains a control character, so the joined path is
// unambiguous when split back apart.
const ROW_KEY_SEP = '';

// One value leaf located inside the column tree, flattened across the
// depth-1 vs depth-2 distinction. `leafIdx` indexes a row's values array;
// `sourceIdx` is the valueSources position (always 0 for depth-1).
export interface ColumnLeafDescriptor {
  readonly leafIdx: number;
  readonly date: Date;
  readonly sourceIdx: number;
}

export interface BuildTimeSeriesOpts {
  // Defaults to 1 (calendar year) when the report binds no fiscal start.
  readonly fyStartMonth?: FyStartMonth;
  // Overrides the reporting date; absent uses the latest bound bucket.
  readonly reportingDateOverride?: Date;
  // Which value source to extract — multi-measure callers build one series
  // per source. Defaults to 0, the only source a depth-1 binding has.
  readonly sourceIdx?: number;
}

function isRootNode(node: DataViewMatrixNode): boolean {
  return typeof node.level === 'undefined' || node.level === null;
}

function levelSourceIndexOf(node: DataViewMatrixNode): number {
  const withIdx = node as DataViewMatrixNode & { levelSourceIndex?: number };
  return withIdx.levelSourceIndex ?? 0;
}

function rowValuesOf(
  node: DataViewMatrixNode,
): { [index: number]: DataViewMatrixNodeValue } | undefined {
  const withValues = node as DataViewMatrixNode & {
    values?: { [index: number]: DataViewMatrixNodeValue };
  };
  return withValues.values;
}

// Sample the first two distinct bucket dates and classify the gap. One or
// zero buckets cannot reveal spacing, so a single-period binding defaults
// to month — the most common report grain.
function detectGranularity(dates: readonly Date[]): Granularity {
  if (dates.length < 2) {
    return 'month';
  }
  const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
  const days = (sorted[1].getTime() - sorted[0].getTime()) / ONE_DAY;
  if (days <= DAY_MAX) {
    return 'day';
  }
  if (days <= MONTH_MAX) {
    return 'month';
  }
  if (days <= QUARTER_MAX) {
    return 'quarter';
  }
  return 'year';
}

function maxDate(dates: readonly Date[]): Date | null {
  if (dates.length === 0) {
    return null;
  }
  let max = dates[0];
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].getTime() > max.getTime()) {
      max = dates[i];
    }
  }
  return max;
}

// Apply `visit` to every non-root row node with its ancestor chain. The
// root contributes no path segment, so its children start the chain empty.
function walkRows(
  node: DataViewMatrixNode,
  ancestors: readonly DataViewMatrixNode[],
  visit: (n: DataViewMatrixNode, a: readonly DataViewMatrixNode[]) => void,
): void {
  if (!isRootNode(node)) {
    visit(node, ancestors);
  }
  if (node.children) {
    const next = isRootNode(node) ? ancestors : [...ancestors, node];
    for (const child of node.children) {
      walkRows(child, next, visit);
    }
  }
}

// Derive a stable RowKey from a row node's hierarchy path. Used both when
// the series map is built and when a synthesis stage looks a row up, so
// the two call sites MUST stay this one function or keys stop matching.
export function rowKeyForNode(
  node: DataViewMatrixNode,
  ancestors: readonly DataViewMatrixNode[],
): RowKey {
  const parts: string[] = [];
  for (const a of ancestors) {
    if (a.value != null) {
      parts.push(String(a.value));
    }
  }
  if (node.value != null) {
    parts.push(String(node.value));
  }
  return parts.join(ROW_KEY_SEP);
}

// Flatten the column tree to one descriptor per value leaf. Returns null
// when any level-0 child fails date coercion — that means the binding is
// not date-driven and the caller must skip time intelligence rather than
// invent buckets. Depth is decided per-bucket: a level-0 child with no
// children is itself the leaf (depth-1, source 0); a child with children
// fans out to its measure leaves (depth-2, explicit source index).
export function inspectColumnLeaves(
  matrix: DataViewMatrix,
): readonly ColumnLeafDescriptor[] | null {
  const root = matrix.columns?.root;
  if (!root?.children || root.children.length === 0) {
    return null;
  }

  const bucketDates: (Date | null)[] = root.children.map((c) =>
    coerceToDate(c.value),
  );
  if (bucketDates.some((d) => d == null)) {
    return null;
  }

  const descriptors: ColumnLeafDescriptor[] = [];
  let leafIdx = 0;
  for (let i = 0; i < root.children.length; i++) {
    const bucket = root.children[i];
    const date = bucketDates[i]!;
    if (!bucket.children || bucket.children.length === 0) {
      descriptors.push({ leafIdx, date, sourceIdx: 0 });
      leafIdx += 1;
      continue;
    }
    for (const measureLeaf of bucket.children) {
      descriptors.push({
        leafIdx,
        date,
        sourceIdx: levelSourceIndexOf(measureLeaf),
      });
      leafIdx += 1;
    }
  }
  return descriptors;
}

// Build the TimeSeries for one value source. Returns null when the binding
// is not date-driven or the requested source has no leaves. When columns
// are date-driven but the matrix carries no rows it still returns a series
// (empty map) so a caller can read reportingDate/granularity without
// conflating "no time intelligence" with "no row data".
export function buildTimeSeries(
  matrix: DataViewMatrix,
  opts: BuildTimeSeriesOpts = {},
): TimeSeries | null {
  const fyStartMonth: FyStartMonth = opts.fyStartMonth ?? 1;
  const sourceIdx = opts.sourceIdx ?? 0;

  const allLeaves = inspectColumnLeaves(matrix);
  if (!allLeaves) {
    return null;
  }
  const leaves = allLeaves.filter((l) => l.sourceIdx === sourceIdx);
  if (leaves.length === 0) {
    return null;
  }

  const dates = leaves.map((l) => l.date);
  const reportingDate = opts.reportingDateOverride ?? maxDate(dates);
  if (reportingDate == null) {
    return null;
  }
  const granularity = detectGranularity(dates);

  const series = new Map<RowKey, DatePoint[]>();
  const rowsRoot = matrix.rows?.root;
  if (rowsRoot) {
    walkRows(rowsRoot, [], (node, ancestors) => {
      const values = rowValuesOf(node);
      if (!values) {
        return;
      }
      const key = rowKeyForNode(node, ancestors);
      const points: DatePoint[] = [];
      for (const leaf of leaves) {
        const cell = values[leaf.leafIdx];
        const v = cell?.value;
        if (typeof v === 'number') {
          points.push({ date: leaf.date, value: v });
        }
      }
      points.sort((a, b) => a.date.getTime() - b.date.getTime());
      if (points.length > 0) {
        series.set(key, points);
      }
    });
  }

  return {
    series,
    reportingDate,
    fyStartMonth,
    granularity,
    kind: 'date-bucketed',
  };
}
