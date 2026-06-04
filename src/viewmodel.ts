"use strict";

import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;
import DataViewTableRow = powerbi.DataViewTableRow;

import { indexMap, RoleIndex } from "./columns";

export type Area = string;
export type MilestoneType = string;
export type LabelPos = "L" | "R" | "none";

// Sentinel value for milestones whose ONLY purpose is to anchor activities-without-real-milestones
// in PBI's relationship cross-join. They never render. Generic PBI workaround, not domain-specific.
export const PHANTOM_TYPE = "__phantom";

// Cap on distinct milestone types rendered. The first N in source-row order bind to
// slot1/slot2/... PBI's formattingSettings framework can't round-trip dynamic-N
// per-instance slices for Format-pane edits, so we cap at fixed slot count and use
// STATIC properties. Data with more types drops the rest with a console warning.
// See design notes for the rationale.
export const MAX_MILESTONE_TYPES = 2;
export const MAX_SWIM_LANES = 8;
// v2.2 INF-3738 — cap for distinct activity-health values rendered with
// per-value icon+color. Same architectural constraint as MAX_MILESTONE_TYPES
// (PBI formattingSettings can't round-trip dynamic-N).
export const MAX_HEALTH_VALUES = 5;

export interface MilestoneTypeBinding {
    typeName: string;
    slotIndex: 0 | 1;
}

