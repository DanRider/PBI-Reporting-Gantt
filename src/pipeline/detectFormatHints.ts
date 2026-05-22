// L2 pipeline. The format-hint pre-pass. It is NOT a PipelineStage: it
// runs once, before the stage pipeline executes, because its product is a
// map the later stages READ off FormatOptions rather than a transformed
// ColumnTree. For each Value-role measure it parses the source format
// STRING — never the measure name — into a structural reading: does the
// first section carry a currency symbol, is it a percentage, how many
// decimal places, is it integer-only. Multi-section masks
// (positive;negative;zero[;text]) are reduced to their first section, so
// a four-section mask is read exactly like a three-section one.

import powerbi from 'powerbi-visuals-api';

import type { FormatHint } from '../model/formatOptions';

import DataViewMatrix = powerbi.DataViewMatrix;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

// The currency glyphs that mark a format as monetary. Matched against the
// first section only — a sign-only later section never implies currency.
const CURRENCY_RE = /[$€£¥]/;

// The hint for a measure whose source format string is absent: treat it as
// an integer with no currency and no percentage, which is the safe default
// the downstream formatter degrades to gracefully.
function emptyHint(queryName: string): FormatHint {
  return {
    queryName,
    hasCurrencySymbol: false,
    isPercentage: false,
    isInteger: true,
    decimalCount: 0,
    rawFormat: undefined,
  };
}

// Count the contiguous run of '0'/'#' placeholders immediately after the
// first '.' — that run length is the decimal-place count. No dot at all
// (or nothing after it) means zero decimals, hence integer-only.
function decimalRunLength(section: string): number {
  const dotIdx = section.indexOf('.');
  if (dotIdx < 0) return 0;
  let count = 0;
  for (let i = dotIdx + 1; i < section.length; i++) {
    const ch = section[i];
    if (ch === '0' || ch === '#') count++;
    else break;
  }
  return count;
}

// Parse one measure's format string into a FormatHint. Pure: depends only
// on its two arguments, no PBI runtime touched.
function parseFormatHint(queryName: string, rawFormat: string | undefined): FormatHint {
  if (!rawFormat) return emptyHint(queryName);

  const firstSection = rawFormat.split(';')[0];
  const symbolMatch = CURRENCY_RE.exec(firstSection);
  const decimalCount = decimalRunLength(firstSection);

  const hint: FormatHint = {
    queryName,
    hasCurrencySymbol: symbolMatch !== null,
    isPercentage: firstSection.includes('%'),
    isInteger: decimalCount === 0,
    decimalCount,
    rawFormat,
  };
  if (symbolMatch !== null) {
    return { ...hint, currencySymbol: symbolMatch[0] };
  }
  return hint;
}

// The pre-pass entry point. Builds queryName→FormatHint over every value
// source; an empty map when there are no value sources is correct — later
// stages then see no hints and fall back to source format strings.
export function detectFormatHints(matrix: DataViewMatrix): ReadonlyMap<string, FormatHint> {
  const sources: readonly DataViewMetadataColumn[] = matrix.valueSources ?? [];
  const hints = new Map<string, FormatHint>();
  for (const source of sources) {
    const queryName = source.queryName ?? source.displayName;
    if (!queryName) continue;
    hints.set(queryName, parseFormatHint(queryName, source.format));
  }
  return hints;
}
