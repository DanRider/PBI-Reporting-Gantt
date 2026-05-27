"use strict";

// Single source of truth for marker symbol shapes used by both render/milestones.ts
// (the in-chart markers) and render/legend.ts (the upper-left legend swatches).
// Adding a new shape: add it here, add its enum entry to capabilities.json under
// milestones.type1Symbol/type2Symbol, and add it to settings.ts MilestonesCard's
// ItemDropdown items[]. All 3 lists must stay in sync.

// v2.2 INF-3738 — added warning/block/pause/x as alert-focused glyphs for
// the per-activity health bullet. star/circle/triangle/square/diamond remain
// the milestone-marker vocabulary; the 4 new kinds are the project-status
// alert vocabulary used by activityHealthIcons.
export type SymbolKind = "star" | "circle" | "triangle" | "square" | "diamond"
    | "warning" | "block" | "pause" | "x";

export const SYMBOL_KINDS: SymbolKind[] = [
    "star", "circle", "triangle", "square", "diamond",
    "warning", "block", "pause", "x",
];

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
        case "warning":  return warningPath(cx, cy, size);
        case "block":    return blockPath(cx, cy, size);
        case "pause":    return pausePath(cx, cy, size);
        case "x":        return xPath(cx, cy, size);
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

// v2.2 INF-3738 — alert glyphs.
// All four follow the same convention as the shapes above: `r` is the
// bounding-circle radius in pixels. fill comes from the caller; readable
// at small sizes (≥10px) because each glyph has at least 4 px of solid mass
// on its dominant axis.

// Warning: filled point-up triangle with a thin transparent vertical "!" slot
// cut out (even-odd fill rule rendering). Single path → both the triangle
// and the cutout in one d-string. Caller must set fill-rule="evenodd".
function warningPath(cx: number, cy: number, r: number): string {
    // Outer triangle inscribed in circle of radius r, point-up
    const top = `${cx.toFixed(2)},${(cy - r).toFixed(2)}`;
    const sin60 = Math.sin(Math.PI / 3);
    const left = `${(cx - r * sin60).toFixed(2)},${(cy + r * 0.5).toFixed(2)}`;
    const right = `${(cx + r * sin60).toFixed(2)},${(cy + r * 0.5).toFixed(2)}`;
    // Inner "!" cutout: small bar + dot, vertically centered just below the apex
    const barTop = (cy - r * 0.25).toFixed(2);
    const barBot = (cy + r * 0.15).toFixed(2);
    const barHalfW = (r * 0.08).toFixed(2);
    const dotTop = (cy + r * 0.25).toFixed(2);
    const dotBot = (cy + r * 0.40).toFixed(2);
    const dotHalfW = (r * 0.08).toFixed(2);
    return (
        // Outer triangle (clockwise, point-up)
        `M${top} L${right} L${left} Z ` +
        // Inner bar cutout (counter-clockwise to subtract under evenodd)
        `M${cx - +barHalfW},${barTop} L${cx + +barHalfW},${barTop} ` +
        `L${cx + +barHalfW},${barBot} L${cx - +barHalfW},${barBot} Z ` +
        // Inner dot cutout
        `M${cx - +dotHalfW},${dotTop} L${cx + +dotHalfW},${dotTop} ` +
        `L${cx + +dotHalfW},${dotBot} L${cx - +dotHalfW},${dotBot} Z`
    );
}

// Block: filled circle (red signals stop) with a horizontal bar cutout —
// the universal no-entry sign. Single path + fill-rule="evenodd".
function blockPath(cx: number, cy: number, r: number): string {
    const barHalfW = (r * 0.75).toFixed(2);
    const barHalfH = (r * 0.18).toFixed(2);
    return (
        // Outer disc (path-as-circle, clockwise)
        `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 Z ` +
        // Inner horizontal bar cutout (counter-clockwise)
        `M${cx - +barHalfW},${cy - +barHalfH} L${cx + +barHalfW},${cy - +barHalfH} ` +
        `L${cx + +barHalfW},${cy + +barHalfH} L${cx - +barHalfW},${cy + +barHalfH} Z`
    );
}

// Pause: two vertical bars (pause-button glyph). Single path with subpaths.
function pausePath(cx: number, cy: number, r: number): string {
    const barW = r * 0.35;
    const gap = r * 0.20;
    const barH = r * 1.4;
    const yTop = cy - barH / 2;
    const yBot = cy + barH / 2;
    const leftX = cx - gap / 2 - barW;
    const rightX = cx + gap / 2;
    return (
        `M${leftX},${yTop} h${barW} v${barH} h${-barW} Z ` +
        `M${rightX},${yTop} h${barW} v${barH} h${-barW} Z`
    );
}

// X: thick diagonal cross drawn as a 12-vertex closed polygon (no stroke
// needed — solid fill). Visually distinct from a "+" because diagonals
// read as cancellation/failure.
function xPath(cx: number, cy: number, r: number): string {
    const t = r * 0.22; // thickness offset perpendicular to the diagonals
    return (
        `M${(cx - r).toFixed(2)},${(cy - r + t).toFixed(2)} ` +
        `L${(cx - r + t).toFixed(2)},${(cy - r).toFixed(2)} ` +
        `L${cx.toFixed(2)},${(cy - t).toFixed(2)} ` +
        `L${(cx + r - t).toFixed(2)},${(cy - r).toFixed(2)} ` +
        `L${(cx + r).toFixed(2)},${(cy - r + t).toFixed(2)} ` +
        `L${(cx + t).toFixed(2)},${cy.toFixed(2)} ` +
        `L${(cx + r).toFixed(2)},${(cy + r - t).toFixed(2)} ` +
        `L${(cx + r - t).toFixed(2)},${(cy + r).toFixed(2)} ` +
        `L${cx.toFixed(2)},${(cy + t).toFixed(2)} ` +
        `L${(cx - r + t).toFixed(2)},${(cy + r).toFixed(2)} ` +
        `L${(cx - r).toFixed(2)},${(cy + r - t).toFixed(2)} ` +
        `L${(cx - t).toFixed(2)},${cy.toFixed(2)} Z`
    );
}

// Returns true for the kinds that REQUIRE fill-rule="evenodd" to render
// their cutouts correctly. Caller (render code) checks this before
// appending the path so it sets the attribute only when needed.
export function symbolNeedsEvenOddFill(kind: SymbolKind): boolean {
    return kind === "warning" || kind === "block";
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
