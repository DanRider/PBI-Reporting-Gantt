"use strict";

import { Selection } from "d3-selection";
import { ColorContext, typeColor } from "../../utils/colors";
import { symbolPath, readableStrokeColor } from "../../utils/symbols";
import { FontStyle, applyFont, measureTextWidth } from "../../utils/font";

export const LEGEND_HEIGHT = 24;

const SYMBOL_TO_LABEL_GAP = 6;
const PAIR_GAP = 18;
const LEFT_INSET = 4;

// Renders the legend as a left-justified row of (symbol, type-name) pairs at the
// top-left corner of the visual. One entry per distinct milestone type found in data.
// Each entry uses the user-picked symbol + size + color from per-type milestone config.
// Font applied per the Legend Format-pane card.
export function renderLegend(
    g: Selection<SVGGElement, unknown, null, undefined>,
    distinctTypes: string[],
    colors: ColorContext,
    show: boolean,
    font: FontStyle,
    labelColor: string
): void {
    g.selectAll("*").remove();
    if (!show || distinctTypes.length === 0) return;

    const cy = LEGEND_HEIGHT / 2;
    let cursorX = LEFT_INSET;

    for (const typeName of distinctTypes) {
        const cfg = colors.milestoneConfig[typeName];
        if (!cfg) continue;
        const fill = typeColor(typeName, colors);
        const stroke = readableStrokeColor(fill);
        const size = cfg.size;

        const symbolCx = cursorX + size;
        g.append("path")
            .attr("d", symbolPath(cfg.symbol, symbolCx, cy, size))
            .attr("fill", fill)
            .attr("stroke", stroke)
            .attr("stroke-width", 0.8);

        const labelX = symbolCx + size + SYMBOL_TO_LABEL_GAP;
        const textSel = g.append("text")
            .attr("x", labelX)
            .attr("y", cy)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "central")
            .attr("fill", labelColor)
            .text(typeName);
        applyFont(textSel, font);

        const labelWidth = measureTextWidth(typeName, font);
        cursorX = labelX + labelWidth + PAIR_GAP;
    }
}
