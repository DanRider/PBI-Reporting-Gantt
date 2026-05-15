"use strict";

import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;

import { SymbolKind, isSymbolKind } from "./symbols";

export interface MilestoneTypeConfig {
    color: string;
    symbol: SymbolKind;
    size: number;
    showMarker: boolean;
    showLabel: boolean;
}

export interface ColorContext {
    areaColors: Record<string, string>;                       // area name → hex (dynamic count, from data)
    milestoneConfig: Record<string, MilestoneTypeConfig>;     // type name → full config (dynamic-N from data)
}

const FALLBACK_COLOR = "#888888";

// Built-in palettes — theme-independent so colors stay consistent across reports/themes.
// Index-based assignment: the N-th distinct value in source-row order receives PALETTE[N % len].
// This means: any 3-area dataset gets [green, pink, blue]; any 2-milestone-type dataset gets
// [gold, black] — matching the consultant-grade brand defaults out-of-the-box without any
// per-value overrides or .pbip pre-persist needed.
//
// AREA + MILESTONE palettes are SEPARATE so areas and milestones never collide on the same
// color (with one shared palette, 3 areas + 2 milestones at indexes 0,1,2,0,1 would put
// green stars on green bars — visually broken).

const AREA_PALETTE = [
    "#5C8A1C",  // green   — Humana Tech Modernization signature
    "#C1004F",  // pink    — Humana Transformation Office signature
    "#00A0DC",  // blue    — Humana Priority Investments signature
    "#9467BD",  // purple
    "#8C564B",  // brown
    "#E377C2",  // pink-light
    "#7F7F7F",  // grey
    "#BCBD22",  // olive
    "#17BECF",  // cyan
    "#FF7F0E",  // orange
];

const MILESTONE_PALETTE = [
    "#FFC000",  // gold     — Humana Traceable Value signature
    "#000000",  // black    — Humana Capability Enabler signature
    "#1F77B4",  // blue
    "#D62728",  // red
    "#2CA02C",  // green-darker
    "#9467BD",  // purple
    "#FF7F0E",  // orange
    "#17BECF",  // cyan
];

export function defaultAreaColorFor(_name: string, index: number): string {
    return AREA_PALETTE[index % AREA_PALETTE.length];
}

export function defaultMilestoneColorFor(_name: string, index: number): string {
    return MILESTONE_PALETTE[index % MILESTONE_PALETTE.length];
}

// Build the per-area color map: persisted overrides win, else AREA_PALETTE default by source-order index.
export function buildAreaColorMap(
    distinctAreas: string[],
    persistedOverrides: Record<string, string>
): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < distinctAreas.length; i++) {
        const area = distinctAreas[i];
        out[area] = persistedOverrides[area] ?? defaultAreaColorFor(area, i);
    }
    return out;
}

// Build per-type milestone config: persisted-overrides win per-property, else defaults.
// Defaults: color from MILESTONE_PALETTE (by source-order index), symbol="star" (slot 0)
// or "circle" (slot 1+) for visual differentiation, size=11, both shows=true.
export function buildMilestoneConfigMap(
    distinctTypes: string[],
    persistedOverrides: Record<string, Partial<MilestoneTypeConfig>>
): Record<string, MilestoneTypeConfig> {
    const out: Record<string, MilestoneTypeConfig> = {};
    for (let i = 0; i < distinctTypes.length; i++) {
        const t = distinctTypes[i];
        const o = persistedOverrides[t] ?? {};
        out[t] = {
            color:      o.color ?? defaultMilestoneColorFor(t, i),
            symbol:     o.symbol ?? "star",   // both slots default to STAR (was: slot 1 = circle)
            size:       o.size ?? 8,          // 30% smaller default (was 11)
            showMarker: o.showMarker ?? true,
            showLabel:  o.showLabel ?? true,
        };
    }
    return out;
}

// Read user-set per-swim-lane color overrides from the persisted dataView objects bag.
// Shape: dataView.metadata.objects.swimlanes[swimLaneName].fill.solid.color = "#RRGGBB"
// (Swim Lane Colors card was consolidated into Swim Lanes card in v1.2.0.0.)
// Static swim-lane properties (show, wrapText, useAreaColor, etc.) are filtered out.
const SWIMLANE_STATIC_KEYS = new Set([
    "show", "wrapText", "useAreaColor", "labelColor",
    "swimLaneWidthPercent", "fontFamily", "fontSize", "bold", "italic", "underline",
]);

export function readSwimLaneColorOverrides(dataView: DataView | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    const objs = dataView?.metadata?.objects?.swimlanes as Record<string, unknown> | undefined;
    if (!objs) return out;
    for (const key of Object.keys(objs)) {
        if (SWIMLANE_STATIC_KEYS.has(key)) continue;
        const inst = objs[key] as { fill?: { solid?: { color?: string } } } | undefined;
        const color = inst?.fill?.solid?.color;
        if (typeof color === "string" && color.length > 0) {
            out[key] = color;
        }
    }
    return out;
}

// Read user-set per-type milestone overrides from the persisted dataView objects bag.
// Shape: dataView.metadata.objects.milestones[typeName] = { fill, symbol, size, showMarker, showLabel }
// Each property is independently optional — partial overrides are valid (e.g., only the color set).
export function readMilestoneOverrides(dataView: DataView | undefined): Record<string, Partial<MilestoneTypeConfig>> {
    const out: Record<string, Partial<MilestoneTypeConfig>> = {};
    const objs = dataView?.metadata?.objects?.milestones as Record<string, unknown> | undefined;
    if (!objs) return out;
    for (const key of Object.keys(objs)) {
        // Skip the static hoverExpansion property (it's a top-level scalar, not a per-type instance)
        if (key === "hoverExpansion") continue;
        const inst = objs[key] as {
            fill?:       { solid?: { color?: string } };
            symbol?:     string;
            size?:       number;
            showMarker?: boolean;
            showLabel?:  boolean;
        } | undefined;
        if (!inst) continue;
        const partial: Partial<MilestoneTypeConfig> = {};
        const color = inst.fill?.solid?.color;
        if (typeof color === "string" && color.length > 0) partial.color = color;
        if (typeof inst.symbol === "string" && isSymbolKind(inst.symbol)) partial.symbol = inst.symbol;
        if (typeof inst.size === "number" && inst.size > 0) partial.size = inst.size;
        if (typeof inst.showMarker === "boolean") partial.showMarker = inst.showMarker;
        if (typeof inst.showLabel === "boolean") partial.showLabel = inst.showLabel;
        if (Object.keys(partial).length > 0) out[key] = partial;
    }
    return out;
}

export function buildColorContext(
    areaColors: Record<string, string>,
    milestoneConfig: Record<string, MilestoneTypeConfig>
): ColorContext {
    return { areaColors, milestoneConfig };
}

export function areaColor(area: string, ctx: ColorContext): string {
    return ctx.areaColors[area] ?? FALLBACK_COLOR;
}

export function typeColor(typeName: string, ctx: ColorContext): string {
    return ctx.milestoneConfig[typeName]?.color ?? FALLBACK_COLOR;
}
