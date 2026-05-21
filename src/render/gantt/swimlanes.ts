"use strict";

import { Selection } from "d3-selection";
import { AreaGroup } from "../../viewmodel";
import { areaColor, ColorContext } from "../../utils/colors";
import { FontStyle, applyFont } from "../../utils/font";

export const DEFAULT_LEFT_RAIL_WIDTH = 130;

const LABEL_BAND_LEFT_PADDING = 8;
const RAIL_TO_RIGHT_GAP = 12;

const RAIL_STROKE_WIDTH = 4;
const CIRCLE_RADIUS = 8;
const LABEL_LINE_HEIGHT_FACTOR = 1.25;

export type RailAlignment = "left" | "center" | "right";

export interface SwimlaneOptions {
    show: boolean;
    wrapText: boolean;
    useAreaColor: boolean;
    labelColor: string;
    railAlignment: RailAlignment;
    font: FontStyle;
    /** v2.1 W1.5b/audit-fix — optional click handler called when the user
     *  clicks a swim-lane label text. Replaces the post-render d3 selectAll
     *  approach which was unreliable when SVG text elements' default
     *  pointer-events:visiblePainted didn't catch clicks between glyphs. */
    onSelectLane?: (laneName: string) => void;
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

    // Position rail line and label text horizontally per the alignment choice.
    // - left:   rail at left edge, label centered in remaining space to the right
    // - center: rail bisects label (both at same x); label drawn ON TOP of rail
    // - right:  rail at right edge, label centered in remaining space to the left (original)
    let railLineX: number;
    let textX: number;
    if (opts.railAlignment === "left") {
        railLineX = LABEL_BAND_LEFT_PADDING + CIRCLE_RADIUS;
        textX = (railLineX + RAIL_TO_RIGHT_GAP + (railWidth - 4)) / 2;
    } else if (opts.railAlignment === "center") {
        railLineX = railWidth / 2;
        textX = railWidth / 2;
    } else {
        // right (default — matches v2.8 original)
        railLineX = railWidth - RAIL_TO_RIGHT_GAP;
        const labelBandLeft = LABEL_BAND_LEFT_PADDING;
        const labelBandRight = railLineX - 8;
        textX = (labelBandLeft + labelBandRight) / 2;
    }

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

        // For "center" alignment, BREAK the rail line above + below the text block
        // (with a small padding) — much cleaner than slashing through the label.
        // For "left"/"right" alignments, single rail line spans yTop to yBottom.
        if (opts.railAlignment === "center") {
            const textPadding = 4;
            const textTopY = yCenter - totalH / 2 - textPadding;
            const textBottomY = yCenter + totalH / 2 + textPadding;
            if (textTopY > yTop) {
                g.append("line")
                    .attr("class", "swimlane-rail")
                    .attr("x1", railLineX).attr("x2", railLineX)
                    .attr("y1", yTop).attr("y2", textTopY)
                    .attr("stroke", railColor)
                    .attr("stroke-width", RAIL_STROKE_WIDTH)
                    .attr("stroke-linecap", "round");
            }
            if (textBottomY < yBottom) {
                g.append("line")
                    .attr("class", "swimlane-rail")
                    .attr("x1", railLineX).attr("x2", railLineX)
                    .attr("y1", textBottomY).attr("y2", yBottom)
                    .attr("stroke", railColor)
                    .attr("stroke-width", RAIL_STROKE_WIDTH)
                    .attr("stroke-linecap", "round");
            }
        } else {
            g.append("line")
                .attr("class", "swimlane-rail")
                .attr("x1", railLineX).attr("x2", railLineX)
                .attr("y1", yTop).attr("y2", yBottom)
                .attr("stroke", railColor)
                .attr("stroke-width", RAIL_STROKE_WIDTH)
                .attr("stroke-linecap", "round");
        }

        g.append("circle")
            .attr("cx", railLineX).attr("cy", yTop)
            .attr("r", CIRCLE_RADIUS)
            .attr("fill", railColor);
        g.append("circle")
            .attr("cx", railLineX).attr("cy", yBottom)
            .attr("r", CIRCLE_RADIUS)
            .attr("fill", railColor);

        for (let i = 0; i < lines.length; i++) {
            // v2.1 W1.5b/audit-fix — attach click DIRECTLY at element creation
            // (callback pattern, not d3-selectAll-after-render). Add
            // pointer-events:bounding-box so the click hits anywhere in the
            // text's bounding rect, not just on painted glyph pixels (the
            // default visiblePainted was unreliable for thin text).
            const textSel = g.append("text")
                .attr("class", "swimlane-label")
                .attr("data-area", group.area)
                .attr("x", textX)
                .attr("y", startY + i * lineHeight)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("fill", labelFill)
                .style("cursor", opts.onSelectLane ? "pointer" : "default")
                .style("pointer-events", "bounding-box")
                .text(lines[i]);
            applyFont(textSel, opts.font);
            if (opts.onSelectLane) {
                textSel.on("click", (e: MouseEvent) => {
                    e.stopPropagation();
                    opts.onSelectLane?.(group.area);
                });
            }
        }
    }
}
