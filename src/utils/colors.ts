"use strict";

import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;

import { SymbolKind, isSymbolKind } from "./symbols";
import { MilestoneTypeBinding } from "../viewmodel";

export interface MilestoneTypeConfig {
    color: string;
    symbol: SymbolKind;
    size: number;
    showMarker: boolean;
    showLabel: boolean;
}

// Settings shape required to derive per-type milestone config (cap-2 with static slots).
export interface MilestonesSettingsShape {
    type1Color:      { value: { value: string } };
    type1Symbol:     { value: { value: string | number } };
    type1Size:       { value: number };
    type1ShowMarker: { value: boolean };
    type1ShowLabel:  { value: boolean };
    type2Color:      { value: { value: string } };
    type2Symbol:     { value: { value: string | number } };
    type2Size:       { value: number };
    type2ShowMarker: { value: boolean };
    type2ShowLabel:  { value: boolean };
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

// Build per-type milestone config from the bound-slot STATIC settings.
// Each typeBinding maps to its slot's static properties (type1* or type2*).
// Returns a map keyed by typeName so render code can look up by milestone.type.
export function buildMilestoneConfigMap(
    typeBindings: MilestoneTypeBinding[],
    settings: MilestonesSettingsShape
): Record<string, MilestoneTypeConfig> {
    const out: Record<string, MilestoneTypeConfig> = {};
    for (const b of typeBindings) {
        const isSlot1 = b.slotIndex === 0;
        const symbolRaw = String(isSlot1 ? settings.type1Symbol.value.value : settings.type2Symbol.value.value);
        out[b.typeName] = {
            color:      (isSlot1 ? settings.type1Color : settings.type2Color).value.value,
            symbol:     isSymbolKind(symbolRaw) ? symbolRaw : "star",
            size:       (isSlot1 ? settings.type1Size : settings.type2Size).value,
            showMarker: (isSlot1 ? settings.type1ShowMarker : settings.type2ShowMarker).value,
            showLabel:  (isSlot1 ? settings.type1ShowLabel : settings.type2ShowLabel).value,
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

// readMilestoneOverrides removed in v1.4.2 — per-type milestone config now comes
// directly from static settings.milestones.typeN* properties (cap-2 with dynamic
// displayName override). See INF-3530 for the dynamic-N persistence failure analysis.

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
