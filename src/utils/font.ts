"use strict";

import { Selection, BaseType } from "d3-selection";

// Single source of truth for font styling across all renderers.
// Every text element in the visual goes through applyFont() — keeps the
// font-family / size / weight / style / decoration handling DRY.

export interface FontStyle {
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
}

export const DEFAULT_FONT: FontStyle = {
    fontFamily: "Segoe UI",
    fontSize: 11,
    bold: false,
    italic: false,
    underline: false,
};

// Apply a FontStyle to a d3 selection (text or any element with font-* attrs).
// Returns the same selection for chaining.
export function applyFont<GElement extends BaseType, Datum>(
    sel: Selection<GElement, Datum, BaseType, unknown>,
    font: FontStyle
): Selection<GElement, Datum, BaseType, unknown> {
    return sel
        .attr("font-family", font.fontFamily)
        .attr("font-size", font.fontSize)
        .attr("font-weight", font.bold ? "bold" : "normal")
        .attr("font-style", font.italic ? "italic" : "normal")
        .attr("text-decoration", font.underline ? "underline" : "none");
}

// Build the canvas font-string used by measureText for layout calculations.
// Mirrors what applyFont sets on SVG text elements.
export function canvasFontString(font: FontStyle): string {
    const style = font.italic ? "italic" : "normal";
    const weight = font.bold ? "bold" : "normal";
    return `${style} ${weight} ${font.fontSize}px ${font.fontFamily}`;
}

// Measure text width using a canvas 2D context with the FontStyle applied.
// Used by activity-labels wrap/truncate logic and milestone-label collision logic.
export function measureTextWidth(text: string, font: FontStyle): number {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return text.length * font.fontSize * 0.55;
    ctx.font = canvasFontString(font);
    return ctx.measureText(text).width;
}
