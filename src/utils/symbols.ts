"use strict";

// Single source of truth for marker symbol shapes used by both render/milestones.ts
// (the in-chart markers) and render/legend.ts (the upper-left legend swatches).
// Adding a new shape: add it here, add its enum entry to capabilities.json under
// milestones.type1Symbol/type2Symbol, and add it to settings.ts MilestonesCard's
// ItemDropdown items[]. All 3 lists must stay in sync.

export type SymbolKind = "star" | "circle" | "triangle" | "square" | "diamond";

export const SYMBOL_KINDS: SymbolKind[] = ["star", "circle", "triangle", "square", "diamond"];

export function isSymbolKind(s: string): s is SymbolKind {
    return (SYMBOL_KINDS as string[]).indexOf(s) !== -1;
}

// Returns SVG `d` attribute for the symbol centered at (cx, cy) with `size`
// being the bounding-circle radius in pixels.
export function symbolPath(kind: SymbolKind, cx: number, cy: number, size: number): string {
    switch (kind) {
        case "star":     return starPath(cx, cy, size, size * 0.43);
        case "circle":   return circlePath(cx, cy, size);
        case "triangle": return trianglePath(cx, cy, size);
        case "square":   return squarePath(cx, cy, size);
        case "diamond":  return diamondPath(cx, cy, size);
    }
}

function starPath(cx: number, cy: number, outerR: number, innerR: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
    }
    return `M${pts.join(" L")} Z`;
}

function circlePath(cx: number, cy: number, r: number): string {
    // Use two arcs to draw a complete circle as a path (so it composes uniformly with the others)
    return `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 Z`;
}

function trianglePath(cx: number, cy: number, r: number): string {
    // Equilateral triangle inscribed in circle of radius r, point-up
    const top = `${cx},${cy - r}`;
    const left = `${cx - r * Math.sin(Math.PI / 3)},${cy + r * 0.5}`;
    const right = `${cx + r * Math.sin(Math.PI / 3)},${cy + r * 0.5}`;
    return `M${top} L${right} L${left} Z`;
}

function squarePath(cx: number, cy: number, r: number): string {
    // Square inscribed in circle of radius r — side = r * sqrt(2)
    const half = r * Math.SQRT1_2;
    return `M${cx - half},${cy - half} h${half * 2} v${half * 2} h${-half * 2} Z`;
}

function diamondPath(cx: number, cy: number, r: number): string {
    return `M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z`;
}

// Returns "#FFFFFF" if fillHex is dark, "#000000" if fillHex is light.
// Uses sRGB relative luminance threshold of 0.5.
export function readableStrokeColor(fillHex: string): string {
    const lum = relativeLuminance(fillHex);
    return lum < 0.5 ? "#FFFFFF" : "#000000";
}

function relativeLuminance(hex: string): number {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return 0.5;  // unknown color → split the difference
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 0xff) / 255;
    const g = ((n >> 8) & 0xff) / 255;
    const b = (n & 0xff) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
