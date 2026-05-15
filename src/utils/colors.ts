"use strict";

import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

import { VisualFormattingSettingsModel } from "../settings";
import { MilestoneTypeBinding } from "../viewmodel";

export interface ColorContext {
    areaColors: Record<string, string>;   // area name → hex (dynamic count, from data)
    typeColors: Record<string, string>;   // type name → hex (max 2, from milestones-card slots)
}

const FALLBACK_COLOR = "#888888";

// Build the per-area color map: persisted overrides win, else theme palette default per area name.
export function buildAreaColorMap(
    distinctAreas: string[],
    persistedOverrides: Record<string, string>,
    host: IVisualHost
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const area of distinctAreas) {
        out[area] = persistedOverrides[area] ?? host.colorPalette.getColor(area).value;
    }
    return out;
}

// Build the per-type color map from the fixed-2 milestone slots.
export function buildTypeColorMap(
    typeBindings: MilestoneTypeBinding[],
    settings: VisualFormattingSettingsModel
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const b of typeBindings) {
        out[b.typeName] = b.slotIndex === 0
            ? settings.milestones.type1Color.value.value
            : settings.milestones.type2Color.value.value;
    }
    return out;
}

// Read user-set per-area color overrides from the persisted dataView objects bag.
// Shape: dataView.metadata.objects.areaColors[areaName].fill.solid.color = "#RRGGBB"
export function readAreaColorOverrides(dataView: DataView | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    const objs = dataView?.metadata?.objects?.areaColors as Record<string, unknown> | undefined;
    if (!objs) return out;
    for (const key of Object.keys(objs)) {
        const inst = objs[key] as { fill?: { solid?: { color?: string } } } | undefined;
        const color = inst?.fill?.solid?.color;
        if (typeof color === "string" && color.length > 0) {
            out[key] = color;
        }
    }
    return out;
}

export function buildColorContext(
    areaColors: Record<string, string>,
    typeColors: Record<string, string>
): ColorContext {
    return { areaColors, typeColors };
}

export function areaColor(area: string, ctx: ColorContext): string {
    return ctx.areaColors[area] ?? FALLBACK_COLOR;
}

export function typeColor(typeName: string, ctx: ColorContext): string {
    return ctx.typeColors[typeName] ?? FALLBACK_COLOR;
}
