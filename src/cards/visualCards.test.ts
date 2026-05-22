import { describe, it, expect } from 'vitest';

import { buildComputedColumnsCard, buildIbcsCard } from './visualCards';
import type { VisualCardsState } from './visualCards';

function state(over: Partial<VisualCardsState> = {}): VisualCardsState {
  return {
    showDelta: true,
    showDeltaPct: true,
    showMtd: true,
    showQtd: true,
    showYtd: true,
    showFy: true,
    showPriorYear: true,
    fyStartMonth: 1,
    ibcsEnabled: true,
    ibcsArrowStyle: 'classic',
    ...over,
  };
}

type Slice = {
  uid: string;
  displayName: string;
  control: {
    type: number;
    properties: {
      descriptor: { objectName: string; propertyName: string };
      value: unknown;
      items?: Array<{ value: string }>;
      options?: { minValue: { value: number }; maxValue: { value: number } };
    };
  };
};

function slices(card: ReturnType<typeof buildComputedColumnsCard>): Slice[] {
  return card.groups[0].slices as unknown as Slice[];
}

describe('buildComputedColumnsCard', () => {
  it('emits exactly eight slices and no custom delta-header text', () => {
    const card = buildComputedColumnsCard(state());
    const s = slices(card);
    expect(card.uid).toBe('computedColumns_card');
    expect(s).toHaveLength(8);
    const props = s.map((x) => x.control.properties.descriptor.propertyName);
    expect(props).toEqual([
      'showDelta',
      'showDeltaPct',
      'showMtd',
      'showQtd',
      'showYtd',
      'showFy',
      'showPriorYear',
      'fyStartMonth',
    ]);
    expect(props).not.toContain('deltaHeader');
    expect(props).not.toContain('deltaPctHeader');
  });

  it('every slice descriptor targets the computedColumns object', () => {
    for (const sl of slices(buildComputedColumnsCard(state()))) {
      expect(sl.control.properties.descriptor.objectName).toBe('computedColumns');
    }
  });

  it('echoes the captured toggle state', () => {
    const s = slices(buildComputedColumnsCard(state({ showFy: false, showQtd: false })));
    expect(s[3].control.properties.value).toBe(false);
    expect(s[5].control.properties.value).toBe(false);
    expect(s[0].control.properties.value).toBe(true);
  });

  it('bounds the fiscal-year start month between 1 and 12', () => {
    const fy = slices(buildComputedColumnsCard(state({ fyStartMonth: 7 })))[7];
    expect(fy.control.properties.value).toBe(7);
    expect(fy.control.properties.options?.minValue.value).toBe(1);
    expect(fy.control.properties.options?.maxValue.value).toBe(12);
  });
});

describe('buildIbcsCard', () => {
  it('emits the enabled toggle and the arrow-style dropdown only', () => {
    const card = buildIbcsCard(state());
    const s = card.groups[0].slices as unknown as Slice[];
    expect(card.uid).toBe('ibcs_card');
    expect(s).toHaveLength(2);
    expect(s[0].control.properties.descriptor.objectName).toBe('ibcs');
    expect(s[0].control.properties.descriptor.propertyName).toBe('enabled');
    expect(s[1].control.properties.descriptor.objectName).toBe('ibcs');
    expect(s[1].control.properties.descriptor.propertyName).toBe('arrowStyle');
  });

  it('echoes the IBCS state and offers classic + minimal', () => {
    const s = (buildIbcsCard(state({ ibcsEnabled: false, ibcsArrowStyle: 'minimal' }))
      .groups[0].slices as unknown as Slice[]);
    expect(s[0].control.properties.value).toBe(false);
    expect(s[1].control.properties.value).toEqual({ value: 'minimal' });
    expect((s[1].control.properties.items ?? []).map((i) => i.value)).toEqual([
      'classic',
      'minimal',
    ]);
  });
});
