// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { walkRowNodes } from './rowNodes';
import {
  FakeSelection,
  leaf,
  renderOpts,
  rowLeaf,
  rowsRoot,
} from './__fixtures__/tree';

import powerbi from 'powerbi-visuals-api';

import DataViewHierarchyLevel = powerbi.DataViewHierarchyLevel;

const LEVELS: DataViewHierarchyLevel[] = [];

function tbody(): HTMLElement {
  return document.createElement('tbody');
}

describe('walkRowNodes — DFS, one tr per non-root node', () => {
  it('skips the root and emits a tr per leaf row', () => {
    const root = rowsRoot([
      rowLeaf('USA', { 0: 100 }),
      rowLeaf('EMEA', { 0: 50 }),
    ]);
    const body = tbody();
    walkRowNodes(root, body, [leaf({ label: 'Sales', leafIndex: 0 })], renderOpts(), LEVELS, { n: 0 });
    const rows = body.querySelectorAll('tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('th')?.textContent).toContain('USA');
  });

  it('alternating rows get the alt class and altRowBg', () => {
    const root = rowsRoot([
      rowLeaf('A', { 0: 1 }),
      rowLeaf('B', { 0: 2 }),
    ]);
    const body = tbody();
    walkRowNodes(root, body, [leaf({ label: 'V', leafIndex: 0 })], renderOpts(), LEVELS, { n: 0 });
    const rows = body.querySelectorAll('tr');
    expect(rows[0].classList.contains('cortex-row-alt')).toBe(false);
    expect(rows[1].classList.contains('cortex-row-alt')).toBe(true);
  });

  it('writes the four branch values into the cells', () => {
    const root = rowsRoot([rowLeaf('USA', { 0: 1000, 1: 700, 2: 100, 3: 200 })]);
    const leaves = [
      leaf({ label: 'Sales', leafIndex: 0 }),
      leaf({ label: 'YTD', isPeriodSynthesis: 'ytd', periodSourceIdxs: [2, 3] }),
      leaf({
        label: 'Δ',
        isSynthetic: 'delta',
        syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 1 },
      }),
    ];
    const body = tbody();
    // IBCS off so this isolates the value-resolution branches; the glyph
    // overlay is covered by the dedicated IBCS block below.
    walkRowNodes(root, body, leaves, renderOpts({ ibcsEnabled: false }), LEVELS, { n: 0 });
    const cells = body.querySelectorAll('td');
    expect(cells[0].textContent).toBe('1000.00'); // plain
    expect(cells[1].textContent).toBe('300.00'); // period sum 100+200
    expect(cells[2].textContent).toBe('300.00'); // delta 1000-700
  });
});

describe('walkRowNodes — IBCS overlay on synthetics', () => {
  it('recolors a positive delta green and prefixes the up glyph (classic)', () => {
    const root = rowsRoot([rowLeaf('USA', { 0: 1000, 1: 700 })]);
    const deltaLeaf = leaf({
      label: 'Δ',
      isSynthetic: 'delta',
      syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 1 },
    });
    const body = tbody();
    walkRowNodes(root, body, [deltaLeaf], renderOpts({ ibcsEnabled: true }), LEVELS, { n: 0 });
    const td = body.querySelector('td') as HTMLTableCellElement;
    expect(td.textContent).toBe('▲ 300.00');
    expect(td.style.color).toBe('rgb(0, 170, 0)');
  });

  it('a plain measure is never recolored even with IBCS on', () => {
    const root = rowsRoot([rowLeaf('USA', { 0: 1000 })]);
    const body = tbody();
    walkRowNodes(root, body, [leaf({ label: 'Sales', leafIndex: 0 })], renderOpts({ ibcsEnabled: true }), LEVELS, { n: 0 });
    const td = body.querySelector('td') as HTMLTableCellElement;
    expect(td.textContent).toBe('1000.00');
    expect(td.style.color).toBe('rgb(204, 204, 204)'); // theme bodyFg
  });

  it('lowerIsBetter favorability flips the color via the queryName map', () => {
    const root = rowsRoot([rowLeaf('USA', { 0: 1000, 1: 700 })]);
    const deltaLeaf = leaf({
      label: 'Δ',
      isSynthetic: 'delta',
      sourceIndex: 1,
      syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 1 },
    });
    const opts = renderOpts({
      ibcsEnabled: true,
      valueSourceQueryNames: ['Sales.Amount', 'Cost.Amount'],
      columnFavorability: new Map([['Cost.Amount', 'lowerIsBetter']]),
    });
    const body = tbody();
    walkRowNodes(root, body, [deltaLeaf], opts, LEVELS, { n: 0 });
    const td = body.querySelector('td') as HTMLTableCellElement;
    // positive cost growth is unfavorable → negative color, up glyph
    expect(td.textContent).toBe('▲ 300.00');
    expect(td.style.color).toBe('rgb(204, 0, 0)');
  });

  it('IBCS off leaves the delta in the theme body color, no glyph', () => {
    const root = rowsRoot([rowLeaf('USA', { 0: 1000, 1: 700 })]);
    const deltaLeaf = leaf({
      label: 'Δ',
      isSynthetic: 'delta',
      syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 1 },
    });
    const body = tbody();
    walkRowNodes(root, body, [deltaLeaf], renderOpts({ ibcsEnabled: false }), LEVELS, { n: 0 });
    const td = body.querySelector('td') as HTMLTableCellElement;
    expect(td.textContent).toBe('300.00');
  });
});

describe('walkRowNodes — selection wiring on leaf rows', () => {
  it('a click selects the row and stashes its id', () => {
    const sel = new FakeSelection();
    const root = rowsRoot([rowLeaf('USA', { 0: 1 })]);
    const body = tbody();
    walkRowNodes(root, body, [leaf({ label: 'V', leafIndex: 0 })], renderOpts({ selection: sel }), LEVELS, { n: 0 });
    const tr = body.querySelector('tr') as HTMLTableRowElement;
    tr.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sel.selectCalls).toHaveLength(1);
    expect(sel.selectedToken).toBe('USA');
  });

  it('group (non-leaf) rows are not wired for selection', () => {
    const child = rowLeaf('USA', { 0: 1 });
    const group = { level: 0, value: 'Americas', children: [child] } as unknown as powerbi.DataViewMatrixNode;
    const root = rowsRoot([group]);
    const sel = new FakeSelection();
    const body = tbody();
    walkRowNodes(root, body, [leaf({ label: 'V', leafIndex: 0 })], renderOpts({ selection: sel }), LEVELS, { n: 0 });
    const rows = body.querySelectorAll('tr');
    // group row + leaf row
    expect(rows).toHaveLength(2);
    rows[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sel.selectCalls).toHaveLength(0);
  });
});
