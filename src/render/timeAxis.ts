"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { yearsInRange, quartersInRange, monthsInRange, monthLetter } from "../utils/dateScale";
import { FontStyle, applyFont } from "../utils/font";
import { readableStrokeColor } from "../utils/symbols";

// Three hierarchy levels (Year, Quarter, Month) stack vertically — only the
// visible ones are drawn, in this top-to-bottom order. The TODAY slot sits
// BETWEEN Year and the next visible level (Quarter or Month) so the TODAY label
// always has horizontal space.

const TODAY_SLOT_H = 14;
const YEAR_BAND_H = 28;
const QUARTER_BAND_H = 22;
const MONTH_BAND_H = 16;
const TIP_PX = 18;   // visible chevron tip (was 10 — too small to read)
const GAP_PX = 0;    // adjacent chevrons interlock (was 2 — visible gap broke nesting)

export interface BandTick {
    start: Date;
    end: Date;
    label: string;
}

export interface LevelToggles {
    year: boolean;
    quarter: boolean;
    month: boolean;
}

export interface LevelFills {
    year: string;
    quarter: string;
    month: string;
}

export interface TimeAxisOpts {
    levels: LevelToggles;
    fills: LevelFills;
    todayLabel: { show: boolean; color: string };
    font: FontStyle;
}

export interface AxisLayoutInfo {
    yearY: number;       // top of Year band (-1 if hidden)
    yearH: number;
    todayY: number;      // top of TODAY slot (-1 if no TODAY)
    todayH: number;
    quarterY: number;    // -1 if hidden
    quarterH: number;
    monthY: number;      // -1 if hidden
    monthH: number;
    totalH: number;      // height the axis occupies
}

// Compute axis layout from level toggles. TODAY slot only appears if at least
// one chevron level is visible (otherwise no axis = no need for TODAY).
export function computeAxisLayout(toggles: LevelToggles, todayShown: boolean): AxisLayoutInfo {
    let y = 0;
    const out: AxisLayoutInfo = {
        yearY: -1, yearH: 0,
        todayY: -1, todayH: 0,
        quarterY: -1, quarterH: 0,
        monthY: -1, monthH: 0,
        totalH: 0,
    };

    if (toggles.year) {
        out.yearY = y; out.yearH = YEAR_BAND_H;
        y += YEAR_BAND_H;
    }
    // TODAY slot fits between Year and the chevron levels (or at top if no Year)
    if (todayShown && (toggles.year || toggles.quarter || toggles.month)) {
        out.todayY = y; out.todayH = TODAY_SLOT_H;
        y += TODAY_SLOT_H;
    }
    if (toggles.quarter) {
        out.quarterY = y; out.quarterH = QUARTER_BAND_H;
        y += QUARTER_BAND_H;
    }
    if (toggles.month) {
        out.monthY = y; out.monthH = MONTH_BAND_H;
        y += MONTH_BAND_H;
    }

    out.totalH = y;
    return out;
}

// Build the chevron path. When isFirst=true, render flat-left pentagon (5 points).
// When isFirst=false, render arrow-nested chevron with triangular notch on the LEFT
// (6 points) — the previous chevron's tip slots into this notch, producing the
// continuous nested-arrow visual from the user's PowerPoint mockup.
function chevronPath(
    x1: number,
    y0: number,
    w: number,
    h: number,
    tip: number,
    isFirst: boolean
): string {
    if (isFirst) {
        return [
            `M${x1},${y0}`,
            `L${x1 + w - tip},${y0}`,
            `L${x1 + w},${y0 + h / 2}`,
            `L${x1 + w - tip},${y0 + h}`,
            `L${x1},${y0 + h}`,
            `Z`,
        ].join(" ");
    }
    return [
        `M${x1 + tip},${y0}`,
        `L${x1 + w - tip},${y0}`,
        `L${x1 + w},${y0 + h / 2}`,
        `L${x1 + w - tip},${y0 + h}`,
        `L${x1 + tip},${y0 + h}`,
        `L${x1},${y0 + h / 2}`,
        `Z`,
    ].join(" ");
}

