// L1 model. The single resolved configuration value the orchestrator
// threads through the pipeline and render stack on every dataView change.
// It is deliberately FLAT: v0.1 deletes the sub-object nesting (layout /
// totals / computedColumns / periodSynth), the pace toggles, the forecast
// registry, the synthesized-leaf template, and the cell-padding knobs that
// the parent design carried. What remains is theme/selection/host plus
// scalar render toggles plus the detected per-measure format hints. This
// file also owns the small enums the rest of the stack imports from one
// place, and the frozen empty-map defaults visual.ts seeds before the
// detect pass runs.

import powerbi from 'powerbi-visuals-api';

import type { Denomination } from '../primitives/format/denomination';
import type { ResolvedTheme } from '../primitives/theme';
import type { SelectionWiring } from '../primitives/selectionWiring';

// Re-exported so every downstream consumer has one import surface for the
// currency-scaling enum even though it physically lives in primitives.
export type { Denomination } from '../primitives/format/denomination';

// Per-measure semantic direction for IBCS variance coloring.
// 'higherIsBetter' (default): positive delta is good (green).
// 'lowerIsBetter' (cost measures): inverts the sign-to-color mapping.
// 'neutral': suppresses IBCS coloring for that measure entirely.
export type FavorabilityDirection = 'higherIsBetter' | 'lowerIsBetter' | 'neutral';

// Which pair of bound measures a variance is computed against.
// 'priorYear' shifts one measure back twelve months (AvA). The other
// three pair two distinct measures in the same period (BvA/FvA/FvF) — the
// pipeline pairing is identical; only the label layer differs.
export type CompareAgainstMode = 'priorYear' | 'budget' | 'forecast' | 'forecastVsForecast';

// IBCS arrow rendering style. 'classic' draws the glyph and the color;
// 'minimal' keeps the semantic color but suppresses the glyph.
export type IbcsArrowStyle = 'classic' | 'minimal';

// One measure's structural reading of its source format string. Produced
// by the detectFormatHints pre-pass purely from the format STRING — never
// inferred from the measure name.
export interface FormatHint {
  readonly queryName: string;
  readonly hasCurrencySymbol: boolean;
  readonly currencySymbol?: string;
  readonly isPercentage: boolean;
  readonly isInteger: boolean;
  readonly decimalCount: number;
  readonly rawFormat: string | undefined;
}

// The resolved per-render configuration. Flat by design.
export interface FormatOptions {
  // Resolved palette colors read by the render layer.
  theme: ResolvedTheme;
  // Per-row click handlers wired to the host selection manager.
  selection: SelectionWiring;
  // Present only at runtime — the channel the control panel persists
  // changes back through. Absent in unit tests.
  host?: powerbi.extensibility.visual.IVisualHost;
  // Body row height in px (already clamped by visual.ts).
  rowHeight: number;
  // Body font size in px (already clamped). Absent = render default.
  bodyFontSize?: number;
  // Currency scaling mode. Absent = 'dollars' (no scaling).
  denomination?: Denomination;
  // Decimal places for currency values (already clamped). Absent = 0.
  decimals?: number;
  // Append the K/M letter when denomination scales. Absent = true.
  showLetter?: boolean;
  // Emit a grand-total row at the bottom.
  showGrandTotal: boolean;
  // Synthesize a Delta column in every 2-leaf cluster. Absent = true.
  showDelta?: boolean;
  // Synthesize a percent-Delta alongside Delta. Absent = true.
  showDeltaPct?: boolean;
  // Period-aggregation toggles. Each absent = true.
  showMtd?: boolean;
  showQtd?: boolean;
  showYtd?: boolean;
  showFy?: boolean;
  // Emit a prior-year companion per enabled period. Absent = true.
  showPriorYear?: boolean;
  // Fiscal-year start month, 1–12 (already clamped). Absent = 1.
  fyStartMonth?: number;
  // Master IBCS variance-encoding toggle. Absent = true.
  ibcsEnabled?: boolean;
  // IBCS arrow style. Absent = 'classic'.
  ibcsArrowStyle?: IbcsArrowStyle;
  // Compare-against mode. Absent = 'priorYear' (legacy AvA).
  compareAgainstMode?: CompareAgainstMode;
  // Appearance theme name driving the matrix + panel palette.
  appearanceTheme?: string;
  // ISO date of the in-visual reporting-month override. Empty = use
  // max(visible dates).
  selectedDate?: string;
  // The month-anchor ISO strings the picker offers. Empty = no date
  // binding.
  availableMonths?: readonly string[];
  // Per-measure format readings keyed by queryName. Seeded empty by
  // visual.ts, overwritten by the detectFormatHints pre-pass.
  formatHints: ReadonlyMap<string, FormatHint>;
  // Per-measure favorability keyed by queryName. Missing key → the render
  // call site defaults to 'higherIsBetter'.
  columnFavorability?: ReadonlyMap<string, FavorabilityDirection>;
  // queryName per valueSources index, so render can map a synthetic
  // leaf's source index to its measure's favorability.
  valueSourceQueryNames?: readonly string[];
}

// The empty hints map visual.ts seeds before the detect pre-pass replaces
// it. Frozen so a stray write surfaces instead of mutating shared state.
export const DEFAULT_FORMAT_HINTS: ReadonlyMap<string, FormatHint> = Object.freeze(
  new Map<string, FormatHint>(),
);

// The empty favorability map used when no per-measure direction is bound.
export const DEFAULT_COLUMN_FAVORABILITY: ReadonlyMap<string, FavorabilityDirection> =
  Object.freeze(new Map<string, FavorabilityDirection>());
