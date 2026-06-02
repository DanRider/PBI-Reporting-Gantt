"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../../viewmodel";

// INF-3787 Phase 2 — glide-path layer #3: slip-chevron.
//
// Renders a single chevron path per activity that has a baselineEnd
// bound AND a slip magnitude above the negligible threshold. The chevron
// points in the direction of drift: right (>) when the forecast end is
// AFTER the baseline end (slipping later), left (<) when the forecast
// end is BEFORE the baseline end (pulled in earlier). Color is semantic
// per the slip-magnitude category.
//
// Slip thresholds (Decision #3 in INF-3791 build brief):
//   |slip| <= 2d  → negligible (skip — no chevron renders; on-track is
//                   implicit when no chevron is present)
//   |slip| <= 7d  → minor
//   |slip| <= 30d → major
//   |slip| >  30d → critical
//
// Pulled-in slips use the same magnitude bands but a single
// "pulled-in" hue (typically read as positive in PM contexts: "ahead
// of schedule"). Slipping uses warming-tone semantic colors (yellow →
// orange → red) per the brief.
//
// Slip categorization is INLINE here for Phase 2 self-containedness.
// Phase 3's src/model/activityState.ts will introduce a shared
// computeSlip() function; the verb will then import it and the inline
// helpers below will be deleted in that commit. Format-pane configurable
// thresholds (Decision #3, exposed for override) land in Phase 4.

const MS_PER_DAY = 86_400_000;

const SLIP_NEGLIGIBLE_DAYS = 2;
const SLIP_MINOR_DAYS = 7;
const SLIP_MAJOR_DAYS = 30;

const COLOR_MINOR_SLIP = "#d4a017";    // yellow-ish — minor slip
const COLOR_MAJOR_SLIP = "#d97706";    // orange    — major slip
const COLOR_CRITICAL_SLIP = "#b91c1c"; // red       — critical slip
const COLOR_PULLED_IN = "#16a34a";     // green     — ahead of schedule (any magnitude)

const CHEVRON_SIZE_PX = 8;
const CHEVRON_STROKE_WIDTH = 2;
const CHEVRON_X_OFFSET_PX = 4; // gap between forecast-bar end and chevron anchor

export type SlipMagnitude = "negligible" | "minor" | "major" | "critical";
export type SlipDirection = "slipping" | "on-track" | "pulled-in";

interface SlipCategory {
    direction: SlipDirection;
    magnitude: SlipMagnitude;
    color: string;
}

function daysBetween(later: Date, earlier: Date): number {
    return (later.getTime() - earlier.getTime()) / MS_PER_DAY;
}

function categorizeSlip(slipDays: number): SlipCategory {
    const abs = Math.abs(slipDays);
    let magnitude: SlipMagnitude;
    if (abs <= SLIP_NEGLIGIBLE_DAYS) magnitude = "negligible";
    else if (abs <= SLIP_MINOR_DAYS) magnitude = "minor";
    else if (abs <= SLIP_MAJOR_DAYS) magnitude = "major";
    else magnitude = "critical";

    let direction: SlipDirection;
    if (magnitude === "negligible") direction = "on-track";
    else direction = slipDays > 0 ? "slipping" : "pulled-in";

    let color: string;
    if (direction === "on-track") color = COLOR_PULLED_IN; // unused (filtered out)
    else if (direction === "pulled-in") color = COLOR_PULLED_IN;
    else if (magnitude === "critical") color = COLOR_CRITICAL_SLIP;
    else if (magnitude === "major") color = COLOR_MAJOR_SLIP;
    else color = COLOR_MINOR_SLIP;

    return { direction, magnitude, color };
}

interface ChevronDatum {
    activity: Activity;
    slipDays: number;
    category: SlipCategory;
    anchorX: number;
    anchorY: number;
}

function chevronPath(anchorX: number, anchorY: number, size: number, dir: SlipDirection): string {
    const half = size / 2;
    if (dir === "slipping") {
        // > shape — base on the left, tip on the right
        return `M${anchorX - half},${anchorY - half} L${anchorX + half},${anchorY} L${anchorX - half},${anchorY + half}`;
    } else {
        // < shape — base on the right, tip on the left (pulled-in)
        return `M${anchorX + half},${anchorY - half} L${anchorX - half},${anchorY} L${anchorX + half},${anchorY + half}`;
    }
}

export function renderSlipChevrons(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    // colors arg accepted for signature uniformity with other glide verbs;
    // chevron color is semantic (computed per slip magnitude), not
    // derived from lane palette.
    _colors: unknown
): Selection<SVGPathElement, ChevronDatum, SVGGElement, unknown> {
    const eligible: ChevronDatum[] = [];
    for (const a of activities) {
        if (a.baselineEnd == null) continue;
        const slipDays = daysBetween(a.end, a.baselineEnd);
        const category = categorizeSlip(slipDays);
        if (category.direction === "on-track") continue; // negligible → skip
        const baseAnchorX = xScale(a.end);
        const anchorX = baseAnchorX + (category.direction === "slipping"
            ? CHEVRON_X_OFFSET_PX
            : -CHEVRON_X_OFFSET_PX);
        const anchorY = a.index * rowHeight + rowHeight / 2;
        eligible.push({ activity: a, slipDays, category, anchorX, anchorY });
    }

    return g.selectAll<SVGPathElement, ChevronDatum>("path.slip-chevron")
        .data(eligible, (d: ChevronDatum) => d.activity.name)
        .join("path")
        .attr("class", "slip-chevron")
        .attr("data-activity", d => d.activity.name)
        .attr("data-slip-days", d => d.slipDays.toFixed(2))
        .attr("data-slip-magnitude", d => d.category.magnitude)
        .attr("data-slip-direction", d => d.category.direction)
        .attr("d", d => chevronPath(d.anchorX, d.anchorY, CHEVRON_SIZE_PX, d.category.direction))
        .attr("fill", "none")
        .attr("stroke", d => d.category.color)
        .attr("stroke-width", CHEVRON_STROKE_WIDTH)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("pointer-events", "none");
}
