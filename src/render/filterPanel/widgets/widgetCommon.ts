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

// Density spec — all values ~20% smaller than the original v2.3 baseline
// per operator request. Compact (most-used) drops to pad_v=3 / font=10
// from 4 / 12; comfortable + dense scaled proportionally for consistency.
export const DENSITY: Record<PinnedDensity, DensitySpec> = {
    comfortable: {
        rowMinHeightPx: 34, pillPaddingV: 6, pillPaddingH: 16, pillFontSizePx: 11,
        pillMinWidthPx: 52, labelFontSizePx: 11, interClusterGapPx: 14, interPillGapPx: 5,
        stripPaddingV: 5, stripPaddingH: 14,
    },
    compact: {
        rowMinHeightPx: 24, pillPaddingV: 3, pillPaddingH: 10, pillFontSizePx: 10,
        pillMinWidthPx: 38, labelFontSizePx: 10, interClusterGapPx: 11, interPillGapPx: 4,
        stripPaddingV: 3, stripPaddingH: 10,
    },
    dense: {
        rowMinHeightPx: 18, pillPaddingV: 1, pillPaddingH: 6, pillFontSizePx: 9,
        pillMinWidthPx: 0,  labelFontSizePx: 9, interClusterGapPx: 8, interPillGapPx: 3,
        stripPaddingV: 2, stripPaddingH: 8,
    },
};

/** Pixels the count badge protrudes BELOW the pill's box for a given density.
 *  Derived from the same formula buildPill uses to position the badge so the
 *  strip's flex-wrap row-gap can be sized to clear the protrusion (INF-3755).
 *  Source of truth for the badge geometry — buildPill consumes this too. */
export function badgeProtrusionPx(d: DensitySpec): number {
    const pillH = d.pillPaddingV * 2 + d.pillFontSizePx;
    const badgeH = Math.max(11, Math.round(pillH * 0.2));
    const descenderBottomFromTop = d.pillPaddingV + d.pillFontSizePx;
    return descenderBottomFromTop + badgeH - pillH;
}

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
    /** Optional faceted count. When provided, a small badge after the
     *  label shows the number of records that would match if this pill
     *  is selected (under current cross-filters from other dims).
     *  Undefined = no badge rendered. */
    count?: number;
}

