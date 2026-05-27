// INF-3739 Phase 3a — generic perimeter-mounted panel primitive.
//
// A reusable DOM primitive that mounts to one of four visual perimeters
// (top/bottom/left/right) in fixed-open or expandable mode. Inherits
// chrome (BG #e8e8ec, border #c0c0c0, grip-dot resize handle) from
// splitterBar so every perimeter panel — Inspector today, Featured /
// Comprehensive filter tiers tomorrow — reads as the same family of
// chrome. Replaces the bespoke Inspector mount code (kills 3 future
// panel implementations down to 1).
//
// Sizing is pixel-based (initialSizePx / minSizePx / maxSizePx). The
// perpendicular dimension to the mount edge animates between 0 and the
// current sizePx on open/close via a CSS width/height transition. Resize
// handle lives on the opposite edge from the mount perimeter; dragging
// updates sizePx via the spec's onResize(newSizePx) callback. Wrappers
// (e.g. controlsPanel) translate to their own units at the boundary.
//
// Pure DOM, no innerHTML. Strict-TS clean.

export type PanelPosition = "top" | "bottom" | "left" | "right";
export type PanelMode = "fixed" | "expandable";
export type PanelView = "auto" | "compact" | "normal";

export interface MountablePanelOptions {
    position: PanelPosition;
    mode: PanelMode;
    view: PanelView;
    initialOpen?: boolean;
    initialSizePx?: number;
    minSizePx?: number;
    maxSizePx?: number;
    onResize?: (newSizePx: number) => void;
    onOpenChange?: (open: boolean) => void;
}

export interface MountablePanelHandle {
    setContent(node: HTMLElement): void;
    setOpen(open: boolean): void;
    setView(view: PanelView): void;
    sizePx(): number;
    element: HTMLElement;
}

const PANEL_BG = "#e8e8ec";
const PANEL_BORDER = "#c0c0c0";
const PANEL_Z_INDEX = 10;
const PANEL_TRANSITION_MS = 400;
const RESIZE_HANDLE_THICKNESS_PX = 4;
const RESIZE_HANDLE_HOVER_BG = "#a3b8d4";
const GRIP_DOT_SIZE_PX = 2;
const GRIP_DOT_COLOR = "#888";
const DEFAULT_SIZE_PX = 240;
const DEFAULT_MIN_PX = 80;
const DEFAULT_MAX_PX = 1200;

const PERPENDICULAR_DIM: Record<PanelPosition, "width" | "height"> = {
    top: "height", bottom: "height", left: "width", right: "width",
};

// Resize-handle anchor lives on the perimeter edge facing the visual interior.
const HANDLE_ANCHOR: Record<PanelPosition, "top" | "bottom" | "left" | "right"> = {
    top: "bottom", bottom: "top", left: "right", right: "left",
};

const RESIZE_CURSOR: Record<PanelPosition, "ns-resize" | "ew-resize"> = {
    top: "ns-resize", bottom: "ns-resize", left: "ew-resize", right: "ew-resize",
};

// Border on the edge facing the visual interior — matches splitterBar's
// "one line between us and the content" aesthetic.
const INTERIOR_BORDER_EDGE: Record<PanelPosition, string> = {
    top: "border-bottom",
    bottom: "border-top",
    left: "border-right",
    right: "border-left",
};

