"use strict";

import { SymbolKind, isSymbolKind } from "./symbols";
import { MilestoneTypeBinding, AreaBinding } from "../viewmodel";

export interface MilestoneTypeConfig {
    color: string;
    symbol: SymbolKind;
    size: number;
    showMarker: boolean;
    // showLabel removed in v1.7.0.0 — labels controlled by per-row Label Visible
    // column + labelPos + label text + per-type showMarker (compound).
}

export interface ColorContext {
    areaColors: Record<string, string>;
    milestoneConfig: Record<string, MilestoneTypeConfig>;
    /** v2.1 audit-fix #7 — when set, per-activity colors override the
     *  per-area color. Used in lane-focus mode (when selection.kind ===
     *  "lane") to give each activity within the lane a distinct palette
     *  color so the user can visually correlate bar ↔ label ↔ table row. */
    activityColors?: Record<string, string>;
}

const FALLBACK_COLOR = "#888888";

// Settings shape required to derive per-type milestone config (cap-2 with static slots).
export interface MilestonesSettingsShape {
    type1Color:      { value: { value: string } };
    type1Symbol:     { value: { value: string | number } };
    type1Size:       { value: number };
    type1ShowMarker: { value: boolean };
    type2Color:      { value: { value: string } };
    type2Symbol:     { value: { value: string | number } };
    type2Size:       { value: number };
    type2ShowMarker: { value: boolean };
}

// Settings shape required to derive per-area color map (cap-8 with static slots).
export interface SwimlanesSettingsShape {
    slot1Color: { value: { value: string } };
    slot2Color: { value: { value: string } };
    slot3Color: { value: { value: string } };
    slot4Color: { value: { value: string } };
    slot5Color: { value: { value: string } };
    slot6Color: { value: { value: string } };
    slot7Color: { value: { value: string } };
    slot8Color: { value: { value: string } };
}

// Build the per-area color map from the bound-slot STATIC settings.
// Each areaBinding maps to its slot's static color property (slot1Color..slot8Color).
// Returns a map keyed by areaName so render code can look up by activity.area.
export function buildAreaColorMap(
    areaBindings: AreaBinding[],
    settings: SwimlanesSettingsShape
): Record<string, string> {
    const out: Record<string, string> = {};
    const slotProps = [
        settings.slot1Color, settings.slot2Color, settings.slot3Color, settings.slot4Color,
        settings.slot5Color, settings.slot6Color, settings.slot7Color, settings.slot8Color,
    ];
    for (const b of areaBindings) {
        out[b.areaName] = slotProps[b.slotIndex].value.value;
    }
    return out;
}

// Build per-type milestone config from the bound-slot STATIC settings.
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
        };
    }
    return out;
}

export function buildColorContext(
    areaColors: Record<string, string>,
    milestoneConfig: Record<string, MilestoneTypeConfig>,
    activityColors?: Record<string, string>,
): ColorContext {
    return { areaColors, milestoneConfig, activityColors };
}

export function areaColor(area: string, ctx: ColorContext): string {
    return ctx.areaColors[area] ?? FALLBACK_COLOR;
}

/** v2.1 audit-fix #7 — prefer the per-activity override (lane-focus mode)
 *  over the area color. Falls back to the area color (default behavior)
 *  when no override is provided. */
export function activityColor(activityName: string, area: string, ctx: ColorContext): string {
    return ctx.activityColors?.[activityName] ?? areaColor(area, ctx);
}

export function typeColor(typeName: string, ctx: ColorContext): string {
    return ctx.milestoneConfig[typeName]?.color ?? FALLBACK_COLOR;
}

// v2.2 INF-3738 — per-value icon binding for the activity bullet (left dot).
// Resolved by the same shape as MilestoneTypeConfig: each value gets a
// symbol kind + fill color + render size in px.
export interface ActivityHealthIconConfig {
    symbol: SymbolKind;
    color: string;
    size: number;
}

// Settings shape required to derive per-value health icon config (cap-5).
// v2.2 INF-3738 V2 — each slot now has a valueMatch ItemDropdown that the
// USER picks from a list of distinct values from their bound data column.
// The map key is the user-picked value; the slot's symbol/color/size are
// the render config.
export interface ActivityHealthIconsSettingsShape {
    slot1ValueMatch: { value: { value: string | number } };
    slot1Symbol:     { value: { value: string | number } };
    slot1Color:      { value: { value: string } };
    slot1Size:       { value: number };
    slot2ValueMatch: { value: { value: string | number } };
    slot2Symbol:     { value: { value: string | number } };
    slot2Color:      { value: { value: string } };
    slot2Size:       { value: number };
    slot3ValueMatch: { value: { value: string | number } };
    slot3Symbol:     { value: { value: string | number } };
    slot3Color:      { value: { value: string } };
    slot3Size:       { value: number };
    slot4ValueMatch: { value: { value: string | number } };
    slot4Symbol:     { value: { value: string | number } };
    slot4Color:      { value: { value: string } };
    slot4Size:       { value: number };
    slot5ValueMatch: { value: { value: string | number } };
    slot5Symbol:     { value: { value: string | number } };
    slot5Color:      { value: { value: string } };
    slot5Size:       { value: number };
}

// Build a Record<healthValue, config> map from the 5 slots in settings.
// Each slot contributes ONE entry, keyed by slotN.valueMatch.value.value.
// Empty matchValues are skipped (slot inactive). Called once per render at
// the top of update(). Same shape contract as buildAreaColorMap +
// buildMilestoneConfigMap (loop-invariant; render-side does O(1) lookup).
export function buildHealthIconMap(
    settings: ActivityHealthIconsSettingsShape,
): Record<string, ActivityHealthIconConfig> {
    const out: Record<string, ActivityHealthIconConfig> = {};
    const slots = [
        { vm: settings.slot1ValueMatch, sym: settings.slot1Symbol, col: settings.slot1Color, sz: settings.slot1Size },
        { vm: settings.slot2ValueMatch, sym: settings.slot2Symbol, col: settings.slot2Color, sz: settings.slot2Size },
        { vm: settings.slot3ValueMatch, sym: settings.slot3Symbol, col: settings.slot3Color, sz: settings.slot3Size },
        { vm: settings.slot4ValueMatch, sym: settings.slot4Symbol, col: settings.slot4Color, sz: settings.slot4Size },
        { vm: settings.slot5ValueMatch, sym: settings.slot5Symbol, col: settings.slot5Color, sz: settings.slot5Size },
    ];
    for (const s of slots) {
        const match = String(s.vm.value.value);
        if (match.length === 0) continue;  // slot inactive
        const symbolRaw = String(s.sym.value.value);
        out[match] = {
            symbol: isSymbolKind(symbolRaw) ? symbolRaw : "circle",
            color:  s.col.value.value,
            size:   s.sz.value,
        };
    }
    return out;
}
