"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";
import {
    computeSlip,
    slipToHealthColor,
    SlipThresholds,
    DEFAULT_SLIP_THRESHOLDS,
} from "../../../model/activityState";
import { HealthColorPalette, DEFAULT_HEALTH_PALETTE } from "../../../utils/healthColor";
import { barHeightFor } from "../bars";

// INF-3787 Phase 5 re-spec — slip whisker (opt-in glide-path chrome).
//
// Thin dashed horizontal segment between baseline-end and forecast-end
// for activities where slip is non-negligible. The "delta only" visual
// surfaces drift magnitude without drawing a full baseline outline.
// Direction is implicit in segment position relative to the forecast bar:
//   slipping  → segment extends RIGHT of forecast bar end
//   pulled-in → segment extends LEFT, ending inside the forecast bar
//
// Renders ONLY when the Glide Path Format-Pane card has "Show slip
// whisker" toggled ON. Default OFF — opt-in chrome per the EARNED-
// escalation principle. The bullet color already tells the slip story
// on every row; the whisker adds magnitude detail when invited.
//
// Stroke color reuses the health palette (slipToHealthColor mapping)
// so the whisker visually ties back to the same bullet escalation
// already telling the viewer the same story.

const WHISKER_STROKE_WIDTH = 1.5;
const WHISKER_STROKE_DASHARRAY = "3 2";

interface WhiskerDatum {
    activity: Activity;
    x1: number;
    x2: number;
    y: number;
    color: string;
}

export function renderSlipWhiskers(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    palette: HealthColorPalette = DEFAULT_HEALTH_PALETTE,
    thresholds: SlipThresholds = DEFAULT_SLIP_THRESHOLDS,
): Selection<SVGLineElement, WhiskerDatum, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;

    const eligible: WhiskerDatum[] = [];
    for (const a of activities) {
        if (a.baselineEnd == null) continue;
        const slip = computeSlip(a.baselineEnd, a.end, thresholds);
        if (slip == null || slip.direction === "on-track") continue;
        const color = slipToHealthColor(slip, palette);
        if (color == null) continue;
        eligible.push({
            activity: a,
            x1: xScale(a.end),            // forecast-end as one endpoint
            x2: xScale(a.baselineEnd),    // baseline-end as the other
            y: a.index * rowHeight + padding + barH / 2,
            color,
        });
    }

    return g.selectAll<SVGLineElement, WhiskerDatum>("line.slip-whisker")
        .data(eligible, (d: WhiskerDatum) => d.activity.name)
        .join("line")
        .attr("class", "slip-whisker")
        .attr("data-activity", d => d.activity.name)
        .attr("x1", d => d.x1)
        .attr("y1", d => d.y)
        .attr("x2", d => d.x2)
        .attr("y2", d => d.y)
        .attr("stroke", d => d.color)
        .attr("stroke-width", WHISKER_STROKE_WIDTH)
        .attr("stroke-dasharray", WHISKER_STROKE_DASHARRAY)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");
}