/** Build a pill button. Shared by pillsMulti + pillsSingle. */
export function buildPill(opts: PillOptions): HTMLButtonElement {
    const { label, active, onClick, density: d, count } = opts;
    const pill = document.createElement("button");
    pill.type = "button";
    // The corner badge ESCAPES the pill's bounding box (negative offsets
    // in buildCountBadge), so the pill keeps its natural compact size —
    // no extra padding to make room. Badge floats on top like a
    // notification dot. Badge is sized as 20% of the rendered pill
    // height (min 14px for legibility), set via rAF after mount.
    const showCount = count !== undefined;
    const stylePieces = [
        `padding:${d.pillPaddingV}px ${d.pillPaddingH}px`,
        "border-radius:4px",
        "border:1px solid " + (active ? PILL_BG_ACTIVE : PILL_BORDER),
        "background:" + (active ? PILL_BG_ACTIVE : PILL_BG_INACTIVE),
        "color:" + (active ? PILL_FG_ACTIVE : PILL_FG_INACTIVE),
        "cursor:pointer",
        "font-size:" + d.pillFontSizePx + "px",
        // Constant weight (no toggle between 500/inactive and 600/active) —
        // a bolder weight at activation made the pill grow a couple of px
        // wider via glyph reflow. Same weight at all times = stable width.
        "font-weight:600",
        "white-space:nowrap",
        "user-select:none",
        "transition:background 100ms ease, border-color 100ms ease",
        "flex-shrink:0",
        "text-align:center",
        "position:relative",
    ];
    if (d.pillMinWidthPx > 0) stylePieces.push("min-width:" + d.pillMinWidthPx + "px");
    pill.style.cssText = stylePieces.join(";");
    pill.textContent = label;
    if (showCount) {
        const badge = buildCountBadge(count, active);
        pill.appendChild(badge);
        // Size + position the badge from the density spec (deterministic,
        // no rAF needed). Badge height = max(14, 20% of pill height).
        // Badge top sits at the descender depth — below the common letters
        // (which end at the baseline). Descenders y/j/g/p/q may dip into
        // the badge area; that's accepted per the operator's spec.
        const pillH = d.pillPaddingV * 2 + d.pillFontSizePx;
        const badgeH = Math.max(11, Math.round(pillH * 0.2));
        // Bottom-offset formula is now in badgeProtrusionPx() — shared with
        // topSlicerStrip's row-gap sizing (INF-3755) so badge geometry has
        // one source of truth.
        const bottomOffset = badgeProtrusionPx(d);
        const halfH = badgeH / 2;
        badge.style.height = badgeH + "px";
        badge.style.minWidth = badgeH + "px";
        badge.style.borderRadius = halfH + "px";
        badge.style.bottom = (-bottomOffset) + "px";
        badge.style.right = (-halfH) + "px";
        badge.style.fontSize = Math.max(8, Math.round(badgeH * 0.6)) + "px";
        // Tight padding — just enough breathing room for the digit
        // against the border. Single-digit badges stay round via
        // min-width=badgeH; multi-digit grow horizontally with minimal
        // padding (2px each side).
        badge.style.padding = "0 2px";
    }
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

/** Small clear-✕ affordance — rendered after the values in pillsMulti
 *  and on the dropdown trigger when the dim has an active selection.
 *  Click clears the dim's selection. Subtle gray default, red on hover. */
export function buildClearButton(onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Clear filter for this dimension";
    btn.textContent = "\u00d7";
    btn.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "width:18px",
        "height:18px",
        "padding:0",
        "border-radius:9px",
        "border:none",
        "background:transparent",
        "color:#888",
        "font-size:14px",
        "font-weight:700",
        "line-height:1",
        "cursor:pointer",
        "user-select:none",
        "transition:background 100ms ease, color 100ms ease",
        "flex-shrink:0",
        "margin-left:4px",
    ].join(";");
    btn.addEventListener("mouseenter", () => {
        btn.style.background = "#d62728";
        btn.style.color = "#ffffff";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.background = "transparent";
        btn.style.color = "#888";
    });
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

/** Faceted-count badge. In "corner" mode (the default for pills), it
 *  escapes the parent's bottom-right corner via negative offsets, floats
 *  on top like a notification dot, has a white halo border so it reads
 *  as a sticker rather than embedded chrome. In "inline" mode (used by
 *  dropdown checkbox rows), it sits in the document flow.
 *
 *  Fixed 18px square for single-digit; expands horizontally via
 *  min-width for 2-3 digit counts. Bulletproof centering via flex. */
export function buildCountBadge(
    count: number,
    parentActive: boolean = false,
    mode: "corner" | "inline" = "corner",
): HTMLSpanElement {
    const badge = document.createElement("span");
    badge.className = "filter-count-badge";
    badge.textContent = String(count);
    const bg = parentActive ? "#ffffff" : "#1F77B4";
    const fg = parentActive ? "#1F77B4" : "#ffffff";
    const isInline = mode === "inline";
    const positionStyle = isInline
        ? "position:relative;"
        : "position:absolute;bottom:-8px;right:-8px;z-index:1;";
    // Inline mode (dropdown rows + sidebar checkrows) uses a compact default
    // size matching the corner-badge floor (~11px). Corner mode starts at
    // 20px and gets resized by buildPill's rAF based on actual pill height.
    const initialMinWidth = isInline ? 13 : 20;
    const initialHeight = isInline ? 13 : 20;
    const initialPadding = isInline ? "0 3px" : "0 7px";
    const initialRadius = isInline ? 6.5 : 10;
    const initialFontSize = isInline ? 8 : 10;
    badge.style.cssText = positionStyle + [
        "display:flex",
        "align-items:center",
        "justify-content:center",
        `min-width:${initialMinWidth}px`,
        `height:${initialHeight}px`,
        `padding:${initialPadding}`,
        `border-radius:${initialRadius}px`,
        "border:none",
        `font-size:${initialFontSize}px`,
        "font-weight:700",
        "line-height:1",
        "font-family:'Segoe UI',system-ui,sans-serif",
        `background:${bg}`,
        `color:${fg}`,
        "box-sizing:content-box",
        "pointer-events:none",
        "box-shadow:0 1px 2px rgba(0,0,0,0.15)",
        // Dim the badge when count is zero — visually says "no impact".
        count === 0 ? "opacity:0.5" : "opacity:1",
    ].join(";");
    return badge;
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
