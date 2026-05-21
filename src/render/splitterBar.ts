// W1 of INF-3728 — vertical splitter between Gantt and table regions.
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

// v2.1 W1.5e — hide-region chevrons at bar ends. Hover-revealed (opacity
// transitions 200ms on bar hover); click toggles the corresponding
// region's collapseMode. Positioned at the far edges so they don't
// compete with the bar's drag area or the center grip dots.
const CHEVRON_WIDTH_PX = 16;
const CHEVRON_FADE_MS = 200;
const CHEVRON_COLOR = "#444";

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
    /** Called when the splitter state changes (drag, button click). */
    onChange: () => void;
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

    // v2.1 W1.5e — left/right chevron buttons at bar ends, hover-revealed.
    // pointer-events:auto + position:absolute so they catch their own
    // clicks (with stopPropagation on pointerdown to avoid starting a drag).
    function buildChevron(side: "left" | "right", char: string): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `splitter-chevron-${side}`;
        btn.textContent = char;
        btn.style.cssText = [
            "position:absolute",
            "top:50%",
            `${side}:2px`,
            "transform:translateY(-50%)",
            `width:${CHEVRON_WIDTH_PX}px`,
            "height:14px",
            "padding:0",
            "border:none",
            "background:transparent",
            `color:${CHEVRON_COLOR}`,
            "font-size:11px",
            "line-height:1",
            "cursor:pointer",
            "opacity:0",
            `transition:opacity ${CHEVRON_FADE_MS}ms ease`,
            "pointer-events:auto",
            "display:flex",
            "align-items:center",
            "justify-content:center",
        ].join(";");
        // Critical: stopPropagation on pointerdown so clicks on the chevron
        // don't start a drag on the bar (which would jump the split fraction).
        btn.addEventListener("pointerdown", (e) => e.stopPropagation());
        return btn;
    }
    const leftChevron = buildChevron("left", "\u25c0");   // ◀ collapses Gantt to its min (showing only the table-leaning split)
    const rightChevron = buildChevron("right", "\u25b6"); // ▶ collapses Table to its min (showing only the Gantt-leaning split)
    bar.appendChild(leftChevron);
    bar.appendChild(rightChevron);

    function updateChevronLabels(): void {
        // Reflect current action in aria/title so screen readers see the role change.
        leftChevron.setAttribute("aria-label", mode === "gantt" ? "Restore Gantt" : "Collapse Gantt");
        leftChevron.title = mode === "gantt" ? "Restore Gantt" : "Collapse Gantt";
        rightChevron.setAttribute("aria-label", mode === "table" ? "Restore Table" : "Collapse Table");
        rightChevron.title = mode === "table" ? "Restore Table" : "Collapse Table";
    }
    updateChevronLabels();

    leftChevron.addEventListener("click", (e) => {
        e.stopPropagation();
        mode = mode === "gantt" ? "none" : "gantt";
        updateChevronLabels();
        options.onChange();
    });
    rightChevron.addEventListener("click", (e) => {
        e.stopPropagation();
        mode = mode === "table" ? "none" : "table";
        updateChevronLabels();
        options.onChange();
    });

    bar.addEventListener("mouseenter", () => {
        leftChevron.style.opacity = "1";
        rightChevron.style.opacity = "1";
    });
    bar.addEventListener("mouseleave", () => {
        leftChevron.style.opacity = "0";
        rightChevron.style.opacity = "0";
    });

    // Drag: pointerdown anywhere on the bar. Capture the pointer so
    // mousemove keeps firing if the cursor leaves the bar while dragging.
    // Chevron buttons stopPropagation on their own pointerdown so they
    // don't fire drag from this listener.
    let dragStartY = 0;
    let dragStartPct = userPct;
    let dragRootTop = 0;
    bar.addEventListener("pointerdown", (e) => {
        if (!visible) return;
        bar.setPointerCapture(e.pointerId);
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
        options.onChange();
        // Silence unused-var: dragRootTop is reserved for future
        // root-relative drag math if PBI ever reports stale clientY.
        void dragRootTop;
    });
    bar.addEventListener("pointerup", (e) => {
        if (bar.hasPointerCapture(e.pointerId)) {
            bar.releasePointerCapture(e.pointerId);
        }
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
