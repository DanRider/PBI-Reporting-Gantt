// L3 render. Depth-first walk of the matrix rows tree, emitting one
// <tr> per non-root node into the tbody: a left label cell indented by
// hierarchy depth, then one value cell per leaf. Every value goes
// through the shared leaf-value resolver so the body and the foot agree.
// When IBCS is on, a synthetic Δ/%Δ cell that resolved to a finite
// number is recolored (and, in classic style, glyph-prefixed) by the
// favorability-aware encoder; the measure's direction is looked up from
// the leaf's borrowed source node through the queryName map. Leaf rows
// get a click handler wired to the host selection and stash their
// selection id so the repaint pass can reconcile the highlight.

import powerbi from 'powerbi-visuals-api';

import type { ColumnLeaf } from '../../model/columnTree';
import type { FormatOptions } from '../../model/formatOptions';
import { ibcsDecorationFor } from './ibcsVariance';
import { resolveLeafValue, type ValuesBag } from './leafValue';
import { repaintSelection } from './selectionRepaint';

import DataViewHierarchyLevel = powerbi.DataViewHierarchyLevel;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import ISelectionId = powerbi.visuals.ISelectionId;

type NodeWithValues = DataViewMatrixNode & { values?: ValuesBag };
type NodeWithSourceIndex = DataViewMatrixNode & { levelSourceIndex?: number };
type TaggedRow = HTMLTableRowElement & { __rgSelectionId?: ISelectionId };

// One indent step per hierarchy level, built from non-breaking spaces so
// the host's whitespace collapsing does not eat the indentation.
const INDENT_UNIT = '    ';

// A DFS counter passed by reference so the alternating-row stripe stays
// consistent across the whole flattened body rather than resetting per
// subtree.
export interface RowCounter {
  n: number;
}

// Resolves the favorability direction for a synthetic leaf: its borrowed
// node's source index maps into the queryName list, which keys the
// per-measure favorability map. A missing entry is 'higherIsBetter', the
// classic AvA reading. The ternary (not &&) matters — an empty-string
// queryName must not leak in as a falsy direction.
function favorabilityFor(leaf: ColumnLeaf, opts: FormatOptions) {
  const sourceIndex = (leaf.node as NodeWithSourceIndex).levelSourceIndex ?? 0;
  const queryName = opts.valueSourceQueryNames
    ? opts.valueSourceQueryNames[sourceIndex]
    : undefined;
  const direction = queryName ? opts.columnFavorability?.get(queryName) : undefined;
  return direction ?? 'higherIsBetter';
}

function appendRowLabel(tr: HTMLElement, node: DataViewMatrixNode, opts: FormatOptions): void {
  const th = document.createElement('th');
  const indent = INDENT_UNIT.repeat(node.level ?? 0);
  th.textContent = indent + (node.value == null ? '' : String(node.value));
  th.style.color = opts.theme.bodyFg;
  th.style.borderBottom = `1px solid ${opts.theme.borderFg}`;
  th.style.fontWeight = 'normal';
  if (opts.bodyFontSize) {
    th.style.fontSize = `${opts.bodyFontSize}px`;
  }
  tr.appendChild(th);
}

function tagSyntheticKind(td: HTMLElement, leaf: ColumnLeaf): void {
  if (leaf.isSynthetic === 'delta') {
    td.classList.add('rg-delta');
  } else if (leaf.isSynthetic === 'deltaPct') {
    td.classList.add('rg-delta-pct');
  } else if (leaf.isPeriodSynthesis) {
    td.classList.add('rg-period');
  }
}

function appendValueCell(
  tr: HTMLElement,
  leaf: ColumnLeaf,
  values: ValuesBag | undefined,
  opts: FormatOptions,
): void {
  const td = document.createElement('td');
  td.classList.add('rg-num');
  tagSyntheticKind(td, leaf);
  // The host iframe stylesheet wins the cascade against class rules, so
  // the three layout-critical properties that keep numbers aligned and
  // unwrapped are set inline with priority.
  td.style.setProperty('text-align', 'right', 'important');
  td.style.setProperty('font-variant-numeric', 'tabular-nums', 'important');
  td.style.setProperty('white-space', 'nowrap', 'important');
  td.style.borderBottom = `1px solid ${opts.theme.borderFg}`;
  td.style.color = opts.theme.bodyFg;
  if (opts.bodyFontSize) {
    td.style.fontSize = `${opts.bodyFontSize}px`;
  }

  const raw = values ? resolveLeafValue(leaf, values) : null;

  // IBCS overlay applies only to a synthetic that resolved to a finite
  // number; a regular measure or period sum is never recolored, which
  // keeps non-variance columns visually identical IBCS-on vs IBCS-off.
  if (opts.ibcsEnabled !== false && leaf.isSynthetic && typeof raw === 'number') {
    const decoration = ibcsDecorationFor(
      raw,
      opts.theme,
      opts.ibcsArrowStyle ?? 'classic',
      favorabilityFor(leaf, opts),
    );
    if (decoration) {
      td.style.color = decoration.color;
      const formatted = leaf.formatter(raw);
      td.textContent = decoration.glyph ? `${decoration.glyph} ${formatted}` : formatted;
      tr.appendChild(td);
      return;
    }
  }

  td.textContent = leaf.formatter(raw);
  tr.appendChild(td);
}

function wireSelection(
  tr: HTMLTableRowElement,
  tbody: HTMLElement,
  node: DataViewMatrixNode,
  opts: FormatOptions,
  rowLevels: DataViewHierarchyLevel[],
): void {
  const id = opts.selection.idForRowNode(node, rowLevels);
  (tr as TaggedRow).__rgSelectionId = id;
  tr.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation();
    opts.selection.select(id, event.ctrlKey || event.metaKey).then(() => {
      repaintSelection(tbody, opts);
    });
  });
}

// `counter` is shared across the whole walk so the zebra striping is
// continuous over the flattened body.
export function walkRowNodes(
  node: DataViewMatrixNode,
  tbody: HTMLElement,
  leaves: ColumnLeaf[],
  opts: FormatOptions,
  rowLevels: DataViewHierarchyLevel[],
  counter: RowCounter,
): void {
  const isRoot = node.level == null;
  if (!isRoot) {
    const tr = document.createElement('tr');
    tr.style.height = `${opts.rowHeight}px`;
    if (counter.n % 2 === 1) {
      tr.classList.add('rg-row-alt');
      tr.style.background = opts.theme.altRowBg;
    }
    counter.n += 1;

    appendRowLabel(tr, node, opts);
    const values = (node as NodeWithValues).values;
    for (const leaf of leaves) {
      appendValueCell(tr, leaf, values, opts);
    }

    const isLeafRow = !node.children || node.children.length === 0;
    if (isLeafRow) {
      wireSelection(tr, tbody, node, opts, rowLevels);
    }
    tbody.appendChild(tr);
  }

  if (node.children) {
    for (const child of node.children) {
      walkRowNodes(child, tbody, leaves, opts, rowLevels, counter);
    }
  }
}
