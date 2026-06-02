"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../viewmodel";
import { ColorContext } from "../../utils/colors";
import { renderBaselineBars } from "./glide/baselineBar";
import { renderActualSegments } from "./glide/actualSegment";
import { renderSlipChevrons } from "./glide/slipChevron";
import { SlipThresholds } from "../../model/activityState";

// INF-3787 Phase 3 + Phase 5 — glide-path render orchestrator.
//
// Integration contract: the FORECAST bar rendering (renderBars) stays
// in the caller's hands (typically src/visual.ts, which renders bars
// directly into bodyG via the existing v2.2.0.3 path). The orchestrator
// adds three SIBLING layer groups to that parent at the correct z-order
// around the caller's own bars+markers content:
//
//   bodyG
//   ├── g.glide-baseline-layer   ← inserted as FIRST child (z-bottom)
//   ├── rect.activity-bar         ← existing forecast bars (caller)
//   ├── path.milestone-marker     ← existing markers (caller)
//   ├── circle.milestone-hit      ← existing hit-targets (caller)
//   ├── text.milestone-label      ← existing labels (caller)
//   ├── g.glide-actual-layer     ← raised to top (above bars + markers)
//   └── g.glide-chevron-layer    ← raised LAST (drift indicator on top)
//
// Two-call API:
//   renderGlidePathBaseline(parent, ...)   — call BEFORE renderBars
//   renderGlidePathOverlays(parent, ..., options) — call AFTER markers+labels
//
// This keeps the existing renderBars data-join / selection-wiring
// unchanged (barsSel is still a direct Selection over bodyG > rect)
// while layering glide-path render on top. Idempotent across re-renders
// — sibling layers are repositioned via .lower() / .raise() each call.

export interface GlidePathOptions {
    /** Format-pane override; omit to use DEFAULT_SLIP_THRESHOLDS. */
    slipThresholds?: SlipThresholds;
}

const BASELINE_LAYER_CLASS = "glide-baseline-layer";
const ACTUAL_LAYER_CLASS = "glide-actual-layer";
const CHEVRON_LAYER_CLASS = "glide-chevron-layer";

/**
 * Render the BELOW-bars glide layer (baseline outlines).
 * MUST be called BEFORE the caller's own renderBars/renderMilestones
 * so the baseline layer settles at the bottom of the z-stack inside
 * `parent`.
 */
export function renderGlidePathBaseline(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext
): void {
    const layer = ensureSiblingLayer(parent, BASELINE_LAYER_CLASS, "first");
    renderBaselineBars(layer, activities, xScale, rowHeight, colors);
}

/**
 * Render the ABOVE-bars glide layers (actual-segment + slip-chevron).
 * MUST be called AFTER the caller's own renderBars/renderMilestones/
 * renderMilestoneLabels so the overlay layers end up at the top of
 * the z-stack and don't block markers/labels from receiving clicks.
 */
export function renderGlidePathOverlays(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext,
    options: GlidePathOptions = {}
): void {
    const actualLayer = ensureSiblingLayer(parent, ACTUAL_LAYER_CLASS, "last");
    renderActualSegments(actualLayer, activities, xScale, rowHeight, colors);
    // chevron AFTER actual so chevron raises above actual on each re-render.
    const chevronLayer = ensureSiblingLayer(parent, CHEVRON_LAYER_CLASS, "last");
    renderSlipChevrons(chevronLayer, activities, xScale, rowHeight, colors, options.slipThresholds);
}

function ensureSiblingLayer(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    cls: string,
    position: "first" | "last"
): Selection<SVGGElement, unknown, null, undefined> {
    let layer = parent.select<SVGGElement>(`g.${cls}`);
    if (layer.empty()) {
        if (position === "first") {
            layer = parent.insert<SVGGElement>("g", ":first-child").attr("class", cls);
        } else {
            layer = parent.append<SVGGElement>("g").attr("class", cls);
        }
        return layer;
    }
    // Re-position across re-renders so caller's interleaved content
    // (potentially appended-after the last update) doesn't push our
    // layers out of the intended z-position.
    if (position === "first") layer.lower();
    else                      layer.raise();
    return layer;
}
