"use strict";

import { Selection } from "d3-selection";
import { AreaGroup } from "../viewmodel";
import { areaColor, ColorContext } from "../utils/colors";
import { FontStyle, applyFont } from "../utils/font";

export const DEFAULT_LEFT_RAIL_WIDTH = 130;

const LABEL_BAND_LEFT_PADDING = 8;
const RAIL_TO_RIGHT_GAP = 12;

const RAIL_STROKE_WIDTH = 4;
const CIRCLE_RADIUS = 8;
const LABEL_LINE_HEIGHT_FACTOR = 1.25;

export interface SwimlaneOptions {
    show: boolean;
    wrapText: boolean;
    useAreaColor: boolean;
    labelColor: string;
    font: FontStyle;
}

export function renderSwimlanes(
    g: Selection<SVGGElement, unknown, null, undefined>,
    areaGroups: AreaGroup[],
    rowHeight: number,
    colors: ColorContext,
    railWidth: number,
    opts: SwimlaneOptions
): void {
    g.selectAll("*").remove();
    if (!opts.show) return;

    const railLineX = railWidth - RAIL_TO_RIGHT_GAP;
    const labelBandLeft = LABEL_BAND_LEFT_PADDING;
    const labelBandRight = railLineX - 8;
    const textX = (labelBandLeft + labelBandRight) / 2;
    const lineHeight = Math.max(opts.font.fontSize * LABEL_LINE_HEIGHT_FACTOR, opts.font.fontSize + 3);

    for (const group of areaGroups) {
        const railColor = areaColor(group.area, colors);
        const labelFill = opts.useAreaColor ? railColor : opts.labelColor;
        const yTop = group.startRowIndex * rowHeight + rowHeight / 2;
        const yBottom = group.endRowIndex * rowHeight + rowHeight / 2;
        const yCenter = (yTop + yBottom) / 2;

        const lines = opts.wrapText
            ? group.area.split(/\s+/).filter(w => w.length > 0)
            : [group.area];
        const totalH = lines.length * lineHeight;
        const startY = yCenter - totalH / 2 + lineHeight / 2;
        for (let i = 0; i < lines.length; i++) {
            const textSel = g.append("text")
                .attr("class", "swimlane-label")
                .attr("x", textX)
                .attr("y", startY + i * lineHeight)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("fill", labelFill)
                .text(lines[i]);
            applyFont(textSel, opts.font);
        }

        g.append("line")
            .attr("class", "swimlane-rail")
            .attr("x1", railLineX).attr("x2", railLineX)
            .attr("y1", yTop).attr("y2", yBottom)
            .attr("stroke", railColor)
            .attr("stroke-width", RAIL_STROKE_WIDTH)
            .attr("stroke-linecap", "round");

        g.append("circle")
            .attr("cx", railLineX).attr("cy", yTop)
            .attr("r", CIRCLE_RADIUS)
            .attr("fill", railColor);
        g.append("circle")
            .attr("cx", railLineX).attr("cy", yBottom)
            .attr("r", CIRCLE_RADIUS)
            .attr("fill", railColor);
    }
}
