// L3 render. The bottom totals row. It re-derives each leaf's value from
// the matrix rows-root values bag through the shared leaf-value resolver
// — the exact same four-branch logic the body rows use, so a column's
// total can never disagree with the sum of its cells. The single <tr> is
// wrapped in a <tfoot> and returned; a matrix that bound no Values has
// no root bag, so null comes back and the caller omits the footer.

import powerbi from 'powerbi-visuals-api';

import type { ColumnLeaf } from '../../model/columnTree';
import type { FormatOptions } from '../../model/formatOptions';
import { resolveLeafValue, type ValuesBag } from './leafValue';
import { styleHeader } from './themeApplication';

import DataViewMatrixNode = powerbi.DataViewMatrixNode;

type NodeWithValues = DataViewMatrixNode & { values?: ValuesBag };

// Returns null when the rows root carries no values bag — nothing to
// total, so the caller skips the foot entirely.
export function renderGrandTotal(
  rowsRoot: DataViewMatrixNode,
  leaves: ColumnLeaf[],
  opts: FormatOptions,
): HTMLElement | null {
  const values = (rowsRoot as NodeWithValues).values;
  if (!values) {
    return null;
  }

  const tfoot = document.createElement('tfoot');
  const tr = document.createElement('tr');
  tr.style.height = `${opts.rowHeight}px`;

  const labelCell = document.createElement('th');
  labelCell.textContent = 'Total';
  styleHeader(labelCell, opts.theme);
  labelCell.style.borderTop = `2px solid ${opts.theme.borderFg}`;
  tr.appendChild(labelCell);

  for (const leaf of leaves) {
    const td = document.createElement('td');
    td.classList.add('rg-num');
    td.style.fontWeight = '700';
    td.style.color = opts.theme.bodyFg;
    td.style.borderTop = `2px solid ${opts.theme.borderFg}`;
    // The host iframe stylesheet outranks class rules, so the numeric
    // alignment and no-wrap that keep the totals row legible are written
    // inline with priority.
    td.style.setProperty('text-align', 'right', 'important');
    td.style.setProperty('font-variant-numeric', 'tabular-nums', 'important');
    td.style.setProperty('white-space', 'nowrap', 'important');
    td.textContent = leaf.formatter(resolveLeafValue(leaf, values));
    tr.appendChild(td);
  }

  tfoot.appendChild(tr);
  return tfoot;
}
