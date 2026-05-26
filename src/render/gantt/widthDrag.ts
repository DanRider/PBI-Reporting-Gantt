// INF-3736 — drag-to-resize helper for invisible column boundaries.
//
// Attaches pointer-event handlers to an SVG element so the user can drag
// horizontally to resize a column. The element is the hit zone (typically
// an invisible overlay rect with cursor:col-resize). The width is reported
// as a PERCENT of viewportWidth, clamped to [minPercent, maxPercent].
//
// onResize fires repeatedly during drag with isCommit=false (live preview)
// and once at pointerup with isCommit=true (commit point — caller persists).
// Synthetic post-pointerup click is swallowed via a one-shot capture-phase
// listener so the drag-end click doesn't trigger downstream selection.

export function attachWidthDrag(
    node: SVGElement,
    areaStartX: number,
    viewportWidth: number,
    minPercent: number,
    maxPercent: number,
    onResize: (newPercent: number, isCommit: boolean) => void,
): void {
    node.style.cursor = "col-resize";
    node.addEventListener("pointerdown", (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const svg = node.ownerSVGElement;
        if (!svg) return;
        const svgRect = svg.getBoundingClientRect();
        node.setPointerCapture(e.pointerId);
        document.body.style.cursor = "col-resize";

        const compute = (clientX: number): number => {
            const svgX = clientX - svgRect.left;
            const newWidthPx = svgX - areaStartX;
            const newPercent = (newWidthPx / Math.max(1, viewportWidth)) * 100;
            return Math.max(minPercent, Math.min(maxPercent, newPercent));
        };
        const onMove = (mv: PointerEvent): void => {
            if (!node.hasPointerCapture(mv.pointerId)) return;
            onResize(compute(mv.clientX), false);
        };
        const onUp = (up: PointerEvent): void => {
            if (node.hasPointerCapture(up.pointerId)) node.releasePointerCapture(up.pointerId);
            document.body.style.cursor = "";
            node.removeEventListener("pointermove", onMove);
            node.removeEventListener("pointerup", onUp);
            onResize(compute(up.clientX), true);
            const swallow = (ev: Event): void => {
                ev.stopPropagation();
                ev.preventDefault();
                window.removeEventListener("click", swallow, true);
            };
            window.addEventListener("click", swallow, true);
        };
        node.addEventListener("pointermove", onMove);
        node.addEventListener("pointerup", onUp);
    });
}
