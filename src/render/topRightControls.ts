// v2.1 audit-fix #5 — top-LEFT toggle sliders for region hide/show.
// v2.2 INF-3739 — filter icon mounts LEFT of the Roadmap/Table toggles.
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
//
// INF-3739: a filter icon now leads the chrome cluster. Click toggles the
// comprehensive filter sidebar; an active-count badge surfaces whenever
// any filter is engaged so the user always knows filters are on even when
// the sidebar is closed.

import { CHROME_LABEL_CSS } from "./chromeLabelStyle";

export type RegionKey = "gantt" | "table";

export interface TopRightControlsOptions {
    /** Called with the region to toggle. The caller mutates its splitter
     *  handle (setHidden) and triggers a re-render. */
    onToggleHidden: (region: RegionKey) => void;
    /** Current hidden state — caller passes it in on every refresh so the
     *  toggle position reflects the inverse action. */
    isHidden: (region: RegionKey) => boolean;
    /** INF-3739 — called when the filter icon is clicked. Caller toggles
     *  the comprehensive filter sidebar's open state. */
    onToggleFilter: () => void;
    /** INF-3739 — number of dims with active selections; drives the badge.
     *  Caller reads from FilterState.activeCount(). */
    getFilterActiveCount: () => number;
    /** INF-3739 — true if the comprehensive sidebar is currently open.
     *  Drives the filter icon's active-press visual (highlighted background). */
    isFilterOpen: () => boolean;
    /** v3.0 hello-world — called when the user clicks the export icon. */
    onExport: () => void;
}

export interface TopRightControlsHandle {
    /** Re-render the toggles + filter badge (call after setHidden, on filter
     *  state change, or after sidebar open/close so visuals stay in sync). */
    refresh(): void;
    /** v2.2 INF-3739 — push the cluster's top anchor down by N px so the
     *  dedicated slicer container above can occupy row 0. */
    setTopOffset(px: number): void;
    /** The funnel/filter button element. Exposed so when a dim is pinned
     *  the visual can lift it into the slicer strip; restoreFilterButton
     *  puts it back when nothing is pinned. */
    filterButtonElement: HTMLElement;
    /** Re-attach filterButtonElement as the first child of the default
     *  topRight container (the toggle row). Safe to call repeatedly —
     *  appendChild moves the node rather than cloning. */
    restoreFilterButton(): void;
    element: HTMLElement;
}

const TRACK_BG_ON = "#9ca3af";
const TRACK_BG_OFF = "#d4d4d8";
const THUMB_BG = "#ffffff";
const THUMB_BORDER = "#6b7280";
const LABEL_COLOR = "#555";
const FILTER_ICON_FG = "#555";
const FILTER_ICON_FG_OPEN = "#1F77B4";
const FILTER_BTN_BG_OPEN = "#dbe7f5";
const BADGE_BG = "#d62728";
const BADGE_FG = "#ffffff";

