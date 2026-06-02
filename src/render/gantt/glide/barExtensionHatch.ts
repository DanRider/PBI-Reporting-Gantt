"use strict";

import { Selection, BaseType } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";
import {
    computeSlip,
    SlipThresholds,
    DEFAULT_SLIP_THRESHOLDS,
} from "../../../model/activityState";
import { barHeightFor } from "../bars";

// INF-3787 — bar-extension hatched overlay.
//
// For activities with a non-negligible slip, render a hatched-pattern
// rect over the region between baselineEnd and forecastEnd (the
// "disagreement zone" between plan and current state). The lane-color
// bar underneath supplies identity; the hatched overlay communicates
// "this portion of the bar is variance, not plan."
//
// Industry precedent:
//   - Civil engineering / construction Gantts use diagonal hatching
//     to mark "extension past planned date"
//   - Bloomberg Terminal uses hatched zones for "outside committed range"
//   - Climate science series use hatching for "interpolated / uncertain"
//
// Reads cohesively whether slip is positive (slipping later) OR negative
// (pulled in earlier) — hatched zone always marks the magnitude between
// baseline and forecast endpoints, direction is implicit from which side
// of the bar end the hatching falls on.
//
// Requires a <pattern id="bar-extension-hatch"> in the SVG <defs>.
// Caller (visual.ts) ensures the pattern is mounted before this verb fires.

export const BAR_HATCH_PATTERN_ID = "bar-extension-hatch";

interface HatchDatum {
    activity: Activity;
    x: number;
    width: number;
    y: number;
    height: number;
}

/**
 * Ensure the <pattern> defs element exists on the root SVG. Idempotent.
 * Caller invokes once per update().
 */
export function ensureBarHatchPattern(
    svgRoot: Selection<SVGSVGElement, unknown, BaseType, unknown>,
): void {
    let defs = svgRoot.select<SVGDefsElement>("defs");
    if (defs.empty()) defs = svgRoot.append<SVGDefsElement>("defs");
    let pattern = defs.select<SVGPatternElement>(`#${BAR_HATCH_PATTERN_ID}`);
    if (pattern.empty()) {
        pattern = defs.append<SVGPatternElement>("pattern")
            .attr("id", BAR_HATCH_PATTERN_ID)
            .attr("patternUnits", "userSpaceOnUse")
            .attr("width", 6)
            .attr("height", 6)
            .attr("patternTransform", "rotate(45)");
        pattern.append("line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", 0).attr("y2", 6)
            .attr("stroke", "rgba(0, 0, 0, 0.32)")
            .attr("stroke-width", 2);
    }
}

export function renderBarExtensionHatches(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    thresholds: SlipThresholds = DEFAULT_SLIP_THRESHOLDS,
): Selection<SVGRectElement, HatchDatum, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;

    const eligible: HatchDatum[] = [];
    for (const a of activities) {
        if (a.baselineEnd == null) continue;
        const slip = computeSlip(a.baselineEnd, a.end, thresholds);
        if (slip == null || slip.direction === "on-track") continue;
        const xBaseline = xScale(a.baselineEnd);
        const xForecast = xScale(a.end);
        const x = Math.min(xBaseline, xForecast);
        const width = Math.max(0, Math.abs(xForecast - xBaseline));
        eligible.push({
            activity: a,
            x,
            width,
            y: a.index * rowHeight + padding,
            height: barH,
        });
    }

    return g.selectAll<SVGRectElement, HatchDatum>("rect.bar-extension-hatch")
        .data(eligible, (d: HatchDatum) => d.activity.name)
        .join("rect")
        .attr("class", "bar-extension-hatch")
        .attr("data-activity", d => d.activity.name)
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", `url(#${BAR_HATCH_PATTERN_ID})`)
        .attr("pointer-events", "none");
}
