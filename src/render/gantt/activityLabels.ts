"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../viewmodel";
import { activityColor, ColorContext, ActivityHealthIconConfig } from "../../utils/colors";
import { FontStyle, applyFont, canvasFontString } from "../../utils/font";
import { healthColor, HealthColorPalette } from "../../utils/healthColor";
import { symbolPath, symbolNeedsEvenOddFill } from "../../utils/symbols";

const LOLLIPOP_CIRCLE_R = 4;
const LOLLIPOP_STROKE_WIDTH = 2;
const LABEL_TO_LOLLIPOP_GAP = 24;   // audit-fix #24g — extra buffer between label text end and lollipop circle
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
    font: FontStyle;
    areaWidth: number;   // dynamic — from LayoutCard percentage
    wrapText: boolean;
    overflowBehavior: OverflowBehavior;
    /** v2.1 audit-fix — optional click handler so clicking the activity
     *  label TEXT (left rail) selects the activity, matching the activity-
     *  bar click behavior. */
    onSelectActivity?: (activityName: string) => void;
    /** v2.2 L2 + L3 — alert palette for the activity bullet (left dot).
     *  Fallback when healthIconMap doesn't have an entry for this row's
     *  health value (e.g., value bound but no slot configured yet). When
     *  activity has a non-null health value AND this palette is provided,
     *  bullet color = healthColor(activity.health, palette). Otherwise
     *  bullet falls back to activityColor() (swim-lane identity color). */
    healthPalette?: HealthColorPalette;
    /** v2.2 INF-3738 — per-value icon binding for the activity bullet.
     *  When activity.health is a key in this map, bullet renders as the
     *  configured symbol/color/size (replaces the default circle entirely).
     *  When not in map (value not bound to a slot OR no activityHealth
     *  binding at all), bullet falls back through healthPalette → swim-lane
     *  circle. Caller (visual.ts) builds via buildHealthIconMap(). */
    healthIconMap?: Record<string, ActivityHealthIconConfig>;
}

export interface ActivityLabelsLayout {
    areaStartX: number;
}

function measureWidth(text: string, font: FontStyle): number {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return text.length * font.fontSize * 0.55;
    ctx.font = canvasFontString(font);
    return ctx.measureText(text).width;
}

// INF-3736 — caller (visual.ts) uses this to detect whether the current
// activityLabelWidth will force any label to wrap, so it can lift the
// rowHeight floor and keep the 2-line render from clipping into adjacent
// rows. Measures with the bold variant to match the render-side
// measurement (see "measure-bold-apply-config" pattern below).
export function anyActivityLabelWraps(
    activities: Activity[],
    maxWidth: number,
    font: FontStyle,
): boolean {
    const measureFont = font.bold ? font : { ...font, bold: true };
    for (const a of activities) {
        if (measureWidth(a.name, measureFont) > maxWidth) return true;
    }
    return false;
}

function truncateToWidth(text: string, maxWidth: number, font: FontStyle): string {
    const fullWidth = measureWidth(text, font);
    if (fullWidth <= maxWidth) return text;
    let lo = 1, hi = text.length;
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const w = measureWidth(text.slice(0, mid) + "…", font);
        if (w <= maxWidth) lo = mid + 1;
        else hi = mid;
    }
    return text.slice(0, Math.max(0, lo - 1)) + "…";
}

interface WrappedLabel {
    lines: string[];
    maxLineWidth: number;
}

