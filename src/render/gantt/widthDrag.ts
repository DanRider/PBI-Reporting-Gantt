// INF-3736 — drag-to-resize helper for invisible column boundaries.
//
// pointerdown fires on the hit zone, but pointermove/pointerup are attached to
// WINDOW, not the hit zone. The hit zone is typically inside an SVG group that
// gets cleared on every re-render (g.selectAll("*").remove()). If we attached
// move/up to the hit zone itself, the very first preview re-render would
// detach it mid-drag and the gesture would die. Window listeners survive any
// DOM mutation downstream.
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
        document.body.style.cursor = "col-resize";

        const compute = (clientX: number): number => {
            const svgX = clientX - svgRect.left;
            const newWidthPx = svgX - areaStartX;
            const newPercent = (newWidthPx / Math.max(1, viewportWidth)) * 100;
            return Math.max(minPercent, Math.min(maxPercent, newPercent));
        };
        const onMove = (mv: PointerEvent): void => {
            onResize(compute(mv.clientX), false);
        };
        const onUp = (up: PointerEvent): void => {
            document.body.style.cursor = "";
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            onResize(compute(up.clientX), true);
            const swallow = (ev: Event): void => {
                ev.stopPropagation();
                ev.preventDefault();
                window.removeEventListener("click", swallow, true);
            };
            window.addEventListener("click", swallow, true);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    });
}