export function mountMountablePanel(
    root: HTMLElement,
    options: MountablePanelOptions,
): MountablePanelHandle {
    const position = options.position;
    const dim = PERPENDICULAR_DIM[position];
    const isHorizontalEdge = dim === "height";  // top / bottom mount
    const minPx = options.minSizePx ?? DEFAULT_MIN_PX;
    const maxPx = options.maxSizePx ?? DEFAULT_MAX_PX;
    let sizePx = clampPx(options.initialSizePx ?? DEFAULT_SIZE_PX, minPx, maxPx);
    let open = options.initialOpen ?? false;
    let viewMode: PanelView = options.view;

    const panel = document.createElement("div");
    panel.className = `mountable-panel mountable-panel-${position}`;
    const baseStyle = [
        "position:absolute",
        `background:${PANEL_BG}`,
        `${INTERIOR_BORDER_EDGE[position]}:1px solid ${PANEL_BORDER}`,
        "overflow:hidden",
        `z-index:${PANEL_Z_INDEX}`,
        `transition:${dim} ${PANEL_TRANSITION_MS}ms ease`,
        "box-sizing:border-box",
        "display:flex",
        isHorizontalEdge ? "flex-direction:row" : "flex-direction:column",
    ];
    if (position === "left") baseStyle.push("left:0", "top:0", "height:100%");
    else if (position === "right") baseStyle.push("right:0", "top:0", "height:100%");
    else if (position === "top") baseStyle.push("left:0", "top:0", "width:100%");
    else baseStyle.push("left:0", "bottom:0", "width:100%");
    panel.style.cssText = baseStyle.join(";");

    // Single content slot. setContent replaces its children — wrappers
    // composing header + body do so inside the supplied node.
    const content = document.createElement("div");
    content.className = "mountable-panel-content";
    content.style.cssText = "flex:1;overflow:auto;box-sizing:border-box;";
    panel.appendChild(content);

    let resizeHandle: HTMLDivElement | null = null;
    if (options.mode === "expandable") {
        resizeHandle = buildResizeHandle(position, isHorizontalEdge);
        wireResizeDrag(resizeHandle, position, isHorizontalEdge, () => sizePx, (next) => {
            sizePx = clampPx(next, minPx, maxPx);
            panel.style[dim] = `${sizePx}px`;
        }, () => {
            // Pause the open/close CSS transition while dragging so the
            // perpendicular dim tracks the cursor 1:1.
            panel.style.transition = "none";
        }, () => {
            panel.style.transition = `${dim} ${PANEL_TRANSITION_MS}ms ease`;
            if (options.onResize) options.onResize(sizePx);
        });
        panel.appendChild(resizeHandle);
    }

    // Clicks INSIDE the panel must NOT bubble to the root-level dismiss
    // handler — same gesture-isolation contract as the prior bespoke
    // Inspector mount.
    panel.addEventListener("click", (e) => { e.stopPropagation(); });

    root.appendChild(panel);

    function applyDimension(): void {
        panel.style[dim] = open ? `${sizePx}px` : "0px";
        panel.style.visibility = open ? "visible" : "hidden";
        if (resizeHandle !== null) {
            resizeHandle.style.display = open ? "flex" : "none";
        }
    }

    applyDimension();

    return {
        setContent(node: HTMLElement): void {
            while (content.firstChild) content.removeChild(content.firstChild);
            content.appendChild(node);
        },
        setOpen(next: boolean): void {
            if (next === open) return;
            open = next;
            applyDimension();
            if (options.onOpenChange) options.onOpenChange(open);
        },
        setView(next: PanelView): void {
            // View density is a state-only mutation at the primitive layer
            // for Phase 3a. Consumers (Phase 3b filter tiers) will branch
            // their content render on the current value. Stored here so
            // future getView() / responsive auto-derive logic has a home.
            viewMode = next;
            void viewMode;
        },
        sizePx: () => (open ? sizePx : 0),
        element: panel,
    };
}

function buildResizeHandle(
    position: PanelPosition,
    isHorizontalEdge: boolean,
): HTMLDivElement {
    const handle = document.createElement("div");
    handle.className = "mountable-panel-resize-handle";
    const anchor = HANDLE_ANCHOR[position];
    const style = [
        "position:absolute",
        `cursor:${RESIZE_CURSOR[position]}`,
        "background:transparent",
        "z-index:1",
        "touch-action:none",
        "user-select:none",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "gap:3px",
        `${anchor}:0`,
    ];
    if (isHorizontalEdge) {
        style.push("left:0", "right:0", `height:${RESIZE_HANDLE_THICKNESS_PX}px`);
    } else {
        style.push("top:0", "bottom:0", `width:${RESIZE_HANDLE_THICKNESS_PX}px`);
    }
    handle.style.cssText = style.join(";");
    // Three grip dots — the splitterBar grab-handle idiom. pointer-events:none
    // so dots don't intercept the drag gesture.
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement("div");
        dot.style.cssText = [
            `width:${GRIP_DOT_SIZE_PX}px`,
            `height:${GRIP_DOT_SIZE_PX}px`,
            "border-radius:50%",
            `background:${GRIP_DOT_COLOR}`,
            "pointer-events:none",
        ].join(";");
        handle.appendChild(dot);
    }
    handle.addEventListener("mouseenter", () => { handle.style.background = RESIZE_HANDLE_HOVER_BG; });
    handle.addEventListener("mouseleave", () => { handle.style.background = "transparent"; });
    return handle;
}

function wireResizeDrag(
    handle: HTMLDivElement,
    position: PanelPosition,
    isHorizontalEdge: boolean,
    getSize: () => number,
    setSize: (px: number) => void,
    onDragStart: () => void,
    onDragEnd: () => void,
): void {
    handle.addEventListener("pointerdown", (e: PointerEvent) => {
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        onDragStart();
        const startCoord = isHorizontalEdge ? e.clientY : e.clientX;
        const startSize = getSize();
        // For right/bottom mounts the handle is on the interior side, so
        // a positive cursor delta SHRINKS the panel — invert the sign.
        const inverted = (position === "right" || position === "bottom");
        const onMove = (mv: PointerEvent): void => {
            if (!handle.hasPointerCapture(mv.pointerId)) return;
            const cur = isHorizontalEdge ? mv.clientY : mv.clientX;
            const delta = cur - startCoord;
            const adjusted = inverted ? -delta : delta;
            setSize(startSize + adjusted);
        };
        const onUp = (up: PointerEvent): void => {
            if (handle.hasPointerCapture(up.pointerId)) {
                handle.releasePointerCapture(up.pointerId);
            }
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            onDragEnd();
            // audit-fix #24e parity (splitterBar / prior controlsPanel) —
            // swallow the synthetic click after pointerup so it doesn't
            // bubble to root whitespace dismiss handlers.
            const swallowNextClick = (ev: Event): void => {
                ev.stopPropagation();
                ev.preventDefault();
                window.removeEventListener("click", swallowNextClick, true);
            };
            window.addEventListener("click", swallowNextClick, true);
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
    });
}

function clampPx(v: number, lo: number, hi: number): number {
    if (hi < lo) return lo;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}
