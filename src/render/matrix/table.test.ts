// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { renderMatrixTable } from './table';
import {
  FakeSelection,
  flatTree,
  leaf,
  matrixOf,
  renderOpts,
  rowLeaf,
  rowsRoot,
} from './__fixtures__/tree';

function scene(showGrandTotal = false) {
  const tree = flatTree([
    leaf({ label: 'Sales', leafIndex: 0 }),
    leaf({ label: 'Budget', leafIndex: 1 }),
  ]);
  const root = rowsRoot(
    [rowLeaf('USA', { 0: 100, 1: 90 }), rowLeaf('EMEA', { 0: 50, 1: 55 })],
    showGrandTotal ? { 0: 150, 1: 145 } : undefined,
  );
  return { tree, matrix: matrixOf(root) };
}

describe('renderMatrixTable — full composition', () => {
  it('produces a root with the controls rail beside the table', () => {
    const { tree, matrix } = scene();
    const root = renderMatrixTable(tree, matrix, renderOpts());
    expect(root.classList.contains('rg-matrix-lt2')).toBe(true);
    expect(root.querySelector('.rg-controls')).not.toBeNull();
    expect(root.querySelector('.rg-matrix-table')).not.toBeNull();
    expect(root.querySelector('table thead')).not.toBeNull();
    expect(root.querySelector('table tbody')).not.toBeNull();
  });

  it('emits a colgroup with a corner col plus one col per leaf', () => {
    const { tree, matrix } = scene();
    const root = renderMatrixTable(tree, matrix, renderOpts());
    const cols = root.querySelectorAll('colgroup col');
    expect(cols).toHaveLength(3);
    expect(cols[0].classList.contains('rg-col-corner')).toBe(true);
  });

  it('omits the tfoot unless showGrandTotal is set', () => {
    const noTotal = scene(false);
    expect(
      renderMatrixTable(noTotal.tree, noTotal.matrix, renderOpts()).querySelector('tfoot'),
    ).toBeNull();
    const withTotal = scene(true);
    expect(
      renderMatrixTable(withTotal.tree, withTotal.matrix, renderOpts({ showGrandTotal: true })).querySelector('tfoot'),
    ).not.toBeNull();
  });

  it('applies the appearance theme to the root without mutating caller opts', () => {
    const { tree, matrix } = scene();
    const opts = renderOpts({ appearanceTheme: 'newsprint' });
    const themeBefore = opts.theme;
    const root = renderMatrixTable(tree, matrix, opts);
    expect(root.classList.contains('rg-theme-newsprint')).toBe(true);
    // Newsprint rootBg is #f9f6ef
    expect(root.style.background).toBe('rgb(249, 246, 239)');
    expect(opts.theme).toBe(themeBefore);
  });

  it('a click on the bare root clears the selection', () => {
    const sel = new FakeSelection();
    sel.selectedToken = 'USA';
    const { tree, matrix } = scene();
    const root = renderMatrixTable(tree, matrix, renderOpts({ selection: sel }));
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sel.clearCalls).toBe(1);
  });

  it('renders the body values end to end', () => {
    const { tree, matrix } = scene();
    const root = renderMatrixTable(tree, matrix, renderOpts());
    const firstRowCells = root.querySelectorAll('tbody tr')[0].querySelectorAll('td');
    expect(firstRowCells[0].textContent).toBe('100.00');
    expect(firstRowCells[1].textContent).toBe('90.00');
  });
});
