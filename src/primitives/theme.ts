// L1 primitive. Resolves the eight colors the matrix paints with into one
// concrete ResolvedTheme, so render code never touches the host palette or
// guesses a fallback. Resolution order per slot: an explicit format-pane
// override, then the host report's color palette keyed by a stable string,
// then a hard-coded hex that always renders.

import powerbi from 'powerbi-visuals-api';

import IColorPalette = powerbi.extensibility.IColorPalette;

// Stable keys handed to IColorPalette.getColor. Stable so a given slot maps
// to the same palette entry across renders and report-theme swaps.
const PALETTE_KEY = {
  headerBg: 'cortex-matrix-lt2-header-bg',
  headerFg: 'cortex-matrix-lt2-header-fg',
  bodyFg: 'cortex-matrix-lt2-body-fg',
  borderFg: 'cortex-matrix-lt2-border-fg',
  altRowBg: 'cortex-matrix-lt2-alt-row',
  ibcsPositive: 'cortex-matrix-lt2-ibcs-positive',
  ibcsNegative: 'cortex-matrix-lt2-ibcs-negative',
  ibcsNeutral: 'cortex-matrix-lt2-ibcs-neutral',
} as const;

// Last-resort hexes. Neutral grays for chrome; IBCS green/red/gray so a
// variance reads correctly even with no palette and no overrides.
const FALLBACK = {
  headerBg: '#F2F2F2',
  headerFg: '#252423',
  bodyFg: '#252423',
  borderFg: '#D9D9D9',
  altRowBg: '#FAFAFA',
  ibcsPositive: '#00A86B',
  ibcsNegative: '#D14545',
  ibcsNeutral: '#888888',
} as const;

// getColor can throw on some hosts and can return an empty value object;
// both mean "palette has nothing here", so collapse them to the fallback.
function accent(palette: IColorPalette, key: string, fallback: string): string {
  try {
    const color = palette.getColor(key);
    return color && color.value ? color.value : fallback;
  } catch {
    return fallback;
  }
}

// Optional per-slot overrides from the ThemeColors format card. Every slot
// is independent — omitting one does not disturb the others.
export interface ThemeOverrides {
  headerBg?: string;
  headerFg?: string;
  bodyFg?: string;
  borderFg?: string;
  altRowBg?: string;
  ibcsPositive?: string;
  ibcsNegative?: string;
  ibcsNeutral?: string;
}

// The fully-resolved palette render code consumes. Every slot is present,
// so downstream code never re-checks for absence.
export interface ResolvedTheme {
  headerBg: string;
  headerFg: string;
  bodyFg: string;
  borderFg: string;
  altRowBg: string;
  ibcsPositive: string;
  ibcsNegative: string;
  ibcsNeutral: string;
}

// `||` (not `??`) is deliberate: the ColorPicker slices default to the
// empty string, and an empty string must fall through to the palette and
// then the fallback rather than paint nothing.
export function resolveTheme(
  palette: IColorPalette,
  overrides: ThemeOverrides,
): ResolvedTheme {
  return {
    headerBg: overrides.headerBg || accent(palette, PALETTE_KEY.headerBg, FALLBACK.headerBg),
    headerFg: overrides.headerFg || accent(palette, PALETTE_KEY.headerFg, FALLBACK.headerFg),
    bodyFg: overrides.bodyFg || accent(palette, PALETTE_KEY.bodyFg, FALLBACK.bodyFg),
    borderFg: overrides.borderFg || accent(palette, PALETTE_KEY.borderFg, FALLBACK.borderFg),
    altRowBg: overrides.altRowBg || accent(palette, PALETTE_KEY.altRowBg, FALLBACK.altRowBg),
    ibcsPositive:
      overrides.ibcsPositive || accent(palette, PALETTE_KEY.ibcsPositive, FALLBACK.ibcsPositive),
    ibcsNegative:
      overrides.ibcsNegative || accent(palette, PALETTE_KEY.ibcsNegative, FALLBACK.ibcsNegative),
    ibcsNeutral:
      overrides.ibcsNeutral || accent(palette, PALETTE_KEY.ibcsNeutral, FALLBACK.ibcsNeutral),
  };
}
