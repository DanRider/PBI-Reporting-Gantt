// v2.1 W1.5a — selection-driven controls panel.
// INF-3739 Phase 3a — refactored onto the MountablePanel primitive.
//
// Public API unchanged (ControlsPanelOptions + ControlsPanelHandle) so
// visual.ts call sites and any other consumer keep working byte-for-byte.
// What changed under the hood: the bespoke slide/resize/chrome code that
// used to live here is now provided by mountMountablePanel({position:"left",
// mode:"expandable", view:"normal"}). This wrapper supplies the panel's
// internal composition (header with × close + body for swap-in content),
// translates the primitive's pixel sizing to the legacy widthPct() the
// layout coordinator reads, and forwards the resize callback as
// onWidthChange so the Gantt + table regions resize against the new
// widthPct() on every drag tick.
//
// Behavior change to note (intentional, no regression in smoke flow):
// the primitive is pixel-sized, so a viewport resize will hold the panel
// at its absolute pixel width rather than re-scaling proportionally to a
// stored percent. Drag-resize, slide-in/out, × close, click-stop-propagation
// — all identical pre/post.
//
// Pure DOM, no innerHTML. Strict-TS clean.

import { mountMountablePanel, MountablePanelHandle } from "./panel/mountablePanel";

// v2.1 audit-fix #15 — user-draggable panel width clamps (preserved as
// percentages of root width so first-mount sizing reads the same as v2.1).
const PANEL_WIDTH_PCT_OPEN_DEFAULT = 20;
const PANEL_WIDTH_PCT_MIN = 10;
const PANEL_WIDTH_PCT_MAX = 60;
const PANEL_HEADER_BORDER = "#c0c0c0";  // align with primitive border
const PANEL_BODY_BG = "#ffffff";        // content surface stays white

export interface ControlsPanelOptions {
    /** Called when the user clicks × in the panel header. The caller is
     *  responsible for clearing its own selection state — which then
     *  triggers setOpen(false) via the subscriber chain. */
    onDismiss: () => void;
    /** v2.1 audit-fix #15 — called when the user drags the right-edge
     *  handle to resize the panel. Caller should trigger a layout
     *  re-render so the Gantt + table regions resize against the new
     *  widthPct(). */
    onWidthChange?: () => void;
}

export interface ControlsPanelHandle {
    /** Override the panel's vertical bounds. By default the MountablePanel
     *  primitive sets top:0 / height:100%. Use this to push the panel down
     *  below the slicer + master-slider chrome and clip its bottom. */
    setVerticalBounds(topPx: number, heightPx: number): void;

    /** Slide the panel open (true) or closed (false). No-op if already in
     *  that state. */
    setOpen(open: boolean): void;
    /** Replace the panel body content. The header (× close) stays static
     *  across content swaps. */
    setContent(node: HTMLElement): void;
    /** Percent of root width the panel reserves. 0 when closed. Read by
     *  the layout coordinator to compute region sizing. Derived live from
     *  the primitive's sizePx() against the current root width. */
    widthPct(): number;
    /** The panel root element. Exposed for cases where the caller needs
     *  to reach in (e.g. test fixtures). */
    element: HTMLElement;
}

function buildHeader(onDismiss: () => void): HTMLDivElement {
    const header = document.createElement("div");
    header.className = "controls-panel-header";
    header.style.cssText = [
        "display:flex",
        "align-items:center",
        "justify-content:space-between",
        "padding:8px 12px",
        `border-bottom:1px solid ${PANEL_HEADER_BORDER}`,
        "min-height:32px",
        "box-sizing:border-box",
        "flex-shrink:0",
    ].join(";");

    // Orchestrator audit: "labeling the menu at the top is largely a waste
    // of space" — the panel content always provides its own h3 title for
    // whatever is selected. Header now hosts only the × close affordance,
    // with the title space replaced by a thin grow spacer so × stays at
    // the right edge.
    const spacer = document.createElement("div");
    spacer.style.cssText = "flex:1;";
    header.appendChild(spacer);

    const closeBtn = document.createElement("button");
    closeBtn.className = "controls-panel-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close controls panel");
    closeBtn.textContent = "\u2715";
    closeBtn.style.cssText = [
        "background:transparent",
        "border:none",
        "cursor:pointer",
        "font-size:16px",
        "color:#555",
        "padding:2px 8px",
        "line-height:1",
        "border-radius:3px",
    ].join(";");
    closeBtn.addEventListener("mouseenter", () => { closeBtn.style.background = "#f0f0f3"; });
    closeBtn.addEventListener("mouseleave", () => { closeBtn.style.background = "transparent"; });
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onDismiss();
    });
    header.appendChild(closeBtn);

    return header;
}

export function mountControlsPanel(
    root: HTMLElement,
    options: ControlsPanelOptions,
): ControlsPanelHandle {
    // Translate the legacy percent clamps to pixels using current root
    // width. First-mount snapshot — matches v2.1's userWidthPct anchored
    // to root-width-at-mount semantic.
    const rootWidthSnapshot = Math.max(1, root.getBoundingClientRect().width);
    const pctToPx = (pct: number): number => Math.round((pct / 100) * rootWidthSnapshot);

    // Composition mounted inside the primitive's content slot. Header
    // (× close) stays put; body's children swap via the wrapper's
    // setContent.
    const composition = document.createElement("div");
    composition.style.cssText = [
        "display:flex",
        "flex-direction:column",
        "height:100%",
        "width:100%",
        "box-sizing:border-box",
    ].join(";");

    const header = buildHeader(() => options.onDismiss());
    composition.appendChild(header);

    const body = document.createElement("div");
    body.className = "controls-panel-body";
    body.style.cssText = [
        "flex:1",
        "overflow:auto",
        "padding:12px",
        "box-sizing:border-box",
        `background:${PANEL_BODY_BG}`,
    ].join(";");
    composition.appendChild(body);

    const panel: MountablePanelHandle = mountMountablePanel(root, {
        position: "left",
        mode: "expandable",
        view: "normal",
        initialOpen: false,
        initialSizePx: pctToPx(PANEL_WIDTH_PCT_OPEN_DEFAULT),
        minSizePx: pctToPx(PANEL_WIDTH_PCT_MIN),
        maxSizePx: pctToPx(PANEL_WIDTH_PCT_MAX),
        onResize: () => { if (options.onWidthChange) options.onWidthChange(); },
    });
    panel.setContent(composition);

    return {
        setOpen(open: boolean): void { panel.setOpen(open); },
        setContent(node: HTMLElement): void {
            while (body.firstChild) body.removeChild(body.firstChild);
            body.appendChild(node);
        },
        widthPct(): number {
            const cur = Math.max(1, root.getBoundingClientRect().width);
            return (panel.sizePx() / cur) * 100;
        },
        setVerticalBounds(topPx: number, heightPx: number): void {
            // Override the MountablePanel's default top:0/height:100% so the
            // popout sits BELOW the chrome row (toggles + master slider) and
            // clips at the supplied bottom — doesn't run the full visual
            // height and doesn't sit behind the toggle row.
            panel.element.style.top = Math.max(0, topPx) + "px";
            panel.element.style.height = Math.max(0, heightPx) + "px";
        },
        element: panel.element,
    };
}
