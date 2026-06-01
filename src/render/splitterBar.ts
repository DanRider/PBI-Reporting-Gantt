// v2.1 W1 — vertical splitter between Gantt and table regions.
//
// Owns: a horizontal bar (8px tall) that sits between the Gantt scroll
// wrapper and the matrix table region. The bar is drag-only — three small
// grip-dot indicators in the center signal "draggable" but have
// pointer-events:none so they don't interfere with capture. The drag
// fraction clamps so neither region falls below its minimum px (1 row of
// visible content + the splitter bar) — the user always sees enough of
// each region to remember it exists.
//
// collapseMode state is retained on the handle for a future hide-region
// affordance (orchestrator: "we may want a way to completely hide one of
// the 2"). Driven programmatically; no in-bar buttons.
//
// Pure DOM, pointer events for drag (with setPointerCapture so the cursor
// can leave the bar mid-drag without losing the gesture). Strict-TS clean.

const BAR_HEIGHT_PX = 8;
const BAR_BG = "#e8e8ec";
const BAR_BG_HOVER = "#d4d4d8";
const BAR_BORDER = "#c0c0c0";
const BAR_Z_INDEX = 6;
// Subtle center indicator — three dots so the bar reads as a grab handle.
// Removed the ▲ ⇕ ▼ buttons (orchestrator: "the reset button had me confused
// i thought it was something to drag... i am thinking we dont need any of
// the 2 visible controls"). Drag-to-resize is the sole interaction.
const GRIP_DOT_SIZE_PX = 2;
const GRIP_DOT_COLOR = "#888";

// Chevron constants removed in audit-fix #4 — drag-to-resize already
// handles proportional resizing, and the top-right "Hide Gantt" /
// "Hide Table" buttons handle full-collapse with self-recall. The
// splitter is now just a draggable separator with grip dots.

export type CollapseMode = "none" | "gantt" | "table";
/** v2.1 audit-fix — fully-hidden mode (orthogonal to collapseMode).
 *  When hiddenMode !== "none", the named region is given 0px and the
 *  other fills the entire usable height; the splitter bar itself hides
 *  too (no meaningful boundary when one region is gone). */
export type HiddenMode = "none" | "gantt" | "table";

export interface SplitterOptions {
    /** Initial fraction of usable height (viewport minus bar) given to Gantt. 0..1. */
    initialPct: number;
    /** Minimum px Gantt occupies when Gantt is collapsed (or drag pins to min). */
    minGanttPx: number;
    /** Minimum px Matrix occupies when Matrix is collapsed (or drag pins to min). */
    minMatrixPx: number;
    /** Called on programmatic state change OR after a drag completes
     *  (pointerup). Triggers a full re-render including any content
     *  that depends on the new layout (gantt SVG rows, table rows). */
    onChange: () => void;
    /** INF-379X — optional fast-path called on every drag frame
     *  (requestAnimationFrame-coalesced). If provided, consumer
     *  should apply ONLY the splitter-affected layout (style.top,
     *  style.height) without re-rendering content — keeps drag
     *  buttery at 60fps even on large datasets. If omitted, drag
     *  falls back to onChange (slow but functionally correct). */
    onLiveDrag?: () => void;
}

export interface SplitterHandle {
    /** Px Gantt should occupy given a viewport height. */
    ganttHeightPx(viewportHeight: number): number;
    /** Px Matrix should occupy given a viewport height. */
    matrixHeightPx(viewportHeight: number): number;
    /** Constant: bar's own height. */
    barHeightPx(): number;
    /** Position the bar element in absolute coords on root. */
    layout(opts: { leftPx: number; topPx: number; widthPx: number }): void;
    /** Hide/show the bar (e.g. when table isn't bound). */
    setVisible(visible: boolean): void;
    /** Current collapse mode (for diagnostics / future persistence). */
    collapseMode(): CollapseMode;
    /** v2.1 audit-fix — fully hide one region (0px) or restore both. */
    setHidden(mode: HiddenMode): void;
    hiddenMode(): HiddenMode;
    element: HTMLElement;
}

