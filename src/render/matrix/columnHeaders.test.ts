// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { renderColumnHeaders } from './columnHeaders';
import { flatTree, leaf, nestedTree, renderOpts } from './__fixtures__/tree';

function thead(): HTMLElement {
  return document.createElement('thead');
}

describe('renderColumnHeaders — one row per level', () => {
  it('emits the leaf level with each leaf label and a row-label spacer', () => {
    const tree = flatTree([
      leaf({ label: 'Sales', leafIndex: 0 }),
      leaf({ label: 'Budget', leafIndex: 1 }),
    ]);
    const head = thead();
    renderColumnHeaders(head, tree, renderOpts());
    const rows = head.querySelectorAll('tr');
    expect(rows).toHaveLength(1);
    const cells = rows[0].querySelectorAll('th');
    // spacer + 2 leaf headers
    expect(cells).toHaveLength(3);
    expect(cells[1].textContent).toBe('Sales');
    expect(cells[2].textContent).toBe('Budget');
  });

  it('leaf headers carry the synthetic kind class', () => {
    const tree = flatTree([
      leaf({ label: 'Δ', isSynthetic: 'delta', groupLabel: 'Plan' }),
      leaf({ label: '%Δ', isSynthetic: 'deltaPct', groupLabel: 'Plan' }),
      leaf({ label: 'YTD', isPeriodSynthesis: 'ytd', groupLabel: 'YTD · May' }),
    ]);
    const head = thead();
    renderColumnHeaders(head, tree, renderOpts());
    // All three leaves carry group labels, so a span row is emitted on
    // top; the kind classes live on the leaf-level row (the last tr).
    const rows = head.querySelectorAll('tr');
    const leafCells = rows[rows.length - 1].querySelectorAll('th');
    expect(leafCells[1].classList.contains('rg-delta')).toBe(true);
    expect(leafCells[2].classList.contains('rg-delta-pct')).toBe(true);
    expect(leafCells[3].classList.contains('rg-period')).toBe(true);
  });
});

describe('renderColumnHeaders — synthetic group-label span row', () => {
  it('single-level tree puts the span row ON TOP', () => {
    const tree = flatTree([
      leaf({ label: 'Sales', leafIndex: 0, groupLabel: 'Plan' }),
      leaf({ label: 'Budget', leafIndex: 1, groupLabel: 'Plan' }),
    ]);
    const head = thead();
    renderColumnHeaders(head, tree, renderOpts());
    const rows = head.querySelectorAll('tr');
    expect(rows).toHaveLength(2);
    // first row is the span row: spacer + one 'Plan' cell spanning 2
    const spanCells = rows[0].querySelectorAll('th');
    expect(spanCells[1].textContent).toBe('Plan');
    expect(spanCells[1].colSpan).toBe(2);
  });

  it('multi-level tree puts the span row BELOW level 0', () => {
    const tree = nestedTree('May 2026', [
      leaf({ label: 'Sales', leafIndex: 0, groupLabel: 'Plan' }),
      leaf({ label: 'Budget', leafIndex: 1, groupLabel: 'Plan' }),
    ]);
    const head = thead();
    renderColumnHeaders(head, tree, renderOpts());
    const rows = head.querySelectorAll('tr');
    // level0, span row, leaf level
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelectorAll('th')[1].textContent).toBe('May 2026');
    expect(rows[1].querySelectorAll('th')[1].textContent).toBe('Plan');
    expect(rows[2].querySelectorAll('th')[1].textContent).toBe('Sales');
  });

  it('no group labels means no span row', () => {
    const tree = flatTree([
      leaf({ label: 'Sales', leafIndex: 0 }),
      leaf({ label: 'Cost', leafIndex: 1 }),
    ]);
    const head = thead();
    renderColumnHeaders(head, tree, renderOpts());
    expect(head.querySelectorAll('tr')).toHaveLength(1);
  });

  it('ungrouped leaves get one-wide filler cells so the row stays rectangular', () => {
    const tree = flatTree([
      leaf({ label: 'Sales', leafIndex: 0 }),
      leaf({ label: 'Δ', isSynthetic: 'delta', groupLabel: 'Plan' }),
      leaf({ label: '%Δ', isSynthetic: 'deltaPct', groupLabel: 'Plan' }),
    ]);
    const head = thead();
    renderColumnHeaders(head, tree, renderOpts());
    const spanRow = head.querySelectorAll('tr')[0];
    const cells = spanRow.querySelectorAll('th');
    // spacer + filler(1) + Plan(2)
    expect(cells).toHaveLength(3);
    expect(cells[1].textContent).toBe('');
    expect(cells[1].colSpan).toBe(1);
    expect(cells[2].textContent).toBe('Plan');
    expect(cells[2].colSpan).toBe(2);
  });

  it('an empty tree renders nothing', () => {
    const head = thead();
    renderColumnHeaders(head, { levels: [], leaves: [] }, renderOpts());
    expect(head.querySelectorAll('tr')).toHaveLength(0);
  });
});
