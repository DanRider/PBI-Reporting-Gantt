// v2.2 T2 + S2 — bindingNames util tests.

import { describe, it, expect } from "vitest";
import { bindingDisplayName, pluralize } from "./bindingNames";
import powerbi from "powerbi-visuals-api";

// Minimal DataView builder for testing — just enough for
// bindingDisplayName to walk metadata.columns.
function makeDataView(columns: Array<{
    displayName: string;
    roles: Record<string, boolean>;
}>): powerbi.DataView {
    return {
        metadata: { columns: columns as powerbi.DataViewMetadataColumn[] },
    } as powerbi.DataView;
}

describe("bindingDisplayName — resolution", () => {
    it("returns bound column's displayName for the role", () => {
        const dv = makeDataView([
            { displayName: "Workstream", roles: { activity: true } },
            { displayName: "Department", roles: { area: true } },
        ]);
        expect(bindingDisplayName("activity", dv, "Activity")).toBe("Workstream");
        expect(bindingDisplayName("area", dv, "Swim Lane")).toBe("Department");
    });

    it("returns fallback when role isn't bound", () => {
        const dv = makeDataView([
            { displayName: "Workstream", roles: { activity: true } },
        ]);
        expect(bindingDisplayName("area", dv, "Swim Lane")).toBe("Swim Lane");
    });

    it("returns fallback when dataView is undefined", () => {
        expect(bindingDisplayName("activity", undefined, "Activity")).toBe("Activity");
    });

    it("returns fallback when dataView has no metadata.columns", () => {
        const dv = { metadata: {} } as powerbi.DataView;
        expect(bindingDisplayName("activity", dv, "Activity")).toBe("Activity");
    });

    it("returns fallback when bound column has empty displayName", () => {
        const dv = makeDataView([
            { displayName: "", roles: { activity: true } },
        ]);
        expect(bindingDisplayName("activity", dv, "Activity")).toBe("Activity");
    });

    it("ignores columns whose roles[role] is missing", () => {
        const dv = makeDataView([
            { displayName: "Notes", roles: { activityNote: true } },
            { displayName: "Workstream", roles: { activity: true } },
        ]);
        expect(bindingDisplayName("activity", dv, "Activity")).toBe("Workstream");
    });
});

describe("pluralize — naive English inflection", () => {
    it("regular nouns: appends 's'", () => {
        expect(pluralize("Workstream")).toBe("Workstreams");
        expect(pluralize("Workstream")).toBe("Workstreams");
        expect(pluralize("Department")).toBe("Departments");
    });
    it("nouns ending in 'y': replaces with 'ies'", () => {
        expect(pluralize("Activity")).toBe("Activities");
        expect(pluralize("Story")).toBe("Stories");
        expect(pluralize("Category")).toBe("Categories");
    });
    it("nouns ending in 's' / 'x' / 'z' / 'sh' / 'ch': appends 'es'", () => {
        expect(pluralize("Process")).toBe("Processes");
        expect(pluralize("Box")).toBe("Boxes");
        expect(pluralize("Branch")).toBe("Branches");
        expect(pluralize("Wish")).toBe("Wishes");
        expect(pluralize("Buzz")).toBe("Buzzes");
    });
    it("case-insensitive on the ending pattern", () => {
        expect(pluralize("STORY")).toBe("STORies");
        // ^ Acceptable — pluralize is for user-facing labels which are
        // usually properly cased; uppercase columns are unusual.
    });
});
