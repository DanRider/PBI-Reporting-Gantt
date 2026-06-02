"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";
import { areaColor, ColorContext } from "../../../utils/colors";
import { barHeightFor } from "../bars";

// INF-3787 Phase 2 — glide-path layer #2: actual-segment.
//
// Renders a HALF-HEIGHT solid-fill rect per activity that has BOTH
// actualStart AND actualEnd bound — the recorded (real) date range. The
// half-height + bottom-anchor convention is the industry-standard
// "progress fill" visual (MS Project, Primavera, Smartsheet all use a
// variant of this). Stacked under the forecast bar at the same x range,
// the bottom half is visibly the actual; the top half is just forecast.
// Self-distinct without requiring transparency or pattern fills.
//
// Lane color (areaColor) per the same audit-fix #8 convention as
// baselineBar — glide-path layers share lane color so the viewer's eye
// groups them as "this is what changed for this lane's plan."
//
// Bounding (clamping actualEnd to TODAY for in-progress work where the
// operator hasn't yet recorded a real end date) is the CALLER's
// responsibility, not the verb's. Verb stays signature-uniform with
// existing render verbs: (g, items[], xScale, rowHeight, colors).

const ACTUAL_MIN_HEIGHT_PX = 4;

export function renderActualSegments(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext
): Selection<SVGRectElement, Activity, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;
    const actualH = Math.max(ACTUAL_MIN_HEIGHT_PX, Math.floor(barH / 2));
    // Anchor at the bottom of the forecast-bar zone: y = row top + padding
    // + (full barH − half barH).
    const actualYOffset = padding + (barH - actualH);

    const eligible = activities.filter(
        a => a.actualStart != null && a.actualEnd != null
    );

    return g.selectAll<SVGRectElement, Activity>("rect.actual-segment")
        .data(eligible, (a: Activity) => a.name)
        .join("rect")
        .attr("class", "actual-segment")
        .attr("data-activity", a => a.name)
        .attr("x", a => xScale(a.actualStart as Date))
        .attr("y", a => a.index * rowHeight + actualYOffset)
        .attr("width", a => Math.max(0, xScale(a.actualEnd as Date) - xScale(a.actualStart as Date)))
        .attr("height", actualH)
        .attr("fill", a => areaColor(a.area, colors))
        .attr("pointer-events", "none");
}
