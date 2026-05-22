// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { renderGrandTotal } from './grandTotal';
import { leaf, renderOpts, rowsRoot } from './__fixtures__/tree';

describe('renderGrandTotal — tfoot from the rows-root values bag', () => {
  it('returns null when the root carries no values bag', () => {
    const root = rowsRoot([]);
    expect(renderGrandTotal(root, [], renderOpts())).toBeNull();
  });

  it('emits a tfoot with a Total label cell and one cell per leaf', () => {
    const root = rowsRoot([], { 0: 1000, 1: 700 });
    const leaves = [
      leaf({ label: 'Sales', leafIndex: 0 }),
      leaf({ label: 'Budget', leafIndex: 1 }),
    ];
    const tfoot = renderGrandTotal(root, leaves, renderOpts());
    expect(tfoot?.tagName).toBe('TFOOT');
    const cells = tfoot!.querySelectorAll('tr > *');
    expect(cells[0].textContent).toBe('Total');
    expect(cells[1].textContent).toBe('1000.00');
    expect(cells[2].textContent).toBe('700.00');
  });

  it('re-derives a delta total through the shared resolver', () => {
    const root = rowsRoot([], { 0: 1000, 1: 700 });
    const deltaLeaf = leaf({
      label: 'Δ',
      isSynthetic: 'delta',
      syntheticPair: { currentLeafIdx: 0, priorLeafIdx: 1 },
    });
    const tfoot = renderGrandTotal(root, [deltaLeaf], renderOpts());
    const cells = tfoot!.querySelectorAll('tr > *');
    expect(cells[1].textContent).toBe('300.00');
  });

  it('re-derives a period-synthesis total by summing its source indices', () => {
    const root = rowsRoot([], { 0: 100, 1: 200, 2: 300 });
    const ytd = leaf({ label: 'YTD', isPeriodSynthesis: 'ytd', periodSourceIdxs: [0, 1, 2] });
    const tfoot = renderGrandTotal(root, [ytd], renderOpts());
    const cells = tfoot!.querySelectorAll('tr > *');
    expect(cells[1].textContent).toBe('600.00');
  });

  it('the total row height follows opts.rowHeight', () => {
    const root = rowsRoot([], { 0: 5 });
    const tfoot = renderGrandTotal(root, [leaf({ label: 'X', leafIndex: 0 })], renderOpts());
    const tr = tfoot!.querySelector('tr') as HTMLTableRowElement;
    expect(tr.style.height).toBe('24px');
  });
});
