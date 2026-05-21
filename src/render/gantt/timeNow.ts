"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { quartersInRange, monthsInRange } from "../../utils/dateScale";

const NOW_LINE_DASH = "4,3";

export type GridlineStyle = "solid" | "dashed" | "dotted";

export interface GridlineOptions {
    show: boolean;
    color: string;
    opacity: number;       // 0..1
    style: GridlineStyle;
}

export interface TimeNowOptions {
    showTodayLine: boolean;
    todayLineColor: string;
    showPastShading: boolean;
    pastFillColor: string;
    pastOpacity: number;
    showFutureShading: boolean;
    futureFillColor: string;
    futureOpacity: number;
    quarterGridlines: GridlineOptions;
    monthGridlines: GridlineOptions;
}

function dashArrayFor(style: GridlineStyle): string | null {
    switch (style) {
        case "solid":  return null;
        case "dashed": return "5,4";
        case "dotted": return "1,3";
    }
}

function renderGridlineSet(
    g: Selection<SVGGElement, unknown, null, undefined>,
    boundaries: Date[],
    xScale: ScaleTime<number, number>,
    bodyHeight: number,
    opts: GridlineOptions,
    cls: string
): void {
    if (!opts.show || opts.opacity <= 0) return;
    const dash = dashArrayFor(opts.style);
    for (const b of boundaries) {
        const x = xScale(b);
        const line = g.append("line")
            .attr("class", cls)
            .attr("x1", x).attr("x2", x)
            .attr("y1", 0).attr("y2", bodyHeight)
            .attr("stroke", opts.color)
            .attr("stroke-opacity", opts.opacity)
            .attr("stroke-width", 1);
        if (dash) line.attr("stroke-dasharray", dash);
    }
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

    // Quarter gridlines — boundaries are quarter STARTS (skip the very first if it would
    // overlap the leftmost edge — typically not visible since chart starts at the boundary)
    const quarterStarts = quartersInRange(domain).map(qb => qb.start);
    renderGridlineSet(g, quarterStarts, xScale, bodyHeight, opts.quarterGridlines, "quarter-gridline");

    // Month gridlines — same pattern
    const monthStarts = monthsInRange(domain).map(mb => mb.start);
    renderGridlineSet(g, monthStarts, xScale, bodyHeight, opts.monthGridlines, "month-gridline");

    // TODAY line — drawn on top of gridlines
    if (opts.showTodayLine && inDomain) {
        g.append("line")
            .attr("x1", xNow).attr("x2", xNow)
            .attr("y1", 0).attr("y2", bodyHeight)
            .attr("stroke", opts.todayLineColor)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", NOW_LINE_DASH);
    }
}
