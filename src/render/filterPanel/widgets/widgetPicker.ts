// INF-3745 Phase A — in-sidebar widget picker.
//
// Builds the gear-icon button + flyout menu of 6 widget options that
// the user clicks to override a slot's widget. Mirrors the pin-button
// pattern in comprehensivePanel.ts; the controller's setWidget() method
// is wired through the onPick callback.
//
// Incompatible options (range-slider on a text column) render visible-
// but-disabled with a tooltip.

import type { FilterDimBinding, SlotWidget } from "../state";

const PICKER_INACTIVE_FG = "#999";
const PICKER_ACTIVE_FG = "#1F77B4";

interface PickerOption {
    value: SlotWidget;
    label: string;
}

const WIDGET_OPTIONS: ReadonlyArray<PickerOption> = [
    { value: "auto",           label: "Auto" },
    { value: "pills-multi",    label: "Pills (multi)" },
    { value: "pills-single",   label: "Pills (single)" },
    { value: "dropdown-multi", label: "Dropdown" },
    { value: "range-slider",   label: "Range slider" },
];

function isOrdinalColumn(binding: FilterDimBinding): boolean {
    const t = binding.columnRef.type;
    if (t == null) return false;
    return !!(t.numeric || t.integer || t.dateTime);
}

export interface WidgetPickerOptions {
    binding: FilterDimBinding;
    currentWidget: SlotWidget;
    onPick: (widget: SlotWidget) => void;
    /** When true, the sidebar's expanded value list for this dim renders
     *  using the same widget as the slicer (instead of the default
     *  checkbox / dropdown by cardinality). Controlled by a checkbox at
     *  the top of the flyout. */
    applyToFilterPane: boolean;
    onToggleApplyToFilterPane: () => void;
}

/** Build the gear-icon button. Click toggles a flyout that shows the 6
 *  widget options; selecting one calls onPick and closes the flyout. */
export function buildWidgetPickerButton(opts: WidgetPickerOptions): HTMLElement {
    const root = document.createElement("div");
    root.style.cssText = "position:relative;display:inline-block;";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Choose widget for this dimension";
    btn.style.cssText = [
        "background:transparent",
        "border:none",
        "cursor:pointer",
        "padding:2px 4px",
        "line-height:0",
        "border-radius:3px",
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "transition:background 100ms ease",
    ].join(";");
    const isUserSet = opts.currentWidget !== "auto";
    btn.appendChild(buildGearSvg(isUserSet));
    btn.addEventListener("mouseenter", () => { btn.style.background = "#f0f0f3"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; });
    root.appendChild(btn);

    // Flyout is portaled to document.body on open (not kept inside `root`)
    // so it escapes the sidebar's local stacking context — otherwise the
    // gantt SVG chart layer occludes it. position:fixed + computed
    // viewport coords on each open. Cleanup: removed from body on close.
    const flyout = document.createElement("div");
    flyout.style.cssText = [
        "position:fixed",
        "min-width:160px",
        "background:#ffffff",
        "border:1px solid #c0c0c0",
        "border-radius:4px",
        "box-shadow:0 4px 12px rgba(0,0,0,0.15)",
        "z-index:2147483640",
        "display:none",
        "padding:4px 0",
    ].join(";");

    const ordinal = isOrdinalColumn(opts.binding);

    // "Apply to filter pane" checkbox row at the top of the flyout.
    // When checked, the sidebar's expanded value rendering uses the
    // SAME widget as the slicer (instead of the default checkbox
    // list / dropdown by cardinality). Bordered separator below to
    // visually divide it from the widget options.
    flyout.appendChild(buildApplyToFilterPaneRow(opts));

    for (const o of WIDGET_OPTIONS) {
        flyout.appendChild(buildOptionRow(o, opts, ordinal, () => setOpen(false)));
    }

    let open = false;
    function setOpen(next: boolean): void {
        if (open === next) return;
        open = next;
        if (open) {
            const rect = btn.getBoundingClientRect();
            flyout.style.top = (rect.bottom + 2) + "px";
            flyout.style.left = "auto";
            flyout.style.right = Math.max(4, window.innerWidth - rect.right) + "px";
            flyout.style.display = "block";
            if (flyout.parentElement !== document.body) {
                document.body.appendChild(flyout);
            }
            setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
        } else {
            flyout.style.display = "none";
            if (flyout.parentElement === document.body) {
                document.body.removeChild(flyout);
            }
            document.removeEventListener("click", onDocClick, true);
        }
    }
    function onDocClick(e: Event): void {
        if (!(e.target instanceof Node)) return;
        if (root.contains(e.target)) return;
        if (flyout.contains(e.target)) return;
        setOpen(false);
    }
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(!open);
    });

    return root;
}

