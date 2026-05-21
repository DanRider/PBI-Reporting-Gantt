// L2 pipeline. The stage that appends MTD/QTD/YTD/FY synthetic columns.
// It asks the buildTimeSeries adapter for one flat list of dated column
// leaves (so it never branches on tree depth itself), resolves the bound
// sources for the active compare-against mode, and for every enabled
// period emits one synthetic leaf per (source, variant) the periodSpec
// plan calls for. Each synthetic carries the row-values indices whose
// date-bucket falls inside its window, so the render layer sums them at
// emit time. FY is skipped in AvA because there it is structurally just
// December YTD — a redundant column. The v0.1 build deliberately drops the
// forecast-registry label override and the synthesized-leaf template that
// the parent design carried; a synthetic's label is the smart period
// context, nothing more. Pure: returns the input tree unchanged whenever
// no synthesis applies.

import powerbi from 'powerbi-visuals-api';
import { valueFormatter } from 'powerbi-visuals-utils-formattingutils';

import { denominationSpec } from '../primitives/format/denomination';
import { inheritedFormat } from '../primitives/format/inheritedFormat';
import {
  computeWindow,
  isInWindow,
  type FyStartMonth,
  type PeriodKind,
  type PeriodVariant,
} from '../primitives/timeSeries';
import type { ColumnLeaf, ColumnTree, ValueFormatter } from '../model/columnTree';
import type { FormatOptions } from '../model/formatOptions';
import type { PipelineStage } from '../model/pipelineStage';
import { inspectColumnLeaves, type ColumnLeafDescriptor } from './buildTimeSeries';
import { classifySource, filterSourcesByMode, type ClassifyMode } from './sourceKinds';
import { periodSpec } from './periodSpec';

import DataViewMatrix = powerbi.DataViewMatrix;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// The maximum bound-source count this stage handles. The mode filter is
// supposed to reduce 3+ measures to a pair; if it cannot, the binding is
// too ambiguous for period synthesis and the tree is returned untouched.
const MAX_PAIRED_SOURCES = 2;

function uniqueSourceIdxs(descriptors: readonly ColumnLeafDescriptor[]): number[] {
  const set = new Set<number>();
  for (const d of descriptors) {
    set.add(d.sourceIdx);
  }
  return Array.from(set).sort((a, b) => a - b);
}

// Borrow a real matrix node so a synthetic leaf has a node to hang on for
// the render layer's ancestry walk. The first column leaf is arbitrary but
// stable; synthetics never read data through it.
function firstColumnLeafNode(matrix: DataViewMatrix): DataViewMatrixNode | null {
  const root = matrix.columns?.root;
  if (!root?.children || root.children.length === 0) {
    return null;
  }
  const first = root.children[0];
  if (first.children && first.children.length > 0) {
    return first.children[0];
  }
  return first;
}

function shiftBackOneYear(d: Date): Date {
  return new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
}

// The fiscal-year-end year of a date: for a calendar year it is the
// date's own year; for an off-calendar start it rolls to the next year
// once the date is on or past the fiscal-start month.
function fiscalYearEndYear(d: Date, fyStartMonth: number): number {
  if (fyStartMonth === 1) {
    return d.getFullYear();
  }
  return d.getMonth() >= fyStartMonth - 1 ? d.getFullYear() + 1 : d.getFullYear();
}

function quarterLabel(d: Date, fyStartMonth: number): string {
  const shifted = (d.getMonth() - (fyStartMonth - 1) + 12) % 12;
  const quarter = Math.floor(shifted / 3) + 1;
  return `Q${quarter} ${fiscalYearEndYear(d, fyStartMonth)}`;
}

