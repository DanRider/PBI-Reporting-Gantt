// L4 cards. The two visual-wide synthesis format-pane cards. The
// ComputedColumns card toggles which synthesized period and variance
// columns the pipeline emits; the IBCS card toggles variance encoding and
// its arrow style. Both are pure functions taking the captured state and
// returning a card visual.ts pushes onto the base model. v0.1 deliberately
// ships ONLY these two cards from this file — no visual-identity, no
// visibility, no pace card, and no custom delta/percent header-text slices
// (the synthesized headers are always the fixed glyphs). The toggle
// semantics live in the pipeline stages that read the matching objects.

import powerbi from 'powerbi-visuals-api';

import FormattingCard = powerbi.visuals.FormattingCard;
import FormattingComponent = powerbi.visuals.FormattingComponent;
import FormattingSlice = powerbi.visuals.FormattingSlice;
import ValidatorType = powerbi.visuals.ValidatorType;
import VisualEnumerationInstanceKinds = powerbi.VisualEnumerationInstanceKinds;

import type { IbcsArrowStyle } from '../model/formatOptions';

// powerbi-visuals-api ships these as runtime-less `const enum`s the
// pbiviz bundler inlines but the test transpiler does not, so pinning the
// stable wire-contract values as typed literals keeps the cards runnable
// under vitest while the structural slice shape still type-checks. Same
// gap class as the formattingutils test mock.
const COMPONENT = {
  toggle: 'ToggleSwitch' as FormattingComponent,
  dropdown: 'Dropdown' as FormattingComponent,
  numUpDown: 'NumUpDown' as FormattingComponent,
} as const;
const CONSTANT_OR_RULE = 3 as VisualEnumerationInstanceKinds;
const VALIDATOR = {
  min: 0 as ValidatorType,
  max: 1 as ValidatorType,
} as const;

// The captured synthesis state visual.ts reads off the bound dataView.
// Eight ComputedColumns fields plus the two IBCS fields — exactly the
// knobs the two cards expose, no forward slots.
export interface VisualCardsState {
  showDelta: boolean;
  showDeltaPct: boolean;
  showMtd: boolean;
  showQtd: boolean;
  showYtd: boolean;
  showFy: boolean;
  showPriorYear: boolean;
  fyStartMonth: number;
  ibcsEnabled: boolean;
  ibcsArrowStyle: IbcsArrowStyle;
}

// A visual-wide toggle binds to one constant value (no per-measure
// selector), so the descriptor is just object+property.
function toggleSlice(
  uid: string,
  displayName: string,
  objectName: string,
  propertyName: string,
  value: boolean,
): FormattingSlice {
  return {
    uid,
    displayName,
    control: {
      type: COMPONENT.toggle,
      properties: {
        descriptor: {
          objectName,
          propertyName,
          instanceKind: CONSTANT_OR_RULE,
        },
        value,
      },
    },
  } as unknown as FormattingSlice;
}

function fyStartMonthSlice(value: number): FormattingSlice {
  return {
    uid: 'computedColumns_fyStartMonth',
    displayName: 'Fiscal year start month (1–12)',
    control: {
      type: COMPONENT.numUpDown,
      properties: {
        descriptor: { objectName: 'computedColumns', propertyName: 'fyStartMonth' },
        value,
        options: {
          minValue: { value: 1, type: VALIDATOR.min },
          maxValue: { value: 12, type: VALIDATOR.max },
        },
      },
    },
  } as unknown as FormattingSlice;
}

function arrowStyleSlice(value: IbcsArrowStyle): FormattingSlice {
  return {
    uid: 'ibcs_arrowStyle',
    displayName: 'Arrow style',
    control: {
      type: COMPONENT.dropdown,
      properties: {
        descriptor: { objectName: 'ibcs', propertyName: 'arrowStyle' },
        value: { value },
        items: [
          { value: 'classic', displayName: 'Classic (glyph + color)' },
          { value: 'minimal', displayName: 'Minimal (color only)' },
        ],
      },
    },
  } as unknown as FormattingSlice;
}

// The ComputedColumns card. Eight slices: the two variance toggles, the
// four period toggles, the prior-year companion toggle, and the
// fiscal-year start month. No custom header-text slices by design — the
// synthesized Δ / %Δ headers are fixed glyphs.
export function buildComputedColumnsCard(state: VisualCardsState): FormattingCard {
  return {
    uid: 'computedColumns_card',
    displayName: 'Computed columns',
    groups: [
      {
        uid: 'computedColumns_group',
        displayName: '',
        slices: [
          toggleSlice('computedColumns_showDelta', 'Show Δ columns', 'computedColumns', 'showDelta', state.showDelta),
          toggleSlice('computedColumns_showDeltaPct', 'Show %Δ columns', 'computedColumns', 'showDeltaPct', state.showDeltaPct),
          toggleSlice('computedColumns_showMtd', 'Show MTD', 'computedColumns', 'showMtd', state.showMtd),
          toggleSlice('computedColumns_showQtd', 'Show QTD', 'computedColumns', 'showQtd', state.showQtd),
          toggleSlice('computedColumns_showYtd', 'Show YTD', 'computedColumns', 'showYtd', state.showYtd),
          toggleSlice('computedColumns_showFy', 'Show FY', 'computedColumns', 'showFy', state.showFy),
          toggleSlice('computedColumns_showPriorYear', 'Show prior year', 'computedColumns', 'showPriorYear', state.showPriorYear),
          fyStartMonthSlice(state.fyStartMonth),
        ],
      },
    ],
  };
}

// The IBCS card. Two slices: the master variance-encoding toggle and the
// arrow-style dropdown.
export function buildIbcsCard(state: VisualCardsState): FormattingCard {
  return {
    uid: 'ibcs_card',
    displayName: 'IBCS variance encoding',
    groups: [
      {
        uid: 'ibcs_group',
        displayName: '',
        slices: [
          toggleSlice('ibcs_enabled', 'Enable IBCS arrows + colors', 'ibcs', 'enabled', state.ibcsEnabled),
          arrowStyleSlice(state.ibcsArrowStyle),
        ],
      },
    ],
  };
}
