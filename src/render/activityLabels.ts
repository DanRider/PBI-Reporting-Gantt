"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../viewmodel";
import { areaColor, ColorContext } from "../utils/colors";

const LABEL_FONT_FAMILY = "'Segoe UI Variable Display', 'Arial Narrow', 'Segoe UI', sans-serif";
const LABEL_FONT_WEIGHT = "bold";
const LOLLIPOP_CIRCLE_R = 4;
const LOLLIPOP_STROKE_WIDTH = 2;
const LABEL_TO_LOLLIPOP_GAP = 14;   // generous breathing room — no crowding
const LOLLIPOP_TO_BAR_GAP = 6;
const MIN_LOLLIPOP_LINE_LEN = 16;
const LINE_OFFSET_PX = 6;           // half of inter-line spacing when wrapped to 2 lines

// DEFAULT fallback only. Actual width comes from the LayoutCard percentage at runtime.
export const DEFAULT_ACTIVITY_LABEL_AREA_WIDTH = 240;
export const ACTIVITY_LOLLIPOP_MIN_WIDTH =
    LABEL_TO_LOLLIPOP_GAP +
    MIN_LOLLIPOP_LINE_LEN +
    LOLLIPOP_CIRCLE_R +
    LOLLIPOP_TO_BAR_GAP;

export type OverflowBehavior = "truncate" | "hide" | "overflow";

export interface ActivityLabelOptions {
    show: boolean;
    fillMode: "grey" | "area";
    customColor: string;
    fontSize: number;
    areaWidth: number;   // dynamic — from LayoutCard percentage
    wrapText: boolean;
    overflowBehavior: OverflowBehavior;
}

export interface ActivityLabelsLayout {
    areaStartX: number;
}

function measureTextWidth(text: string, fontSize: number, family: string, weight = "normal"): number {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return text.length * fontSize * 0.55;
    ctx.font = `${weight} ${fontSize}px ${family}`;
    return ctx.measureText(text).width;
}

function truncateToWidth(text: string, maxWidth: number, fontSize: number, family: string): string {
    const fullWidth = measureTextWidth(text, fontSize, family, LABEL_FONT_WEIGHT);
    if (fullWidth <= maxWidth) return text;
    let lo = 1, hi = text.length;
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const w = measureTextWidth(text.slice(0, mid) + "…", fontSize, family, LABEL_FONT_WEIGHT);
        if (w <= maxWidth) lo = mid + 1;
        else hi = mid;
    }
    return text.slice(0, Math.max(0, lo - 1)) + "…";
}

interface WrappedLabel {
    lines: string[];
    maxLineWidth: number;
}

/**
 * Greedy word-break into up to 2 lines. If even one word doesn't fit, truncate.
 * Returns the lines + the widest line's measured width for lollipop positioning.
 */
function wrapToLines(text: string, maxWidth: number, fontSize: number, family: string): WrappedLabel {
    const fullWidth = measureTextWidth(text, fontSize, family, LABEL_FONT_WEIGHT);
    if (fullWidth <= maxWidth) {
        return { lines: [text], maxLineWidth: fullWidth };
    }

    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return { lines: [text], maxLineWidth: fullWidth };

    // Try greedy fill of line 1
    let line1 = "";
    let line1Width = 0;
    let splitIdx = 0;

    for (let i = 0; i < words.length; i++) {
        const trial = i === 0 ? words[i] : line1 + " " + words[i];
        const trialWidth = measureTextWidth(trial, fontSize, family, LABEL_FONT_WEIGHT);
        if (trialWidth <= maxWidth) {
            line1 = trial;
            line1Width = trialWidth;
            splitIdx = i + 1;
        } else {
            break;
        }
    }

    if (splitIdx === 0) {
        // Not even the first word fits — truncate it.
        const trunc = truncateToWidth(words[0], maxWidth, fontSize, family);
        return { lines: [trunc], maxLineWidth: maxWidth };
    }

    if (splitIdx >= words.length) {
        // Everything fit in line 1 (shouldn't reach here given the early exit, but safe)
        return { lines: [line1], maxLineWidth: line1Width };
    }

    // Build line 2 from remaining words, truncating if too long
    const remaining = words.slice(splitIdx).join(" ");
    const line2 = truncateToWidth(remaining, maxWidth, fontSize, family);
    const line2Width = measureTextWidth(line2, fontSize, family, LABEL_FONT_WEIGHT);

    return {
        lines: [line1, line2],
        maxLineWidth: Math.max(line1Width, line2Width),
    };
}

