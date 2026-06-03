"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../viewmodel";
import { SlipThresholds } from "../../model/activityState";
import { renderBaselineMarks } from "./glide/baselineMark";

// INF-3787 — baseline-mark layer orchestrator (bullet-chart vocabulary).
//
// Default render layers shipping with v2.3:
//   1. Bullet escalation (lives in activityLabels.ts via the
//      slipBulletColorByActivity opt — already wired)
//   2. Baseline mark inside the bar (this orchestrator's sole job —
//      single dark vertical tick at xScale(baselineEnd) for each
//      activity with non-negligible slip)
//
// The mark layer is appended as the LAST child of the parent so it
// draws over the forecast bar (the tick is INSIDE the bar visually).
// Idempotent across re-renders.

export interface GlidePathOptions {
    slipThresholds?: SlipThresholds;
}

const MARK_LAYER_CLASS = "glide-baseline-mark-layer";

export function renderBaselineMarkLayer(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    options: GlidePathOptions = {},
): void {
    const layer = ensureSiblingLayer(parent, MARK_LAYER_CLASS);
    renderBaselineMarks(layer, activities, xScale, rowHeight, options.slipThresholds);
}

function ensureSiblingLayer(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    cls: string,
): Selection<SVGGElement, unknown, null, undefined> {
    let layer = parent.select<SVGGElement>(`g.${cls}`);
    if (layer.empty()) {
        layer = parent.append<SVGGElement>("g").attr("class", cls);
    } else {
        layer.raise();
    }
    return layer;
}
