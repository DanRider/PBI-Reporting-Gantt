"use strict";

import { Selection } from "d3-selection";
import { ColorContext, typeColor } from "../../utils/colors";
import { symbolPath, readableStrokeColor } from "../../utils/symbols";
import { FontStyle, applyFont, measureTextWidth } from "../../utils/font";

export const LEGEND_HEIGHT = 24;

const SYMBOL_TO_LABEL_GAP = 6;
const PAIR_GAP = 18;
const LEFT_INSET = 4;

// v2.1 audit-fix #11 — 3-state legend toggle:
//   "visible"     → normal symbol + label, full color
//   "transparent" → entry at 0.5 opacity, chart milestones at 0.3 opacity
//   "hidden"      → grey symbol + slash overlay (international "disabled"
//                   symbol), chart milestones invisible
// Clicking an entry cycles through the 3 states. Orchestrator: "we get
// all 3 states without bullshit menus and allowing users to drive the
// experience."
export type LegendTypeState = "visible" | "transparent" | "hidden";

const DISABLED_GREY = "#9ca3af";

export function renderLegend(
    g: Selection<SVGGElement, unknown, null, undefined>,
    distinctTypes: string[],
    colors: ColorContext,
    show: boolean,
    font: FontStyle,
    labelColor: string,
    typeState?: ReadonlyMap<string, LegendTypeState>,
    onToggleType?: (typeName: string) => void,
): void {
    g.selectAll("*").remove();
    if (!show || distinctTypes.length === 0) return;

    const cy = LEGEND_HEIGHT / 2;
    let cursorX = LEFT_INSET;

    for (const typeName of distinctTypes) {
        const cfg = colors.milestoneConfig[typeName];
        if (!cfg) continue;
        const state: LegendTypeState = typeState?.get(typeName) ?? "visible";
        const isClickable = onToggleType != null;

        const fill = state === "hidden" ? DISABLED_GREY : typeColor(typeName, colors);
        const stroke = readableStrokeColor(fill);
        const size = cfg.size;

        // Wrap each entry in a <g> so the cycle state can apply group-level
        // opacity + click handler. "transparent" dims the entry to 0.5.
        // "hidden" overlays a slash to signal disabled.
        const entry = g.append("g")
            .attr("class", "legend-entry")
            .attr("data-type", typeName)
            .attr("data-state", state)
            .style("opacity", state === "transparent" ? 0.5 : 1)
            .style("cursor", isClickable ? "pointer" : "default");

        const symbolCx = cursorX + size;
        entry.append("path")
            .attr("d", symbolPath(cfg.symbol, symbolCx, cy, size))
            .attr("fill", fill)
            .attr("stroke", stroke)
            .attr("stroke-width", 0.8)
            .style("pointer-events", "bounding-box");

        // International "disabled" symbol overlay (circle + diagonal slash)
        // when state === "hidden". Sits over the type icon so the user
        // sees what's being hidden but understands it's off.
        if (state === "hidden") {
            const r = size + 2;
            entry.append("circle")
                .attr("cx", symbolCx)
                .attr("cy", cy)
                .attr("r", r)
                .attr("fill", "none")
                .attr("stroke", DISABLED_GREY)
                .attr("stroke-width", 1.5)
                .style("pointer-events", "none");
            // Diagonal slash from upper-left to lower-right of the circle.
            const off = r * 0.7071; // cos(45°) ≈ 0.7071
            entry.append("line")
                .attr("x1", symbolCx - off)
                .attr("y1", cy - off)
                .attr("x2", symbolCx + off)
                .attr("y2", cy + off)
                .attr("stroke", DISABLED_GREY)
                .attr("stroke-width", 1.5)
                .style("pointer-events", "none");
        }

        const labelX = symbolCx + size + SYMBOL_TO_LABEL_GAP;
        const textSel = entry.append("text")
            .attr("x", labelX)
            .attr("y", cy)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "central")
            .attr("fill", state === "hidden" ? DISABLED_GREY : labelColor)
            .style("pointer-events", "bounding-box")
            .text(typeName);
        applyFont(textSel, font);

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
