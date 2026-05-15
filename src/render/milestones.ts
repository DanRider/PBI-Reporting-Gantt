"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Milestone } from "../viewmodel";
import { typeColor, ColorContext } from "../utils/colors";
import { symbolPath, readableStrokeColor } from "../utils/symbols";

const LABEL_GAP_PX = 8;
const LABEL_FONT_FAMILY = "Segoe UI, sans-serif";
const ARROW_LEFT = "\u2190 ";
const ARROW_RIGHT = " \u2192";

function collisionMinGapFor(fontSize: number): number {
    return Math.max(2, Math.round(fontSize * 0.7));
}
function minTruncWidthFor(fontSize: number): number {
    return Math.max(14, Math.round(fontSize * 4.5));
}

export type MilestoneOverflowBehavior = "truncate" | "hide" | "overflow";

export interface MilestoneLabelOptions {
    labelColor: string;
    fontSize: number;
    overflowBehavior: MilestoneOverflowBehavior;
}

function rowCenterY(parentRowIndex: number, rowHeight: number): number {
    return parentRowIndex * rowHeight + rowHeight / 2;
}

function measureTextWidth(text: string, fontSize: number, family: string): number {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return text.length * fontSize * 0.55;
    ctx.font = `${fontSize}px ${family}`;
    return ctx.measureText(text).width;
}

function truncateToWidth(text: string, maxWidth: number, fontSize: number, family: string): string | null {
    const fullWidth = measureTextWidth(text, fontSize, family);
    if (fullWidth <= maxWidth) return text;
    let lo = 1, hi = text.length;
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (measureTextWidth(text.slice(0, mid) + "…", fontSize, family) <= maxWidth) lo = mid + 1;
        else hi = mid;
    }
    const truncLen = Math.max(0, lo - 1);
    if (truncLen < 2) return null;
    return text.slice(0, truncLen) + "…";
}

function decorate(rawLabel: string, pos: "L" | "R"): string {
    return pos === "L" ? rawLabel + ARROW_RIGHT : ARROW_LEFT + rawLabel;
}

