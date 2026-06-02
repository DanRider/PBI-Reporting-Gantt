import { describe, it, expect } from "vitest";
import { Activity } from "../viewmodel";
import { deriveState } from "../model/activityState";
import { glidePathRow } from "./glidePathRow";

function mkActivity(over: Partial<Activity> & { name: string; index: number }): Activity {
    return {
        name: over.name,
        area: over.area ?? "L",
        start: over.start ?? new Date("2026-01-01"),
        end: over.end ?? new Date("2026-02-01"),
        index: over.index,
        note: null,
        health: null,
        baselineStart: over.baselineStart,
        baselineEnd: over.baselineEnd,
        actualStart: over.actualStart,
        actualEnd: over.actualEnd,
    };
}

const today = new Date("2026-02-01");

describe("glidePathRow — graceful degradation table", () => {
    it("no-baseline + no-actual → just forecast bar (v2.2.0.3 shape)", () => {
        const state = deriveState(mkActivity({ name: "v22-shape", index: 0 }), today);
        expect(glidePathRow(state)).toEqual(["bar"]);
    });

    it("has-baseline only (no actual) + on-track → baselineBar + bar (no chevron)", () => {
        const state = deriveState(mkActivity({ name: "B-only-ontrack", index: 0,
            baselineStart: new Date("2026-01-15"),
            baselineEnd: new Date("2026-02-01"),
            end: new Date("2026-02-01") }), today);
        expect(glidePathRow(state)).toEqual(["baselineBar", "bar"]);
    });

    it("has-baseline only + slipping → baselineBar + bar + slipChevron", () => {
        const state = deriveState(mkActivity({ name: "B-only-slip", index: 0,
            baselineStart: new Date("2026-01-15"),
            baselineEnd: new Date("2026-02-01"),
            end: new Date("2026-02-15") }), today);
        expect(glidePathRow(state)).toEqual(["baselineBar", "bar", "slipChevron"]);
    });

    it("has-baseline + has-actual + slipping → all four layers", () => {
        const state = deriveState(mkActivity({ name: "all", index: 0,
            baselineStart: new Date("2026-01-15"),
            baselineEnd: new Date("2026-02-01"),
            actualStart: new Date("2026-01-16"),
            actualEnd: new Date("2026-01-25"),
            end: new Date("2026-02-15") }), today);
        expect(glidePathRow(state)).toEqual(["baselineBar", "bar", "actualSegment", "slipChevron"]);
    });

    it("has-actual only (no baseline) → bar + actualSegment (no chevron, no baselineBar)", () => {
        const state = deriveState(mkActivity({ name: "A-only", index: 0,
            actualStart: new Date("2026-01-16"),
            actualEnd: new Date("2026-01-25") }), today);
        expect(glidePathRow(state)).toEqual(["bar", "actualSegment"]);
    });

    it("has-baseline + has-actual + on-track (no slip) → baselineBar + bar + actualSegment", () => {
        const state = deriveState(mkActivity({ name: "BA-ontrack", index: 0,
            baselineStart: new Date("2026-01-15"),
            baselineEnd: new Date("2026-02-01"),
            actualStart: new Date("2026-01-16"),
            actualEnd: new Date("2026-01-25"),
            end: new Date("2026-02-01") }), today);
        expect(glidePathRow(state)).toEqual(["baselineBar", "bar", "actualSegment"]);
    });
});

describe("glidePathRow — z-order invariants", () => {
    it("bar always present (forecast end is required)", () => {
        const states = [
            deriveState(mkActivity({ name: "1", index: 0 }), today),
            deriveState(mkActivity({ name: "2", index: 0,
                baselineStart: new Date("2026-01-15"), baselineEnd: new Date("2026-02-01") }), today),
            deriveState(mkActivity({ name: "3", index: 0,
                actualStart: new Date("2026-01-16"), actualEnd: new Date("2026-01-25") }), today),
        ];
        for (const s of states) {
            expect(glidePathRow(s)).toContain("bar");
        }
    });

    it("baselineBar (if present) renders before bar (z-bottom)", () => {
        const state = deriveState(mkActivity({ name: "z", index: 0,
            baselineStart: new Date("2026-01-15"),
            baselineEnd: new Date("2026-02-01"),
            actualStart: new Date("2026-01-16"),
            actualEnd: new Date("2026-01-25"),
            end: new Date("2026-02-15") }), today);
        const layers = glidePathRow(state);
        expect(layers.indexOf("baselineBar")).toBeLessThan(layers.indexOf("bar"));
    });

    it("actualSegment (if present) renders after bar (z-above forecast)", () => {
        const state = deriveState(mkActivity({ name: "z", index: 0,
            actualStart: new Date("2026-01-16"),
            actualEnd: new Date("2026-01-25") }), today);
        const layers = glidePathRow(state);
        expect(layers.indexOf("bar")).toBeLessThan(layers.indexOf("actualSegment"));
    });

    it("slipChevron (if present) renders last (z-top)", () => {
        const state = deriveState(mkActivity({ name: "z", index: 0,
            baselineStart: new Date("2026-01-15"),
            baselineEnd: new Date("2026-02-01"),
            actualStart: new Date("2026-01-16"),
            actualEnd: new Date("2026-01-25"),
            end: new Date("2026-02-15") }), today);
        const layers = glidePathRow(state);
        expect(layers[layers.length - 1]).toBe("slipChevron");
    });
});
