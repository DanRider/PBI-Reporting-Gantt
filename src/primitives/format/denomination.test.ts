import { describe, it, expect } from 'vitest';
import { denominationSpec } from './denomination';

const DOLLAR_BASE = '$#,##0';

describe('denominationSpec — dollars / undefined denom (no scaling)', () => {
  it('dollars + 0 decimals + showLetter true rebuilds 3-section format, scale 1', () => {
    expect(denominationSpec(DOLLAR_BASE, 'dollars', 0, true)).toEqual({
      format: '$#,##0;($#,##0);$0',
      scale: 1,
    });
  });

  it('dollars + 2 decimals applies decimals to every section', () => {
    expect(denominationSpec(DOLLAR_BASE, 'dollars', 2, true)).toEqual({
      format: '$#,##0.00;($#,##0.00);$0.00',
      scale: 1,
    });
  });

  it('dollars + 4 decimals + showLetter false (letter param ignored, no scaling)', () => {
    expect(denominationSpec(DOLLAR_BASE, 'dollars', 4, false)).toEqual({
      format: '$#,##0.0000;($#,##0.0000);$0.0000',
      scale: 1,
    });
  });

  it('undefined denom defaults to dollars-style rebuild', () => {
    expect(denominationSpec(DOLLAR_BASE, undefined, 0, true)).toEqual({
      format: '$#,##0;($#,##0);$0',
      scale: 1,
    });
  });

  it('dollars without $ in base passes the base through', () => {
    expect(denominationSpec('#,##0', 'dollars', 2, true)).toEqual({
      format: '#,##0',
      scale: 1,
    });
  });

  it('undefined base format passes undefined through, scale 1', () => {
    expect(denominationSpec(undefined, 'dollars', 2, true)).toEqual({
      format: undefined,
      scale: 1,
    });
  });
});

describe('denominationSpec — thousands (K)', () => {
  it('thousands + 0 dec + showLetter true gives K suffix and 1/1000 scale', () => {
    expect(denominationSpec(DOLLAR_BASE, 'thousands', 0, true)).toEqual({
      format: '$#,##0"K";($#,##0"K");$0"K"',
      scale: 1 / 1000,
    });
  });

  it('thousands + 2 dec + showLetter true', () => {
    expect(denominationSpec(DOLLAR_BASE, 'thousands', 2, true)).toEqual({
      format: '$#,##0.00"K";($#,##0.00"K");$0.00"K"',
      scale: 1 / 1000,
    });
  });

  it('thousands + 4 dec + showLetter true', () => {
    expect(denominationSpec(DOLLAR_BASE, 'thousands', 4, true)).toEqual({
      format: '$#,##0.0000"K";($#,##0.0000"K");$0.0000"K"',
      scale: 1 / 1000,
    });
  });

  it('thousands + 0 dec + showLetter false drops suffix, keeps 1/1000 scale', () => {
    expect(denominationSpec(DOLLAR_BASE, 'thousands', 0, false)).toEqual({
      format: '$#,##0;($#,##0);$0',
      scale: 1 / 1000,
    });
  });

  it('thousands + 2 dec + showLetter false', () => {
    expect(denominationSpec(DOLLAR_BASE, 'thousands', 2, false)).toEqual({
      format: '$#,##0.00;($#,##0.00);$0.00',
      scale: 1 / 1000,
    });
  });

  it('thousands + 4 dec + showLetter false', () => {
    expect(denominationSpec(DOLLAR_BASE, 'thousands', 4, false)).toEqual({
      format: '$#,##0.0000;($#,##0.0000);$0.0000',
      scale: 1 / 1000,
    });
  });
});

describe('denominationSpec — millions (M)', () => {
  it('millions + 0 dec + showLetter true gives M suffix and 1/1_000_000 scale', () => {
    expect(denominationSpec(DOLLAR_BASE, 'millions', 0, true)).toEqual({
      format: '$#,##0"M";($#,##0"M");$0"M"',
      scale: 1 / 1000000,
    });
  });

  it('millions + 2 dec + showLetter true', () => {
    expect(denominationSpec(DOLLAR_BASE, 'millions', 2, true)).toEqual({
      format: '$#,##0.00"M";($#,##0.00"M");$0.00"M"',
      scale: 1 / 1000000,
    });
  });

  it('millions + 4 dec + showLetter true', () => {
    expect(denominationSpec(DOLLAR_BASE, 'millions', 4, true)).toEqual({
      format: '$#,##0.0000"M";($#,##0.0000"M");$0.0000"M"',
      scale: 1 / 1000000,
    });
  });

  it('millions + 0 dec + showLetter false drops suffix', () => {
    expect(denominationSpec(DOLLAR_BASE, 'millions', 0, false)).toEqual({
      format: '$#,##0;($#,##0);$0',
      scale: 1 / 1000000,
    });
  });

  it('millions + 2 dec + showLetter false', () => {
    expect(denominationSpec(DOLLAR_BASE, 'millions', 2, false)).toEqual({
      format: '$#,##0.00;($#,##0.00);$0.00',
      scale: 1 / 1000000,
    });
  });

  it('millions + 4 dec + showLetter false', () => {
    expect(denominationSpec(DOLLAR_BASE, 'millions', 4, false)).toEqual({
      format: '$#,##0.0000;($#,##0.0000);$0.0000',
      scale: 1 / 1000000,
    });
  });
});

describe('denominationSpec — edge cases', () => {
  it('thousands on a non-currency format passes through, scale 1', () => {
    expect(denominationSpec('#,##0', 'thousands', 2, true)).toEqual({
      format: '#,##0',
      scale: 1,
    });
  });

  it('millions on an undefined base passes undefined through, scale 1', () => {
    expect(denominationSpec(undefined, 'millions', 2, true)).toEqual({
      format: undefined,
      scale: 1,
    });
  });

  it('decimals undefined defaults to 0', () => {
    expect(denominationSpec(DOLLAR_BASE, 'dollars', undefined, true)).toEqual({
      format: '$#,##0;($#,##0);$0',
      scale: 1,
    });
  });

  it('decimals above the internal cap clamp to 6', () => {
    expect(denominationSpec(DOLLAR_BASE, 'dollars', 99, true)).toEqual({
      format: '$#,##0.000000;($#,##0.000000);$0.000000',
      scale: 1,
    });
  });

  it('negative decimals clamp to 0', () => {
    expect(denominationSpec(DOLLAR_BASE, 'dollars', -5, true)).toEqual({
      format: '$#,##0;($#,##0);$0',
      scale: 1,
    });
  });

  it('fractional decimals floor before clamping', () => {
    expect(denominationSpec(DOLLAR_BASE, 'dollars', 2.9, true)).toEqual({
      format: '$#,##0.00;($#,##0.00);$0.00',
      scale: 1,
    });
  });

  it('showLetter undefined defaults to true (letter present for thousands)', () => {
    expect(denominationSpec(DOLLAR_BASE, 'thousands', 0, undefined)).toEqual({
      format: '$#,##0"K";($#,##0"K");$0"K"',
      scale: 1 / 1000,
    });
  });
});
