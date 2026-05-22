import { describe, it, expect } from 'vitest';

import { detectFormatHints } from './detectFormatHints';
import { matrix, root, source } from './__fixtures__/matrix';

function hintFor(format: string | undefined) {
  const m = matrix(root([]), [source({ displayName: 'M', queryName: 'q', format })]);
  return detectFormatHints(m).get('q')!;
}

describe('detectFormatHints — format-shape coverage', () => {
  it('undefined format → integer, no currency, no percent', () => {
    const h = hintFor(undefined);
    expect(h).toEqual({
      queryName: 'q',
      hasCurrencySymbol: false,
      isPercentage: false,
      isInteger: true,
      decimalCount: 0,
      rawFormat: undefined,
    });
  });

  it('integer-only format → decimalCount 0, isInteger true', () => {
    const h = hintFor('#,##0');
    expect(h.isInteger).toBe(true);
    expect(h.decimalCount).toBe(0);
    expect(h.hasCurrencySymbol).toBe(false);
    expect(h.isPercentage).toBe(false);
  });

  it('three-section currency format → currency from first section, decimals counted', () => {
    const h = hintFor('$#,##0.00;($#,##0.00);$0.00');
    expect(h.hasCurrencySymbol).toBe(true);
    expect(h.currencySymbol).toBe('$');
    expect(h.decimalCount).toBe(2);
    expect(h.isInteger).toBe(false);
    expect(h.isPercentage).toBe(false);
  });

  it('percent format → isPercentage true, decimals counted', () => {
    const h = hintFor('0.0%');
    expect(h.isPercentage).toBe(true);
    expect(h.decimalCount).toBe(1);
    expect(h.hasCurrencySymbol).toBe(false);
  });

  it('non-dollar currency symbol (€) is detected', () => {
    const h = hintFor('€#,##0');
    expect(h.hasCurrencySymbol).toBe(true);
    expect(h.currencySymbol).toBe('€');
  });

  it('four-section format → only the FIRST section drives the hint', () => {
    // positive ; negative ; zero ; text — the 4th section must be ignored.
    const h = hintFor('$#,##0.000;($#,##0.000);$0.000;"n/a"');
    expect(h.hasCurrencySymbol).toBe(true);
    expect(h.currencySymbol).toBe('$');
    expect(h.decimalCount).toBe(3);
    expect(h.isInteger).toBe(false);
    expect(h.rawFormat).toBe('$#,##0.000;($#,##0.000);$0.000;"n/a"');
  });

  it('hash decimal placeholders count toward decimalCount', () => {
    const h = hintFor('0.##');
    expect(h.decimalCount).toBe(2);
    expect(h.isInteger).toBe(false);
  });

  it('a non-numeric run after the dot stops the decimal count', () => {
    const h = hintFor('0.00"x"0');
    expect(h.decimalCount).toBe(2);
  });
});

describe('detectFormatHints — map construction', () => {
  it('returns an empty map when there are no value sources', () => {
    expect(detectFormatHints(matrix(root([]), [])).size).toBe(0);
  });

  it('keys by queryName and one entry per source', () => {
    const m = matrix(root([]), [
      source({ displayName: 'Sales', queryName: 'qSales', format: '$#,##0' }),
      source({ displayName: 'Pct', queryName: 'qPct', format: '0.0%' }),
    ]);
    const hints = detectFormatHints(m);
    expect(hints.size).toBe(2);
    expect(hints.get('qSales')!.hasCurrencySymbol).toBe(true);
    expect(hints.get('qPct')!.isPercentage).toBe(true);
  });

  it('falls back to displayName when queryName is absent', () => {
    const m = matrix(root([]), [source({ displayName: 'OnlyName', format: '#,##0' })]);
    const hints = detectFormatHints(m);
    expect(hints.has('OnlyName')).toBe(true);
  });
});
