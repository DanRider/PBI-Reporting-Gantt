// W1.5a of INF-3730 — selection-driven controls panel.
//
// Mounts ONLY the slide-in panel — no hamburger. External code (the visual's
// selectionStore subscriber) calls setOpen(true|false) and setContent(node).
// The panel header carries the "Controls" title + × close button; clicking ×
// fires onDismiss so the caller can clear its selection state (which then
// closes the panel via the subscribe chain).
//
// Replaces the hamburger journey-and-morph approach from INF-3728 W1
// (commits bd9a37b → 8ebe3ff → c3c4d3f) — the controls panel is now
// auto-driven by what the user clicks in the Gantt/table, not toggled
// independently. See INF-3730 for the design pivot.
//
// Pure DOM, no innerHTML. Strict-TS clean.

const PANEL_WIDTH_PCT_OPEN = 20;
const PANEL_WIDTH_PCT_CLOSED = 0;
// 400ms slide — matches the duration tuned in c3c4d3f under W1.
const PANEL_TRANSITION_MS = 400;
const PANEL_Z_INDEX = 10;
const PANEL_BG = "#ffffff";
const PANEL_BORDER = "#d0d0d0";

export interface ControlsPanelOptions {
    /** Called when the user clicks × in the panel header. The caller is
     *  responsible for clearing its own selection state — which then
     *  triggers setOpen(false) via the subscriber chain. */
    onDismiss: () => void;
}

export interface ControlsPanelHandle {
    /** Slide the panel open (true) or closed (false). No-op if already in
     *  that state. */
    setOpen(open: boolean): void;
    /** Replace the panel body content. The header (title + ×) stays static
     *  across content swaps. */
    setContent(node: HTMLElement): void;
    /** Percent of root width the panel reserves. 0 when closed, 20 when
     *  open. Read by the layout coordinator to compute region sizing. */
    widthPct(): number;
    /** The panel root element. Exposed for cases where the caller needs to
     *  reach in (e.g. test fixtures). */
    element: HTMLElement;
}

function buildPanel(): HTMLDivElement {
    const panel = document.createElement("div");
    panel.className = "controls-panel";
    panel.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        "height:100%",
        `background:${PANEL_BG}`,
        `border-right:1px solid ${PANEL_BORDER}`,
        "overflow:auto",
        `z-index:${PANEL_Z_INDEX}`,
        `transition:width ${PANEL_TRANSITION_MS}ms ease`,
        "box-sizing:border-box",
        "display:flex",
        "flex-direction:column",
    ].join(";");
    return panel;
}

function buildPanelHeader(onDismiss: () => void): HTMLDivElement {
    const header = document.createElement("div");
    header.className = "controls-panel-header";
    header.style.cssText = [
        "display:flex",
        "align-items:center",
        "justify-content:space-between",
        "padding:8px 12px",
        `border-bottom:1px solid ${PANEL_BORDER}`,
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
    closeBtn.textContent = "\u2715"; // ×
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
    let open = false;

    const panel = buildPanel();
    const header = buildPanelHeader(() => options.onDismiss());
    panel.appendChild(header);

    // Body container — setContent swaps THIS element's children, never
    // touches the header. flex:1 so it takes all space below the header
    // and clips its own overflow.
    const body = document.createElement("div");
    body.className = "controls-panel-body";
    body.style.cssText = "flex:1;overflow:auto;padding:12px;box-sizing:border-box;";
    panel.appendChild(body);

    // Clicks INSIDE the panel must NOT bubble to the root-level whitespace
    // handler (which would clear selection and close the panel). The ×
    // close button has its own explicit stopPropagation + onDismiss path.
    panel.addEventListener("click", (e) => { e.stopPropagation(); });

    root.appendChild(panel);

    function applyWidth(): void {
        panel.style.width = open ? `${PANEL_WIDTH_PCT_OPEN}%` : `${PANEL_WIDTH_PCT_CLOSED}%`;
        // Hide from layout / assistive tech when fully closed so screen
        // readers don't announce a 0-width region's contents.
        panel.style.visibility = open ? "visible" : "hidden";
    }

    applyWidth();

    return {
        setOpen(next: boolean): void {
            if (next === open) return;
            open = next;
            applyWidth();
        },
        setContent(node: HTMLElement): void {
            while (body.firstChild) body.removeChild(body.firstChild);
            body.appendChild(node);
        },
        // Orchestrator audit: "leave the bottom visual spanning the entire
        // visual" — the panel is now an OVERLAY (z-index 10 over the SVG),
        // not a region that reserves layout space. widthPct returns 0 so
        // the layout coordinator never shrinks Gantt + table when the panel
        // opens. The panel's CSS width still animates 0% → 20% (visual
        // slide-in) but it floats over the data, not beside it.
        widthPct: () => PANEL_WIDTH_PCT_CLOSED,
        element: panel,
    };
}
