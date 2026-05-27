// INF-3739 — top slicer strip (always-on, pinned dims).
//
// Mounts in a DEDICATED container at the very top of the visual (top:0).
// The existing chrome row (toggles + master time slider) sits BELOW this
// container, pushed down by the strip's rendered height.
//
// Density-aware: pill padding / font-size / row spacing scale per the
// pinnedDensity formatting setting ("comfortable" / "compact" / "dense").
// Multi-dim packing: dim clusters (label + pills) flow as inline-flex
// children of a flex-wrap container — multiple clusters share a physical
// row until the row fills, then wrap. Saves significant vertical real
// estate when several short-label dims are pinned simultaneously.
//
// Pills are multi-select (parity with the sidebar). Filled when active,
// outlined otherwise. The "All" pill clears the dim's selection.

import { FilterDimBinding, FilterSlotSettings, FilterState, dimLabel } from "./state";

export type PinnedDensity = "comfortable" | "compact" | "dense";

interface DensitySpec {
    rowMinHeightPx: number;
    pillPaddingV: number;
    pillPaddingH: number;
    pillFontSizePx: number;
    pillMinWidthPx: number;
    labelFontSizePx: number;
    interClusterGapPx: number;
    interPillGapPx: number;
    stripPaddingV: number;
    stripPaddingH: number;
}

const DENSITY: Record<PinnedDensity, DensitySpec> = {
    comfortable: {
        rowMinHeightPx: 42, pillPaddingV: 7, pillPaddingH: 20, pillFontSizePx: 13,
        pillMinWidthPx: 64, labelFontSizePx: 13, interClusterGapPx: 18, interPillGapPx: 6,
        stripPaddingV: 6, stripPaddingH: 16,
    },
    compact: {
        rowMinHeightPx: 30, pillPaddingV: 4, pillPaddingH: 12, pillFontSizePx: 12,
        pillMinWidthPx: 48, labelFontSizePx: 12, interClusterGapPx: 14, interPillGapPx: 5,
        stripPaddingV: 4, stripPaddingH: 12,
    },
    dense: {
        rowMinHeightPx: 22, pillPaddingV: 1, pillPaddingH: 8, pillFontSizePx: 11,
        pillMinWidthPx: 0,  labelFontSizePx: 11, interClusterGapPx: 10, interPillGapPx: 4,
        stripPaddingV: 2, stripPaddingH: 10,
    },
};

/** Default row height — controller exposes a dynamic getter that returns
 *  the strip's ACTUAL offsetHeight after render (since packing depends on
 *  viewport width). Kept as a fallback sentinel only. */
export const TOP_SLICER_ROW_HEIGHT_PX = 30;

const STRIP_BG = "#ffffff";
const STRIP_BORDER = "#c0c0c0";
const LABEL_FG = "#222";
const PILL_BG_ACTIVE = "#1F77B4";
const PILL_FG_ACTIVE = "#ffffff";
const PILL_BG_INACTIVE = "#ffffff";
const PILL_FG_INACTIVE = "#333";
const PILL_BORDER = "#c0c0c0";
const PILL_BG_HOVER = "#eef3fb";

export interface TopSlicerStripHandle {
    render(
        bindings: ReadonlyArray<FilterDimBinding>,
        slots: ReadonlyArray<FilterSlotSettings>,
        density: PinnedDensity,
    ): void;
    element: HTMLElement;
}

