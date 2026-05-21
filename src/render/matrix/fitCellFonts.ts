// L3 render. Whole-table responsive scaling. When the rendered table is
// intrinsically wider than the slot it sits in, the entire <table> is
// shrunk with a single CSS transform so every column, cell, glyph, and
// border scales together — far cheaper and more legible than measuring
// and re-sizing fonts cell by cell. Pure measurement plus a style write,
// and idempotent: it clears any prior transform before measuring so a
// resize re-fits from the true intrinsic width rather than compounding.

// Below this ratio the text is unreadable; the table stays at this floor
// and the user is expected to widen the visual instead.
const MIN_SCALE = 0.4;

// Reads the table's natural width against the container's available
// width and, only when it overflows, locks a top-left scale transform
// plus an explicit width so the layout reserves the scaled footprint.
export function fitTableToContainer(container: HTMLElement): void {
  const table = container.querySelector('table');
  if (!table) {
    return;
  }
  const tableEl = table as HTMLTableElement;

  // Clear prior scaling so offsetWidth reports the true intrinsic width,
  // not a previously-scaled one.
  tableEl.style.transform = '';
  tableEl.style.transformOrigin = '';
  tableEl.style.width = '';

  const available = container.clientWidth;
  const intrinsic = tableEl.offsetWidth;
  if (available <= 0 || intrinsic <= 0) {
    return;
  }
  if (intrinsic <= available) {
    return;
  }

  const ratio = Math.max(MIN_SCALE, available / intrinsic);
  tableEl.style.transformOrigin = 'top left';
  tableEl.style.transform = `scale(${ratio})`;
  // Pin the pre-scale width so the container still reserves the correct
  // horizontal space for the now-smaller table.
  tableEl.style.width = `${intrinsic}px`;
}

// The name table.ts wires to. Kept as a distinct export so the
// orchestrator's call site reads as an intent ("fit the cell fonts")
// while the implementation remains whole-table scaling.
export function fitCellFonts(container: HTMLElement): void {
  fitTableToContainer(container);
}
