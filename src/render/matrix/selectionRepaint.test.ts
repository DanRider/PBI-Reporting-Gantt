// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { repaintSelection } from './selectionRepaint';
import { FakeSelection, renderOpts } from './__fixtures__/tree';

import powerbi from 'powerbi-visuals-api';

import ISelectionId = powerbi.visuals.ISelectionId;

function taggedRow(token: string): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const id = {
    token,
    equals: (o: unknown) => (o as { token?: string })?.token === token,
  } as unknown as ISelectionId;
  (tr as HTMLTableRowElement & { __cortexSelectionId?: ISelectionId }).__cortexSelectionId = id;
  return tr;
}

describe('repaintSelection — reconciles the row highlight with selection state', () => {
  it('adds the class to the selected row and clears the rest', () => {
    const sel = new FakeSelection();
    sel.selectedToken = 'USA';
    const opts = renderOpts({ selection: sel });
    const tbody = document.createElement('tbody');
    tbody.appendChild(taggedRow('USA'));
    tbody.appendChild(taggedRow('EMEA'));

    repaintSelection(tbody, opts);

    const rows = tbody.querySelectorAll('tr');
    expect(rows[0].classList.contains('cortex-row-selected')).toBe(true);
    expect(rows[1].classList.contains('cortex-row-selected')).toBe(false);
  });

  it('clears a previously-highlighted row when selection moves away', () => {
    const sel = new FakeSelection();
    sel.selectedToken = 'EMEA';
    const opts = renderOpts({ selection: sel });
    const tbody = document.createElement('tbody');
    const usa = taggedRow('USA');
    usa.classList.add('cortex-row-selected');
    tbody.appendChild(usa);

    repaintSelection(tbody, opts);

    expect(usa.classList.contains('cortex-row-selected')).toBe(false);
  });

  it('rows without a stashed id are always cleared (group rows)', () => {
    const sel = new FakeSelection();
    sel.selectedToken = 'USA';
    const opts = renderOpts({ selection: sel });
    const tbody = document.createElement('tbody');
    const group = document.createElement('tr');
    group.classList.add('cortex-row-selected');
    tbody.appendChild(group);

    repaintSelection(tbody, opts);

    expect(group.classList.contains('cortex-row-selected')).toBe(false);
  });
});
