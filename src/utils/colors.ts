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

// Built-in palette — theme-independent so colors stay consistent across reports/themes.
// Same area name always hashes to the same slot, so the same dataset always renders the
// same colors regardless of which PBI report or theme it's viewed in.
// D3 category10 — broadly used categorical palette, good contrast across hues.
const DEFAULT_PALETTE = [
    "#1F77B4", // blue
    "#FF7F0E", // orange
    "#2CA02C", // green
    "#D62728", // red
    "#9467BD", // purple
    "#8C564B", // brown
    "#E377C2", // pink
    "#7F7F7F", // grey
    "#BCBD22", // olive
    "#17BECF", // cyan
];

// FNV-1a 32-bit hash → palette index. Deterministic per string.
function paletteIndex(name: string, len: number): number {
    let hash = 0x811c9dc5;  // FNV offset basis
    for (let i = 0; i < name.length; i++) {
        hash ^= name.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;  // FNV prime, force unsigned
    }
    return hash % len;
}

export function defaultColorFor(areaName: string): string {
    return DEFAULT_PALETTE[paletteIndex(areaName, DEFAULT_PALETTE.length)];
}

// Build the per-area color map: persisted overrides win, else built-in palette default per area name.
export function buildAreaColorMap(
    distinctAreas: string[],
    persistedOverrides: Record<string, string>
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const area of distinctAreas) {
        out[area] = persistedOverrides[area] ?? defaultColorFor(area);
    }
    return out;
}

// Build per-type milestone config: persisted-overrides win per-property, else defaults.
// Defaults: color from DEFAULT_PALETTE (hashed by type name), symbol="star", size=11, both shows=true.
export function buildMilestoneConfigMap(
    distinctTypes: string[],
    persistedOverrides: Record<string, Partial<MilestoneTypeConfig>>
): Record<string, MilestoneTypeConfig> {
    const out: Record<string, MilestoneTypeConfig> = {};
    for (const t of distinctTypes) {
        const o = persistedOverrides[t] ?? {};
        out[t] = {
            color:      o.color ?? defaultColorFor(t),
            symbol:     o.symbol ?? "star",
            size:       o.size ?? 11,
            showMarker: o.showMarker ?? true,
            showLabel:  o.showLabel ?? true,
        };
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
