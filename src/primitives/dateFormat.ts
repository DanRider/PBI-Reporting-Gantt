// L1 primitive. A DAX FORMAT subset for dates plus a tolerant coercion of
// a Power BI primitive to a Date. We implement the DAX token set directly
// rather than lean on Intl.DateTimeFormat because report authors typing
// "MMM YYYY" expect DAX casing/semantics, not the platform locale's. Both
// functions are salvaged into the L1 layer so synthesis code can format
// and parse header dates without reaching into a heavier model module.

import powerbi from 'powerbi-visuals-api';

import PrimitiveValue = powerbi.PrimitiveValue;

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

// Epoch numbers and Date.parse both happily accept tiny integers that are
// really row ordinals, so anything resolving before this year is rejected.
const MIN_PLAUSIBLE_YEAR = 1900;

const RE_YEAR_MONTH = /^(\d{4})\s+([A-Za-z]{3,9})$/;
const RE_MONTH_YEAR = /^([A-Za-z]{3,9})\s+(\d{4})$/;

// Case-insensitive on the first three letters; -1 when not a month name.
function monthIndex(name: string): number {
  return MONTH_KEYS.indexOf(name.toLowerCase().slice(0, 3));
}

// Longest tokens MUST precede their prefixes in the alternation: JS regex
// takes the leftmost matching branch, so MMMM before MMM before MM before
// M (likewise YYYY/YY, DD/D). Non-token characters pass through verbatim.
// There is no literal-escape mechanism here by design — header-template
// escaping is a separate concern that was deleted in v0.1.
export function formatDate(d: Date, fmt: string): string {
  const token: Record<string, () => string> = {
    MMMM: () => MONTH_NAMES_FULL[d.getMonth()],
    MMM: () => MONTH_NAMES_SHORT[d.getMonth()],
    MM: () => String(d.getMonth() + 1).padStart(2, '0'),
    M: () => String(d.getMonth() + 1),
    YYYY: () => String(d.getFullYear()),
    YY: () => String(d.getFullYear() % 100).padStart(2, '0'),
    DD: () => String(d.getDate()).padStart(2, '0'),
    D: () => String(d.getDate()),
  };
  return fmt.replace(/MMMM|MMM|MM|M|YYYY|YY|DD|D/g, (m) => token[m]());
}

// Order matters: a valid Date and a real epoch number short-circuit; the
// two "YYYY Mon" / "Mon YYYY" shapes are matched before Date.parse so a
// month-precision label resolves to the first of that month rather than
// whatever the platform parser guesses.
export function coerceToDate(v: PrimitiveValue | null | undefined): Date | null {
  if (v == null) {
    return null;
  }

  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v;
  }

  if (typeof v === 'number') {
    const d = new Date(v);
    return !isNaN(d.getTime()) && d.getFullYear() > MIN_PLAUSIBLE_YEAR ? d : null;
  }

  const s = String(v).trim();
  if (s === '') {
    return null;
  }

  const ym = RE_YEAR_MONTH.exec(s);
  if (ym) {
    const mi = monthIndex(ym[2]);
    if (mi >= 0) {
      return new Date(parseInt(ym[1], 10), mi, 1);
    }
  }

  const my = RE_MONTH_YEAR.exec(s);
  if (my) {
    const mi = monthIndex(my[1]);
    if (mi >= 0) {
      return new Date(parseInt(my[2], 10), mi, 1);
    }
  }

  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    if (d.getFullYear() > MIN_PLAUSIBLE_YEAR) {
      return d;
    }
  }

  return null;
}