export interface AreaBinding {
    areaName: string;
    slotIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

// v2.2 INF-3738 — first 5 distinct activity-health values bind to slots
// 0..4. Each slot has a Format-pane symbol + color + size (see
// activityHealthIcons object in capabilities.json).
export interface HealthBinding {
    healthValue: string;
    slotIndex: 0 | 1 | 2 | 3 | 4;
}

export interface Activity {
    name: string;
    area: Area;
    start: Date;
    end: Date;
    index: number;
    note: string | null;    // optional per-row status note from Activity Note role; null when unbound or empty
    // v2.2 L2 — optional per-activity health/alert string. When bound, drives
    // the bullet color via healthColor() (palette = milestoneHealthColors).
    // Recognizes literal "Green"/"Yellow"/"Red" AND semantic values like
    // "On Track" / "At Risk" / "Off Track" / "Blocked" / "Complete".
    health: string | null;
    // v2.3 INF-3787 — glide-path optional dates. `start`/`end` carry the
    // CURRENT forecast (existing semantic). When the corresponding role is
    // bound, baselineStart/End = committed plan dates, actualStart/End =
    // recorded real dates. Glide-path render verbs layer these as
    // additional states on the activity row. Absent = render unchanged
    // from v2.2 (graceful degradation).
    baselineStart?: Date;
    baselineEnd?:   Date;
    actualStart?:   Date;
    actualEnd?:     Date;
    // INF-3815 — optional operator-bound completion percentage (0-100).
    // When present, the Activity Inspector's slide-out bar can read this
    // instead of computing elapsed-time / total-time (gated on the
    // activityInspector.progressBarSource Format Pane setting).
    percentComplete?: number;
    // INF-3823 — optional per-row hex from `areaColor` role; invalid drops to undefined.
    areaColor?: string;
}

export interface Milestone {
    activity: string;
    date: Date;
    type: MilestoneType;
    label: string | null;
    labelPos: LabelPos;     // "L" | "R" | "none" — "none" hides the label (per-row hide mechanism)
    id: string;
    parentRowIndex: number;
    note: string | null;    // optional per-row status note from Milestone Note role
    // v2.1 W1.5d — optional milestone metadata. Each is non-null only when
    // the corresponding well is bound AND the row value is non-empty.
    // The milestone-detail Inspector renders rows for each conditionally.
    owner:       string | null;
    status:      string | null;
    externalUrl: string | null;
    health:      string | null;
    // v2.3 INF-3787 — when bound, the original committed milestone date.
    // Renders as a hollow outline marker + connector line to the current
    // solid marker (MS Project Tracking Gantt convention).
    baselineDate?: Date;
}

export interface AreaGroup {
    area: Area;
    startRowIndex: number;
    endRowIndex: number;
}

export interface RoadmapViewModel {
    activities: Activity[];
    milestones: Milestone[];
    areaGroups: AreaGroup[];
    distinctAreas: string[];
    distinctTypes: string[];
    distinctHealthValues: string[];        // v2.2 INF-3738 — first-seen activity-health values
    typeBindings: MilestoneTypeBinding[];  // first 2 types bound to slots 0/1 (cap-2)
    areaBindings: AreaBinding[];           // first 8 areas bound to slots 0..7 (cap-8)
    healthBindings: HealthBinding[];       // v2.2 INF-3738 — first 5 health values bound to slots 0..4
    dateExtent: [Date, Date];
    // INF-3823 — area→data-bound hex; first-row-wins; {} when role unbound.
    perAreaColor: Record<string, string>;
}

export const EMPTY_VIEWMODEL: RoadmapViewModel = {
    activities: [],
    milestones: [],
    areaGroups: [],
    distinctAreas: [],
    distinctTypes: [],
    distinctHealthValues: [],
    typeBindings: [],
    areaBindings: [],
    healthBindings: [],
    dateExtent: [new Date(), new Date()],
    perAreaColor: {},
};

function computeAreaGroups(activities: Activity[]): AreaGroup[] {
    const out: AreaGroup[] = [];
    if (activities.length === 0) return out;
    let curArea: string = activities[0].area;
    let curStart = 0;
    for (let i = 1; i < activities.length; i++) {
        if (activities[i].area !== curArea) {
            out.push({ area: curArea, startRowIndex: curStart, endRowIndex: i - 1 });
            curArea = activities[i].area;
            curStart = i;
        }
    }
    out.push({ area: curArea, startRowIndex: curStart, endRowIndex: activities.length - 1 });
    return out;
}

export function convertDataView(dataView: DataView | undefined): RoadmapViewModel {
    const table = dataView?.table;
    if (!table || !table.rows || table.rows.length === 0) return EMPTY_VIEWMODEL;

    const idx = indexMap(table);
    const activityMap = new Map<string, Activity>();
    const areaFirstSeen: string[] = [];                  // first-seen-in-data area sort
    const areaSeen = new Set<string>();
    const typeFirstSeen: string[] = [];                  // first-seen-in-data type sort
    const typeSeen = new Set<string>();
    // v2.2 INF-3738 — collect distinct activity-health values for slot binding.
    const healthFirstSeen: string[] = [];
    const healthSeen = new Set<string>();
    // INF-3823 — first-row-wins per-area hex; invalid drops via isHexLike.
    const perAreaColor: Record<string, string> = {};
    const milestonesRaw: Milestone[] = [];
    let milestoneCounter = 0;

    for (const row of table.rows) {
        // INF-3823 — per-area first-row-wins hex rollup (runs every row).
        const rowArea = strAt(row, idx.area);
        if (rowArea && perAreaColor[rowArea] === undefined) {
            const rowColor = strAt(row, idx.areaColor);
            if (isHexLike(rowColor)) perAreaColor[rowArea] = rowColor;
        }

        const aName = strAt(row, idx.activity);
        if (aName && !activityMap.has(aName)) {
            const start = dateAt(row, idx.startDate);
            const end = dateAt(row, idx.endDate);
            if (start && end) {
                const area = strAt(row, idx.area) ?? "";
                if (area && !areaSeen.has(area)) {
                    areaSeen.add(area);
                    areaFirstSeen.push(area);
                }
                // v2.2 L2 — read per-activity health/alert column when bound.
                // First-row wins (subsequent milestone rows for the same
                // activity don't overwrite, matching activityNote behavior).
                const aHealth = strAt(row, idx.activityHealth);
                if (aHealth && !healthSeen.has(aHealth)) {
                    healthSeen.add(aHealth);
                    healthFirstSeen.push(aHealth);
                }
                // v2.3 INF-3787 — read optional glide-path dates. Each
                // defaults to undefined when role unbound or value null;
                // render path treats undefined as "no baseline/actual
                // layer for this row" and degrades to existing single-bar.
                const bStart = dateAt(row, idx.baselineStart);
                const bEnd   = dateAt(row, idx.baselineEnd);
                const aStart = dateAt(row, idx.actualStart);
                const aEnd   = dateAt(row, idx.actualEnd);
                // INF-3815 — optional per-activity percentComplete numeric.
                // First-row wins (mirrors activityNote / activityHealth).
                const pctRaw = numAt(row, idx.percentComplete);
                const pctClamped = pctRaw == null ? undefined : Math.max(0, Math.min(100, pctRaw));
                // INF-3823 — per-Activity hex (per-area rollup runs above).
                const colorRaw = strAt(row, idx.areaColor);
                const colorValid = isHexLike(colorRaw) ? colorRaw : undefined;
                activityMap.set(aName, {
                    name: aName,
                    area,
                    start,
                    end,
                    index: activityMap.size,
                    note: strAt(row, idx.activityNote),
                    health: aHealth,
                    baselineStart: bStart ?? undefined,
                    baselineEnd:   bEnd   ?? undefined,
                    actualStart:   aStart ?? undefined,
                    actualEnd:     aEnd   ?? undefined,
                    percentComplete: pctClamped,
                    areaColor:     colorValid,
                });
            }
        }

        const mAct = strAt(row, idx.milestoneActivity);
        const mDate = dateAt(row, idx.milestoneDate);
        const mType = strAt(row, idx.milestoneType);
        if (mAct && mDate && mType && mType !== PHANTOM_TYPE) {
            if (!typeSeen.has(mType)) {
                typeSeen.add(mType);
                typeFirstSeen.push(mType);
            }
            const mBaselineDate = dateAt(row, idx.milestoneBaselineDate);
            milestonesRaw.push({
                activity: mAct,
                date: mDate,
                type: mType,
                label: strAt(row, idx.milestoneLabel),
                labelPos: (strAt(row, idx.labelPosition) ?? "none") as LabelPos,
                // v2.1 W1.5d — read 4 optional metadata fields when bound.
                owner:       strAt(row, idx.milestoneOwner),
                status:      strAt(row, idx.milestoneStatus),
                externalUrl: strAt(row, idx.milestoneExternalUrl),
                health:      strAt(row, idx.milestoneHealth),
                id: `m${milestoneCounter++}`,
                parentRowIndex: -1,
                note: strAt(row, idx.milestoneNote),
                baselineDate: mBaselineDate ?? undefined,
            });
        }
    }

    // Sort activities by area first-seen-in-data order, then by source-row index within area
    const areaSortIndex = new Map(areaFirstSeen.map((a, i) => [a, i]));
    const activities = [...activityMap.values()];
    activities.sort((a, b) => {
        const ai = areaSortIndex.get(a.area) ?? Infinity;
        const bi = areaSortIndex.get(b.area) ?? Infinity;
        if (ai !== bi) return ai - bi;
        return a.index - b.index;
    });
    activities.forEach((a, i) => (a.index = i));

    const activityRowIndex = new Map(activities.map(a => [a.name, a.index]));
    const deduped = dedupMilestones(milestonesRaw);
    for (const m of deduped) {
        m.parentRowIndex = activityRowIndex.get(m.activity) ?? -1;
    }

    const dateExtent = computeExtent(activities, deduped);
    const areaGroups = computeAreaGroups(activities);

    // Cap milestone types at MAX_MILESTONE_TYPES — drop milestones whose type isn't bound.
    const boundTypes = typeFirstSeen.slice(0, MAX_MILESTONE_TYPES);
    const boundTypeSet = new Set(boundTypes);
    const filteredDeduped = deduped.filter(m => boundTypeSet.has(m.type));
    if (typeFirstSeen.length > MAX_MILESTONE_TYPES && typeof console !== "undefined") {
        console.warn(
            `[Reporting Gantt] Data has ${typeFirstSeen.length} distinct milestone types; ` +
            `only the first ${MAX_MILESTONE_TYPES} render. Bound: [${boundTypes.join(", ")}]. ` +
            `Dropped: [${typeFirstSeen.slice(MAX_MILESTONE_TYPES).join(", ")}].`
        );
    }
    const typeBindings: MilestoneTypeBinding[] = boundTypes.map((typeName, i) => ({
        typeName,
        slotIndex: i as 0 | 1,
    }));

    // Cap swim lanes at MAX_SWIM_LANES with the same pattern.
    const boundAreas = areaFirstSeen.slice(0, MAX_SWIM_LANES);
    if (areaFirstSeen.length > MAX_SWIM_LANES && typeof console !== "undefined") {
        console.warn(
            `[Reporting Gantt] Data has ${areaFirstSeen.length} distinct Swim Lane values; ` +
            `only the first ${MAX_SWIM_LANES} render. Bound: [${boundAreas.join(", ")}]. ` +
            `Dropped: [${areaFirstSeen.slice(MAX_SWIM_LANES).join(", ")}].`
        );
    }
    const areaBindings: AreaBinding[] = boundAreas.map((areaName, i) => ({
        areaName,
        slotIndex: i as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
    }));

    // v2.2 INF-3738 — cap activity-health distinct values at MAX_HEALTH_VALUES
    // with the same first-seen-binds-to-slot pattern as milestone types and
    // swim lanes. Activities whose health value is bound get a per-value
    // icon+color in the bullet; activities whose value is NOT bound (overflow,
    // unbound role, null) fall back to today's swim-lane circle in renderer.
    const boundHealthValues = healthFirstSeen.slice(0, MAX_HEALTH_VALUES);
    if (healthFirstSeen.length > MAX_HEALTH_VALUES && typeof console !== "undefined") {
        console.warn(
            `[Reporting Gantt] Data has ${healthFirstSeen.length} distinct Activity Health values; ` +
            `only the first ${MAX_HEALTH_VALUES} render with custom icons. Bound: [${boundHealthValues.join(", ")}]. ` +
            `Dropped (render as swim-lane circle): [${healthFirstSeen.slice(MAX_HEALTH_VALUES).join(", ")}].`
        );
    }
    const healthBindings: HealthBinding[] = boundHealthValues.map((healthValue, i) => ({
        healthValue,
        slotIndex: i as 0 | 1 | 2 | 3 | 4,
    }));

    return {
        activities,
        milestones: filteredDeduped,
        areaGroups,
        distinctAreas: areaFirstSeen,
        distinctTypes: typeFirstSeen,
        distinctHealthValues: healthFirstSeen,
        typeBindings,
        areaBindings,
        healthBindings,
        dateExtent,
        perAreaColor,
    };
}

function dedupMilestones(arr: Milestone[]): Milestone[] {
    const seen = new Set<string>();
    return arr.filter(m => {
        const key = `${m.activity}|${m.date.toISOString()}|${m.type}|${m.label ?? ""}|${m.labelPos}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function computeExtent(activities: Activity[], milestones: Milestone[]): [Date, Date] {
    const times: number[] = [];
    for (const a of activities) {
        times.push(a.start.getTime());
        times.push(a.end.getTime());
    }
    for (const m of milestones) {
        times.push(m.date.getTime());
    }
    if (times.length === 0) {
        const now = new Date();
        return [now, now];
    }
    return [new Date(Math.min(...times)), new Date(Math.max(...times))];
}

function strAt(row: DataViewTableRow, i: number): string | null {
    if (i < 0) return null;
    const v = row[i];
    if (v == null) return null;
    const s = String(v);
    return s.length === 0 ? null : s;
}

function dateAt(row: DataViewTableRow, i: number): Date | null {
    if (i < 0) return null;
    const v = row[i];
    if (v == null) return null;
    if (v instanceof Date) return v;
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
}

// INF-3815 — read a numeric value from a column. Returns null when:
// - role unbound (i < 0)
// - cell empty/null
// - value can't be parsed as a finite number
function numAt(row: DataViewTableRow, i: number): number | null {
    if (i < 0) return null;
    const v = row[i];
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

// INF-3823 — local hex gate (mirrors colors.ts:isValidHex; circular-import avoidance).
function isHexLike(s: string | null | undefined): s is string {
    return typeof s === "string" && /^#[0-9A-Fa-f]{6}$/.test(s);
}

export { indexMap };
export type { RoleIndex };
