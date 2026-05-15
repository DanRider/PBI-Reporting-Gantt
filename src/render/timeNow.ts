"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";

const NOW_LINE_DASH = "4,3";

export interface TimeNowOptions {
    showTodayLine: boolean;
    todayLineColor: string;
    showPastShading: boolean;
    pastFillColor: string;
    pastOpacity: number;     // 0..1
    showFutureShading: boolean;
    futureFillColor: string;
    futureOpacity: number;   // 0..1
}

export function renderTimeNow(
    g: Selection<SVGGElement, unknown, null, undefined>,
    xScale: ScaleTime<number, number>,
    domain: [Date, Date],
    bodyHeight: number,
    opts: TimeNowOptions,
    now: Date = new Date()
): void {
    g.selectAll("*").remove();

    const nowT = now.getTime();
    const inDomain = nowT >= domain[0].getTime() && nowT <= domain[1].getTime();

    const xLeft = xScale(domain[0]);
    const xRight = xScale(domain[1]);
    const xNow = inDomain ? xScale(now) : (nowT < domain[0].getTime() ? xLeft : xRight);

    if (opts.showPastShading && opts.pastOpacity > 0) {
        const w = Math.max(0, xNow - xLeft);
        if (w > 0) {
            g.append("rect")
                .attr("x", xLeft).attr("y", 0)
                .attr("width", w)
                .attr("height", bodyHeight)
                .attr("fill", opts.pastFillColor)
                .attr("fill-opacity", opts.pastOpacity);
        }
    }

    if (opts.showFutureShading && opts.futureOpacity > 0) {
        const w = Math.max(0, xRight - xNow);
        if (w > 0) {
            g.append("rect")
                .attr("x", xNow).attr("y", 0)
                .attr("width", w)
                .attr("height", bodyHeight)
                .attr("fill", opts.futureFillColor)
                .attr("fill-opacity", opts.futureOpacity);
        }
    }

    if (opts.showTodayLine && inDomain) {
        g.append("line")
            .attr("x1", xNow).attr("x2", xNow)
            .attr("y1", 0).attr("y2", bodyHeight)
            .attr("stroke", opts.todayLineColor)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", NOW_LINE_DASH);
    }
}