// The compact period context a synthetic wears as its default label.
function smartPeriodLabel(
  period: PeriodKind,
  variant: PeriodVariant,
  reportingDate: Date,
  fyStartMonth: number,
): string {
  const ref = variant === 'prior' ? shiftBackOneYear(reportingDate) : reportingDate;
  switch (period) {
    case 'mtd':
      return `${MONTH_SHORT[ref.getMonth()]} ${ref.getFullYear()}`;
    case 'qtd':
      return quarterLabel(ref, fyStartMonth);
    case 'ytd':
      return `YTD ${MONTH_SHORT[ref.getMonth()]} ${fiscalYearEndYear(ref, fyStartMonth)}`;
    case 'fy':
      return `FY ${fiscalYearEndYear(ref, fyStartMonth)}`;
  }
}

// The group-label every leaf of one period shares so the outer-span row
// and the delta stage can cluster them. YTD already starts with "YTD"; FY
// has no month context to add; MTD/QTD get a "KIND · context" prefix.
function periodGroupLabel(
  period: PeriodKind,
  reportingDate: Date,
  fyStartMonth: number,
): string {
  const context = smartPeriodLabel(period, 'current', reportingDate, fyStartMonth);
  if (period === 'fy') {
    return context;
  }
  if (period === 'ytd') {
    return context.replace(/^YTD /, 'YTD · ');
  }
  return `${period.toUpperCase()} · ${context}`;
}

function resolveReportingDate(
  descriptors: readonly ColumnLeafDescriptor[],
  selectedIso: string | undefined,
): Date {
  let reportingDate = descriptors[0].date;
  for (const d of descriptors) {
    if (d.date.getTime() > reportingDate.getTime()) {
      reportingDate = d.date;
    }
  }
  if (!selectedIso) {
    return reportingDate;
  }
  // Construct from numeric parts so the comparison is in local time,
  // matching the descriptor dates (new Date(iso) would be UTC midnight and
  // shift a month in a negative-offset zone). An out-of-range selection
  // gracefully keeps the max-date fallback.
  const parts = selectedIso.split('-');
  if (parts.length >= 2) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    if (!isNaN(y) && !isNaN(m)) {
      const match = descriptors.find(
        (d) => d.date.getFullYear() === y && d.date.getMonth() === m,
      );
      if (match) {
        return match.date;
      }
    }
  }
  return reportingDate;
}

interface PeriodLeafInput {
  borrowNode: DataViewMatrixNode;
  source: DataViewMetadataColumn | undefined;
  opts: FormatOptions;
  period: PeriodKind;
  variant: PeriodVariant;
  periodSourceIdxs: number[];
  reportingDate: Date;
  fyStartMonth: number;
  isPairedCurrent: boolean;
  visible: boolean;
}

function buildPeriodLeaf(input: PeriodLeafInput): ColumnLeaf {
  const { source, opts, period, variant, reportingDate, fyStartMonth } = input;
  const hintKey = source?.queryName ?? source?.displayName ?? '';
  const hint = opts.formatHints.get(hintKey);
  const baseFormat = hint ? inheritedFormat(hint, 'period').format : source?.format;
  const spec = denominationSpec(
    baseFormat,
    opts.denomination,
    opts.decimals,
    opts.showLetter,
  );
  const inner = valueFormatter.create({ format: spec.format });
  const scale = spec.scale;
  const formatter: ValueFormatter = (value) => {
    if (value == null) {
      return '';
    }
    if (typeof value === 'number' && scale !== 1) {
      return inner.format(value * scale);
    }
    return inner.format(value);
  };

  // In a paired-current mode both leaves of a cluster share one window, so
  // the period-context label would collide. The non-actual plan leaf is
  // then differentiated by its measure name; the actual leaf keeps the
  // smart period label for consistency with AvA.
  const periodLbl = smartPeriodLabel(period, variant, reportingDate, fyStartMonth);
  const measureName = source?.displayName ?? '';
  const isActual = classifySource(source) === 'actual';
  const defaultLabel =
    input.isPairedCurrent && !isActual && measureName ? measureName : periodLbl;

  return {
    node: input.borrowNode,
    leafIndex: -1,
    formatter,
    defaultLabel,
    visible: input.visible,
    groupLabel: periodGroupLabel(period, reportingDate, fyStartMonth),
    isPeriodSynthesis: period,
    periodVariant: variant,
    periodSourceIdxs: input.periodSourceIdxs,
  };
}

