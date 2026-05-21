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
// v2.1 audit-fix #9 — legend entries are now toggle buttons. Clicking
// an entry calls onToggleType(typeName); the caller updates its
// hiddenTypes set and re-renders. Hidden types are dimmed (opacity 0.3)
// in the legend AND in the milestone renderer.
export function renderLegend(
    g: Selection<SVGGElement, unknown, null, undefined>,
    distinctTypes: string[],
    colors: ColorContext,
    show: boolean,
    font: FontStyle,
    labelColor: string,
    hiddenTypes?: ReadonlySet<string>,
    onToggleType?: (typeName: string) => void,
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

        const isHidden = hiddenTypes?.has(typeName) ?? false;
        const isClickable = onToggleType != null;

        // Wrap each entry (symbol + label) in a <g> so we can apply group
        // opacity for the dim state and attach a single click handler.
        const entry = g.append("g")
            .attr("class", "legend-entry")
            .attr("data-type", typeName)
            .style("opacity", isHidden ? 0.3 : 1)
            .style("cursor", isClickable ? "pointer" : "default");

        const symbolCx = cursorX + size;
        entry.append("path")
            .attr("d", symbolPath(cfg.symbol, symbolCx, cy, size))
            .attr("fill", fill)
            .attr("stroke", stroke)
            .attr("stroke-width", 0.8)
            .style("pointer-events", "bounding-box");

        const labelX = symbolCx + size + SYMBOL_TO_LABEL_GAP;
        const textSel = entry.append("text")
            .attr("x", labelX)
            .attr("y", cy)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "central")
            .attr("fill", labelColor)
            .style("pointer-events", "bounding-box")
            .text(typeName);
        applyFont(textSel, font);

        // Attach click handler to the whole entry group so clicking either
        // the symbol OR the label fires the toggle. stopPropagation so the
        // click doesn't bubble to root (which would clear selection).
        if (isClickable) {
            entry.on("click", (e: MouseEvent) => {
                e.stopPropagation();
                onToggleType!(typeName);
            });
        }

        const labelWidth = measureTextWidth(typeName, font);
        cursorX = labelX + labelWidth + PAIR_GAP;
    }
}
