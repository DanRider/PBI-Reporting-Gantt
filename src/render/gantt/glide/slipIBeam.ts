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

// INF-3787 Phase 5 re-spec — vertical I-beam BISECTING the baseline-end date.
//
// Visual idiom: a vertical "I" stands AT xScale(baselineEnd) — the
// date the activity was originally planned to end. The bar renders at
// its current forecast position; the I-beam pins where it WAS planned
// for. Reads as "originally we said this ends HERE." Acts like a mini
// per-activity TODAY-line, but for the historical baseline.
//
// Shape: vertical stem with horizontal caps at top + bottom (I shape).
// Spans slightly taller than the bar so the caps clear the bar
// rounded corners and the eye anchors on the marker, not the bar.
//
// Color: neutral dark grey (#444). No semantic color — magnitude of
// slip is visually evident from the I-beam's horizontal offset
// relative to the bar's right edge.
//
// Renders ONLY when there's a non-negligible slip. On-track activities
// (baseline matches forecast) render no I-beam (it would overlap with
// the bar end and add noise).

const IBEAM_STROKE = "#444444";
const IBEAM_STROKE_WIDTH = 1.8;
const IBEAM_CAP_HALF_WIDTH = 4;        // horizontal extent of each cap (half-width)
const IBEAM_VERTICAL_OVERHANG_PX = 3;  // how far the I extends above/below the bar zone

interface IBeamDatum {
    activity: Activity;
    x: number;
    yTop: number;
    yBottom: number;
}

export function renderSlipIBeams(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    thresholds: SlipThresholds = DEFAULT_SLIP_THRESHOLDS,
): Selection<SVGPathElement, IBeamDatum, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;

    const eligible: IBeamDatum[] = [];
    for (const a of activities) {
        if (a.baselineEnd == null) continue;
        const slip = computeSlip(a.baselineEnd, a.end, thresholds);
        if (slip == null || slip.direction === "on-track") continue;
        const rowTop = a.index * rowHeight;
        eligible.push({
            activity: a,
            x: xScale(a.baselineEnd),
            yTop: rowTop + padding - IBEAM_VERTICAL_OVERHANG_PX,
            yBottom: rowTop + padding + barH + IBEAM_VERTICAL_OVERHANG_PX,
        });
    }

    return g.selectAll<SVGPathElement, IBeamDatum>("path.slip-ibeam")
        .data(eligible, (d: IBeamDatum) => d.activity.name)
        .join("path")
        .attr("class", "slip-ibeam")
        .attr("data-activity", d => d.activity.name)
        // Single path with 3 subpaths forming the I:
        //   top cap     M(x-cap, yTop)    L(x+cap, yTop)
        //   vertical    M(x,     yTop)    L(x,     yBottom)
        //   bottom cap  M(x-cap, yBottom) L(x+cap, yBottom)
        .attr("d", d =>
            `M${d.x - IBEAM_CAP_HALF_WIDTH},${d.yTop} L${d.x + IBEAM_CAP_HALF_WIDTH},${d.yTop} ` +
            `M${d.x},${d.yTop} L${d.x},${d.yBottom} ` +
            `M${d.x - IBEAM_CAP_HALF_WIDTH},${d.yBottom} L${d.x + IBEAM_CAP_HALF_WIDTH},${d.yBottom}`
        )
        .attr("fill", "none")
        .attr("stroke", IBEAM_STROKE)
        .attr("stroke-width", IBEAM_STROKE_WIDTH)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");
}
