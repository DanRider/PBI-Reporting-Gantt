import { describe, it, expect } from 'vitest';

import { buildColumnsCard } from './columnsCard';
import type { ValueColumnEntry } from './columnsCard';

function entry(over: Partial<ValueColumnEntry> = {}): ValueColumnEntry {
  return {
    queryName: 'Sales.Amount',
    displayName: 'Sales',
    visible: true,
    groupLabel: '',
    direction: 'higherIsBetter',
    ...over,
  };
}

// The slice control carries the descriptor + value; these readers keep
// the assertions terse without leaking the PBI cast into every test.
function sliceAt(card: ReturnType<typeof buildColumnsCard>, g: number, s: number) {
  return (card.groups[g].slices as unknown as Array<{
    uid: string;
    displayName: string;
    control: {
      type: number;
      properties: {
        descriptor: { objectName: string; propertyName: string; selector?: { metadata: string } };
        value: unknown;
        items?: Array<{ value: string }>;
      };
    };
  }>)[s];
}

describe('buildColumnsCard', () => {
  it('emits one group per bound measure', () => {
    const card = buildColumnsCard([
      entry({ queryName: 'Sales.Amount', displayName: 'Sales' }),
      entry({ queryName: 'Budget.Amount', displayName: 'Budget' }),
    ]);
    expect(card.uid).toBe('columns_card');
    expect(card.groups).toHaveLength(2);
    expect(card.groups[0].displayName).toBe('Sales');
    expect(card.groups[1].displayName).toBe('Budget');
  });

  it('each group has exactly three slices: visible, groupLabel, direction', () => {
    const card = buildColumnsCard([entry()]);
    expect(card.groups[0].slices).toHaveLength(3);
    expect(sliceAt(card, 0, 0).control.properties.descriptor.propertyName).toBe('visible');
    expect(sliceAt(card, 0, 1).control.properties.descriptor.propertyName).toBe('groupLabel');
    expect(sliceAt(card, 0, 2).control.properties.descriptor.propertyName).toBe('direction');
  });

  it('binds each slice descriptor to its measure queryName via the metadata selector', () => {
    const card = buildColumnsCard([entry({ queryName: 'COGS.Amount' })]);
    for (let s = 0; s < 3; s += 1) {
      expect(sliceAt(card, 0, s).control.properties.descriptor.selector).toEqual({
        metadata: 'COGS.Amount',
      });
    }
  });

  it('routes each slice to the right capabilities object', () => {
    const card = buildColumnsCard([entry()]);
    expect(sliceAt(card, 0, 0).control.properties.descriptor.objectName).toBe('columnVisibility');
    expect(sliceAt(card, 0, 1).control.properties.descriptor.objectName).toBe('columnHeaders');
    expect(sliceAt(card, 0, 2).control.properties.descriptor.objectName).toBe('columnFavorability');
  });

  it('echoes the captured live values into the slice value fields', () => {
    const card = buildColumnsCard([
      entry({ visible: false, groupLabel: 'QTD', direction: 'lowerIsBetter' }),
    ]);
    expect(sliceAt(card, 0, 0).control.properties.value).toBe(false);
    expect(sliceAt(card, 0, 1).control.properties.value).toBe('QTD');
    expect(sliceAt(card, 0, 2).control.properties.value).toEqual({ value: 'lowerIsBetter' });
  });

  it('offers the three favorability choices in the direction dropdown', () => {
    const card = buildColumnsCard([entry()]);
    const items = sliceAt(card, 0, 2).control.properties.items ?? [];
    expect(items.map((i) => i.value)).toEqual([
      'higherIsBetter',
      'lowerIsBetter',
      'neutral',
    ]);
  });

  it('produces an empty group list when no measures are bound', () => {
    const card = buildColumnsCard([]);
    expect(card.groups).toHaveLength(0);
  });

  it('keys slice uids by group index so two measures never collide', () => {
    const card = buildColumnsCard([entry(), entry({ queryName: 'B.X' })]);
    const uids = new Set<string>();
    for (let g = 0; g < 2; g += 1) {
      for (let s = 0; s < 3; s += 1) {
        uids.add(sliceAt(card, g, s).uid);
      }
    }
    expect(uids.size).toBe(6);
  });
});
