// L3 render. The variance-cell encoder. Given one synthesized Δ or %Δ
// number, the resolved IBCS color trio, the arrow style, and the
// measure's favorability direction, it answers how that single cell
// paints: a movement direction, a glyph, and a hex color. It is the
// only place the IBCS sign-to-color rule lives. Pure: no DOM, no state,
// a function of its arguments. A non-finite input, or a measure marked
// 'neutral', means "do not encode this cell" and is reported as null so
// the caller falls back to the plain formatted value in the body color.

import type { FavorabilityDirection, IbcsArrowStyle } from '../../model/formatOptions';

// Movements smaller than this in magnitude are treated as no movement.
// A raw subtraction of two nearly-equal floats lands here, and painting
// it green or red would be noise, so it reads as flat-and-neutral.
const FLAT_EPSILON = 1e-9;

// The glyphs are the IBCS triangles and an en-dash for flat. Centralized
// so 'minimal' style can blank the glyph without touching the colors.
const GLYPH_UP = '▲';
const GLYPH_DOWN = '▼';
const GLYPH_FLAT = '–';

// The movement direction is the raw arithmetic sign of the variance; the
// color is decided separately by favorability so a cost measure that
// grew still shows an up-triangle but in the unfavorable color.
export type IbcsDirection = 'up' | 'down' | 'flat';

// The colors render reads. These three slots already exist on the
// resolved theme; this narrow view keeps the encoder decoupled from the
// rest of the palette.
export interface IbcsColorSet {
  ibcsPositive: string;
  ibcsNegative: string;
  ibcsNeutral: string;
}

// A single cell's encoding. `glyph` is '' under the 'minimal' style; the
// color is always meaningful.
export interface IbcsDecoration {
  direction: IbcsDirection;
  glyph: string;
  color: string;
}

// Returns null in exactly two cases the caller must treat identically —
// render the formatted value with no color override: a non-numeric /
// non-finite variance, and a measure whose direction is 'neutral'
// (IBCS coloring deliberately suppressed for that measure).
export function ibcsDecorationFor(
  value: number | null | undefined,
  colors: IbcsColorSet,
  style: IbcsArrowStyle = 'classic',
  direction: FavorabilityDirection = 'higherIsBetter',
): IbcsDecoration | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  if (direction === 'neutral') {
    return null;
  }

  const isMinimal = style === 'minimal';

  if (Math.abs(value) < FLAT_EPSILON) {
    return {
      direction: 'flat',
      glyph: isMinimal ? '' : GLYPH_FLAT,
      color: colors.ibcsNeutral,
    };
  }

  // 'lowerIsBetter' flips the sign that drives color selection: a
  // positive delta on a cost measure is unfavorable, so it paints with
  // the negative color while still wearing an up-triangle for the actual
  // arithmetic movement.
  const colorSign =
    direction === 'lowerIsBetter' ? -Math.sign(value) : Math.sign(value);
  const favorableColor =
    colorSign > 0 ? colors.ibcsPositive : colors.ibcsNegative;

  if (value > 0) {
    return {
      direction: 'up',
      glyph: isMinimal ? '' : GLYPH_UP,
      color: favorableColor,
    };
  }
  return {
    direction: 'down',
    glyph: isMinimal ? '' : GLYPH_DOWN,
    color: favorableColor,
  };
}
