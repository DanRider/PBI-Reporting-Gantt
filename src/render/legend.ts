"use strict";

import { Selection } from "d3-selection";
import { ColorContext, typeColor } from "../utils/colors";
import { MilestoneTypeBinding } from "../viewmodel";
import { VisualFormattingSettingsModel } from "../settings";
import { symbolPath, readableStrokeColor, isSymbolKind, SymbolKind } from "../utils/symbols";

export const LEGEND_HEIGHT = 24;

const LABEL_FONT_SIZE = 12;
const LABEL_FONT_FAMILY = "Segoe UI, sans-serif";
const SYMBOL_TO_LABEL_GAP = 6;
const PAIR_GAP = 18;
const LEFT_INSET = 4;

function measureTextWidth(text: string, fontSize: number, family: string): number {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return text.length * fontSize * 0.55;
    ctx.font = `${fontSize}px ${family}`;
    return ctx.measureText(text).width;
}

// Renders the legend as a left-justified row of (symbol, type-name) pairs at the
// top of the visual. One entry per bound milestone-type slot. Each entry uses the
// user-picked symbol + size + color from settings.milestones.
export function renderLegend(
    g: Selection<SVGGElement, unknown, null, undefined>,
    typeBindings: MilestoneTypeBinding[],
    settings: VisualFormattingSettingsModel,
    colors: ColorContext,
    show: boolean
): void {
    g.selectAll("*").remove();
    if (!show || typeBindings.length === 0) return;

    const cy = LEGEND_HEIGHT / 2;
    let cursorX = LEFT_INSET;

    for (const binding of typeBindings) {
        const isSlot1 = binding.slotIndex === 0;
        const symbolStr = String(isSlot1
            ? settings.milestones.type1Symbol.value.value
            : settings.milestones.type2Symbol.value.value);
        const symbol: SymbolKind = isSymbolKind(symbolStr) ? symbolStr : "star";
        const size = isSlot1
            ? settings.milestones.type1Size.value
            : settings.milestones.type2Size.value;
        const fill = typeColor(binding.typeName, colors);
        const stroke = readableStrokeColor(fill);

        const symbolCx = cursorX + size;
        g.append("path")
            .attr("d", symbolPath(symbol, symbolCx, cy, size))
            .attr("fill", fill)
            .attr("stroke", stroke)
            .attr("stroke-width", 0.8);

        const labelX = symbolCx + size + SYMBOL_TO_LABEL_GAP;
        g.append("text")
            .attr("x", labelX)
            .attr("y", cy)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "central")
            .attr("font-size", LABEL_FONT_SIZE)
            .attr("font-family", LABEL_FONT_FAMILY)
            .attr("fill", "#222")
            .text(binding.typeName);

        const labelWidth = measureTextWidth(binding.typeName, LABEL_FONT_SIZE, LABEL_FONT_FAMILY);
        cursorX = labelX + labelWidth + PAIR_GAP;
    }
}
