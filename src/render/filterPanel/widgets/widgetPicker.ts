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
    { value: "search-chips",   label: "Search" },
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

    const flyout = document.createElement("div");
    flyout.style.cssText = [
        "position:absolute",
        "top:100%",
        "right:0",
        "min-width:160px",
        "background:#ffffff",
        "border:1px solid #c0c0c0",
        "border-radius:4px",
        "box-shadow:0 4px 12px rgba(0,0,0,0.15)",
        "z-index:1100",
        "display:none",
        "padding:4px 0",
    ].join(";");
    root.appendChild(flyout);

    const ordinal = isOrdinalColumn(opts.binding);

    for (const o of WIDGET_OPTIONS) {
        flyout.appendChild(buildOptionRow(o, opts, ordinal, () => setOpen(false)));
    }

    let open = false;
    function setOpen(next: boolean): void {
        if (open === next) return;
        open = next;
        flyout.style.display = open ? "block" : "none";
        if (open) {
            setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
        } else {
            document.removeEventListener("click", onDocClick, true);
        }
    }
    function onDocClick(e: Event): void {
        if (!(e.target instanceof Node)) return;
        if (root.contains(e.target)) return;
        setOpen(false);
    }
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setOpen(!open);
    });

    return root;
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

/** Crisp 14px inline-SVG gear. Filled when a non-"auto" widget is in
 *  effect (signals user override), outlined when "auto". */
function buildGearSvg(filled: boolean): SVGElement {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.style.pointerEvents = "none";
    const fg = filled ? PICKER_ACTIVE_FG : PICKER_INACTIVE_FG;
    // 8-tooth gear + center circle. Simple polygon approximation.
    const gear = document.createElementNS(SVG_NS, "path");
    gear.setAttribute("d",
        "M8 1 L9 3 L11 2 L11 4 L13 5 L12 7 L14 8 L12 9 L13 11 L11 12 L11 14 L9 13 L8 15 L7 13 L5 14 L5 12 L3 11 L4 9 L2 8 L4 7 L3 5 L5 4 L5 2 L7 3 Z",
    );
    gear.setAttribute("fill", filled ? fg : "none");
    gear.setAttribute("stroke", fg);
    gear.setAttribute("stroke-width", "1");
    gear.setAttribute("stroke-linejoin", "round");
    svg.appendChild(gear);
    const inner = document.createElementNS(SVG_NS, "circle");
    inner.setAttribute("cx", "8");
    inner.setAttribute("cy", "8");
    inner.setAttribute("r", "2");
    inner.setAttribute("fill", "#ffffff");
    inner.setAttribute("stroke", fg);
    inner.setAttribute("stroke-width", "1");
    svg.appendChild(inner);
    return svg;
}