export function renderActivityLabels(
    g: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    rowHeight: number,
    layout: ActivityLabelsLayout,
    xScale: ScaleTime<number, number>,
    opts: ActivityLabelOptions,
    colors: ColorContext
): void {
    g.selectAll("*").remove();

    const fontSize = opts.fontSize;
    const maxLabelWidth = opts.areaWidth;

    for (const a of activities) {
        const cy = a.index * rowHeight + rowHeight / 2;
        const lollipopColor = areaColor(a.area, colors);
        const labelFill = opts.fillMode === "area" ? lollipopColor : opts.customColor;

        // Decide what to render based on wrap + overflow settings
        let renderLines: string[];
        let renderMaxWidth: number;
        const fullWidth = measureTextWidth(a.name, fontSize, LABEL_FONT_FAMILY, LABEL_FONT_WEIGHT);

        if (opts.wrapText) {
            const wrapped = wrapToLines(a.name, maxLabelWidth, fontSize, LABEL_FONT_FAMILY);
            // If still doesn't fully fit after wrap (truncated tail in line 2) and overflowBehavior=hide
            const truncated = wrapped.lines.length > 1 && wrapped.lines[1].endsWith("…");
            const lineOneTruncated = wrapped.lines[0].endsWith("…");
            if ((truncated || lineOneTruncated) && opts.overflowBehavior === "hide") {
                continue;
            }
            renderLines = wrapped.lines;
            renderMaxWidth = wrapped.maxLineWidth;
        } else {
            // Single line — honor overflow behavior
            if (fullWidth <= maxLabelWidth) {
                renderLines = [a.name];
                renderMaxWidth = fullWidth;
            } else if (opts.overflowBehavior === "hide") {
                continue;
            } else if (opts.overflowBehavior === "overflow") {
                renderLines = [a.name];
                renderMaxWidth = fullWidth;
            } else {
                // truncate
                const trunc = truncateToWidth(a.name, maxLabelWidth, fontSize, LABEL_FONT_FAMILY);
                renderLines = [trunc];
                renderMaxWidth = measureTextWidth(trunc, fontSize, LABEL_FONT_FAMILY, LABEL_FONT_WEIGHT);
            }
        }

        if (opts.show) {
            if (renderLines.length === 1) {
                g.append("text")
                    .attr("class", "activity-label")
                    .attr("data-activity", a.name)
                    .attr("x", layout.areaStartX)
                    .attr("y", cy)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "central")
                    .attr("font-size", fontSize)
                    .attr("font-family", LABEL_FONT_FAMILY)
                    .attr("font-weight", LABEL_FONT_WEIGHT)
                    .attr("fill", labelFill)
                    .text(renderLines[0]);
            } else {
                g.append("text")
                    .attr("class", "activity-label")
                    .attr("data-activity", a.name)
                    .attr("x", layout.areaStartX)
                    .attr("y", cy - LINE_OFFSET_PX)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "central")
                    .attr("font-size", fontSize)
                    .attr("font-family", LABEL_FONT_FAMILY)
                    .attr("font-weight", LABEL_FONT_WEIGHT)
                    .attr("fill", labelFill)
                    .text(renderLines[0]);
                g.append("text")
                    .attr("class", "activity-label")
                    .attr("data-activity", a.name)
                    .attr("x", layout.areaStartX)
                    .attr("y", cy + LINE_OFFSET_PX)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "central")
                    .attr("font-size", fontSize)
                    .attr("font-family", LABEL_FONT_FAMILY)
                    .attr("font-weight", LABEL_FONT_WEIGHT)
                    .attr("fill", labelFill)
                    .text(renderLines[1]);
            }
        }

        // Lollipop line starts AFTER the widest line of the label, with generous padding.
        const lineStartX = opts.show
            ? layout.areaStartX + renderMaxWidth + LABEL_TO_LOLLIPOP_GAP
            : layout.areaStartX;

        const barStartX = xScale(a.start);
        const circleX = Math.max(
            lineStartX + MIN_LOLLIPOP_LINE_LEN + LOLLIPOP_CIRCLE_R,
            barStartX - LOLLIPOP_TO_BAR_GAP - LOLLIPOP_CIRCLE_R
        );

        g.append("line")
            .attr("class", "activity-lollipop-line")
            .attr("x1", lineStartX)
            .attr("x2", circleX - LOLLIPOP_CIRCLE_R)
            .attr("y1", cy).attr("y2", cy)
            .attr("stroke", lollipopColor)
            .attr("stroke-width", LOLLIPOP_STROKE_WIDTH)
            .attr("stroke-linecap", "round");

        g.append("circle")
            .attr("class", "activity-lollipop-cap")
            .attr("cx", circleX).attr("cy", cy)
            .attr("r", LOLLIPOP_CIRCLE_R)
            .attr("fill", lollipopColor);
    }
}
