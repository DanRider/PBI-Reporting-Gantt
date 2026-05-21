// v2.1 audit-fix — top-right control cluster.
//
// Two hover-revealed buttons mounted at the top-right of the visual root.
// Orchestrator: "i also wanted a way to completely collapse the ghant or
// the table with hover over controlls in the top right ... when they are
// docked we can add a partially transparant control that can rescue the
// menu on demand."
//
// Design: buttons are semi-transparent at rest (opacity 0.25) so they
// don't clutter; opacity 1 when the cursor is anywhere over them. Clicking
// a button toggles the corresponding region's fully-hidden state. When a
// region IS hidden, the button stays visible (still semi-transparent) and
// shows its inverted-state label — clicking restores. Self-recall, no
// separate affordance needed.

export type RegionKey = "gantt" | "table";

export interface TopRightControlsOptions {
    /** Called with the region to toggle. The caller mutates its splitter
     *  handle (setHidden) and triggers a re-render. */
    onToggleHidden: (region: RegionKey) => void;
    /** Current hidden state — caller passes it in on every refresh so the
     *  button labels reflect the inverse action (Hide ↔ Show). */
    isHidden: (region: RegionKey) => boolean;
}

export interface TopRightControlsHandle {
    /** Re-render the buttons (call after setHidden so labels flip). */
    refresh(): void;
    element: HTMLElement;
}

const BTN_BG = "#ffffff";
const BTN_BORDER = "#c0c0c0";
const REST_OPACITY = "0.25";
const ACTIVE_OPACITY = "1";

function buildContainer(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "top-right-controls";
    div.style.cssText = [
        "position:absolute",
        "top:4px",
        "right:4px",
        "z-index:12",
        "display:flex",
        "flex-direction:column",
        "gap:4px",
        `opacity:${REST_OPACITY}`,
        "transition:opacity 200ms ease",
        "pointer-events:auto",
    ].join(";");
    return div;
}

function buildButton(label: string, title: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.setAttribute("aria-label", title);
    btn.title = title;
    btn.style.cssText = [
        "min-width:80px",
        "height:22px",
        "padding:0 8px",
        "font-size:11px",
        "line-height:1",
        "color:#333",
        `background:${BTN_BG}`,
        `border:1px solid ${BTN_BORDER}`,
        "border-radius:3px",
        "cursor:pointer",
        "box-sizing:border-box",
        "white-space:nowrap",
    ].join(";");
    return btn;
}

export function mountTopRightControls(
    root: HTMLElement,
    options: TopRightControlsOptions,
): TopRightControlsHandle {
    const container = buildContainer();
    container.addEventListener("mouseenter", () => { container.style.opacity = ACTIVE_OPACITY; });
    container.addEventListener("mouseleave", () => { container.style.opacity = REST_OPACITY; });

    const ganttBtn = buildButton("", "");
    const tableBtn = buildButton("", "");

    function applyLabels(): void {
        const ganttHidden = options.isHidden("gantt");
        const tableHidden = options.isHidden("table");
        ganttBtn.textContent = ganttHidden ? "↓ Show Gantt" : "↑ Hide Gantt";
        ganttBtn.title = ganttHidden ? "Show the Gantt region" : "Hide the Gantt region";
        ganttBtn.setAttribute("aria-label", ganttBtn.title);
        tableBtn.textContent = tableHidden ? "↑ Show Table" : "↓ Hide Table";
        tableBtn.title = tableHidden ? "Show the table region" : "Hide the table region";
        tableBtn.setAttribute("aria-label", tableBtn.title);
    }

    ganttBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    tableBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    ganttBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        options.onToggleHidden("gantt");
    });
    tableBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        options.onToggleHidden("table");
    });

    container.appendChild(ganttBtn);
    container.appendChild(tableBtn);
    root.appendChild(container);

    applyLabels();

    return {
        refresh: applyLabels,
        element: container,
    };
}
