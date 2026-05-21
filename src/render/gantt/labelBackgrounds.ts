"use strict";

import { Selection } from "d3-selection";
import { RenderedLabel } from "./milestones";
import { barHeightFor } from "./bars";

const BG_FILL = "#707070";       // medium-dark grey — readable behind white text
const BG_RX = 6;                  // matches bar corner radius
const HORIZONTAL_PADDING = 4;     // small breathing room around the text
const VERTICAL_PADDING = 0;       // vertically match bar height exactly

/**
 * Render a rounded grey rect behind each milestone label.
 * Bars (rendered AFTER this layer) cover whatever portion of the rect overlaps
 * a bar's x-range. The grey shows only where the label extends into whitespace.
 */
export function renderLabelBackgrounds(
    g: Selection<SVGGElement, unknown, null, undefined>,
    rendered: RenderedLabel[],
    rowHeight: number
): void {
    g.selectAll("*").remove();
    const barH = barHeightFor(rowHeight) + VERTICAL_PADDING * 2;
    const yOffset = (rowHeight - barH) / 2;

    for (const r of rendered) {
        const rowIdx = r.milestone.parentRowIndex;
        if (rowIdx < 0) continue;

        const leftX = r.anchor === "end" ? r.x - r.width : r.x;
        const x = leftX - HORIZONTAL_PADDING;
        const width = r.width + HORIZONTAL_PADDING * 2;
        const y = rowIdx * rowHeight + yOffset;

        g.append("rect")
            .attr("class", "label-bg")
            .attr("data-milestone-id", r.milestone.id)
            .attr("x", x)
            .attr("y", y)
            .attr("width", width)
            .attr("height", barH)
            .attr("rx", BG_RX)
            .attr("ry", BG_RX)
            .attr("fill", BG_FILL);
    }
}
