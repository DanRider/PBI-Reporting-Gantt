// L3 render. The controls-panel companion to the table scaler. The rail
// renders its stack of controls at natural size into an inner element;
// this measures that inner content against the outer slot and, if it
// overflows in either axis, shrinks it with one transform. The panel can
// spill both ways — too many stacked controls overflow the height, a
// long label overflows the width — so the more aggressive of the two
// ratios is chosen to make both fit. Idempotent: the prior transform is
// cleared before measuring.

// The readability floor for the rail; below this the labels blur, so the
// panel clamps here even if that means it still slightly overflows.
const MIN_SCALE = 0.5;

// `container` is the fixed outer slot; `content` is the natural-size
// inner element. On overflow the inner is scaled from its top-left and
// its pre-scale box is pinned so the slot reserves the right space.
export function fitPanelToContainer(container: HTMLElement, content: HTMLElement): void {
  content.style.transform = '';
  content.style.transformOrigin = '';

  const slotW = container.clientWidth;
  const slotH = container.clientHeight;
  if (slotW <= 0 || slotH <= 0) {
    return;
  }

  const contentW = content.scrollWidth;
  const contentH = content.scrollHeight;
  if (contentW <= 0 || contentH <= 0) {
    return;
  }
  if (contentW <= slotW && contentH <= slotH) {
    return;
  }

  // The smaller ratio is the binding one — it guarantees the axis that
  // overflows most still fits.
  const ratio = Math.max(MIN_SCALE, Math.min(slotW / contentW, slotH / contentH));
  content.style.transformOrigin = 'top left';
  content.style.transform = `scale(${ratio})`;
  content.style.width = `${contentW}px`;
  content.style.height = `${contentH}px`;
}
