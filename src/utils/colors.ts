"use strict";

import { SymbolKind, isSymbolKind } from "./symbols";
import { MilestoneTypeBinding, AreaBinding } from "../viewmodel";

export interface MilestoneTypeConfig {
    color: string;
    symbol: SymbolKind;
    size: number;
    showMarker: boolean;
    showLabel: boolean;
}

export interface ColorContext {
    areaColors: Record<string, string>;
    milestoneConfig: Record<string, MilestoneTypeConfig>;
}

const FALLBACK_COLOR = "#888888";

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
            showLabel:  (isSlot1 ? settings.type1ShowLabel : settings.type2ShowLabel).value,
        };
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