function renderBand(
    g: Selection<SVGGElement, unknown, null, undefined>,
    ticks: BandTick[],
    xScale: ScaleTime<number, number>,
    domain: [Date, Date],
    bandY: number,
    bandH: number,
    fill: string,
    font: FontStyle,
    levelClass: string
): void {
    const stroke = readableStrokeColor(fill);
    const labelFill = stroke;
    const tip = Math.max(4, Math.min(TIP_PX, Math.round(bandH * 0.45)));
    const xMin = xScale(domain[0]);
    const xMax = xScale(domain[1]);

    let isFirstChevron = true;

    for (const t of ticks) {
        // Clamp the tick's effective range to the visible domain so a year that
        // extends before/after domain bounds doesn't extrapolate to negative x
        // or beyond the right edge (was overrunning the legend area in v1.3.0).
        const startRaw = xScale(t.start);
        const endRaw = xScale(t.end);
        if (endRaw <= xMin || startRaw >= xMax) continue;
        const startX = Math.max(startRaw, xMin);
        const endX = Math.min(endRaw, xMax);

        const w = (endX - startX) - GAP_PX;
        if (w <= 0) continue;
        const tipUsed = Math.min(tip, w / 2);

        // The first VISIBLE chevron in the band gets flat-left geometry.
        // Float-tolerant comparison: if the clamped startX equals xMin (chart left edge),
        // this is the first chevron of the row.
        const isFirst = isFirstChevron && Math.abs(startX - xMin) < 0.5;

        g.append("path")
            .attr("class", `${levelClass}-chevron`)
            .attr("d", chevronPath(startX, bandY, w, bandH, tipUsed, isFirst))
            .attr("fill", fill)
            .attr("stroke", "rgba(255,255,255,0.4)")
            .attr("stroke-width", 0.5);

        // Label centered in the chevron's body region (excluding the right tip).
        // For nested chevrons, also account for the left notch: label's effective
        // horizontal range is [startX + (isFirst ? 0 : tipUsed), startX + w - tipUsed].
        const labelLeftInset = isFirst ? 0 : tipUsed;
        const labelMidX = startX + labelLeftInset + (w - tipUsed - labelLeftInset) / 2;
        const sel = g.append("text")
            .attr("class", `${levelClass}-label`)
            .attr("x", labelMidX)
            .attr("y", bandY + bandH / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", labelFill)
            .text(t.label);
        applyFont(sel, font);

        isFirstChevron = false;
    }
}

export function renderTimeAxis(
    g: Selection<SVGGElement, unknown, null, undefined>,
    xScale: ScaleTime<number, number>,
    domain: [Date, Date],
    now: Date | null,
    opts: TimeAxisOpts
): AxisLayoutInfo {
    g.selectAll("*").remove();

    const todayShown = opts.todayLabel.show && now != null
        && now.getTime() >= domain[0].getTime() && now.getTime() <= domain[1].getTime();
    const layout = computeAxisLayout(opts.levels, todayShown);

    // YEAR band (largest font)
    if (layout.yearY >= 0) {
        const yearTicks: BandTick[] = yearsInRange(domain).map(yb => ({
            start: yb.start, end: yb.end, label: String(yb.year),
        }));
        renderBand(g, yearTicks, xScale, domain, layout.yearY, layout.yearH, opts.fills.year, opts.font, "year");
    }

    // QUARTER band (mid font — 92% of card font)
    if (layout.quarterY >= 0) {
        const qTicks: BandTick[] = quartersInRange(domain).map(qb => ({
            start: qb.start, end: qb.end, label: `Q${qb.quarter}`,
        }));
        const qFont: FontStyle = { ...opts.font, fontSize: Math.max(9, Math.round(opts.font.fontSize * 0.92)) };
        renderBand(g, qTicks, xScale, domain, layout.quarterY, layout.quarterH, opts.fills.quarter, qFont, "quarter");
    }

    // MONTH band (smallest font — single-letter labels)
    if (layout.monthY >= 0) {
        const mTicks: BandTick[] = monthsInRange(domain).map(mb => ({
            start: mb.start, end: mb.end, label: monthLetter(mb.month),
        }));
        const mFont: FontStyle = { ...opts.font, fontSize: Math.max(8, Math.round(opts.font.fontSize * 0.78)) };
        renderBand(g, mTicks, xScale, domain, layout.monthY, layout.monthH, opts.fills.month, mFont, "month");
    }

    // TODAY label (right-anchored at xNow so the "|" sits on the line)
    if (layout.todayY >= 0 && now) {
        const xNow = xScale(now);
        const todayFont: FontStyle = { ...opts.font, fontSize: Math.max(9, Math.round(opts.font.fontSize * 0.85)) };
        const tSel = g.append("text")
            .attr("class", "today-axis-label")
            .attr("x", xNow + 2)
            .attr("y", layout.todayY + layout.todayH / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "central")
            .attr("fill", opts.todayLabel.color)
            .text("TODAY |");
        applyFont(tSel, todayFont);
    }

    return layout;
}
