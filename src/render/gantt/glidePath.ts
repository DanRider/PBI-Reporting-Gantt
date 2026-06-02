"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../viewmodel";
import { SlipThresholds } from "../../model/activityState";
import { renderSlipIBeams } from "./glide/slipIBeam";

// INF-3787 Phase 5 re-spec — slip I-beam layer orchestrator.
//
// Per the EARNED-escalation principle + the bar-shrink convention,
// default render now ships:
//   1. Bullet escalation (lives in activityLabels.ts via the
//      slipBulletColorByActivity opt — already wired)
//   2. Shifted-bar 30% height shrink (lives in bars.ts via the
//      shiftedSet arg — wired in visual.ts before this orchestrator)
//   3. Slip I-beam in the freed top space (this orchestrator's
//      sole job — neutral dark grey, length = slip magnitude)
//
// The I-beam layer is appended as the LAST child of the parent so it
// draws above the (already-shrunken) forecast bar in z-order. Idempotent
// across re-renders.

const IBEAM_LAYER_CLASS = "glide-ibeam-layer";

export interface GlidePathOptions {
    slipThresholds?: SlipThresholds;
}

export function renderSlipIBeamLayer(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    options: GlidePathOptions = {},
): void {
    const layer = ensureSiblingLayer(parent, IBEAM_LAYER_CLASS);
    renderSlipIBeams(layer, activities, xScale, rowHeight, options.slipThresholds);
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
