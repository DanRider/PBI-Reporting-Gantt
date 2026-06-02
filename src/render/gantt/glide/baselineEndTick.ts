"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";
import { barHeightFor } from "../bars";

// INF-3787 Phase 5 re-spec — activity baseline-end tick.
//
// Industry-convention pattern (Smartsheet's thin-gray baseline marker
// + Tufte bullet-graph reference tick). For each activity with
// baselineEnd bound, renders a short vertical TICK at the baseline
// date's x-position, just below the forecast bar's bottom edge. The
// viewer's eye sees the bar's right edge vs. the tick = slip at a
// glance, without painting a full ghost bar.
//
// WHY a tick at baseline-END (not a full ghost rect): the viewer cares
// about WHERE THE BASELINE ENDED (was it on time?), not how long the
// past plan was. One point, marked precisely, beats a translucent
// rectangle that visualizes irrelevant duration.
//
// Color = neutral grey (reads universally as "past state"). Hides
// invisibly when baselineEnd matches forecast end (tick collocates
// with the bar's right edge — drawn but indistinguishable from the
// bar edge, expected behavior).
//
// Fires automatically when baselineEnd is bound — no toggle.

const TICK_STROKE = "#444444";
const TICK_STROKE_WIDTH = 2.5;
const TICK_LENGTH_PX = 12;         // vertical extent below the bar
const TICK_CAP_HALF_WIDTH = 4;     // half-width of horizontal cap (forms "T" anchor)
const TICK_GAP_PX = 2;             // gap between bar bottom and tick top (cap)

interface TickDatum {
    activity: Activity;
    x: number;
    yTop: number;
    yBottom: number;
}

export function renderActivityBaselineTicks(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
): Selection<SVGPathElement, TickDatum, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;

    const eligible: TickDatum[] = [];
    for (const a of activities) {
        if (a.baselineEnd == null) continue;
        const barBottom = a.index * rowHeight + padding + barH;
        const yTop = barBottom + TICK_GAP_PX;
        eligible.push({
            activity: a,
            x: xScale(a.baselineEnd),
            yTop,
            yBottom: yTop + TICK_LENGTH_PX,
        });
    }

    // Single path per anchor: horizontal cap at top + vertical stem (T shape).
    // Reads cartographically as "reference mark at this point" — more
    // obvious than a bare vertical line at portfolio scale while still
    // staying neutral (no semantic color).
    return g.selectAll<SVGPathElement, TickDatum>("path.activity-baseline-tick")
        .data(eligible, (d: TickDatum) => d.activity.name)
        .join("path")
        .attr("class", "activity-baseline-tick")
        .attr("data-activity", d => d.activity.name)
        .attr("d", d =>
            `M${d.x - TICK_CAP_HALF_WIDTH},${d.yTop} L${d.x + TICK_CAP_HALF_WIDTH},${d.yTop} ` +
            `M${d.x},${d.yTop} L${d.x},${d.yBottom}`
        )
        .attr("fill", "none")
        .attr("stroke", TICK_STROKE)
        .attr("stroke-width", TICK_STROKE_WIDTH)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");
}
