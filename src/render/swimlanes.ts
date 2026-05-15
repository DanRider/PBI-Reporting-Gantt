"use strict";

import { Selection } from "d3-selection";
import { AreaGroup } from "../viewmodel";
import { areaColor, ColorContext } from "../utils/colors";

// Default rail width — used as fallback. Actual width is now passed in from
// the dynamic layout calculation in visual.ts.
export const DEFAULT_LEFT_RAIL_WIDTH = 130;

const LABEL_BAND_LEFT_PADDING = 8;     // gap from rail's left edge to label text
const RAIL_TO_RIGHT_GAP = 12;          // gap from rail line to the rail's right edge

const RAIL_STROKE_WIDTH = 4;
const CIRCLE_RADIUS = 8;
const LABEL_FONT_SIZE = 13;
const LABEL_LINE_HEIGHT = 16;

export function renderSwimlanes(
    g: Selection<SVGGElement, unknown, null, undefined>,
    areaGroups: AreaGroup[],
    rowHeight: number,
    colors: ColorContext,
    show: boolean,
    railWidth: number,
    wrapText: boolean = true
): void {
    g.selectAll("*").remove();
    if (!show) return;

    const railLineX = railWidth - RAIL_TO_RIGHT_GAP;
    const labelBandLeft = LABEL_BAND_LEFT_PADDING;
    const labelBandRight = railLineX - 8;
    const textX = (labelBandLeft + labelBandRight) / 2;

    for (const group of areaGroups) {
        const color = areaColor(group.area, colors);
        const yTop = group.startRowIndex * rowHeight + rowHeight / 2;
        const yBottom = group.endRowIndex * rowHeight + rowHeight / 2;
        const yCenter = (yTop + yBottom) / 2;

        // wrapText=true: each word on its own line (current). false: single line.
        const lines = wrapText
            ? group.area.split(/\s+/).filter(w => w.length > 0)
            : [group.area];
        const totalH = lines.length * LABEL_LINE_HEIGHT;
        const startY = yCenter - totalH / 2 + LABEL_LINE_HEIGHT / 2;
        for (let i = 0; i < lines.length; i++) {
            g.append("text")
                .attr("class", "swimlane-label")
                .attr("x", textX)
                .attr("y", startY + i * LABEL_LINE_HEIGHT)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("font-size", LABEL_FONT_SIZE)
                .attr("font-weight", "bold")
                .attr("fill", color)
                .text(lines[i]);
        }

        g.append("line")
            .attr("class", "swimlane-rail")
            .attr("x1", railLineX).attr("x2", railLineX)
            .attr("y1", yTop).attr("y2", yBottom)
            .attr("stroke", color)
            .attr("stroke-width", RAIL_STROKE_WIDTH)
            .attr("stroke-linecap", "round");

        g.append("circle")
            .attr("cx", railLineX).attr("cy", yTop)
            .attr("r", CIRCLE_RADIUS)
            .attr("fill", color);
        g.append("circle")
            .attr("cx", railLineX).attr("cy", yBottom)
            .attr("r", CIRCLE_RADIUS)
            .attr("fill", color);
    }
}
