import { describe, it, expect } from 'vitest';
import powerbi from 'powerbi-visuals-api';
import { resolveTheme, ThemeOverrides } from './theme';

import IColorPalette = powerbi.extensibility.IColorPalette;

// Test double: resolveTheme only ever calls getColor. `map` drives the
// palette answer; an absent key yields an empty value (palette "miss").
function palette(map: Record<string, string>): IColorPalette {
  return {
    getColor: (key: string) => ({ value: map[key] ?? '' }),
  } as IColorPalette;
}

// Same shape but getColor throws — some hosts do this for unknown keys.
function throwingPalette(): IColorPalette {
  return {
    getColor: () => {
      throw new Error('palette unavailable');
    },
  } as IColorPalette;
}

const NO_OVERRIDES: ThemeOverrides = {};

describe('resolveTheme — precedence: override > palette > fallback', () => {
  it('returns explicit overrides verbatim when every slot is set', () => {
    const overrides: ThemeOverrides = {
      headerBg: '#111111',
      headerFg: '#222222',
      bodyFg: '#333333',
      borderFg: '#444444',
      altRowBg: '#555555',
      ibcsPositive: '#0F0',
      ibcsNegative: '#F00',
      ibcsNeutral: '#999',
    };
    expect(resolveTheme(palette({}), overrides)).toEqual(overrides);
  });

  it('falls through to palette colors when no overrides given', () => {
    const resolved = resolveTheme(
      palette({
        'cortex-matrix-lt2-header-bg': '#ABCDEF',
        'cortex-matrix-lt2-ibcs-positive': '#123456',
      }),
      NO_OVERRIDES,
    );
    expect(resolved.headerBg).toBe('#ABCDEF');
    expect(resolved.ibcsPositive).toBe('#123456');
  });

  it('falls through to hard fallbacks when palette has nothing', () => {
    const resolved = resolveTheme(palette({}), NO_OVERRIDES);
    expect(resolved.headerBg).toBe('#F2F2F2');
    expect(resolved.bodyFg).toBe('#252423');
    expect(resolved.ibcsNegative).toBe('#D14545');
    expect(resolved.ibcsNeutral).toBe('#888888');
  });

  it('falls through to fallbacks when palette.getColor throws', () => {
    const resolved = resolveTheme(throwingPalette(), NO_OVERRIDES);
    expect(resolved.altRowBg).toBe('#FAFAFA');
    expect(resolved.ibcsPositive).toBe('#00A86B');
  });

  it('treats an empty-string override as "unset" and falls through', () => {
    const resolved = resolveTheme(
      palette({ 'cortex-matrix-lt2-header-bg': '#AAAAAA' }),
      { headerBg: '' },
    );
    expect(resolved.headerBg).toBe('#AAAAAA');
  });

  it('empty-string override with empty palette reaches the fallback', () => {
    const resolved = resolveTheme(palette({}), { borderFg: '' });
    expect(resolved.borderFg).toBe('#D9D9D9');
  });

  it('resolves each slot independently (one override, rest fall through)', () => {
    const resolved = resolveTheme(palette({}), { bodyFg: '#0A0A0A' });
    expect(resolved.bodyFg).toBe('#0A0A0A');
    expect(resolved.headerBg).toBe('#F2F2F2');
    expect(resolved.headerFg).toBe('#252423');
  });
});