function wrapToLines(text: string, maxWidth: number, font: FontStyle): WrappedLabel {
    const fullWidth = measureWidth(text, font);
    if (fullWidth <= maxWidth) {
        return { lines: [text], maxLineWidth: fullWidth };
    }

    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return { lines: [text], maxLineWidth: fullWidth };

    let line1 = "";
    let line1Width = 0;
    let splitIdx = 0;

    for (let i = 0; i < words.length; i++) {
        const trial = i === 0 ? words[i] : line1 + " " + words[i];
        const trialWidth = measureWidth(trial, font);
        if (trialWidth <= maxWidth) {
            line1 = trial;
            line1Width = trialWidth;
            splitIdx = i + 1;
        } else {
            break;
        }
    }

    if (splitIdx === 0) {
        const trunc = truncateToWidth(words[0], maxWidth, font);
        return { lines: [trunc], maxLineWidth: maxWidth };
    }

    if (splitIdx >= words.length) {
        return { lines: [line1], maxLineWidth: line1Width };
    }

    const remaining = words.slice(splitIdx).join(" ");
    const line2 = truncateToWidth(remaining, maxWidth, font);
    const line2Width = measureWidth(line2, font);

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

    const font = opts.font;
    // v2.1 audit-fix #13 — when the activity is selected, the label text
    // becomes bold (post-render attribute set in visual.ts). Bold renders
    // ~8-12% wider than normal weight; using the user-config font for
    // measurement caused the BOLD selected text to overflow into the
    // lollipop/bar zone. Fix: always MEASURE with the bold version so the
    // layout slot reserves enough width for either state. We still APPLY
    // the user's actual weight at render time (applyFont below), so
    // non-selected text renders as configured — just with extra slot space
    // to its right that's invisible until selection.
    const measureFont = font.bold ? font : { ...font, bold: true };
    const maxLabelWidth = opts.areaWidth;

    for (const a of activities) {
        const cy = a.index * rowHeight + rowHeight / 2;
        const lollipopColor = activityColor(a.name, a.area, colors);
        const labelFill = opts.fillMode === "area" ? lollipopColor : opts.customColor;

        let renderLines: string[];
        let renderMaxWidth: number;
        const fullWidth = measureWidth(a.name, measureFont);

        if (opts.wrapText) {
            const wrapped = wrapToLines(a.name, maxLabelWidth, measureFont);
            const truncated = wrapped.lines.length > 1 && wrapped.lines[1].endsWith("…");
            const lineOneTruncated = wrapped.lines[0].endsWith("…");
            if ((truncated || lineOneTruncated) && opts.overflowBehavior === "hide") {
                continue;
            }
            renderLines = wrapped.lines;
            renderMaxWidth = wrapped.maxLineWidth;
        } else {
            if (fullWidth <= maxLabelWidth) {
                renderLines = [a.name];
                renderMaxWidth = fullWidth;
            } else if (opts.overflowBehavior === "hide") {
                continue;
            } else if (opts.overflowBehavior === "overflow") {
                renderLines = [a.name];
                renderMaxWidth = fullWidth;
            } else {
                const trunc = truncateToWidth(a.name, maxLabelWidth, measureFont);
                renderLines = [trunc];
                renderMaxWidth = measureWidth(trunc, measureFont);
            }
        }

        if (opts.show) {
            // v2.1 audit-fix #8 — colored bullet (the "-*" in the user's ASCII
            // art) inline before the label text. Uses the lollipop color
            // (which is per-activity palette in lane focus, lane color
            // otherwise), giving every Gantt row an explicit color-coded
            // legend entry. Bullet sits at the original areaStartX; text
            // shifts right by BULLET_GAP to make room.
            const BULLET_RADIUS = 4;
            const BULLET_GAP = 10;
            const bulletCx = layout.areaStartX + BULLET_RADIUS;
            // v2.2 INF-3738 — bullet rendering priority:
            //   1. healthIconMap[a.health] -> per-value custom symbol
            //   2. healthPalette fallback   -> circle in healthColor() (B3-style)
            //   3. swim-lane fallback       -> circle in lollipopColor (today's)
            // textX uses BULLET_RADIUS regardless of which path runs so the
            // label text stays left-aligned across the chart (operator's
            // explicit ask: "all of the text still perfectly left aligns").
            const iconBinding = (a.health && opts.healthIconMap)
                ? opts.healthIconMap[a.health]
                : undefined;
            if (iconBinding) {
                const iconR = Math.min(iconBinding.size, rowHeight - 4) / 2;
                const pathEl = g.append("path")
                    .attr("class", "activity-label-bullet")
                    .attr("d", symbolPath(iconBinding.symbol, bulletCx, cy, iconR))
                    .attr("fill", iconBinding.color)
                    .style("pointer-events", "none");
                if (symbolNeedsEvenOddFill(iconBinding.symbol)) {
                    pathEl.attr("fill-rule", "evenodd");
                }
            } else {
                const bulletColor = (a.health && opts.healthPalette)
                    ? healthColor(a.health, opts.healthPalette)
                    : lollipopColor;
                g.append("circle")
                    .attr("class", "activity-label-bullet")
                    .attr("cx", bulletCx)
                    .attr("cy", cy)
                    .attr("r", BULLET_RADIUS)
                    .attr("fill", bulletColor)
                    .style("pointer-events", "none");
            }
            const textX = layout.areaStartX + BULLET_RADIUS * 2 + BULLET_GAP;

            // v2.1 audit-fix — click any label text to select the activity.
            // pointer-events:bounding-box catches clicks anywhere in the
            // text's rect, not just on painted glyphs.
            const attachClick = (sel: Selection<SVGTextElement, unknown, null, undefined>): void => {
                sel.style("cursor", opts.onSelectActivity ? "pointer" : "default")
                   .style("pointer-events", "bounding-box");
                if (opts.onSelectActivity) {
                    sel.on("click", (e: MouseEvent) => {
                        e.stopPropagation();
                        opts.onSelectActivity?.(a.name);
                    });
                }
            };
            if (renderLines.length === 1) {
                const sel = g.append("text")
                    .attr("class", "activity-label")
                    .attr("data-activity", a.name)
                    .attr("x", textX)
                    .attr("y", cy)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "central")
                    .attr("fill", labelFill)
                    .text(renderLines[0]);
                applyFont(sel, font);
                attachClick(sel);
            } else {
                const sel1 = g.append("text")
                    .attr("class", "activity-label")
                    .attr("data-activity", a.name)
                    .attr("x", textX)
                    .attr("y", cy - LINE_OFFSET_PX)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "central")
                    .attr("fill", labelFill)
                    .text(renderLines[0]);
                applyFont(sel1, font);
                attachClick(sel1);
                const sel2 = g.append("text")
                    .attr("class", "activity-label")
                    .attr("data-activity", a.name)
                    .attr("x", textX)
                    .attr("y", cy + LINE_OFFSET_PX)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "central")
                    .attr("fill", labelFill)
                    .text(renderLines[1]);
                applyFont(sel2, font);
                attachClick(sel2);
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

        // v2.2 L1 — line now starts AT lineStartX + LOLLIPOP_CIRCLE_R so it
        // doesn't paint behind the new LEFT cap circle. x2 unchanged (still
        // reserves room for the RIGHT cap circle).
        g.append("line")
            .attr("class", "activity-lollipop-line")
            .attr("x1", lineStartX + LOLLIPOP_CIRCLE_R)
            .attr("x2", circleX - LOLLIPOP_CIRCLE_R)
            .attr("y1", cy).attr("y2", cy)
            .attr("stroke", lollipopColor)
            .attr("stroke-width", LOLLIPOP_STROKE_WIDTH)
            .attr("stroke-linecap", "round");

        // v2.2 L1 — LEFT cap (new). Mirrors the existing right-end cap so
        // the dash reads as *========* instead of ========*. Same color as
        // the line + right cap (lollipopColor = activity area color or
        // per-activity palette in lane-focus). Bullet (above) is separate.
        g.append("circle")
            .attr("class", "activity-lollipop-cap-left")
            .attr("cx", lineStartX).attr("cy", cy)
            .attr("r", LOLLIPOP_CIRCLE_R)
            .attr("fill", lollipopColor);

        g.append("circle")
            .attr("class", "activity-lollipop-cap")
            .attr("cx", circleX).attr("cy", cy)
            .attr("r", LOLLIPOP_CIRCLE_R)
            .attr("fill", lollipopColor);
    }
}
