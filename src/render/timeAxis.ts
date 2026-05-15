"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { yearsInRange, quartersInRange } from "../utils/dateScale";
import { FontStyle, applyFont } from "../utils/font";

export interface AxisLayout {
    yearBandY: number;
    yearBandH: number;
    todaySlotY: number;
    todaySlotH: number;
    quarterBandY: number;
    quarterBandH: number;
}

export const AXIS_DEFAULTS: AxisLayout = {
    yearBandY: 0,
    yearBandH: 22,
    todaySlotY: 22,
    todaySlotH: 14,
    quarterBandY: 36,
    quarterBandH: 24,
};

export function axisTotalHeight(layout: AxisLayout = AXIS_DEFAULTS): number {
    return layout.yearBandH + layout.todaySlotH + layout.quarterBandH;
}

export interface TodayLabelOpts {
    show: boolean;
    color: string;
}

export interface TimeAxisOpts {
    todayLabel: TodayLabelOpts;
    axisLabelColor: string;
    font: FontStyle;        // applied to year + quarter labels (and TODAY label)
}

export function renderTimeAxis(
    g: Selection<SVGGElement, unknown, null, undefined>,
    xScale: ScaleTime<number, number>,
    domain: [Date, Date],
    now: Date | null,
    opts: TimeAxisOpts,
    layout: AxisLayout = AXIS_DEFAULTS
): void {
    g.selectAll("*").remove();

    const years = yearsInRange(domain);
    const quarters = quartersInRange(domain);

    const xMin = xScale(domain[0]);
    const xMax = xScale(domain[1]);

    for (const yb of years) {
        const x1 = Math.max(xScale(yb.start), xMin);
        const x2 = Math.min(xScale(yb.end), xMax);
        const w = x2 - x1;
        if (w <= 0) continue;

        g.append("rect")
            .attr("class", "year-bg")
            .attr("x", x1)
            .attr("y", layout.yearBandY)
            .attr("width", w)
            .attr("height", layout.yearBandH)
            .attr("fill", "#e8e8e8")
            .attr("stroke", "#bbb")
            .attr("stroke-width", 0.5);

        const textSel = g.append("text")
            .attr("class", "year-label")
            .attr("x", x1 + w / 2)
            .attr("y", layout.yearBandY + layout.yearBandH / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", opts.axisLabelColor)
            .text(String(yb.year));
        applyFont(textSel, opts.font);
    }

    if (opts.todayLabel.show && now && now.getTime() >= domain[0].getTime() && now.getTime() <= domain[1].getTime()) {
        const xNow = xScale(now);
        const todayFont: FontStyle = {
            ...opts.font,
            fontSize: Math.max(9, Math.round(opts.font.fontSize * 0.85)),
        };
        const tSel = g.append("text")
            .attr("class", "today-axis-label")
            .attr("x", xNow + 2)
            .attr("y", layout.todaySlotY + layout.todaySlotH / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "central")
            .attr("fill", opts.todayLabel.color)
            .text("TODAY |");
        applyFont(tSel, todayFont);
    }

    const TIP_PX = 10;
    const GAP_PX = 2;

    for (const qb of quarters) {
        const x1 = xScale(qb.start);
        const x2 = xScale(qb.end);
        const w = (x2 - x1) - GAP_PX;
        if (w <= 0) continue;

        const y0 = layout.quarterBandY;
        const h = layout.quarterBandH;
        const tip = Math.min(TIP_PX, w / 2);

        const points = [
            `${x1},${y0}`,
            `${x1 + w - tip},${y0}`,
            `${x1 + w},${y0 + h / 2}`,
            `${x1 + w - tip},${y0 + h}`,
            `${x1},${y0 + h}`,
        ].join(" ");

        g.append("polygon")
            .attr("class", "quarter-chevron")
            .attr("points", points)
            .attr("fill", "#d0d0d0")
            .attr("stroke", "#999")
            .attr("stroke-width", 0.5);

        const qFont: FontStyle = {
            ...opts.font,
            fontSize: Math.max(9, Math.round(opts.font.fontSize * 0.92)),
        };
        const qSel = g.append("text")
            .attr("class", "quarter-label")
            .attr("x", x1 + (w - tip) / 2)
            .attr("y", y0 + h / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", opts.axisLabelColor)
            .text(`Q${qb.quarter}`);
        applyFont(qSel, qFont);
    }
}
