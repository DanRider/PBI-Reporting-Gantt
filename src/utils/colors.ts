"use strict";

import { SymbolKind, isSymbolKind } from "./symbols";
import { MilestoneTypeBinding, AreaBinding, HealthBinding } from "../viewmodel";

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
    const exact = ctx.areaColors[area];
    if (exact !== undefined) return exact;
    // INF-3782 — areaBindings caps at 8 swim-lane slots (slot1Color..slot8Color
    // in SwimlanesSettingsShape). On datasets with more than 8 distinct areas,
    // lanes 9+ were not bound to a slot → not in ctx.areaColors → fell back
    // to the uniform FALLBACK_COLOR "#888" and rendered as indistinguishable
    // grey rows. Operator-reported on client deployment with 12+ areas:
    // "swim lane colors eventually switched to be all grey as i scrolled down."
    // Fix: deterministically hash the area name into the bound palette so
    // beyond-cap lanes cycle through bound slot colors rather than collapsing
    // to grey. Same area name yields the same color across data refreshes.
    // Repeats are visible but the lanes stay distinguishable.
    const values = Object.values(ctx.areaColors);
    if (values.length === 0) return FALLBACK_COLOR;
    return values[stableHashUint(area) % values.length];
}

/** Deterministic 31-bit unsigned hash of a string. djb2-style; cheap;
 *  stable across reloads because it depends only on the area name. */
function stableHashUint(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return h < 0 ? -h : h;
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
// v2.2 INF-3738 V3 — back to swim-lane pattern: each slot's displayName is
// renamed at runtime in visual.ts from vm.healthBindings (first-seen-in-
// data ordering). No explicit valueMatch field — the slot's identity IS
// the value, just like swim-lane slot colors.
export interface ActivityHealthIconsSettingsShape {
    slot1Symbol: { value: { value: string | number } };
    slot1Color:  { value: { value: string } };
    slot1Size:   { value: number };
    slot2Symbol: { value: { value: string | number } };
    slot2Color:  { value: { value: string } };
    slot2Size:   { value: number };
    slot3Symbol: { value: { value: string | number } };
    slot3Color:  { value: { value: string } };
    slot3Size:   { value: number };
    slot4Symbol: { value: { value: string | number } };
    slot4Color:  { value: { value: string } };
    slot4Size:   { value: number };
    slot5Symbol: { value: { value: string | number } };
    slot5Color:  { value: { value: string } };
    slot5Size:   { value: number };
}

// Build a Record<healthValue, config> map from healthBindings × static slot
// settings. Each binding indexes into the corresponding slot N for its
// symbol/color/size. Matches the buildAreaColorMap + buildMilestoneConfigMap
// pattern: loop-invariant, called once per render at top of update().
export function buildHealthIconMap(
    healthBindings: HealthBinding[],
    settings: ActivityHealthIconsSettingsShape,
): Record<string, ActivityHealthIconConfig> {
    const out: Record<string, ActivityHealthIconConfig> = {};
    const slotSymbols = [
        settings.slot1Symbol, settings.slot2Symbol, settings.slot3Symbol,
        settings.slot4Symbol, settings.slot5Symbol,
    ];
    const slotColors = [
        settings.slot1Color, settings.slot2Color, settings.slot3Color,
        settings.slot4Color, settings.slot5Color,
    ];
    const slotSizes = [
        settings.slot1Size, settings.slot2Size, settings.slot3Size,
        settings.slot4Size, settings.slot5Size,
    ];
    for (const b of healthBindings) {
        const symbolRaw = String(slotSymbols[b.slotIndex].value.value);
        out[b.healthValue] = {
            symbol: isSymbolKind(symbolRaw) ? symbolRaw : "circle",
            color:  slotColors[b.slotIndex].value.value,
            size:   slotSizes[b.slotIndex].value,
        };
    }
    return out;
}
