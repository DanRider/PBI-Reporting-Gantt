// L3 render. Builds the <thead>: one row per ColumnTree level, plus an
// optional synthetic span row that groups the leaves sharing a
// groupLabel (a period cluster, a Δ pair). The span row is derived here
// from the leaf list — render never reaches into the pipeline for it;
// the ColumnTree is the whole contract. Its placement follows one rule:
// a single-level tree (leaves only) gets the span row ON TOP so the
// group caption sits above the column names; a multi-level tree gets it
// just BELOW the outermost level so the caption nests under the date /
// dimension headers. With no clustered leaves there is no span row.

import type { ColumnTree } from '../../model/columnTree';
import type { FormatOptions } from '../../model/formatOptions';
import { styleHeader } from './themeApplication';

// Where the synthetic group-caption row lands relative to the level
// rows. 'none' means no leaf carried a group label.
type SpanPosition = 'top' | 'belowOuter' | 'none';

// One emitted caption: either a real group spanning `colspan` leaves, or
// a one-wide filler over a leaf that belongs to no group (so the row
// still has a cell per column and the table stays rectangular).
interface SpanCell {
  label: string;
  colspan: number;
}

interface SpanRow {
  position: SpanPosition;
  cells: SpanCell[];
}

// Folds consecutive same-label leaves into one caption cell and emits a
// blank single-wide cell for every ungrouped leaf, so the cell widths
// sum to exactly the leaf count.
function buildSpanRow(tree: ColumnTree): SpanRow {
  const leaves = tree.leaves;
  const cells: SpanCell[] = [];
  let anyGroup = false;

  let i = 0;
  while (i < leaves.length) {
    const label = leaves[i].groupLabel ?? '';
    if (label.length === 0) {
      cells.push({ label: '', colspan: 1 });
      i += 1;
      continue;
    }
    let run = 1;
    while (i + run < leaves.length && (leaves[i + run].groupLabel ?? '') === label) {
      run += 1;
    }
    cells.push({ label, colspan: run });
    anyGroup = true;
    i += run;
  }

  if (!anyGroup) {
    return { position: 'none', cells: [] };
  }
  // One level means the tree is just the leaf row; the caption belongs
  // above it. More levels mean a date / dimension hierarchy is present,
  // and the caption nests directly under its outermost level.
  return { position: tree.levels.length <= 1 ? 'top' : 'belowOuter', cells };
}

// The leaf header text: the matrix node's own value if it has one, else
// the leaf's synthesized default label (the "Δ", "%Δ", "YTD May 2026"
// captions the pipeline already resolved). Index pairing is 1:1 with the
// leaf row so synthetics keep their own label even though they borrow a
// real node for ancestry.
function leafHeaderText(tree: ColumnTree, entryIndex: number): string {
  const entry = tree.levels[tree.levels.length - 1][entryIndex];
  const leaf = tree.leaves[entryIndex];
  const nodeValue = entry.node.value;
  if (nodeValue != null) {
    return String(nodeValue);
  }
  return leaf ? leaf.defaultLabel : '';
}

// A leading filler cell so the span row aligns with the row-label
// column the body rows carry on their left.
function appendRowLabelSpacer(tr: HTMLElement, opts: FormatOptions): void {
  const corner = document.createElement('th');
  corner.textContent = '';
  styleHeader(corner, opts.theme);
  tr.appendChild(corner);
}

function emitSpanRow(span: SpanRow, opts: FormatOptions): HTMLElement {
  const tr = document.createElement('tr');
  appendRowLabelSpacer(tr, opts);
  for (const cell of span.cells) {
    const th = document.createElement('th');
    th.textContent = cell.label;
    th.colSpan = cell.colspan;
    styleHeader(th, opts.theme);
    th.style.setProperty('text-align', 'center', 'important');
    tr.appendChild(th);
  }
  return tr;
}

function emitLevelRow(
  tree: ColumnTree,
  level: number,
  leafLevel: number,
  opts: FormatOptions,
): HTMLElement {
  const tr = document.createElement('tr');
  appendRowLabelSpacer(tr, opts);
  const entries = tree.levels[level];
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    const th = document.createElement('th');
    th.colSpan = entry.leafCount;
    if (level === leafLevel) {
      th.textContent = leafHeaderText(tree, entryIndex);
      const leaf = tree.leaves[entryIndex];
      if (leaf?.isSynthetic === 'delta') {
        th.classList.add('rg-delta');
      } else if (leaf?.isSynthetic === 'deltaPct') {
        th.classList.add('rg-delta-pct');
      } else if (leaf?.isPeriodSynthesis) {
        th.classList.add('rg-period');
      }
    } else {
      th.textContent = entry.node.value == null ? '' : String(entry.node.value);
    }
    styleHeader(th, opts.theme);
    th.style.setProperty('text-align', 'center', 'important');
    tr.appendChild(th);
  }
  return tr;
}

// Appends every header row to `thead` in visual order: the span row
// first when it sits on top, then each level, dropping the span row in
// directly under level 0 when it nests there.
export function renderColumnHeaders(
  thead: HTMLElement,
  tree: ColumnTree,
  opts: FormatOptions,
): void {
  const depth = tree.levels.length;
  if (depth === 0) {
    return;
  }
  const leafLevel = depth - 1;
  const span = buildSpanRow(tree);

  if (span.position === 'top') {
    thead.appendChild(emitSpanRow(span, opts));
  }
  for (let level = 0; level < depth; level += 1) {
    thead.appendChild(emitLevelRow(tree, level, leafLevel, opts));
    if (span.position === 'belowOuter' && level === 0) {
      thead.appendChild(emitSpanRow(span, opts));
    }
  }
}
