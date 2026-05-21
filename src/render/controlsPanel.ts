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
const PANEL_TRANSITION_MS = 200;
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

function buildHamburgerButton(): HTMLButtonElement {
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
    ].join(";");
    for (let i = 0; i < 3; i++) {
        const bar = document.createElement("div");
        bar.style.cssText = "width:14px;height:2px;background:#333;border-radius:1px;";
        btn.appendChild(bar);
    }
    return btn;
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

function buildPanelHeader(onClose: () => void): HTMLDivElement {
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
    ].join(";");

    const title = document.createElement("div");
    title.className = "section-header";
    title.style.cssText = "font-weight:bold;font-size:13px;color:#222;";
    title.textContent = "Controls";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "controls-panel-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close controls panel");
    closeBtn.textContent = "\u2715"; // ✕
    closeBtn.style.cssText = [
        "background:transparent",
        "border:none",
        "cursor:pointer",
        "font-size:14px",
        "color:#555",
        "padding:2px 6px",
        "line-height:1",
    ].join(";");
    closeBtn.addEventListener("click", onClose);
    header.appendChild(closeBtn);

    return header;
}

export function mountControlsPanel(
    root: HTMLElement,
    options: ControlsPanelOptions,
): ControlsPanelHandle {
    let open = options.initiallyOpen;

    const panel = buildPanel();
    const header = buildPanelHeader(() => setOpen(false));
    panel.appendChild(header);
    root.appendChild(panel);

    const hamburger = buildHamburgerButton();
    hamburger.addEventListener("click", () => setOpen(!open));
    root.appendChild(hamburger);

    function applyWidth(): void {
        panel.style.width = open ? `${PANEL_WIDTH_PCT_OPEN}%` : `${PANEL_WIDTH_PCT_CLOSED}%`;
        // Hide the panel header from layout/AT when fully closed so screen
        // readers don't announce a 0-width region's contents.
        panel.style.visibility = open ? "visible" : "hidden";
        // Hide the hamburger when the panel is open — the ✕ close button in
        // the panel header is the canonical close affordance, and the
        // hamburger sits at z-index 11 on top of the panel header (occluding
        // the "Controls" title). Re-show when the panel closes so the user
        // has the open affordance back.
        hamburger.style.display = open ? "none" : "flex";
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
