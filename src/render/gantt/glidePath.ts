"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../viewmodel";
import { ColorContext } from "../../utils/colors";
import { renderBars } from "./bars";
import { renderBaselineBars } from "./glide/baselineBar";
import { renderActualSegments } from "./glide/actualSegment";
import { renderSlipChevrons } from "./glide/slipChevron";
import { SlipThresholds } from "../../model/activityState";

// INF-3787 Phase 3 — glide-path render orchestrator.
//
// Calls the 4 layer verbs in z-order against shared sibling layer
// groups. Each verb internally filters its eligible-activity subset, so
// the orchestrator's only job is layer management + verb dispatch.
//
// Z-order (bottom → top by sibling-group append order):
//   1. baselineBar    — dashed outline (committed plan, frozen)
//   2. forecast bar   — solid lane-color (current forecast)
//   3. actualSegment  — half-height bottom-anchored solid (real progress)
//   4. slipChevron    — semantic-colored drift indicator (top)
//
// Idempotent layer creation: ensureGlidePathLayers() reuses existing
// groups across re-renders. d3's data-join inside each verb handles
// add/update/remove against the layer's existing children — the
// orchestrator itself has no per-frame allocation cost.
//
// Wiring into the existing render pipeline (src/visual.ts) happens in
// Phase 5 — this file defines the call surface but is not yet invoked.

export interface GlidePathLayers {
    baseline: Selection<SVGGElement, unknown, null, undefined>;
    forecast: Selection<SVGGElement, unknown, null, undefined>;
    actual:   Selection<SVGGElement, unknown, null, undefined>;
    chevron:  Selection<SVGGElement, unknown, null, undefined>;
}

const LAYER_BASELINE = "glide-baseline-layer";
const LAYER_FORECAST = "glide-forecast-layer";
const LAYER_ACTUAL = "glide-actual-layer";
const LAYER_CHEVRON = "glide-chevron-layer";

export function ensureGlidePathLayers(
    parent: Selection<SVGGElement, unknown, null, undefined>
): GlidePathLayers {
    function ensure(cls: string): Selection<SVGGElement, unknown, null, undefined> {
        let layer = parent.select<SVGGElement>(`g.${cls}`);
        if (layer.empty()) layer = parent.append<SVGGElement>("g").attr("class", cls);
        return layer;
    }
    // Order matters — append order is z-order in SVG.
    return {
        baseline: ensure(LAYER_BASELINE),
        forecast: ensure(LAYER_FORECAST),
        actual:   ensure(LAYER_ACTUAL),
        chevron:  ensure(LAYER_CHEVRON),
    };
}

export interface GlidePathOptions {
    /** Format-pane override; omit to use DEFAULT_SLIP_THRESHOLDS. */
    slipThresholds?: SlipThresholds;
}

export function renderGlidePath(
    layers: GlidePathLayers,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext,
    options: GlidePathOptions = {}
): void {
    renderBaselineBars(layers.baseline,    activities, xScale, rowHeight, colors);
    renderBars(layers.forecast,            activities, xScale, rowHeight, colors);
    renderActualSegments(layers.actual,    activities, xScale, rowHeight, colors);
    renderSlipChevrons(layers.chevron,     activities, xScale, rowHeight, colors, options.slipThresholds);
}
