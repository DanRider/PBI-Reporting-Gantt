// L1 primitive. Bounds a possibly-absent, possibly-garbage numeric input
// into a known [min, max] range, falling back to a sane default when the
// input is not a usable finite number. The named Range constants are the
// single source of truth for the UI numeric limits the rest of the visual
// reads (row height, font size, decimal counts, fiscal-year start month).

// A numeric constraint: the closed interval [min, max] plus the value to
// substitute when an input cannot be coerced to a finite number.
export interface Range {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

// Power BI hands settings through as `PrimitiveValue`, which can be a
// string, boolean, Date, null, or undefined depending on how the report
// author filled the format pane. Clamping here means callers never carry
// that uncertainty into layout math.
export function clamp(value: unknown, range: Range): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return range.default;
  }
  return Math.max(range.min, Math.min(range.max, value));
}

// Body row height in px. Default 24 reads comfortably at the default font.
export const ROW_HEIGHT: Range = { min: 16, max: 60, default: 24 };

// Body font size in px. 13 matches the host report's default text size.
export const BODY_FONT_SIZE: Range = { min: 8, max: 32, default: 13 };

// Decimal places the report author may request in the format pane.
export const DECIMALS: Range = { min: 0, max: 4, default: 0 };

// Decimal places used for internal format-string assembly, where one or
// two extra places are sometimes needed before the value is scaled.
export const DECIMALS_INTERNAL: Range = { min: 0, max: 6, default: 0 };

// Fiscal-year start month, 1 = January. Drives every period-window calc.
export const FY_START_MONTH: Range = { min: 1, max: 12, default: 1 };
