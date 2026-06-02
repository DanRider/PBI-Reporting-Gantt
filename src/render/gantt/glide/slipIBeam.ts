"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";
import {
    computeSlip,
    SlipThresholds,
    DEFAULT_SLIP_THRESHOLDS,
} from "../../../model/activityState";
import { barHeightFor, shiftedBarHeightFor } from "../bars";

// INF-3787 Phase 5 re-spec — slip I-beam in the freed top-of-row
// space of shifted activities.
//
// Visual idiom: classic bar-and-whisker I-beam. Vertical caps at
// xScale(baselineEnd) AND xScale(forecastEnd); thin horizontal
// connector running between them. Length of the connector = slip
// magnitude visually (longer connector = bigger slip). Neutral dark
// grey (#444) — magnitude is encoded in I-beam LENGTH, no semantic
// color needed.
//
// Renders ONLY for shifted activities (those passed in shiftedSet via
// renderBars + verified non-negligible slip via computeSlip). For
// every non-shifted row, no I-beam emitted — bars render at full
// height, viewer sees a clean row.
//
// The "shifted bar shrunk 30%" + "I-beam in freed top space" combine
// to communicate "this activity has moved from plan" without color,
// without alarm, and without per-row chrome on healthy rows. Tooltip
// (extended separately) carries the narrative on hover.

const IBEAM_STROKE = "#444444";
const IBEAM_CAP_STROKE_WIDTH = 1.8;
const IBEAM_CONNECTOR_STROKE_WIDTH = 1.2;
const IBEAM_CAP_HEIGHT_PX = 7;
const IBEAM_TOP_INSET_PX = 1; // gap from row's top to I-beam top

interface IBeamDatum {
    activity: Activity;
    x1: number;       // earlier of (baselineEnd, forecastEnd)
    x2: number;       // later of the two
    yTop: number;
    yBottom: number;
    yMid: number;
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
    // I-beam sits in the freed top space of the shifted bar zone:
    // y range = [padding + IBEAM_TOP_INSET, padding + IBEAM_TOP_INSET + IBEAM_CAP_HEIGHT_PX].
    // Verify the I-beam stays inside the row by clamping its height
    // to the freed space (barH - shrunkBarH) minus the inset.
    const shrunkBarH = shiftedBarHeightFor(rowHeight);
    const freedTopH = barH - shrunkBarH;
    const capH = Math.max(3, Math.min(IBEAM_CAP_HEIGHT_PX, freedTopH - IBEAM_TOP_INSET_PX));

    const eligible: IBeamDatum[] = [];
    for (const a of activities) {
        if (a.baselineEnd == null) continue;
        const slip = computeSlip(a.baselineEnd, a.end, thresholds);
        if (slip == null || slip.direction === "on-track") continue;
        const xBaseline = xScale(a.baselineEnd);
        const xForecast = xScale(a.end);
        const yTop = a.index * rowHeight + padding + IBEAM_TOP_INSET_PX;
        const yBottom = yTop + capH;
        eligible.push({
            activity: a,
            x1: Math.min(xBaseline, xForecast),
            x2: Math.max(xBaseline, xForecast),
            yTop,
            yBottom,
            yMid: yTop + capH / 2,
        });
    }

    return g.selectAll<SVGPathElement, IBeamDatum>("path.slip-ibeam")
        .data(eligible, (d: IBeamDatum) => d.activity.name)
        .join("path")
        .attr("class", "slip-ibeam")
        .attr("data-activity", d => d.activity.name)
        // Single path with 3 subpaths:
        //   left vertical cap   M(x1, yTop) L(x1, yBottom)
        //   horizontal connector M(x1, yMid) L(x2, yMid)
        //   right vertical cap  M(x2, yTop) L(x2, yBottom)
        .attr("d", d =>
            `M${d.x1},${d.yTop} L${d.x1},${d.yBottom} ` +
            `M${d.x1},${d.yMid} L${d.x2},${d.yMid} ` +
            `M${d.x2},${d.yTop} L${d.x2},${d.yBottom}`
        )
        .attr("fill", "none")
        .attr("stroke", IBEAM_STROKE)
        .attr("stroke-width", IBEAM_CAP_STROKE_WIDTH)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");
}