function buildApplyToFilterPaneRow(opts: WidgetPickerOptions): HTMLLabelElement {
    const row = document.createElement("label");
    row.style.cssText = [
        "display:flex",
        "align-items:center",
        "gap:6px",
        "padding:5px 12px 7px 12px",
        "font-size:11px",
        "color:#333",
        "cursor:pointer",
        "user-select:none",
        "border-bottom:1px solid #e0e0e0",
        "margin-bottom:3px",
    ].join(";");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = opts.applyToFilterPane;
    cb.style.cssText = "margin:0;cursor:pointer;accent-color:#2ca02c;";
    cb.addEventListener("click", (e) => {
        e.stopPropagation();
        opts.onToggleApplyToFilterPane();
    });
    row.appendChild(cb);
    const text = document.createElement("span");
    text.textContent = "Apply to filter pane";
    row.appendChild(text);
    // Stop bubbling to the document-click handler that closes the flyout.
    row.addEventListener("click", (e) => e.stopPropagation());
    return row;
}

function buildOptionRow(
    o: PickerOption,
    opts: WidgetPickerOptions,
    ordinal: boolean,
    close: () => void,
): HTMLDivElement {
    const row = document.createElement("div");
    const disabled = o.value === "range-slider" && !ordinal;
    const isCurrent = o.value === opts.currentWidget;
    row.style.cssText = [
        "padding:5px 12px",
        "font-size:11px",
        "color:" + (disabled ? "#bbb" : "#333"),
        "cursor:" + (disabled ? "not-allowed" : "pointer"),
        "background:" + (isCurrent ? "#eef3fb" : "transparent"),
        "font-weight:" + (isCurrent ? "600" : "500"),
        "user-select:none",
        "display:flex",
        "align-items:center",
        "gap:6px",
    ].join(";");
    const marker = document.createElement("span");
    marker.textContent = isCurrent ? "\u2713" : " ";
    marker.style.cssText = "width:10px;color:" + (isCurrent ? PICKER_ACTIVE_FG : "transparent") + ";font-weight:700;";
    row.appendChild(marker);
    const text = document.createElement("span");
    text.textContent = o.label;
    row.appendChild(text);
    if (disabled) {
        row.title = "Range slider is only available for numeric or date/time columns.";
    }
    if (!disabled) {
        row.addEventListener("mouseenter", () => {
            if (!isCurrent) row.style.background = "#f0f0f3";
        });
        row.addEventListener("mouseleave", () => {
            if (!isCurrent) row.style.background = "transparent";
        });
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            opts.onPick(o.value);
            close();
        });
    }
    return row;
}

/** Real gear icon — multi-element solid silhouette that reads as a
 *  settings gear at 16px: 8 rectangular teeth around the perimeter,
 *  round body, white-filled center hub. Solid-filled in both states
 *  (no outline mode); active = blue, inactive = gray. INF-3757. */
function buildGearSvg(filled: boolean): SVGElement {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.style.pointerEvents = "none";
    const fg = filled ? PICKER_ACTIVE_FG : PICKER_INACTIVE_FG;
    // 8 teeth — rectangles at 45° intervals around (8,8). Slightly rounded
    // corners (rx=0.3) so they read as "settings teeth" not "saw blade."
    for (let i = 0; i < 8; i++) {
        const tooth = document.createElementNS(SVG_NS, "rect");
        tooth.setAttribute("x", "6.8");
        tooth.setAttribute("y", "0.5");
        tooth.setAttribute("width", "2.4");
        tooth.setAttribute("height", "3");
        tooth.setAttribute("rx", "0.3");
        tooth.setAttribute("fill", fg);
        tooth.setAttribute("transform", `rotate(${i * 45} 8 8)`);
        svg.appendChild(tooth);
    }
    // Body circle covers tooth roots; same fill so no seam shows.
    const body = document.createElementNS(SVG_NS, "circle");
    body.setAttribute("cx", "8");
    body.setAttribute("cy", "8");
    body.setAttribute("r", "4.6");
    body.setAttribute("fill", fg);
    svg.appendChild(body);
    // White-filled hub — gives the gear its center "hole" read.
    const hub = document.createElementNS(SVG_NS, "circle");
    hub.setAttribute("cx", "8");
    hub.setAttribute("cy", "8");
    hub.setAttribute("r", "1.8");
    hub.setAttribute("fill", "#ffffff");
    svg.appendChild(hub);
    return svg;
}
