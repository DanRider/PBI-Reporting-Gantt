// W1 of INF-3728 — controls panel chrome only.
//
// Mounts a small hamburger button (top-left of root) and a slide-in panel.
// The panel itself is intentionally empty in W1 — W2+ populates it with
// column visibility/order, filter pills, etc. This module owns the chrome:
// the hamburger toggle, the open/close transition, the section-header
// pattern reused by later waves.
//
// Pure DOM. No d3, no innerHTML. Strict-TS clean. Under 200 lines.

const PANEL_WIDTH_PCT_OPEN = 20;
const PANEL_WIDTH_PCT_CLOSED = 0;
// 400ms slide — orchestrator's audit said the prior 200ms felt snappy and they
// wanted "a second to breathe." Half the prior speed, doubled the duration.
const PANEL_TRANSITION_MS = 400;
const HAMBURGER_SIZE_PX = 24;
const HAMBURGER_Z_INDEX = 11;
const PANEL_Z_INDEX = 10;
const PANEL_BG = "#ffffff";
const PANEL_BORDER = "#d0d0d0";

export interface ControlsPanelOptions {
    initiallyOpen: boolean;
    onToggle?: (open: boolean) => void;
}

export interface ControlsPanelHandle {
    isOpen(): boolean;
    setOpen(open: boolean): void;
    widthPct(): number;
    element: HTMLElement;
}

function buildHamburgerButton(): { btn: HTMLButtonElement; bars: HTMLDivElement[] } {
    const btn = document.createElement("button");
    btn.className = "controls-panel-hamburger";
    btn.type = "button";
    btn.setAttribute("aria-label", "Open controls panel");
    btn.style.cssText = [
        "position:absolute",
        "left:4px",
        "top:4px",
        `width:${HAMBURGER_SIZE_PX}px`,
        `height:${HAMBURGER_SIZE_PX}px`,
        `z-index:${HAMBURGER_Z_INDEX}`,
        "background:#ffffff",
        `border:1px solid ${PANEL_BORDER}`,
        "border-radius:3px",
        "cursor:pointer",
        "padding:0",
        "display:flex",
        "flex-direction:column",
        "align-items:center",
        "justify-content:center",
        "gap:3px",
        // Slide left position in lockstep with the panel's width transition.
        // Same 400ms ease — hamburger journeys with the panel's right edge
        // from left:4px (closed) to just inside the panel's right edge.
        `transition:left ${PANEL_TRANSITION_MS}ms ease`,
    ].join(";");
    const bars: HTMLDivElement[] = [];
    for (let i = 0; i < 3; i++) {
        const bar = document.createElement("div");
        bar.style.cssText = [
            "width:14px",
            "height:2px",
            "background:#333",
            "border-radius:1px",
            // Morph from three-bar stack (☰) to an × when the panel opens.
            // Same duration as the slide so journey + morph end together.
            `transition:transform ${PANEL_TRANSITION_MS}ms ease, opacity ${PANEL_TRANSITION_MS}ms ease`,
            "transform-origin:center",
        ].join(";");
        btn.appendChild(bar);
        bars.push(bar);
    }
    return { btn, bars };
}

function applyHamburgerMorph(bars: HTMLDivElement[], open: boolean): void {
    if (open) {
        // Collapse the three-bar stack into an ×:
        //   top bar    → translateY(+5) + rotate(45°)   = NW-SE diagonal
        //   middle bar → opacity 0                       = empty center
        //   bottom bar → translateY(-5) + rotate(-45°)  = NE-SW diagonal
        // Both diagonals meet at the column's vertical midpoint.
        bars[0].style.transform = "translateY(5px) rotate(45deg)";
        bars[1].style.opacity = "0";
        bars[2].style.transform = "translateY(-5px) rotate(-45deg)";
    } else {
        bars[0].style.transform = "";
        bars[1].style.opacity = "1";
        bars[2].style.transform = "";
    }
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
    ].join(";");
    return panel;
}

function buildPanelHeader(): HTMLDivElement {
    const header = document.createElement("div");
    header.className = "controls-panel-header";
    header.style.cssText = [
        "display:flex",
        "align-items:center",
        "justify-content:flex-start",
        "padding:8px 12px",
        `border-bottom:1px solid ${PANEL_BORDER}`,
        "min-height:32px",
        "box-sizing:border-box",
    ].join(";");

    // No close button here — the hamburger journeys to the panel's right
    // edge and morphs to × when open, becoming the sole close affordance.
    // Putting another × inside the header would duplicate the affordance.
    const title = document.createElement("div");
    title.className = "section-header";
    title.style.cssText = "font-weight:bold;font-size:13px;color:#222;";
    title.textContent = "Controls";
    header.appendChild(title);

    return header;
}

export function mountControlsPanel(
    root: HTMLElement,
    options: ControlsPanelOptions,
): ControlsPanelHandle {
    let open = options.initiallyOpen;

    const panel = buildPanel();
    const header = buildPanelHeader();
    panel.appendChild(header);
    root.appendChild(panel);

    const { btn: hamburger, bars: hamburgerBars } = buildHamburgerButton();
    hamburger.addEventListener("click", () => setOpen(!open));
    root.appendChild(hamburger);

    function applyWidth(): void {
        panel.style.width = open ? `${PANEL_WIDTH_PCT_OPEN}%` : `${PANEL_WIDTH_PCT_CLOSED}%`;
        // Hide the panel header from layout/AT when fully closed so screen
        // readers don't announce a 0-width region's contents.
        panel.style.visibility = open ? "visible" : "hidden";
        // Hamburger journeys: when closed, sits at left:4px (top-left of
        // visual). When open, rides to just inside the panel's right edge
        // and morphs from ☰ to ×. Replaces the prior hide-when-open
        // approach from 8ebe3ff — same problem (no header occlusion), but
        // keeps a single visible affordance that transforms semantically
        // instead of teleporting close UI to a different location.
        hamburger.style.left = open
            ? `calc(${PANEL_WIDTH_PCT_OPEN}% - ${HAMBURGER_SIZE_PX + 8}px)`
            : "4px";
        applyHamburgerMorph(hamburgerBars, open);
        // ARIA label tracks the new role (× when open, ☰ when closed).
        hamburger.setAttribute(
            "aria-label",
            open ? "Close controls panel" : "Open controls panel",
        );
    }

    function setOpen(next: boolean): void {
        if (next === open) return;
        open = next;
        applyWidth();
        if (options.onToggle) options.onToggle(open);
    }

    applyWidth();

    return {
        isOpen: () => open,
        setOpen: (next: boolean) => setOpen(next),
        widthPct: () => (open ? PANEL_WIDTH_PCT_OPEN : PANEL_WIDTH_PCT_CLOSED),
        element: panel,
    };
}