export function mountTopSlicerStrip(
    container: HTMLElement,
    state: FilterState,
): TopSlicerStripHandle {
    const strip = document.createElement("div");
    strip.className = "filter-top-slicer-strip";
    strip.style.cssText = [
        "display:flex",
        "flex-direction:row",
        "flex-wrap:wrap",
        "background:" + STRIP_BG,
        "border-bottom:1px solid " + STRIP_BORDER,
        "box-sizing:border-box",
        "width:100%",
        "font-family:'Segoe UI',system-ui,sans-serif",
    ].join(";");
    container.appendChild(strip);

    let lastBindings: ReadonlyArray<FilterDimBinding> = [];
    let lastSlots: ReadonlyArray<FilterSlotSettings> = [];
    let lastDensity: PinnedDensity = "compact";
    state.subscribe(() => repaint(lastBindings, lastSlots, lastDensity));

    function repaint(
        bindings: ReadonlyArray<FilterDimBinding>,
        slots: ReadonlyArray<FilterSlotSettings>,
        density: PinnedDensity,
    ): void {
        while (strip.firstChild) strip.removeChild(strip.firstChild);
        if (bindings.length === 0) {
            strip.style.display = "none";
            return;
        }
        const d = DENSITY[density];
        strip.style.display = "flex";
        strip.style.gap = `${d.interPillGapPx}px ${d.interClusterGapPx}px`;
        strip.style.padding = `${d.stripPaddingV}px ${d.stripPaddingH}px`;
        strip.style.minHeight = d.rowMinHeightPx + "px";
        strip.style.alignItems = "center";
        for (const b of bindings) {
            const slot = slots[b.slotIndex];
            if (slot === undefined) continue;
            strip.appendChild(buildDimCluster(b, slot, state, d));
        }
    }

    return {
        render(bindings, slots, density): void {
            lastBindings = bindings;
            lastSlots = slots;
            lastDensity = density;
            repaint(bindings, slots, density);
        },
        element: strip,
    };
}

function buildDimCluster(
    binding: FilterDimBinding,
    slot: FilterSlotSettings,
    state: FilterState,
    d: DensitySpec,
): HTMLDivElement {
    // A "cluster" = one dim's label + its pill row, inline so the browser's
    // flex-wrap keeps the label glued to its pills when wrapping.
    const cluster = document.createElement("div");
    cluster.style.cssText = [
        "display:inline-flex",
        "flex-direction:row",
        "align-items:center",
        `gap:${d.interPillGapPx + 2}px`,
        "flex-shrink:0",
    ].join(";");

    const label = document.createElement("span");
    label.textContent = dimLabel(binding, slot) + ":";
    label.style.cssText = [
        "color:" + LABEL_FG,
        "font-weight:600",
        "font-size:" + d.labelFontSizePx + "px",
        "white-space:nowrap",
    ].join(";");
    cluster.appendChild(label);

    const pillsWrap = document.createElement("div");
    pillsWrap.style.cssText = [
        "display:flex",
        "flex-direction:row",
        `gap:${d.interPillGapPx}px`,
    ].join(";");
    cluster.appendChild(pillsWrap);

    const selected = state.get(binding.dimName);
    const allActive = selected.size === 0;
    pillsWrap.appendChild(buildPill("All", allActive, () => state.clear(binding.dimName), d));

    for (const v of binding.distinctValues) {
        const active = selected.has(v);
        pillsWrap.appendChild(buildPill(v, active, () => state.toggle(binding.dimName, v), d));
    }
    return cluster;
}

function buildPill(
    label: string,
    active: boolean,
    onClick: () => void,
    d: DensitySpec,
): HTMLButtonElement {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.textContent = label;
    const stylePieces = [
        `padding:${d.pillPaddingV}px ${d.pillPaddingH}px`,
        "border-radius:4px",
        "border:1px solid " + (active ? PILL_BG_ACTIVE : PILL_BORDER),
        "background:" + (active ? PILL_BG_ACTIVE : PILL_BG_INACTIVE),
        "color:" + (active ? PILL_FG_ACTIVE : PILL_FG_INACTIVE),
        "cursor:pointer",
        "font-size:" + d.pillFontSizePx + "px",
        "font-weight:" + (active ? "600" : "500"),
        "white-space:nowrap",
        "user-select:none",
        "transition:background 100ms ease, border-color 100ms ease",
        "flex-shrink:0",
        "text-align:center",
    ];
    if (d.pillMinWidthPx > 0) stylePieces.push("min-width:" + d.pillMinWidthPx + "px");
    pill.style.cssText = stylePieces.join(";");
    pill.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    pill.addEventListener("mouseenter", () => {
        if (!active) pill.style.background = PILL_BG_HOVER;
    });
    pill.addEventListener("mouseleave", () => {
        if (!active) pill.style.background = PILL_BG_INACTIVE;
    });
    return pill;
}
