"use strict";

import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;
import DataViewTableRow = powerbi.DataViewTableRow;

import { indexMap, RoleIndex } from "./columns";

export type Area = string;
export type MilestoneType = string;
export type LabelPos = "L" | "R" | "none";

export const MAX_MILESTONE_TYPES = 2;

// Sentinel value for milestones whose ONLY purpose is to anchor activities-without-real-milestones
// in PBI's relationship cross-join. They never render. Generic PBI workaround, not domain-specific.
export const PHANTOM_TYPE = "__phantom";

export interface Activity {
    name: string;
    area: Area;
    start: Date;
    end: Date;
    index: number;
}

export interface Milestone {
    activity: string;
    date: Date;
    type: MilestoneType;
    label: string | null;
    labelPos: LabelPos;
    id: string;
    parentRowIndex: number;
}

export interface AreaGroup {
    area: Area;
    startRowIndex: number;
    endRowIndex: number;
}

export interface MilestoneTypeBinding {
    typeName: string;
    slotIndex: 0 | 1;
}

export interface RoadmapViewModel {
    activities: Activity[];
    milestones: Milestone[];
    areaGroups: AreaGroup[];
    distinctAreas: string[];
    typeBindings: MilestoneTypeBinding[];
    dateExtent: [Date, Date];
}

export const EMPTY_VIEWMODEL: RoadmapViewModel = {
    activities: [],
    milestones: [],
    areaGroups: [],
    distinctAreas: [],
    typeBindings: [],
    dateExtent: [new Date(), new Date()],
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
    const milestonesRaw: Milestone[] = [];
    let milestoneCounter = 0;
    let droppedExcessTypes = 0;

    for (const row of table.rows) {
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
                activityMap.set(aName, {
                    name: aName,
                    area,
                    start,
                    end,
                    index: activityMap.size,
                });
            }
        }

        const mAct = strAt(row, idx.milestoneActivity);
        const mDate = dateAt(row, idx.milestoneDate);
        const mType = strAt(row, idx.milestoneType);
        if (mAct && mDate && mType && mType !== PHANTOM_TYPE) {
            // Track first-seen type order BEFORE filtering, so the cap is deterministic
            if (!typeSeen.has(mType)) {
                typeSeen.add(mType);
                typeFirstSeen.push(mType);
            }
            milestonesRaw.push({
                activity: mAct,
                date: mDate,
                type: mType,
                label: strAt(row, idx.milestoneLabel),
                labelPos: (strAt(row, idx.labelPosition) ?? "none") as LabelPos,
                id: `m${milestoneCounter++}`,
                parentRowIndex: -1,
            });
        }
    }

    // Cap milestone types at MAX_MILESTONE_TYPES. Drop milestones of types beyond the cap.
    const boundTypes = typeFirstSeen.slice(0, MAX_MILESTONE_TYPES);
    const boundTypeSet = new Set(boundTypes);
    const milestonesFiltered: Milestone[] = [];
    for (const m of milestonesRaw) {
        if (boundTypeSet.has(m.type)) {
            milestonesFiltered.push(m);
        } else {
            droppedExcessTypes++;
        }
    }
    if (typeFirstSeen.length > MAX_MILESTONE_TYPES && typeof console !== "undefined") {
        console.warn(
            `[Reporting Gantt] Data has ${typeFirstSeen.length} distinct milestone types; ` +
            `only the first ${MAX_MILESTONE_TYPES} are rendered. ` +
            `Bound: [${boundTypes.join(", ")}]. ` +
            `Dropped: [${typeFirstSeen.slice(MAX_MILESTONE_TYPES).join(", ")}] ` +
            `(${droppedExcessTypes} milestones).`
        );
    }

    const typeBindings: MilestoneTypeBinding[] = boundTypes.map((typeName, i) => ({
        typeName,
        slotIndex: (i as 0 | 1),
    }));

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
    const deduped = dedupMilestones(milestonesFiltered);
    for (const m of deduped) {
        m.parentRowIndex = activityRowIndex.get(m.activity) ?? -1;
    }

    const dateExtent = computeExtent(activities, deduped);
    const areaGroups = computeAreaGroups(activities);

    return {
        activities,
        milestones: deduped,
        areaGroups,
        distinctAreas: areaFirstSeen,
        typeBindings,
        dateExtent,
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

export { indexMap };
export type { RoleIndex };
