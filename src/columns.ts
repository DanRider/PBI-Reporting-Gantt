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
