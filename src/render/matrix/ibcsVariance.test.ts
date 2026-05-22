import { describe, it, expect } from 'vitest';

import { ibcsDecorationFor, type IbcsColorSet } from './ibcsVariance';

const COLORS: IbcsColorSet = {
  ibcsPositive: '#00aa00',
  ibcsNegative: '#cc0000',
  ibcsNeutral: '#888888',
};

describe('ibcsDecorationFor — non-encoding cases return null', () => {
  it('null and undefined produce no decoration', () => {
    expect(ibcsDecorationFor(null, COLORS)).toBeNull();
    expect(ibcsDecorationFor(undefined, COLORS)).toBeNull();
  });

  it('NaN and Infinity produce no decoration', () => {
    expect(ibcsDecorationFor(NaN, COLORS)).toBeNull();
    expect(ibcsDecorationFor(Infinity, COLORS)).toBeNull();
    expect(ibcsDecorationFor(-Infinity, COLORS)).toBeNull();
  });

  it("'neutral' favorability suppresses encoding entirely", () => {
    expect(ibcsDecorationFor(500, COLORS, 'classic', 'neutral')).toBeNull();
    expect(ibcsDecorationFor(-500, COLORS, 'classic', 'neutral')).toBeNull();
  });
});

describe('ibcsDecorationFor — near-zero is flat and neutral', () => {
  it('a value below EPSILON reads flat with the neutral color', () => {
    const deco = ibcsDecorationFor(1e-12, COLORS);
    expect(deco).not.toBeNull();
    expect(deco?.direction).toBe('flat');
    expect(deco?.color).toBe(COLORS.ibcsNeutral);
    expect(deco?.glyph).toBe('–');
  });

  it('exact zero is flat', () => {
    expect(ibcsDecorationFor(0, COLORS)?.direction).toBe('flat');
  });

  it('minimal style blanks the flat glyph', () => {
    expect(ibcsDecorationFor(0, COLORS, 'minimal')?.glyph).toBe('');
  });
});

describe('ibcsDecorationFor — higherIsBetter (default)', () => {
  it('positive variance is up + positive color', () => {
    const deco = ibcsDecorationFor(120, COLORS);
    expect(deco?.direction).toBe('up');
    expect(deco?.glyph).toBe('▲');
    expect(deco?.color).toBe(COLORS.ibcsPositive);
  });

  it('negative variance is down + negative color', () => {
    const deco = ibcsDecorationFor(-120, COLORS);
    expect(deco?.direction).toBe('down');
    expect(deco?.glyph).toBe('▼');
    expect(deco?.color).toBe(COLORS.ibcsNegative);
  });
});

describe('ibcsDecorationFor — lowerIsBetter inverts the color, not the glyph', () => {
  it('positive variance keeps the up glyph but paints the negative color', () => {
    const deco = ibcsDecorationFor(120, COLORS, 'classic', 'lowerIsBetter');
    expect(deco?.direction).toBe('up');
    expect(deco?.glyph).toBe('▲');
    expect(deco?.color).toBe(COLORS.ibcsNegative);
  });

  it('negative variance keeps the down glyph but paints the positive color', () => {
    const deco = ibcsDecorationFor(-120, COLORS, 'classic', 'lowerIsBetter');
    expect(deco?.direction).toBe('down');
    expect(deco?.glyph).toBe('▼');
    expect(deco?.color).toBe(COLORS.ibcsPositive);
  });
});

describe('ibcsDecorationFor — minimal style suppresses glyphs only', () => {
  it('color survives, glyph is blank for up and down', () => {
    const up = ibcsDecorationFor(50, COLORS, 'minimal');
    expect(up?.glyph).toBe('');
    expect(up?.color).toBe(COLORS.ibcsPositive);
    const down = ibcsDecorationFor(-50, COLORS, 'minimal');
    expect(down?.glyph).toBe('');
    expect(down?.color).toBe(COLORS.ibcsNegative);
  });
});
