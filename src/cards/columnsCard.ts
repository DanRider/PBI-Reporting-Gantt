// L4 cards. The dynamically-populated per-measure format-pane card. One
// group per bound Value-role measure, each holding exactly three slices:
// a visibility toggle, a free-text outer-span group label, and a
// favorability-direction dropdown that drives IBCS variance coloring for
// that measure. It is a pure function — visual.ts captures the current
// per-measure state into ValueColumnEntry[] and feeds it here, then
// pushes the returned card onto the base formatting model. The card holds
// no logic beyond shaping descriptors; what the toggles mean lives in the
// pipeline and render layers that read the matching capabilities objects.

import powerbi from 'powerbi-visuals-api';

import type { FavorabilityDirection } from '../model/formatOptions';

import FormattingCard = powerbi.visuals.FormattingCard;
import FormattingComponent = powerbi.visuals.FormattingComponent;
import FormattingGroup = powerbi.visuals.FormattingGroup;
import FormattingSlice = powerbi.visuals.FormattingSlice;
import VisualEnumerationInstanceKinds = powerbi.VisualEnumerationInstanceKinds;

// powerbi-visuals-api ships these as `const enum`s with no runtime
// object — the pbiviz webpack build inlines them, but the test runner's
// transpiler does not, so dereferencing powerbi.visuals.FormattingComponent
// at runtime is undefined. The values are a stable wire contract, so they
// are pinned here as typed literals (typed AS the enum so the structural
// FormattingSlice shape still type-checks). Same gap class as the
// formattingutils test mock.
const COMPONENT = {
  toggle: 'ToggleSwitch' as FormattingComponent,
  text: 'TextInput' as FormattingComponent,
  dropdown: 'Dropdown' as FormattingComponent,
} as const;
const CONSTANT_OR_RULE = 3 as VisualEnumerationInstanceKinds;

// One captured measure's current format-pane state. visual.ts reads each
// of these off the bound dataView so the slices echo the live value.
export interface ValueColumnEntry {
  queryName: string;
  displayName: string;
  visible: boolean;
  groupLabel: string;
  direction: FavorabilityDirection;
}

const DIRECTION_CHOICES: ReadonlyArray<{ value: FavorabilityDirection; displayName: string }> = [
  { value: 'higherIsBetter', displayName: 'Higher is better' },
  { value: 'lowerIsBetter', displayName: 'Lower is better' },
  { value: 'neutral', displayName: 'No coloring' },
];

// The per-measure descriptor is keyed by the measure's queryName so the
// host scopes each persisted value to that one measure. The selector +
// altConstantValueSelector pair plus ConstantOrRule is what makes the
// value bindable per measure rather than visual-wide.
function metadataDescriptor(objectName: string, propertyName: string, queryName: string) {
  return {
    objectName,
    propertyName,
    selector: { metadata: queryName },
    altConstantValueSelector: { metadata: queryName },
    instanceKind: CONSTANT_OR_RULE,
  };
}

function visibilitySlice(col: ValueColumnEntry, i: number): FormattingSlice {
  return {
    uid: `columns_visible_${i}`,
    displayName: 'Visible',
    control: {
      type: COMPONENT.toggle,
      properties: {
        descriptor: metadataDescriptor('columnVisibility', 'visible', col.queryName),
        value: col.visible,
      },
    },
  } as unknown as FormattingSlice;
}

function groupLabelSlice(col: ValueColumnEntry, i: number): FormattingSlice {
  return {
    uid: `columns_groupLabel_${i}`,
    displayName: 'Column group',
    control: {
      type: COMPONENT.text,
      properties: {
        descriptor: metadataDescriptor('columnHeaders', 'groupLabel', col.queryName),
        placeholder: 'Leave empty for no outer span',
        value: col.groupLabel,
      },
    },
  } as unknown as FormattingSlice;
}

function directionSlice(col: ValueColumnEntry, i: number): FormattingSlice {
  return {
    uid: `columns_direction_${i}`,
    displayName: 'Favorability direction',
    control: {
      type: COMPONENT.dropdown,
      properties: {
        descriptor: metadataDescriptor('columnFavorability', 'direction', col.queryName),
        value: { value: col.direction },
        items: DIRECTION_CHOICES.map((o) => ({ value: o.value, displayName: o.displayName })),
      },
    },
  } as unknown as FormattingSlice;
}

// Builds the Columns card. One group per measure, three slices each. The
// `as unknown as` on each slice is the documented PBI type-definition gap:
// FormattingModel's TS types model Dropdown as a composite control, so a
// flat slice array of mixed ToggleSwitch/TextInput/Dropdown does not type
// against FormattingSlice even though the host accepts it at runtime. The
// cast is confined to the three slice builders above.
export function buildColumnsCard(entries: readonly ValueColumnEntry[]): FormattingCard {
  const groups: FormattingGroup[] = entries.map((col, i) => ({
    uid: `columns_group_${i}`,
    displayName: col.displayName,
    slices: [
      visibilitySlice(col, i),
      groupLabelSlice(col, i),
      directionSlice(col, i),
    ],
  }));
  return {
    uid: 'columns_card',
    displayName: 'Columns',
    groups,
  };
}
