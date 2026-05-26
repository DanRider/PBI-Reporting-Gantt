// v2.1 audit-fix #5 — top-LEFT toggle sliders for region hide/show.
//
// Orchestrator: "then move the hide / show and make them grey sliders in
// the upper left skider that remain visible ... i like the idea of the
// drag and the physical boolean."
//
// File kept under the old name (topRightControls.ts) for import-path
// stability; the exported symbol mountTopRightControls is the same.
// Position is now top:4px left:4px. The text buttons of audit-fix #3 are
// replaced with two physical-looking toggle switches (grey pill + sliding
// thumb) — always visible (no hover transitions). z-index 12 places them
// above the panel (z-index 10) so they never get occluded.

export type RegionKey = "gantt" | "table";

export interface TopRightControlsOptions {
    /** Called with the region to toggle. The caller mutates its splitter
     *  handle (setHidden) and triggers a re-render. */
    onToggleHidden: (region: RegionKey) => void;
    /** Current hidden state — caller passes it in on every refresh so the
     *  toggle position reflects the inverse action. */
    isHidden: (region: RegionKey) => boolean;
}

export interface TopRightControlsHandle {
    /** Re-render the toggles (call after setHidden so thumbs slide). */
    refresh(): void;
    element: HTMLElement;
}

const TRACK_BG_ON = "#9ca3af";      // mid-grey — region visible
const TRACK_BG_OFF = "#d4d4d8";     // light-grey — region hidden
const THUMB_BG = "#ffffff";
const THUMB_BORDER = "#6b7280";
const LABEL_COLOR = "#555";

function buildContainer(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "top-left-toggles";
    div.style.cssText = [
        "position:absolute",
        // v2.1 audit-fix #24 — toggles + master slider share top:6 row.
        // Slider mounts to the right of these toggles via masterTimeSlider
        // (host's left = panelWidthPx + TOGGLE_AREA_RESERVE_PX in visual.ts).
        "top:6px",
        "left:6px",
        "z-index:12",
        "display:flex",
        "flex-direction:row",
        "gap:8px",
        "align-items:center",
        "pointer-events:auto",
    ].join(";");
    return div;
}

interface Toggle {
    element: HTMLDivElement;
    track: HTMLDivElement;
    thumb: HTMLDivElement;
}

function buildToggle(label: string, title: string): Toggle {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:4px;cursor:pointer;user-select:none;";
    wrap.title = title;

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    labelEl.style.cssText = `font-size:10px;font-weight:600;color:${LABEL_COLOR};font-family:'Segoe UI',system-ui,sans-serif;`;
    wrap.appendChild(labelEl);

    const track = document.createElement("div");
    track.style.cssText = [
        "position:relative",
        "width:28px",
        "height:14px",
        `background:${TRACK_BG_ON}`,
        "border-radius:8px",
        "transition:background 150ms ease",
        "box-sizing:border-box",
    ].join(";");

    const thumb = document.createElement("div");
    thumb.style.cssText = [
        "position:absolute",
        "top:1px",
        "left:15px",           // ON state default — thumb on the right
        "width:12px",
        "height:12px",
        "border-radius:50%",
        `background:${THUMB_BG}`,
        `border:1px solid ${THUMB_BORDER}`,
        "transition:left 150ms ease",
        "box-sizing:border-box",
    ].join(";");
    track.appendChild(thumb);
    wrap.appendChild(track);

    return { element: wrap, track, thumb };
}

export function mountTopRightControls(
    root: HTMLElement,
    options: TopRightControlsOptions,
): TopRightControlsHandle {
    const container = buildContainer();
    // Prevent the toggle clicks from bubbling to the root whitespace
    // handler (which would clear selection and close the panel).
    container.addEventListener("click", (e) => { e.stopPropagation(); });
    container.addEventListener("pointerdown", (e) => { e.stopPropagation(); });

    const ganttToggle = buildToggle("Roadmap", "Toggle Roadmap visibility");
    const tableToggle = buildToggle("Table", "Toggle Table visibility");

    function applyState(toggle: Toggle, hidden: boolean): void {
        // Hidden = thumb on left + lighter track (OFF state).
        // Visible = thumb on right + mid-grey track (ON state).
        toggle.track.style.background = hidden ? TRACK_BG_OFF : TRACK_BG_ON;
        toggle.thumb.style.left = hidden ? "1px" : "15px";
    }

    function refresh(): void {
        applyState(ganttToggle, options.isHidden("gantt"));
        applyState(tableToggle, options.isHidden("table"));
    }

    ganttToggle.element.addEventListener("click", (e) => {
        e.stopPropagation();
        options.onToggleHidden("gantt");
    });
    tableToggle.element.addEventListener("click", (e) => {
        e.stopPropagation();
        options.onToggleHidden("table");
    });

    container.appendChild(ganttToggle.element);
    container.appendChild(tableToggle.element);
    root.appendChild(container);

    refresh();

    return {
        refresh,
        element: container,
    };
}