function buildContainer(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "top-left-toggles";
    div.style.cssText = [
        "position:absolute",
        "top:6px",
        // Shifted right to clear the funnel's anchored slot (left:6, width:22)
        // + an 8px gap = left:36. The toggle row now contains only the
        // boolean toggles + download button; the funnel is its own thing
        // appended directly to root (see mountTopRightControls).
        "left:36px",
        "z-index:12",
        "display:flex",
        "flex-direction:row",
        "gap:8px",
        "align-items:center",
        // Force container height to 22px (matches the funnel's height/anchor
        // slot at top:6) so all flex children — Roadmap/Table toggles +
        // download — center at absolute y=17, sharing a centerline with
        // the funnel.
        "height:22px",
        "pointer-events:auto",
        // INF-3751: CSS transition on `top` — when visual.ts sets the
        // `.opening`/`.closing` class on documentElement, visual.less
        // applies `transition: top 1000ms ease` (with directional delay
        // for sequencing). This element's setTopOffset() write then
        // animates smoothly instead of snapping.
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
    // CHROME_LABEL_CSS bundles color / weight / size / family — shared with
    // the strip's dim cluster labels in topSlicerStrip.ts so both surfaces
    // stay visually identical from a single point of truth.
    labelEl.style.cssText = CHROME_LABEL_CSS;
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
        "left:15px",
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

interface FilterButton {
    element: HTMLDivElement;
    iconPath: SVGPathElement;
    badge: HTMLSpanElement;
}

function buildFilterButton(): FilterButton {
    const wrap = document.createElement("div");
    wrap.style.cssText = [
        // Funnel is ABSOLUTE-positioned at top:6 left:6 directly on root
        // (NOT inside the toggle row's container). It must stay anchored
        // when the toggle row drops to make space for the slicer strip —
        // "left behind while the toggle row moves down."
        // z-index sits above the strip so the strip's content can flow
        // under it without obscuring the funnel.
        "position:absolute",
        "top:6px",
        "left:6px",
        "z-index:14",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "width:22px",
        "height:22px",
        "border-radius:4px",
        "cursor:pointer",
        "user-select:none",
        "background:transparent",
        "transition:background 120ms ease",
        // No view-transition-name — the funnel is not in any snapshot and
        // therefore never animates. It is the still point.
    ].join(";");
    wrap.title = "Show/hide filter panel";

    const SVG_NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.style.pointerEvents = "none";
    const path = document.createElementNS(SVG_NS, "path");
    // Funnel: top edge full-width, sides slope inward, stem at bottom.
    path.setAttribute("d", "M3 5 L21 5 L14 13 L14 21 L10 19 L10 13 Z");
    path.setAttribute("fill", FILTER_ICON_FG);
    path.setAttribute("stroke", "none");
    svg.appendChild(path);
    wrap.appendChild(svg);

    const badge = document.createElement("span");
    badge.style.cssText = [
        "position:absolute",
        "top:-3px",
        "right:-4px",
        "min-width:14px",
        "height:14px",
        "padding:0 3px",
        "border-radius:7px",
        `background:${BADGE_BG}`,
        `color:${BADGE_FG}`,
        "font-size:9px",
        "font-weight:700",
        "font-family:'Segoe UI',system-ui,sans-serif",
        "line-height:14px",
        "text-align:center",
        "display:none",
        "box-sizing:border-box",
        "pointer-events:none",
    ].join(";");
    wrap.appendChild(badge);

    return { element: wrap, iconPath: path, badge };
}

function buildExportButton(): HTMLDivElement {
    const wrap = document.createElement("div");
    wrap.style.cssText = [
        "position:relative",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "width:22px",
        "height:22px",
        "border-radius:4px",
        "cursor:pointer",
        "user-select:none",
        "background:transparent",
        "transition:background 120ms ease",
    ].join(";");
    wrap.title = "Export to Excel";
    const SVG_NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.style.pointerEvents = "none";
    // Download arrow: tray at bottom, arrow shaft + head pointing down into it.
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M12 3 L12 14 M7 10 L12 15 L17 10 M4 19 L20 19 L20 21 L4 21 Z");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#555");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    wrap.appendChild(svg);
    return wrap;
}

export function mountTopRightControls(
    root: HTMLElement,
    options: TopRightControlsOptions,
): TopRightControlsHandle {
    const container = buildContainer();
    container.addEventListener("click", (e) => { e.stopPropagation(); });
    container.addEventListener("pointerdown", (e) => { e.stopPropagation(); });

    const filterBtn = buildFilterButton();
    const ganttToggle = buildToggle("Roadmap", "Toggle Roadmap visibility");
    const tableToggle = buildToggle("Table", "Toggle Table visibility");
    const exportBtn = buildExportButton();

    function applyToggleState(toggle: Toggle, hidden: boolean): void {
        toggle.track.style.background = hidden ? TRACK_BG_OFF : TRACK_BG_ON;
        toggle.thumb.style.left = hidden ? "1px" : "15px";
    }

    function applyFilterState(): void {
        const open = options.isFilterOpen();
        const count = options.getFilterActiveCount();
        filterBtn.element.style.background = open ? FILTER_BTN_BG_OPEN : "transparent";
        filterBtn.iconPath.setAttribute("fill", open ? FILTER_ICON_FG_OPEN : FILTER_ICON_FG);
        if (count > 0) {
            filterBtn.badge.textContent = String(count);
            filterBtn.badge.style.display = "block";
        } else {
            filterBtn.badge.style.display = "none";
        }
    }

    function refresh(): void {
        applyToggleState(ganttToggle, options.isHidden("gantt"));
        applyToggleState(tableToggle, options.isHidden("table"));
        applyFilterState();
    }

    filterBtn.element.addEventListener("click", (e) => {
        e.stopPropagation();
        options.onToggleFilter();
    });
    filterBtn.element.addEventListener("mouseenter", () => {
        if (!options.isFilterOpen()) filterBtn.element.style.background = "#f0f0f3";
    });
    filterBtn.element.addEventListener("mouseleave", () => {
        if (!options.isFilterOpen()) filterBtn.element.style.background = "transparent";
    });

    ganttToggle.element.addEventListener("click", (e) => {
        e.stopPropagation();
        options.onToggleHidden("gantt");
    });
    tableToggle.element.addEventListener("click", (e) => {
        e.stopPropagation();
        options.onToggleHidden("table");
    });
    exportBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        options.onExport();
    });
    exportBtn.addEventListener("mouseenter", () => { exportBtn.style.background = "#f0f0f3"; });
    exportBtn.addEventListener("mouseleave", () => { exportBtn.style.background = "transparent"; });

    // Chrome reads left → right:
    // [funnel] [Roadmap toggle] [Table toggle] [download]
    //
    // BUT the funnel is anchored independently — it goes directly on root
    // at top:6 left:6, NOT inside the toggle row container. When the toggle
    // row drops on pin, the funnel stays put ("left behind while the toggle
    // row moves down"). The container only holds the boolean toggles.
    root.appendChild(filterBtn.element);
    container.appendChild(ganttToggle.element);
    container.appendChild(tableToggle.element);
    container.appendChild(exportBtn);
    root.appendChild(container);

    refresh();

    return {
        refresh,
        setTopOffset(px: number): void {
            container.style.top = (6 + Math.max(0, px)) + "px";
        },
        filterButtonElement: filterBtn.element,
        restoreFilterButton(): void {
            // Move filterBtn back to position 0 in the toggle row.
            // appendChild/insertBefore move the existing node rather than
            // cloning — safe to call even when already in place.
            if (filterBtn.element.parentNode !== container) {
                container.insertBefore(filterBtn.element, container.firstChild);
            }
        },
        element: container,
    };
}
