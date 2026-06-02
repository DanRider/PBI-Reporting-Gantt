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

const TICK_STROKE = "#777777";
const TICK_STROKE_WIDTH = 1.5;
const TICK_LENGTH_PX = 6;          // vertical extent below the bar
const TICK_GAP_PX = 1;             // gap between bar bottom and tick top

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
): Selection<SVGLineElement, TickDatum, SVGGElement, unknown> {
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

    return g.selectAll<SVGLineElement, TickDatum>("line.activity-baseline-tick")
        .data(eligible, (d: TickDatum) => d.activity.name)
        .join("line")
        .attr("class", "activity-baseline-tick")
        .attr("data-activity", d => d.activity.name)
        .attr("x1", d => d.x)
        .attr("x2", d => d.x)
        .attr("y1", d => d.yTop)
        .attr("y2", d => d.yBottom)
        .attr("stroke", TICK_STROKE)
        .attr("stroke-width", TICK_STROKE_WIDTH)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");
}
