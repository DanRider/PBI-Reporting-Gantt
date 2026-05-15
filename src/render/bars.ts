"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../viewmodel";
import { areaColor, ColorContext } from "../utils/colors";

const BAR_RADIUS = 6;

export function barHeightFor(rowHeight: number): number {
    return Math.max(8, Math.floor(rowHeight * 0.78));
}

export function renderBars(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext
): Selection<SVGRectElement, Activity, SVGGElement, unknown> {
    const barH = barHeightFor(rowHeight);
    const padding = (rowHeight - barH) / 2;
    const rx = Math.min(BAR_RADIUS, Math.floor(barH / 2));

    return g.selectAll<SVGRectElement, Activity>("rect.activity-bar")
        .data(activities, (a: Activity) => a.name)
        .join("rect")
        .attr("class", "activity-bar")
        .attr("data-activity", a => a.name)
        .attr("x", a => xScale(a.start))
        .attr("y", a => a.index * rowHeight + padding)
        .attr("width", a => Math.max(0, xScale(a.end) - xScale(a.start)))
        .attr("height", barH)
        .attr("rx", rx)
        .attr("ry", rx)
        .attr("fill", a => areaColor(a.area, colors));
}
