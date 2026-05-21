// L2 pipeline. Resolves, for one (period, mode) cell, exactly which value
// sources participate and which variant (current vs prior-year) each one
// renders. Almost every cell uses the mode's default source pair; the one
// real branch is FY in a paired mode. There, Budget is the plan locked at
// year start while the current Forecast is the live re-plan, so the most
// meaningful full-year comparison is Forecast minus Budget — and Forecast
// must sit on the LEFT so a forecast revised upward reads as a positive
// delta. When a paired FY has only one of the two plans bound it degrades
// to that plan versus prior-year actual. This file is pure: it reads the
// source metadata and returns a plan; it never touches the matrix or DOM.

import powerbi from 'powerbi-visuals-api';

import type { PeriodKind, PeriodVariant } from '../primitives/timeSeries';
import { classifySource, type ClassifyMode, type SourceKind } from './sourceKinds';

import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

// The resolved plan for one period cell: which sources render, and the
// variant list each renders. A single source in AvA may carry both
// 'current' and 'prior'; a paired mode carries one variant per source.
export interface PeriodSpec {
  sourceIdxs: number[];
  variantsBySource: Map<number, PeriodVariant[]>;
}

const PAIRED_MODES: ReadonlySet<ClassifyMode> = new Set([
  'budget',
  'forecast',
  'forecastVsForecast',
]);

function isPairedMode(mode: ClassifyMode | undefined): boolean {
  return mode !== undefined && PAIRED_MODES.has(mode);
}

// Resolve the FY-in-paired-mode override. Returns the override spec, or
// null when this is not that cell or neither plan/fallback is bound (the
// caller then falls through to the default pairing).
function fyPairedOverride(
  period: PeriodKind,
  mode: ClassifyMode | undefined,
  allSourceIdxs: readonly number[],
  valueSources: readonly DataViewMetadataColumn[],
): PeriodSpec | null {
  if (period !== 'fy' || (mode !== 'budget' && mode !== 'forecast')) {
    return null;
  }

  const kinds = allSourceIdxs.map((i) => classifySource(valueSources[i]));
  const firstOfKind = (kind: SourceKind): number | undefined => {
    const at = kinds.indexOf(kind);
    return at < 0 ? undefined : allSourceIdxs[at];
  };

  const budgetIdx = firstOfKind('budget');
  const forecastIdx = firstOfKind('forecast');
  const actualIdx = firstOfKind('actual');

  // Forecast LEFT, Budget RIGHT: Δ = Forecast − Budget is positive when the
  // forecast has revised up from the year-start plan.
  if (forecastIdx !== undefined && budgetIdx !== undefined) {
    return {
      sourceIdxs: [forecastIdx, budgetIdx],
      variantsBySource: new Map([
        [forecastIdx, ['current']],
        [budgetIdx, ['current']],
      ]),
    };
  }
  if (mode === 'budget' && budgetIdx !== undefined && actualIdx !== undefined) {
    return {
      sourceIdxs: [budgetIdx, actualIdx],
      variantsBySource: new Map([
        [budgetIdx, ['current']],
        [actualIdx, ['prior']],
      ]),
    };
  }
  if (mode === 'forecast' && forecastIdx !== undefined && actualIdx !== undefined) {
    return {
      sourceIdxs: [forecastIdx, actualIdx],
      variantsBySource: new Map([
        [forecastIdx, ['current']],
        [actualIdx, ['prior']],
      ]),
    };
  }
  return null;
}

// The default pairing: use the mode's base sources. A single source in AvA
// renders current (+ prior when prior-year is on); a two-source paired mode
// renders both current side by side; an ad-hoc two-source AvA renders the
// first current and the second as the prior-year companion.
function defaultSpec(
  mode: ClassifyMode | undefined,
  baseSourceIdxs: readonly number[],
  showPriorYear: boolean,
): PeriodSpec {
  const sourceIdxs = baseSourceIdxs.slice();
  const variantsBySource = new Map<number, PeriodVariant[]>();
  const isSingle = sourceIdxs.length === 1;
  const isPairedCurrent = isPairedMode(mode) && sourceIdxs.length === 2;

  for (const idx of sourceIdxs) {
    if (isPairedCurrent) {
      variantsBySource.set(idx, ['current']);
    } else if (isSingle) {
      variantsBySource.set(idx, showPriorYear ? ['current', 'prior'] : ['current']);
    } else {
      variantsBySource.set(idx, idx === sourceIdxs[0] ? ['current'] : ['prior']);
    }
  }
  return { sourceIdxs, variantsBySource };
}

export function periodSpec(
  period: PeriodKind,
  mode: ClassifyMode | undefined,
  baseSourceIdxs: readonly number[],
  allSourceIdxs: readonly number[],
  valueSources: readonly DataViewMetadataColumn[],
  showPriorYear: boolean,
): PeriodSpec {
  const override = fyPairedOverride(period, mode, allSourceIdxs, valueSources);
  if (override) {
    return override;
  }
  return defaultSpec(mode, baseSourceIdxs, showPriorYear);
}