function buildBar(): HTMLDivElement {
    const bar = document.createElement("div");
    bar.className = "gantt-table-splitter";
    bar.style.cssText = [
        "position:absolute",
        `height:${BAR_HEIGHT_PX}px`,
        `background:${BAR_BG}`,
        `border-top:1px solid ${BAR_BORDER}`,
        `border-bottom:1px solid ${BAR_BORDER}`,
        `z-index:${BAR_Z_INDEX}`,
        "cursor:ns-resize",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "gap:3px",
        "box-sizing:border-box",
        "user-select:none",
        "touch-action:none",
    ].join(";");
    // Three small dots in the middle: a conventional grab-handle visual that
    // signals "draggable" without competing with the cursor:ns-resize hint.
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement("div");
        dot.style.cssText = [
            `width:${GRIP_DOT_SIZE_PX}px`,
            `height:${GRIP_DOT_SIZE_PX}px`,
            "border-radius:50%",
            `background:${GRIP_DOT_COLOR}`,
            "pointer-events:none",
        ].join(";");
        bar.appendChild(dot);
    }
    bar.addEventListener("mouseenter", () => { bar.style.background = BAR_BG_HOVER; });
    bar.addEventListener("mouseleave", () => { bar.style.background = BAR_BG; });
    return bar;
}

