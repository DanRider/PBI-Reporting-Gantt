"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";
import {
    computeSlip,
    SlipThresholds,
    DEFAULT_SLIP_THRESHOLDS,
} from "../../../model/activityState";
import { barHeightFor } from "../bars";

// INF-3787 — bullet-chart comparative measure for activity variance.
//
// Tufte / Stephen Few bullet-graph vocabulary: a single small TICK on
// (or relative to) the featured measure marks the comparative value.
// For each activity with a non-negligible slip and baselineEnd bound,
// render a dark vertical line at xScale(baselineEnd) spanning the
// bar's exact y/height range. Position alone tells the story:
//
//   tick INSIDE the bar     → forecast extends past baseline (slipping)
//   tick OUTSIDE bar to the right → forecast stops short (pulled in)
//   tick AT bar's right edge → on-track (filtered out — no chrome)
//
// No bar shrink, no I-beam shape, no hatched zones. The bar itself is
// the canvas; the tick is the only addition. Variance magnitude reads
// as the horizontal distance between the tick and the bar's right
// edge — intrinsic, no separate magnitude encoding required.

const MARK_STROKE = "#1f2937";        // dark slate — high contrast against every lane color
const MARK_STROKE_WIDTH = 2;
const MARK_VERTICAL_INSET = 1;        // px from bar top/bottom edges so the tick reads "on the bar"

interface MarkDatum {
    activity: Activity;
    x: number;
    yTop: number;
    yBottom: number;
}

export function renderBaselineMarks(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    thresholds: SlipThresholds = DEFAULT_SLIP_THRESHOLDS,
): Selection<SVGPathElement, MarkDatum, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;

    const eligible: MarkDatum[] = [];
    for (const a of activities) {
        if (a.baselineEnd == null) continue;
        const slip = computeSlip(a.baselineEnd, a.end, thresholds);
        if (slip == null || slip.direction === "on-track") continue;
        const rowTop = a.index * rowHeight;
        eligible.push({
            activity: a,
            x: xScale(a.baselineEnd),
            yTop: rowTop + padding + MARK_VERTICAL_INSET,
            yBottom: rowTop + padding + barH - MARK_VERTICAL_INSET,
        });
    }

    return g.selectAll<SVGPathElement, MarkDatum>("path.baseline-mark")
        .data(eligible, (d: MarkDatum) => d.activity.name)
        .join("path")
        .attr("class", "baseline-mark")
        .attr("data-activity", d => d.activity.name)
        .attr("d", d => `M${d.x},${d.yTop} L${d.x},${d.yBottom}`)
        .attr("fill", "none")
        .attr("stroke", MARK_STROKE)
        .attr("stroke-width", MARK_STROKE_WIDTH)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");
}