export class SynthesizePeriodLeavesStage implements PipelineStage {
  readonly name = 'synthesizePeriodLeaves';

  apply(tree: ColumnTree, matrix: DataViewMatrix, opts: FormatOptions): ColumnTree {
    if (tree.leaves.length === 0) {
      return tree;
    }

    const showMtd = opts.showMtd !== false;
    const showQtd = opts.showQtd !== false;
    const showYtd = opts.showYtd !== false;
    const showFy = opts.showFy !== false;
    const showPriorYear = opts.showPriorYear !== false;
    if (!showMtd && !showQtd && !showYtd && !showFy) {
      return tree;
    }

    const descriptors = inspectColumnLeaves(matrix);
    if (!descriptors || descriptors.length === 0) {
      return tree;
    }

    const mode = opts.compareAgainstMode as ClassifyMode | undefined;
    const valueSources: DataViewMetadataColumn[] = matrix.valueSources || [];
    const allSourceIdxs = uniqueSourceIdxs(descriptors);
    const baseSourceIdxs = filterSourcesByMode(allSourceIdxs, valueSources, mode);
    if (baseSourceIdxs.length > MAX_PAIRED_SOURCES) {
      return tree;
    }

    // FY in AvA is the same single-measure rolling 12-month sum as
    // December YTD, so it is dropped to avoid a redundant column.
    const isAvA = mode === undefined || mode === 'priorYear';
    const enabledPeriods: PeriodKind[] = [];
    if (showMtd) enabledPeriods.push('mtd');
    if (showQtd) enabledPeriods.push('qtd');
    if (showYtd) enabledPeriods.push('ytd');
    if (showFy && !isAvA) enabledPeriods.push('fy');
    if (enabledPeriods.length === 0) {
      return tree;
    }

    const borrowNode = firstColumnLeafNode(matrix);
    if (!borrowNode) {
      return tree;
    }

    const fyStartMonth: FyStartMonth = (opts.fyStartMonth as FyStartMonth) ?? 1;
    const reportingDate = resolveReportingDate(descriptors, opts.selectedDate);

    const isPairedCurrent =
      (mode === 'budget' || mode === 'forecast' || mode === 'forecastVsForecast') &&
      baseSourceIdxs.length === 2;

    const synthesized: ColumnLeaf[] = [];
    for (const period of enabledPeriods) {
      const spec = periodSpec(
        period,
        mode,
        baseSourceIdxs,
        allSourceIdxs,
        valueSources,
        showPriorYear,
      );
      for (const sourceIdx of spec.sourceIdxs) {
        const variants = spec.variantsBySource.get(sourceIdx) ?? ['current'];
        for (const variant of variants) {
          const win = computeWindow(period, variant, reportingDate, fyStartMonth);
          const periodSourceIdxs: number[] = [];
          for (const d of descriptors) {
            if (d.sourceIdx === sourceIdx && isInWindow(d.date, win)) {
              periodSourceIdxs.push(d.leafIdx);
            }
          }
          // The Actual leaf of a paired-current FY is FY-Actual = Dec-YTD-
          // Actual, redundant with the YTD column. Hide the leaf but keep
          // its periodSourceIdxs so the delta stage can still subtract.
          const hideActualFy =
            period === 'fy' &&
            isPairedCurrent &&
            classifySource(valueSources[sourceIdx]) === 'actual';
          synthesized.push(
            buildPeriodLeaf({
              borrowNode,
              source: valueSources[sourceIdx],
              opts,
              period,
              variant,
              periodSourceIdxs,
              reportingDate,
              fyStartMonth,
              isPairedCurrent,
              visible: !hideActualFy,
            }),
          );
        }
      }
    }

    if (synthesized.length === 0) {
      return tree;
    }

    const levels = [synthesized.map((l) => ({ node: l.node, leafCount: 1 }))];
    return { levels, leaves: synthesized };
  }
}
