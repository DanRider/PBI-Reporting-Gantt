// INF-3745 Phase A — shared widget primitives.
//
// Density specs lifted from topSlicerStrip.ts (now consumed by both the
// strip itself and every WidgetRenderer for pixel-perfect parity).
// Also exports the pill-style helper used by pillsMulti + pillsSingle and
// the popover positioning helper used by dropdownMulti.

import type { PinnedDensity } from "../state";

export interface DensitySpec {
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

export const DENSITY: Record<PinnedDensity, DensitySpec> = {
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

// Shared pill chrome — single source for active/inactive/hover colors.
export const PILL_BG_ACTIVE = "#1F77B4";
export const PILL_FG_ACTIVE = "#ffffff";
export const PILL_BG_INACTIVE = "#ffffff";
export const PILL_FG_INACTIVE = "#333";
export const PILL_BORDER = "#c0c0c0";
export const PILL_BG_HOVER = "#eef3fb";

export interface PillOptions {
    label: string;
    active: boolean;
    onClick: () => void;
    density: DensitySpec;
}

/** Build a pill button. Shared by pillsMulti + pillsSingle. */
export function buildPill(opts: PillOptions): HTMLButtonElement {
    const { label, active, onClick, density: d } = opts;
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

export interface PopoverPosition {
    /** "below" stacks under trigger; "above" stacks over. Phase A always "below";
     *  Phase D handles edge detection. */
    placement: "below" | "above";
    /** Pixel offset from trigger.bottom (when placement=below) or trigger.top
     *  (placement=above). */
    offsetPx: number;
}

/** Phase A popover positioning — absolutely positions `popover` directly
 *  below `trigger`. Caller is responsible for relative parent + z-index.
 *  Phase D will replace this with viewport-aware placement. */
export function positionPopoverBelow(
    trigger: HTMLElement,
    popover: HTMLElement,
    pos: PopoverPosition = { placement: "below", offsetPx: 4 },
): void {
    popover.style.position = "absolute";
    popover.style.left = "0px";
    if (pos.placement === "below") {
        popover.style.top = (trigger.offsetHeight + pos.offsetPx) + "px";
        popover.style.bottom = "auto";
    } else {
        popover.style.bottom = (trigger.offsetHeight + pos.offsetPx) + "px";
        popover.style.top = "auto";
    }
}
