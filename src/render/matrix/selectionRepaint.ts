// L3 render. Reconciles the body's row highlight with the host's live
// selection. Each leaf <tr> the row renderer emitted carries its
// ISelectionId on a private property; this walks the rendered rows and
// toggles the .rg-row-selected class so the highlighted set matches
// whatever the SelectionManager currently holds. Called after every
// select() resolves and after the clear handler fires. It mutates
// classList only — it never builds DOM and never reads data.

import powerbi from 'powerbi-visuals-api';

import type { FormatOptions } from '../../model/formatOptions';

import ISelectionId = powerbi.visuals.ISelectionId;

const SELECTED_CLASS = 'rg-row-selected';

// The property the row renderer stashes the row's selection id under.
// Read-only here; the renderer is the sole writer.
type TaggedRow = HTMLTableRowElement & { __rgSelectionId?: ISelectionId };

// Rows without a stashed id (group/subtotal rows) are always cleared —
// only leaf rows participate in selection, so a missing id means "not
// selectable" rather than "unknown state".
export function repaintSelection(tbody: HTMLElement, opts: FormatOptions): void {
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row) => {
    const id = (row as TaggedRow).__rgSelectionId;
    if (id && opts.selection.isSelected(id)) {
      row.classList.add(SELECTED_CLASS);
    } else {
      row.classList.remove(SELECTED_CLASS);
    }
  });
}
