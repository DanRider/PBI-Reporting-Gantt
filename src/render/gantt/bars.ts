"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../viewmodel";
import { areaColor, ColorContext } from "../../utils/colors";

const BAR_RADIUS = 6;
const SHIFTED_BAR_HEIGHT_FRACTION = 0.7; // 30% shrink — frees top space for the slip I-beam

export function barHeightFor(rowHeight: number): number {
    return Math.max(8, Math.floor(rowHeight * 0.78));
}

/** INF-3787 Phase 5 re-spec — bar height when the activity has a
 *  non-negligible slip and is rendered in the "shifted" treatment.
 *  Anchored at the BOTTOM of the normal bar zone so the I-beam has
 *  consistent freed space at the top. */
export function shiftedBarHeightFor(rowHeight: number): number {
    return Math.max(8, Math.floor(barHeightFor(rowHeight) * SHIFTED_BAR_HEIGHT_FRACTION));
}

export function renderBars(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext,
    // INF-3787 — optional set of activity names that should render
    // SHIFTED (height = 70% of normal, anchored at row bottom so the
    // freed top space hosts the slip I-beam). Backward-compatible
    // default: empty set → every bar renders at full height.
    shiftedSet: Set<string> = new Set()
): Selection<SVGRectElement, Activity, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const shrunkBarH = shiftedBarHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;
    // Bottom-anchored: shifted bar y = padding + (barH - shrunkBarH).
    const shiftedYOffset = padding + (barH - shrunkBarH);
    const rx = Math.min(BAR_RADIUS, Math.floor(barH / 2));
    const shrunkRx = Math.min(BAR_RADIUS, Math.floor(shrunkBarH / 2));

    return g.selectAll<SVGRectElement, Activity>("rect.activity-bar")
        .data(activities, (a: Activity) => a.name)
        .join("rect")
        .attr("class", a => shiftedSet.has(a.name) ? "activity-bar activity-bar-shifted" : "activity-bar")
        .attr("data-activity", a => a.name)
        .attr("x", a => xScale(a.start))
        .attr("y", a => a.index * rowHeight + (shiftedSet.has(a.name) ? shiftedYOffset : padding))
        .attr("width", a => Math.max(0, xScale(a.end) - xScale(a.start)))
        .attr("height", a => shiftedSet.has(a.name) ? shrunkBarH : barH)
        .attr("rx", a => shiftedSet.has(a.name) ? shrunkRx : rx)
        .attr("ry", a => shiftedSet.has(a.name) ? shrunkRx : rx)
        // v2.1 audit-fix #8 — bars KEEP lane color (orchestrator: "i wanted to
        // keep the bars their original green color so they have a visual
        // reference back to the parent"). Per-activity color lives on the
        // lollipop dot + label text + panel + table tints, not on the bars.
        .attr("fill", a => areaColor(a.area, colors));
}