// Renders milestone markers using each milestone's type-bound symbol+size+color.
// Stroke color computed dynamically from fill via sRGB luminance (white on dark, black on light).
// Per-type showMarker filtering applied; markers for types without a config entry are dropped.
export function renderMilestones(
    g: Selection<SVGGElement, unknown, null, undefined>,
    milestones: Milestone[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    colors: ColorContext,
    hoverExpansionPercent: number = 50
): Selection<SVGCircleElement, Milestone, SVGGElement, unknown> {
    const renderable = milestones.filter(m => {
        if (m.parentRowIndex === -1) return false;
        const cfg = colors.milestoneConfig[m.type];
        return cfg !== undefined && cfg.showMarker;
    });
    const expansion = Math.max(0, hoverExpansionPercent) / 100;

    g.selectAll<SVGPathElement, Milestone>("path.milestone-marker")
        .data(renderable, (m: Milestone) => m.id)
        .join("path")
        .attr("class", "milestone-marker")
        .attr("data-milestone-id", m => m.id)
        .attr("d", m => {
            const cfg = colors.milestoneConfig[m.type];
            return symbolPath(cfg.symbol, xScale(m.date), rowCenterY(m.parentRowIndex, rowHeight), cfg.size);
        })
        .attr("fill", m => typeColor(m.type, colors))
        .attr("stroke", m => readableStrokeColor(typeColor(m.type, colors)))
        .attr("stroke-width", 0.8)
        .attr("pointer-events", "none");

    return g.selectAll<SVGCircleElement, Milestone>("circle.milestone-hit")
        .data(renderable, (m: Milestone) => m.id)
        .join("circle")
        .attr("class", "milestone-hit")
        .attr("data-milestone-id", m => m.id)
        .attr("cx", m => xScale(m.date))
        .attr("cy", m => rowCenterY(m.parentRowIndex, rowHeight))
        .attr("r", m => {
            const cfg = colors.milestoneConfig[m.type];
            return cfg.size * (1 + expansion);
        })
        .attr("fill", "transparent")
        .attr("pointer-events", "all");
}

export interface RenderedLabel {
    milestone: Milestone;
    text: string;
    x: number;
    anchor: "start" | "end";
    width: number;
}

// Pre-filters milestones whose type's showLabel is OFF before computing visible labels.
// The marker-size of each milestone (per its type config) drives the label-gap calculation.
export function computeVisibleLabels(
    milestones: Milestone[],
    colors: ColorContext,
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    chartLeftEdge: number,
    chartRightEdge: number,
    fontSize: number,
    overflowBehavior: MilestoneOverflowBehavior = "truncate"
): RenderedLabel[] {
    const candidates = milestones.filter(m => {
        if (m.parentRowIndex === -1) return false;
        if (m.labelPos === "none") return false;
        if (m.label == null || m.label.length === 0) return false;
        const cfg = colors.milestoneConfig[m.type];
        return cfg !== undefined && cfg.showLabel;
    });

    const byRow = new Map<number, Milestone[]>();
    for (const m of candidates) {
        const arr = byRow.get(m.parentRowIndex) ?? [];
        arr.push(m);
        byRow.set(m.parentRowIndex, arr);
    }

    const collisionGap = collisionMinGapFor(fontSize);
    const minTruncWidth = minTruncWidthFor(fontSize);

    const out: RenderedLabel[] = [];
    for (const [, rowMs] of byRow) {
        rowMs.sort((a, b) => a.date.getTime() - b.date.getTime());
        let lastRightX = -Infinity;

        for (const m of rowMs) {
            const cx = xScale(m.date);
            const markerSize = colors.milestoneConfig[m.type].size;
            const rawLabel = m.label as string;

            let pos: "L" | "R" = m.labelPos === "L" ? "L" : "R";
            const rText = decorate(rawLabel, "R");
            const rWidth = measureTextWidth(rText, fontSize, LABEL_FONT_FAMILY);
            if (pos === "R" && cx + markerSize + LABEL_GAP_PX + rWidth > chartRightEdge) {
                pos = "L";
            }

            let decorated = decorate(rawLabel, pos);
            let width = measureTextWidth(decorated, fontSize, LABEL_FONT_FAMILY);

            let startX: number;
            let endX: number;
            if (pos === "L") {
                endX = cx - markerSize - LABEL_GAP_PX;
                startX = endX - width;
            } else {
                startX = cx + markerSize + LABEL_GAP_PX;
                endX = startX + width;
            }

            if (startX < lastRightX + collisionGap) {
                if (overflowBehavior === "hide") continue;
                if (overflowBehavior === "overflow") {
                    // Render anyway — labels may visually overlap.
                } else {
                    const minX = lastRightX + collisionGap;
                    const availableWidth = endX - minX;
                    if (availableWidth < minTruncWidth) continue;

                    const arrowExtra = pos === "L"
                        ? measureTextWidth(ARROW_RIGHT, fontSize, LABEL_FONT_FAMILY)
                        : measureTextWidth(ARROW_LEFT, fontSize, LABEL_FONT_FAMILY);
                    const labelBudget = availableWidth - arrowExtra;
                    if (labelBudget < minTruncWidth * 0.6) continue;

                    const trunc = truncateToWidth(rawLabel, labelBudget, fontSize, LABEL_FONT_FAMILY);
                    if (!trunc) continue;

                    decorated = decorate(trunc, pos);
                    width = measureTextWidth(decorated, fontSize, LABEL_FONT_FAMILY);
                    if (pos === "L") {
                        startX = endX - width;
                    } else {
                        startX = minX;
                        endX = startX + width;
                    }
                    if (startX < minX - 0.5) continue;
                }
            }

            if (startX < chartLeftEdge) continue;

            out.push({
                milestone: m,
                text: decorated,
                x: pos === "L" ? endX : startX,
                anchor: pos === "L" ? "end" : "start",
                width,
            });
            lastRightX = Math.max(lastRightX, endX);
        }
    }
    return out;
}

export function renderMilestoneLabels(
    g: Selection<SVGGElement, unknown, null, undefined>,
    rendered: RenderedLabel[],
    rowHeight: number,
    opts: MilestoneLabelOptions
): void {
    g.selectAll("text.milestone-label").remove();

    g.selectAll<SVGTextElement, RenderedLabel>("text.milestone-label")
        .data(rendered, (d: RenderedLabel) => d.milestone.id)
        .join("text")
        .attr("class", "milestone-label")
        .attr("data-milestone-id", d => d.milestone.id)
        .attr("x", d => d.x)
        .attr("y", d => rowCenterY(d.milestone.parentRowIndex, rowHeight))
        .attr("text-anchor", d => d.anchor)
        .attr("dominant-baseline", "central")
        .attr("font-size", opts.fontSize)
        .attr("font-family", LABEL_FONT_FAMILY)
        .attr("fill", opts.labelColor)
        .text(d => d.text);
}
