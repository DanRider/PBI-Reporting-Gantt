// W1.5 of INF-3728 — vertical splitter between Gantt and table regions.
//
// Owns: a horizontal bar (8px tall) that sits between the Gantt scroll
// wrapper and the matrix table region. The bar carries three buttons
// (collapse-gantt, reset, collapse-table) and a drag handle covering
// the rest of its width. Drag = manual resize. Buttons = preset states.
//
// Collapse semantics: neither side ever drops below its minimum px so
// the user always sees enough of the collapsed region to remember it
// exists (1 row of content + the splitter bar).
//
// Pure DOM, pointer events for drag (with setPointerCapture so the cursor
// can leave the bar mid-drag without losing the gesture). Strict-TS clean.

const BAR_HEIGHT_PX = 8;
const BAR_BG = "#e8e8ec";
const BAR_BG_HOVER = "#d4d4d8";
const BAR_BORDER = "#c0c0c0";
const BAR_Z_INDEX = 6;
const BUTTON_SIZE_PX = 14;
const BUTTON_BG = "#ffffff";
const BUTTON_BG_HOVER = "#f0f0f3";

export type CollapseMode = "none" | "gantt" | "table";

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
        "gap:4px",
        "box-sizing:border-box",
        "user-select:none",
        "touch-action:none",
    ].join(";");
    bar.addEventListener("mouseenter", () => { bar.style.background = BAR_BG_HOVER; });
    bar.addEventListener("mouseleave", () => { bar.style.background = BAR_BG; });
    return bar;
}

function buildIconButton(label: string, ariaLabel: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.setAttribute("aria-label", ariaLabel);
    btn.title = ariaLabel;
    btn.style.cssText = [
        `width:${BUTTON_SIZE_PX + 6}px`,
        `height:${BUTTON_SIZE_PX}px`,
        "padding:0",
        "font-size:10px",
        "line-height:1",
        "color:#444",
        `background:${BUTTON_BG}`,
        `border:1px solid ${BAR_BORDER}`,
        "border-radius:2px",
        "cursor:pointer",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "box-sizing:border-box",
    ].join(";");
    btn.addEventListener("mouseenter", () => { btn.style.background = BUTTON_BG_HOVER; });
    btn.addEventListener("mouseleave", () => { btn.style.background = BUTTON_BG; });
    // The buttons sit inside the drag bar; their clicks must not start a drag.
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    return btn;
}

export function mountSplitterBar(
    root: HTMLElement,
    options: SplitterOptions,
): SplitterHandle {
    let userPct = clampPct(options.initialPct);
    let mode: CollapseMode = "none";
    let lastViewportHeight = 0;
    let visible = true;

    const bar = buildBar();

    const collapseGanttBtn = buildIconButton("▲", "Collapse Gantt");
    const resetBtn = buildIconButton("⇕", "Reset Gantt/Table split");
    const collapseTableBtn = buildIconButton("▼", "Collapse Table");

    collapseGanttBtn.addEventListener("click", () => {
        mode = mode === "gantt" ? "none" : "gantt";
        options.onChange();
    });
    resetBtn.addEventListener("click", () => {
        mode = "none";
        userPct = clampPct(options.initialPct);
        options.onChange();
    });
    collapseTableBtn.addEventListener("click", () => {
        mode = mode === "table" ? "none" : "table";
        options.onChange();
    });

    bar.appendChild(collapseGanttBtn);
    bar.appendChild(resetBtn);
    bar.appendChild(collapseTableBtn);

    // Drag: pointerdown on the bar (NOT on a button — buttons stopPropagation
    // pointerdown). Capture the pointer so mousemove keeps firing if the
    // cursor leaves the bar while dragging.
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
        const usable = Math.max(0, viewportHeight - BAR_HEIGHT_PX);
        if (mode === "gantt") return Math.min(options.minGanttPx, usable - options.minMatrixPx);
        if (mode === "table") return Math.max(options.minGanttPx, usable - options.minMatrixPx);
        const raw = usable * userPct;
        return clampPx(raw, options.minGanttPx, usable - options.minMatrixPx);
    }

    function matrixHeightPx(viewportHeight: number): number {
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
        bar.style.display = v ? "flex" : "none";
    }

    return {
        ganttHeightPx,
        matrixHeightPx,
        barHeightPx: () => BAR_HEIGHT_PX,
        layout,
        setVisible,
        collapseMode: () => mode,
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