export function mountSplitterBar(
    root: HTMLElement,
    options: SplitterOptions,
): SplitterHandle {
    let userPct = clampPct(options.initialPct);
    let mode: CollapseMode = "none";
    let hidden: HiddenMode = "none";
    let lastViewportHeight = 0;
    let visible = true;

    const bar = buildBar();

    // Drag: pointerdown anywhere on the bar. Capture the pointer so
    // mousemove keeps firing if the cursor leaves the bar while dragging.
    // Chevron buttons stopPropagation on their own pointerdown so they
    // don't fire drag from this listener.
    let dragStartY = 0;
    let dragStartPct = userPct;
    let dragRootTop = 0;

    // INF-379X — requestAnimationFrame coalesce for live-drag updates.
    // pointermove on modern hardware fires 120Hz+; each fire triggered
    // a full visual.update() (expensive at pointer-event rate). rAF
    // caps the drag callback at the browser's paint cadence (60Hz)
    // AND deduplicates multiple events within the same frame. During
    // drag, onLiveDrag (cheap layout-only) fires per frame. On
    // pointerup the pending frame is cancelled and onChange fires
    // synchronously (full re-render to reflow content).
    let pendingFrame = 0;
    function scheduleDragChange(): void {
        if (pendingFrame !== 0) return;
        pendingFrame = window.requestAnimationFrame(() => {
            pendingFrame = 0;
            (options.onLiveDrag ?? options.onChange)();
        });
    }
    function commitDrag(): void {
        // Called from pointerup. Cancels any pending frame so a stale
        // onLiveDrag does not fire AFTER the final settle. Fires
        // onChange synchronously (full re-render reflows content that
        // onLiveDrag deliberately skipped during drag).
        const wasMidDrag = pendingFrame !== 0;
        if (pendingFrame !== 0) {
            window.cancelAnimationFrame(pendingFrame);
            pendingFrame = 0;
        }
        if (wasMidDrag) options.onChange();
    }
    function cancelPendingDrag(): void {
        if (pendingFrame !== 0) {
            window.cancelAnimationFrame(pendingFrame);
            pendingFrame = 0;
        }
    }

    bar.addEventListener("pointerdown", (e) => {
        if (!visible) return;
        // Cancel any pending frame from a previous interaction —
        // belt-and-suspenders for a new drag starting before pointerup
        // (rare but possible with touch + capture quirks).
        cancelPendingDrag();
        bar.setPointerCapture(e.pointerId);
        // INF-379X — flag documentElement during drag so the chrome-
        // animation CSS transitions (visual.less .matrix-region etc.)
        // are disabled. Without this disable, every drag-frame style.top
        // mutation is eased over the transition's duration — the matrix
        // chases the splitter at transition speed, not pointer speed
        // (operator: "it moves but it is too slow").
        document.documentElement.classList.add("splitter-dragging");
        dragStartY = e.clientY;
        dragStartPct = userPct;
        const rootRect = root.getBoundingClientRect();
        dragRootTop = rootRect.top;
        // Drag overrides collapse: start dragging from the current effective
        // gantt fraction so the bar doesn't jump.
        if (mode !== "none" && lastViewportHeight > 0) {
            const currentGantt = ganttHeightPx(lastViewportHeight);
            const usable = lastViewportHeight - BAR_HEIGHT_PX;
            userPct = clampPct(currentGantt / Math.max(1, usable));
            dragStartPct = userPct;
            mode = "none";
        }
    });
    bar.addEventListener("pointermove", (e) => {
        if (!bar.hasPointerCapture(e.pointerId)) return;
        if (lastViewportHeight <= 0) return;
        const deltaY = e.clientY - dragStartY;
        const usable = lastViewportHeight - BAR_HEIGHT_PX;
        if (usable <= 0) return;
        const deltaPct = deltaY / usable;
        userPct = clampPct(dragStartPct + deltaPct);
        // INF-379X — rAF coalesce. Multiple pointermove events within
        // the same frame collapse to one onChange call.
        scheduleDragChange();
        // Silence unused-var: dragRootTop is reserved for future
        // root-relative drag math if PBI ever reports stale clientY.
        void dragRootTop;
    });
    bar.addEventListener("pointerup", (e) => {
        if (bar.hasPointerCapture(e.pointerId)) {
            bar.releasePointerCapture(e.pointerId);
        }
        // INF-379X — drag finished; re-enable the chrome-animation CSS
        // transitions so the next strip-pin/unpin animation (INF-3751)
        // still eases as designed.
        document.documentElement.classList.remove("splitter-dragging");
        // INF-379X — commit the drag: cancel any pending rAF (its
        // onLiveDrag is now stale) and fire onChange synchronously so
        // the visual reflows content (gantt SVG, table rows) to the
        // new dimensions.
        commitDrag();
        // audit-fix #24e — swallow the synthetic click after pointerup so
        // the root whitespace handler doesn't clear the selection (and
        // close the Inspector panel). Same pattern as controlsPanel.
        const swallowNextClick = (ev: Event): void => {
            ev.stopPropagation();
            ev.preventDefault();
            window.removeEventListener("click", swallowNextClick, true);
        };
        window.addEventListener("click", swallowNextClick, true);
    });
    bar.addEventListener("pointercancel", () => {
        // INF-379X — cancel pending frame on pointercancel (touch interrupted,
        // capture lost). Don't fire onChange — the drag was aborted.
        cancelPendingDrag();
        document.documentElement.classList.remove("splitter-dragging");
    });

    root.appendChild(bar);

    function ganttHeightPx(viewportHeight: number): number {
        lastViewportHeight = viewportHeight;
        // v2.1 audit-fix — fully-hidden mode takes precedence over collapseMode.
        // Bar takes 0 height when one region is fully hidden so the visible
        // region fills the full viewport.
        if (hidden === "gantt") return 0;
        if (hidden === "table") return viewportHeight;
        const usable = Math.max(0, viewportHeight - BAR_HEIGHT_PX);
        if (mode === "gantt") return Math.min(options.minGanttPx, usable - options.minMatrixPx);
        if (mode === "table") return Math.max(options.minGanttPx, usable - options.minMatrixPx);
        const raw = usable * userPct;
        return clampPx(raw, options.minGanttPx, usable - options.minMatrixPx);
    }

    function matrixHeightPx(viewportHeight: number): number {
        if (hidden === "table") return 0;
        if (hidden === "gantt") return viewportHeight;
        const usable = Math.max(0, viewportHeight - BAR_HEIGHT_PX);
        return Math.max(0, usable - ganttHeightPx(viewportHeight));
    }

    function layout(opts: { leftPx: number; topPx: number; widthPx: number }): void {
        bar.style.left = `${opts.leftPx}px`;
        bar.style.top = `${opts.topPx}px`;
        bar.style.width = `${opts.widthPx}px`;
    }

    function setVisible(v: boolean): void {
        visible = v;
        // v2.1 audit-fix — also hide when a region is fully hidden (no
        // meaningful boundary). External setVisible(false) for table-unbound
        // case still wins; hidden-mode-driven hide overrides only when the
        // caller wanted visible.
        const effectiveVisible = v && hidden === "none";
        bar.style.display = effectiveVisible ? "flex" : "none";
    }

    function barHeightPx(): number {
        return hidden === "none" ? BAR_HEIGHT_PX : 0;
    }

    return {
        ganttHeightPx,
        matrixHeightPx,
        barHeightPx,
        layout,
        setVisible,
        collapseMode: () => mode,
        setHidden(next: HiddenMode): void {
            hidden = next;
            // Re-apply visibility so the bar element follows the new state.
            setVisible(visible);
            options.onChange();
        },
        hiddenMode: () => hidden,
        element: bar,
    };
}

function clampPct(v: number): number {
    if (Number.isNaN(v)) return 0.6;
    if (v < 0.05) return 0.05;
    if (v > 0.95) return 0.95;
    return v;
}

function clampPx(v: number, lo: number, hi: number): number {
    if (hi < lo) return lo;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}
