import { describe, it, expect } from 'vitest';
import { inheritedFormat, FormatHintInput } from './inheritedFormat';

function hint(overrides: Partial<FormatHintInput>): FormatHintInput {
  return { isPercentage: false, decimalCount: 0, rawFormat: undefined, ...overrides };
}

const USD_HINT = hint({ rawFormat: '$#,##0' });
const USD_2DEC_HINT = hint({ decimalCount: 2, rawFormat: '$#,##0.00' });
const PCT_HINT = hint({ isPercentage: true, rawFormat: '0%' });
const PCT_2DEC_HINT = hint({ isPercentage: true, decimalCount: 2, rawFormat: '0.00%' });
const INT_HINT = hint({ rawFormat: '#,##0' });

describe('inheritedFormat — delta kind preserves source format', () => {
  it('delta on USD hint preserves $#,##0', () => {
    expect(inheritedFormat(USD_HINT, 'delta')).toEqual({ format: '$#,##0', scale: 1 });
  });

  it('delta on USD 2-decimal hint preserves $#,##0.00', () => {
    expect(inheritedFormat(USD_2DEC_HINT, 'delta')).toEqual({
      format: '$#,##0.00',
      scale: 1,
    });
  });

  it('delta on integer hint preserves #,##0', () => {
    expect(inheritedFormat(INT_HINT, 'delta')).toEqual({ format: '#,##0', scale: 1 });
  });

  it('delta on missing hint yields safe default #,##0', () => {
    expect(inheritedFormat(undefined, 'delta')).toEqual({ format: '#,##0', scale: 1 });
  });
});

describe('inheritedFormat — period kind preserves source format', () => {
  it('period on USD hint preserves $', () => {
    expect(inheritedFormat(USD_HINT, 'period')).toEqual({ format: '$#,##0', scale: 1 });
  });

  it('period on missing hint yields safe default #,##0', () => {
    expect(inheritedFormat(undefined, 'period')).toEqual({ format: '#,##0', scale: 1 });
  });
});

describe('inheritedFormat — pace kind preserves source format', () => {
  it('pace on USD hint preserves $', () => {
    expect(inheritedFormat(USD_HINT, 'pace')).toEqual({ format: '$#,##0', scale: 1 });
  });
});

describe('inheritedFormat — deltaPct kind forces percent', () => {
  it('deltaPct on USD hint uses 1-decimal percent default', () => {
    expect(inheritedFormat(USD_HINT, 'deltaPct')).toEqual({ format: '0.0%', scale: 1 });
  });

  it('deltaPct on integer hint uses 1-decimal percent default', () => {
    expect(inheritedFormat(INT_HINT, 'deltaPct')).toEqual({ format: '0.0%', scale: 1 });
  });

  it('deltaPct on percent hint inherits 0 decimals', () => {
    expect(inheritedFormat(PCT_HINT, 'deltaPct')).toEqual({ format: '0%', scale: 1 });
  });

  it('deltaPct on percent 2-decimal hint inherits 2 decimals', () => {
    expect(inheritedFormat(PCT_2DEC_HINT, 'deltaPct')).toEqual({
      format: '0.00%',
      scale: 1,
    });
  });

  it('deltaPct on missing hint yields 0%', () => {
    expect(inheritedFormat(undefined, 'deltaPct')).toEqual({ format: '0%', scale: 1 });
  });
});

describe('inheritedFormat — attainment kind forces percent', () => {
  it('attainment on USD hint uses 1-decimal percent default', () => {
    expect(inheritedFormat(USD_HINT, 'attainment')).toEqual({ format: '0.0%', scale: 1 });
  });

  it('attainment on missing hint yields 0%', () => {
    expect(inheritedFormat(undefined, 'attainment')).toEqual({ format: '0%', scale: 1 });
  });
});
