// L1 primitive. Given a measure's source format plus the requested
// denomination, decimals, and letter-suffix toggle, returns the format
// string to display with AND the scale factor to multiply the raw value
// by in JS first. Scaling happens in JS, not via a format-string scaling
// comma, because the comma is silently unreliable unless a trailing
// decimal placeholder is present — so we never trust it.

import { clamp, DECIMALS_INTERNAL } from '../clamp';

export type Denomination = 'dollars' | 'thousands' | 'millions';

export interface DenominationSpec {
  format: string | undefined;
  scale: number;
}

// Three-section currency mask: positive ; parenthesized-negative ; zero.
// `tail` is the decimal places, `sfx` the optional quoted K/M letter.
function threeSection(tail: string, sfx: string): string {
  const body = `$#,##0${tail}${sfx}`;
  return `${body};($#,##0${tail}${sfx});$0${tail}${sfx}`;
}

// A non-currency or absent base format means there is nothing to rescale
// safely, so it passes through untouched with scale 1 even when a K/M
// denomination was asked for — the request is meaningless without a `$`.
export function denominationSpec(
  baseFormat: string | undefined,
  denom: Denomination | undefined,
  decimals: number | undefined,
  showLetter: boolean | undefined,
): DenominationSpec {
  const dec = clamp(Math.floor(decimals ?? 0), DECIMALS_INTERNAL);
  const tail = dec > 0 ? `.${'0'.repeat(dec)}` : '';
  const wantLetter = showLetter !== false;

  if (!denom || denom === 'dollars') {
    if (baseFormat && baseFormat.indexOf('$') >= 0) {
      return { format: threeSection(tail, ''), scale: 1 };
    }
    return { format: baseFormat, scale: 1 };
  }

  if (!baseFormat || baseFormat.indexOf('$') < 0) {
    return { format: baseFormat, scale: 1 };
  }

  const scale = denom === 'thousands' ? 1 / 1000 : 1 / 1000000;
  const letter = denom === 'thousands' ? 'K' : 'M';
  const sfx = wantLetter ? `"${letter}"` : '';
  return { format: threeSection(tail, sfx), scale };
}
