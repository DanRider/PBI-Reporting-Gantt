"use strict";

import powerbi from "powerbi-visuals-api";
import DataViewTable = powerbi.DataViewTable;

export const ROLE = {
    activity:          "activity",
    area:              "area",
    startDate:         "startDate",
    endDate:           "endDate",
    milestoneActivity: "milestoneActivity",
    milestoneDate:     "milestoneDate",
    milestoneType:     "milestoneType",
    milestoneLabel:    "milestoneLabel",
    labelPosition:     "labelPosition",
    activityNote:      "activityNote",
    milestoneNote:     "milestoneNote",
    // v2.1 W1.5d — 4 optional milestone metadata wells
    // surfaced in the milestone-detail Inspector panel when bound.
    milestoneOwner:       "milestoneOwner",
    milestoneStatus:      "milestoneStatus",
    milestoneExternalUrl: "milestoneExternalUrl",
    milestoneHealth:      "milestoneHealth",
    // v2.2 L2 — per-activity health/alert column. Drives the bullet color
    // at the start of the activity label row (left dot). When unbound,
    // bullet falls back to the swim-lane color.
    activityHealth:       "activityHealth",
} as const;

export type RoleName = typeof ROLE[keyof typeof ROLE];

export type RoleIndex = Record<RoleName, number>;

export function columnIndexByRole(table: DataViewTable | undefined, role: RoleName): number {
    if (!table || !table.columns) return -1;
    return table.columns.findIndex(c => c.roles != null && Boolean(c.roles[role]));
}

export function indexMap(table: DataViewTable | undefined): RoleIndex {
    const out = {} as RoleIndex;
    for (const role of Object.values(ROLE)) {
        out[role] = columnIndexByRole(table, role);
    }
    return out;
}
