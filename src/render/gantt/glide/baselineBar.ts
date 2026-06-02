"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";
import { areaColor, ColorContext } from "../../../utils/colors";
import { barHeightFor } from "../bars";

// INF-3787 Phase 2 — glide-path layer #1: baseline-bar.
//
// Renders a dashed-outline rect per activity that has BOTH baselineStart
// AND baselineEnd bound — the committed (planning-time) date range. Sits
// at the same y/height as the forecast bar (renderBars) so the layers
// visually align; differs by stroke style (dashed) and fill (none).
//
// Color = lane color (areaColor) per the audit-fix #8 precedent that
// glide-path layers share the lane color so the viewer's eye groups them
// as "this is what changed for this lane's plan." If we ever need to
// differentiate baseline color further, do it via a per-lane palette
// shift, not by departing from the area-color convention.

const BASELINE_STROKE_DASHARRAY = "4 2";
const BASELINE_STROKE_WIDTH = 1.5;

export function renderBaselineBars(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext
): Selection<SVGRectElement, Activity, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;

    // Filter at the data-join boundary so unbound-baseline activities
    // simply produce no element. Type assertion is safe — the filter
    // proves both dates exist.
    const eligible = activities.filter(
        a => a.baselineStart != null && a.baselineEnd != null
    );

    return g.selectAll<SVGRectElement, Activity>("rect.baseline-bar")
        .data(eligible, (a: Activity) => a.name)
        .join("rect")
        .attr("class", "baseline-bar")
        .attr("data-activity", a => a.name)
        .attr("x", a => xScale(a.baselineStart as Date))
        .attr("y", a => a.index * rowHeight + padding)
        .attr("width", a => Math.max(0, xScale(a.baselineEnd as Date) - xScale(a.baselineStart as Date)))
        .attr("height", barH)
        .attr("fill", "none")
        .attr("stroke", a => areaColor(a.area, colors))
        .attr("stroke-width", BASELINE_STROKE_WIDTH)
        .attr("stroke-dasharray", BASELINE_STROKE_DASHARRAY)
        .attr("pointer-events", "none");
}
