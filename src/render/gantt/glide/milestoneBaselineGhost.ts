"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Milestone } from "../../../viewmodel";
import { typeColor, ColorContext } from "../../../utils/colors";
import { symbolPath } from "../../../utils/symbols";

// INF-3787 Phase 5 re-spec — milestone baseline ghost + connector.
//
// MS Project Tracking Gantt convention. For each milestone with a
// baselineDate bound, renders:
//   - a thin connector line from baselineDate x to current x at the
//     milestone's parent row y (drawn FIRST so markers paint over its
//     endpoints)
//   - a HOLLOW outline marker at the baselineDate x-position (same
//     symbol shape + size as the type's current marker; fill = none,
//     stroke = type color)
// The current solid marker is unchanged — rendered by the existing
// renderMilestones path in src/render/gantt/milestones.ts.
//
// Reads cleanly to any MS-Project user: "the milestone was here,
// now it's here." More visual weight than the activity baseline-tick
// is intentional — milestones moving is news, not normal drift.
//
// Filters out milestones with no baselineDate AND milestones where
// baselineDate === date (no shift to communicate; rendering would
// overlap exactly with the current marker).

const GHOST_STROKE_WIDTH = 1.5;
const CONNECTOR_STROKE_WIDTH = 1;
const CONNECTOR_STROKE_DASHARRAY = "2 2";

interface GhostDatum {
    milestone: Milestone;
    cx: number;       // baseline x
    currentCx: number; // current x (for connector endpoint)
    cy: number;
    color: string;
    size: number;
}

function rowCenterY(parentRowIndex: number, rowHeight: number): number {
    return parentRowIndex * rowHeight + rowHeight / 2;
}

export function renderMilestoneBaselineGhosts(
    g: Selection<SVGGElement, unknown, null, undefined>,
    milestones: Milestone[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext,
): void {
    const eligible: GhostDatum[] = [];
    for (const m of milestones) {
        if (m.parentRowIndex === -1) continue;
        if (m.baselineDate == null) continue;
        if (m.baselineDate.getTime() === m.date.getTime()) continue; // no shift
        const cfg = colors.milestoneConfig[m.type];
        if (cfg == null || !cfg.showMarker) continue;
        eligible.push({
            milestone: m,
            cx: xScale(m.baselineDate),
            currentCx: xScale(m.date),
            cy: rowCenterY(m.parentRowIndex, rowHeight),
            color: typeColor(m.type, colors),
            size: cfg.size,
        });
    }

    // Connectors first (z-bottom).
    g.selectAll<SVGLineElement, GhostDatum>("line.milestone-baseline-connector")
        .data(eligible, (d: GhostDatum) => d.milestone.id)
        .join("line")
        .attr("class", "milestone-baseline-connector")
        .attr("data-milestone-id", d => d.milestone.id)
        .attr("x1", d => d.cx)
        .attr("x2", d => d.currentCx)
        .attr("y1", d => d.cy)
        .attr("y2", d => d.cy)
        .attr("stroke", d => d.color)
        .attr("stroke-width", CONNECTOR_STROKE_WIDTH)
        .attr("stroke-dasharray", CONNECTOR_STROKE_DASHARRAY)
        .attr("stroke-linecap", "round")
        .attr("pointer-events", "none");

    // Hollow ghost markers (z-top within this layer; current solid
    // markers drawn by renderMilestones in a separate group will paint
    // over the connector endpoint at currentCx — that's intentional).
    g.selectAll<SVGPathElement, GhostDatum>("path.milestone-baseline-ghost")
        .data(eligible, (d: GhostDatum) => d.milestone.id)
        .join("path")
        .attr("class", "milestone-baseline-ghost")
        .attr("data-milestone-id", d => d.milestone.id)
        .attr("d", d => symbolPath(colors.milestoneConfig[d.milestone.type].symbol, d.cx, d.cy, d.size))
        .attr("fill", "none")
        .attr("stroke", d => d.color)
        .attr("stroke-width", GHOST_STROKE_WIDTH)
        .attr("pointer-events", "none");
}
