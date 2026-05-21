// L3 render. The orchestrator. It takes the finished ColumnTree, the
// matrix (for the rows tree only), and the resolved options, and returns
// one wired root: a left controls rail beside a scrollable table region
// holding the thead, tbody, and an optional tfoot. It resolves the
// active appearance theme once and layers its matrix colors over the
// caller's resolved theme without mutating the caller's options. It
// owns no value logic — the header, body, and foot renderers do — and
// it never reaches into the pipeline; the ColumnTree is the entire
// boundary. After layout it fits the table and the panel to their
// slots, on the next frame when one is available so measurement runs
// against real geometry.

import powerbi from 'powerbi-visuals-api';

import type { ColumnTree } from '../../model/columnTree';
import type { FormatOptions } from '../../model/formatOptions';
import type { ResolvedTheme } from '../../primitives/theme';
import { renderColumnHeaders } from './columnHeaders';
import { renderControlsPanel } from './controlsPanel';
import { fitCellFonts } from './fitCellFonts';
import { fitPanelToContainer } from './fitPanelToContainer';
import { renderGrandTotal } from './grandTotal';
import { repaintSelection } from './selectionRepaint';
import { walkRowNodes } from './rowNodes';
import { resolveAppearanceTheme } from './themes';

import DataViewMatrix = powerbi.DataViewMatrix;

// Layers the active appearance palette over the caller's resolved theme.
// The IBCS color slots are kept from the caller so report-theme or
// format-pane overrides of variance colors still win.
function withAppearance(theme: ResolvedTheme, appearanceName: string | undefined): ResolvedTheme {
  const appearance = resolveAppearanceTheme(appearanceName);
  return {
    ...theme,
    headerBg: appearance.matrix.headerBg,
    headerFg: appearance.matrix.headerFg,
    bodyFg: appearance.matrix.bodyFg,
    borderFg: appearance.matrix.borderFg,
    altRowBg: appearance.matrix.altRowBg,
  };
}

function buildControls(opts: FormatOptions): { outer: HTMLElement; inner: HTMLElement } {
  const outer = document.createElement('div');
  outer.classList.add('cortex-controls');
  outer.style.flex = '0 0 15%';
  outer.style.minWidth = '100px';
  outer.style.maxWidth = '220px';
  outer.style.height = '100%';
  outer.style.boxSizing = 'border-box';
  outer.style.overflow = 'hidden';
  outer.style.position = 'relative';

  // The rail renders at natural size into an absolutely-positioned inner
  // element; fitPanelToContainer then scales the inner to the outer slot
  // — the same intrinsic-then-scale recipe the table uses.
  const inner = document.createElement('div');
  inner.style.position = 'absolute';
  inner.style.top = '0';
  inner.style.left = '0';
  renderControlsPanel(inner, opts);
  outer.appendChild(inner);
  return { outer, inner };
}

function buildColgroup(tree: ColumnTree): HTMLElement {
  const colgroup = document.createElement('colgroup');
  // The row-label column auto-sizes; data columns get a per-kind class
  // so the four period groups can share one width discipline in CSS.
  const cornerCol = document.createElement('col');
  cornerCol.classList.add('cortex-col-corner');
  colgroup.appendChild(cornerCol);
  for (const leaf of tree.leaves) {
    const col = document.createElement('col');
    if (leaf.isSynthetic === 'delta') {
      col.classList.add('cortex-col-delta');
    } else if (leaf.isSynthetic === 'deltaPct') {
      col.classList.add('cortex-col-delta-pct');
    } else if (leaf.isPeriodSynthesis) {
      col.classList.add('cortex-col-period');
    } else {
      col.classList.add('cortex-col-other');
    }
    colgroup.appendChild(col);
  }
  return colgroup;
}

export function renderMatrixTable(
  tree: ColumnTree,
  matrix: DataViewMatrix,
  callerOpts: FormatOptions,
): HTMLElement {
  const appearance = resolveAppearanceTheme(callerOpts.appearanceTheme);
  const opts: FormatOptions = {
    ...callerOpts,
    theme: withAppearance(callerOpts.theme, callerOpts.appearanceTheme),
  };

  const root = document.createElement('div');
  root.classList.add('cortex-matrix-lt2');
  root.classList.add(`cortex-theme-${appearance.name}`);
  root.style.color = opts.theme.bodyFg;
  root.style.background = appearance.rootBg;
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.display = 'flex';
  root.style.flexDirection = 'row';
  root.style.alignItems = 'stretch';
  root.style.overflow = 'hidden';

  const controls = buildControls(opts);

  const tableWrap = document.createElement('div');
  tableWrap.classList.add('cortex-matrix-table');
  tableWrap.style.flex = '1 1 auto';
  tableWrap.style.minWidth = '0';
  tableWrap.style.height = '100%';
  tableWrap.style.overflow = 'hidden';

  const table = document.createElement('table');
  table.appendChild(buildColgroup(tree));

  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  renderColumnHeaders(thead, tree, opts);
  walkRowNodes(matrix.rows.root, tbody, tree.leaves, opts, matrix.rows.levels, { n: 0 });
  table.appendChild(thead);
  table.appendChild(tbody);

  if (opts.showGrandTotal) {
    const tfoot = renderGrandTotal(matrix.rows.root, tree.leaves, opts);
    if (tfoot) {
      table.appendChild(tfoot);
    }
  }

  tableWrap.appendChild(table);
  root.appendChild(controls.outer);
  root.appendChild(tableWrap);

  const fit = (): void => {
    fitCellFonts(tableWrap);
    fitPanelToContainer(controls.outer, controls.inner);
  };
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(fit);
  } else {
    fit();
  }

  // A click on empty chrome (the root or the bare table, not a row)
  // clears the page-wide cross-filter and repaints the highlight.
  root.addEventListener('click', (event: MouseEvent) => {
    if (event.target === root || event.target === table) {
      opts.selection.clear();
      repaintSelection(tbody, opts);
    }
  });

  return root;
}
