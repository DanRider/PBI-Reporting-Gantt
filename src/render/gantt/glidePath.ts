"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../viewmodel";
import { renderActivityBaselineTicks } from "./glide/baselineEndTick";

// INF-3787 Phase 5 re-spec — glide-path layer orchestrator.
//
// Per the EARNED-escalation principle + the industry-convention
// survey, default render now ships:
//   1. Bullet escalation (lives in activityLabels.ts via the
//      slipBulletColorByActivity opt — already wired)
//   2. Activity baseline-end tick (this orchestrator's sole job —
//      a short grey vertical mark just below the forecast bar at
//      xScale(baselineEnd) for each activity with baselineEnd bound)
//
// Future scopes (not in this orchestrator):
//   3. Milestone hollow-ghost + connector → src/render/gantt/glide/
//      milestoneBaselineGhost.ts called from a different render path
//      (milestone-layer orchestration, not activity-layer)
//
// The tick layer is appended as the LAST child of the parent so it
// draws above the forecast bar in z-order (the tick sits BELOW the
// bar geometrically but is rendered AFTER so other render calls don't
// occlude it). Idempotent across re-renders.

const TICK_LAYER_CLASS = "glide-baseline-tick-layer";

export function renderActivityBaselineTickLayer(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
): void {
    const layer = ensureSiblingLayer(parent, TICK_LAYER_CLASS);
    renderActivityBaselineTicks(layer, activities, xScale, rowHeight);
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
