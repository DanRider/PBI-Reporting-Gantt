// L1 primitive. Decides the format string a synthesized leaf should wear
// based on the source measure's format hint and what kind of leaf is being
// synthesized. Percent-by-nature kinds (deltaPct, attainment) always read
// as a percentage; value-preserving kinds (period, delta, pace) inherit
// the source format wholesale. It declares its own input interface rather
// than importing the model type, so it stays a leaf of the L1 layer.

export interface FormatHintInput {
  isPercentage: boolean;
  decimalCount: number;
  rawFormat: string | undefined;
}

export type SyntheticKind = 'period' | 'delta' | 'deltaPct' | 'pace' | 'attainment';

export interface FormatSpec {
  format: string;
  scale: number;
}

const DEFAULT_NUMBER_FORMAT = '#,##0';
const DEFAULT_PERCENT_FORMAT = '0%';

// A non-percent source rendered as a percentage has no decimal preference
// of its own, so fall back to one decimal place (the 0.0% baseline).
const NON_PERCENT_PERCENT_DECIMALS = 1;

function decimalsToFormatTail(decimals: number): string {
  return decimals <= 0 ? '' : `.${'0'.repeat(decimals)}`;
}

// Scale is always 1 here: inheritance never rescales, it only restyles.
// Magnitude scaling is denomination's job, kept strictly separate.
export function inheritedFormat(
  hint: FormatHintInput | undefined,
  kind: SyntheticKind,
): FormatSpec {
  if (kind === 'deltaPct' || kind === 'attainment') {
    if (!hint) {
      return { format: DEFAULT_PERCENT_FORMAT, scale: 1 };
    }
    const decimals = hint.isPercentage
      ? hint.decimalCount
      : NON_PERCENT_PERCENT_DECIMALS;
    return { format: `0${decimalsToFormatTail(decimals)}%`, scale: 1 };
  }

  if (!hint) {
    return { format: DEFAULT_NUMBER_FORMAT, scale: 1 };
  }

  return { format: hint.rawFormat ?? DEFAULT_NUMBER_FORMAT, scale: 1 };
}
