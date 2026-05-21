// L2 pipeline. Classifies a bound value source as an actual, a budget, or
// a forecast measure purely from its query/display name, and resolves the
// subset of bound sources a compare-against mode pairs. Name matching is
// ordered on purpose: a measure literally named "forecast budget" must read
// as a budget, so the budget test runs before the forecast test. The mode
// filter is graceful — when the kind a mode expects is not bound it falls
// back to the leading sources rather than producing nothing, so a partly
// configured report still renders something sensible.

import powerbi from 'powerbi-visuals-api';

import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

// The three semantic roles a value source can play in variance synthesis.
export type SourceKind = 'actual' | 'budget' | 'forecast';

// Compare-against modes that pair two distinct measures in the same period.
// 'priorYear' (AvA) is the single-measure default and is handled separately.
type PairedMode = 'budget' | 'forecast' | 'forecastVsForecast';

export type ClassifyMode = 'priorYear' | PairedMode;

// Forecast also answers to these synonyms. 'plan' is here because finance
// teams routinely label the rolling re-plan a "plan"; 'budget' still wins
// because its test runs first below.
const FORECAST_TOKENS = ['forecast', 'fcst', 'plan'];

function nameOf(source: DataViewMetadataColumn | undefined): string {
  return (source?.queryName ?? source?.displayName ?? '').toLowerCase();
}

// Classify by substring. Budget is tested before forecast so a measure
// whose name contains both words resolves to budget; an unmatched name is
// an actual, which is the safe default for an unconfigured binding.
export function classifySource(source: DataViewMetadataColumn | undefined): SourceKind {
  const name = nameOf(source);
  if (name.includes('budget')) {
    return 'budget';
  }
  if (FORECAST_TOKENS.some((token) => name.includes(token))) {
    return 'forecast';
  }
  return 'actual';
}

// Resolve the source indices a mode pairs. With one source there is nothing
// to pair, so the input passes through. Otherwise each mode looks up the
// kinds it needs and, when they are bound, returns exactly that pair (or
// single); when they are not bound it falls back to the leading one or two
// sources so the report still renders.
export function filterSourcesByMode(
  sourceIdxs: readonly number[],
  valueSources: readonly DataViewMetadataColumn[],
  mode: ClassifyMode | undefined,
): number[] {
  if (sourceIdxs.length <= 1) {
    return sourceIdxs.slice();
  }

  const kinds = sourceIdxs.map((i) => classifySource(valueSources[i]));
  const firstOfKind = (kind: SourceKind): number | undefined => {
    const at = kinds.indexOf(kind);
    return at < 0 ? undefined : sourceIdxs[at];
  };
  const allOfKind = (kind: SourceKind): number[] =>
    sourceIdxs.filter((_, i) => kinds[i] === kind);

  switch (mode) {
    case 'budget': {
      const actual = firstOfKind('actual');
      const budget = firstOfKind('budget');
      if (actual !== undefined && budget !== undefined) {
        return [actual, budget];
      }
      return sourceIdxs.slice(0, 2);
    }
    case 'forecast': {
      const actual = firstOfKind('actual');
      const forecast = firstOfKind('forecast');
      if (actual !== undefined && forecast !== undefined) {
        return [actual, forecast];
      }
      return sourceIdxs.slice(0, 2);
    }
    case 'forecastVsForecast': {
      const forecasts = allOfKind('forecast');
      if (forecasts.length >= 2) {
        return forecasts.slice(0, 2);
      }
      return sourceIdxs.slice(0, 2);
    }
    case 'priorYear':
    default: {
      const actual = firstOfKind('actual');
      return actual !== undefined ? [actual] : sourceIdxs.slice(0, 1);
    }
  }
}
