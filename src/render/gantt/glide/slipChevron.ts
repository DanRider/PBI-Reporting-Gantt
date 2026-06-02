"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";
import { computeSlip, SlipResult, SlipDirection } from "../../../model/activityState";

// INF-3787 Phase 2-3 — glide-path layer #3: slip-chevron.
//
// Renders a single chevron path per activity that has a baselineEnd
// bound AND a slip magnitude above the negligible threshold. The chevron
// points in the direction of drift: right (>) when the forecast end is
// AFTER the baseline end (slipping later), left (<) when the forecast
// end is BEFORE the baseline end (pulled in earlier). Color is semantic
// per the slip-magnitude category.
//
// Slip categorization lives in src/model/activityState.ts as the single
// source of truth across the glide-path stack (Phase 3 refactor). The
// verb here is responsible only for the color mapping (magnitude →
// stroke color) and the chevron geometry — pure rendering concerns.
// Format-pane configurable thresholds (Decision #3, exposed for
// override) land in Phase 4 via the same model entry point.

const COLOR_MINOR_SLIP = "#d4a017";    // yellow-ish — minor slip
const COLOR_MAJOR_SLIP = "#d97706";    // orange    — major slip
const COLOR_CRITICAL_SLIP = "#b91c1c"; // red       — critical slip
const COLOR_PULLED_IN = "#16a34a";     // green     — ahead of schedule (any magnitude)

const CHEVRON_SIZE_PX = 8;
const CHEVRON_STROKE_WIDTH = 2;
const CHEVRON_X_OFFSET_PX = 4; // gap between forecast-bar end and chevron anchor

function colorForSlip(result: SlipResult): string {
    if (result.direction === "pulled-in") return COLOR_PULLED_IN;
    if (result.magnitude === "critical")  return COLOR_CRITICAL_SLIP;
    if (result.magnitude === "major")     return COLOR_MAJOR_SLIP;
    return COLOR_MINOR_SLIP; // direction === "slipping", magnitude === "minor"
    // (on-track is filtered out before this map fires)
}

interface ChevronDatum {
    activity: Activity;
    slip: SlipResult;
    anchorX: number;
    anchorY: number;
}

function chevronPath(anchorX: number, anchorY: number, size: number, dir: SlipDirection): string {
    const half = size / 2;
    if (dir === "slipping") {
        // > shape — base on the left, tip on the right
        return `M${anchorX - half},${anchorY - half} L${anchorX + half},${anchorY} L${anchorX - half},${anchorY + half}`;
    } else {
        // < shape — base on the right, tip on the left (pulled-in)
        return `M${anchorX + half},${anchorY - half} L${anchorX - half},${anchorY} L${anchorX + half},${anchorY + half}`;
    }
}

export function renderSlipChevrons(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    // colors arg accepted for signature uniformity with other glide verbs;
    // chevron color is semantic (computed per slip magnitude), not
    // derived from lane palette.
    _colors: unknown
): Selection<SVGPathElement, ChevronDatum, SVGGElement, unknown> {
    const eligible: ChevronDatum[] = [];
    for (const a of activities) {
        const slip = computeSlip(a.baselineEnd, a.end);
        if (slip == null) continue;                       // no baseline → no chevron
        if (slip.direction === "on-track") continue;      // negligible magnitude → no chevron
        const baseAnchorX = xScale(a.end);
        const anchorX = baseAnchorX + (slip.direction === "slipping"
            ? CHEVRON_X_OFFSET_PX
            : -CHEVRON_X_OFFSET_PX);
        const anchorY = a.index * rowHeight + rowHeight / 2;
        eligible.push({ activity: a, slip, anchorX, anchorY });
    }

    return g.selectAll<SVGPathElement, ChevronDatum>("path.slip-chevron")
        .data(eligible, (d: ChevronDatum) => d.activity.name)
        .join("path")
        .attr("class", "slip-chevron")
        .attr("data-activity", d => d.activity.name)
        .attr("data-slip-days", d => d.slip.days.toFixed(2))
        .attr("data-slip-magnitude", d => d.slip.magnitude)
        .attr("data-slip-direction", d => d.slip.direction)
        .attr("d", d => chevronPath(d.anchorX, d.anchorY, CHEVRON_SIZE_PX, d.slip.direction))
        .attr("fill", "none")
        .attr("stroke", d => colorForSlip(d.slip))
        .attr("stroke-width", CHEVRON_STROKE_WIDTH)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("pointer-events", "none");
}
