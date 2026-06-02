import { describe, it, expect } from "vitest";
import { Activity } from "../viewmodel";
import {
    computeSlip,
    categorizeSlip,
    deriveState,
    slipToHealthColor,
    SLIP_NEGLIGIBLE_DAYS,
    SLIP_MINOR_DAYS,
    SLIP_MAJOR_DAYS,
    DEFAULT_SLIP_THRESHOLDS,
    SlipThresholds,
} from "./activityState";
import { DEFAULT_HEALTH_PALETTE } from "../utils/healthColor";

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

describe("computeSlip", () => {
    it("returns null when baselineEnd is undefined (slip undefined without a baseline)", () => {
        expect(computeSlip(undefined, new Date("2026-02-01"))).toBeNull();
    });

    it("returns positive days when forecast end is after baseline end (slipping)", () => {
        const result = computeSlip(new Date("2026-02-01"), new Date("2026-02-11"));
        expect(result).not.toBeNull();
        expect(result!.days).toBe(10);
        expect(result!.direction).toBe("slipping");
    });

    it("returns negative days when forecast end is before baseline end (pulled in)", () => {
        const result = computeSlip(new Date("2026-02-15"), new Date("2026-02-01"));
        expect(result).not.toBeNull();
        expect(result!.days).toBe(-14);
        expect(result!.direction).toBe("pulled-in");
    });

    it("returns on-track direction when slip is exactly zero", () => {
        const d = new Date("2026-02-01");
        const result = computeSlip(d, d);
        expect(result).not.toBeNull();
        expect(result!.days).toBe(0);
        expect(result!.direction).toBe("on-track");
        expect(result!.magnitude).toBe("negligible");
    });
});

describe("categorizeSlip — magnitude thresholds (Decision #3 defaults)", () => {
    const cases: Array<[number, "negligible" | "minor" | "major" | "critical"]> = [
        // Boundary values
        [0,                          "negligible"],
        [SLIP_NEGLIGIBLE_DAYS,       "negligible"],   // 2
        [SLIP_NEGLIGIBLE_DAYS + 0.1, "minor"],
        [SLIP_MINOR_DAYS,            "minor"],        // 7
        [SLIP_MINOR_DAYS + 0.1,      "major"],
        [SLIP_MAJOR_DAYS,            "major"],        // 30
        [SLIP_MAJOR_DAYS + 0.1,      "critical"],
        // Spot checks across both directions
        [3,    "minor"],
        [-3,   "minor"],
        [20,   "major"],
        [-20,  "major"],
        [100,  "critical"],
        [-100, "critical"],
    ];
    for (const [days, expected] of cases) {
        it(`${days}d → ${expected}`, () => {
            expect(categorizeSlip(days).magnitude).toBe(expected);
        });
    }
});

describe("categorizeSlip — direction encoding", () => {
    it("negligible magnitude always reports on-track direction", () => {
        expect(categorizeSlip(0).direction).toBe("on-track");
        expect(categorizeSlip(1).direction).toBe("on-track");
        expect(categorizeSlip(-2).direction).toBe("on-track");
    });

    it("non-negligible positive slip reports slipping", () => {
        expect(categorizeSlip(5).direction).toBe("slipping");
        expect(categorizeSlip(100).direction).toBe("slipping");
    });

    it("non-negligible negative slip reports pulled-in", () => {
        expect(categorizeSlip(-5).direction).toBe("pulled-in");
        expect(categorizeSlip(-100).direction).toBe("pulled-in");
    });
});

describe("deriveState", () => {
    const today = new Date("2026-02-01");

    it("hasBaseline false when either baselineStart or baselineEnd is missing", () => {
        const noBase = deriveState(mkActivity({ name: "n", index: 0 }), today);
        expect(noBase.hasBaseline).toBe(false);
        const onlyStart = deriveState(mkActivity({ name: "s", index: 0,
            baselineStart: new Date("2026-01-15") }), today);
        expect(onlyStart.hasBaseline).toBe(false);
        const onlyEnd = deriveState(mkActivity({ name: "e", index: 0,
            baselineEnd: new Date("2026-02-15") }), today);
        expect(onlyEnd.hasBaseline).toBe(false);
    });

    it("hasBaseline true only when both baseline endpoints bound", () => {
        const result = deriveState(mkActivity({ name: "b", index: 0,
            baselineStart: new Date("2026-01-15"),
            baselineEnd: new Date("2026-02-15") }), today);
        expect(result.hasBaseline).toBe(true);
    });

    it("hasActual mirrors hasBaseline logic for actual endpoints", () => {
        const both = deriveState(mkActivity({ name: "a", index: 0,
            actualStart: new Date("2026-01-15"),
            actualEnd: new Date("2026-01-25") }), today);
        expect(both.hasActual).toBe(true);
        const partial = deriveState(mkActivity({ name: "p", index: 0,
            actualStart: new Date("2026-01-15") }), today);
        expect(partial.hasActual).toBe(false);
    });

    it("slip is null when baselineEnd unbound; populated when bound", () => {
        const noSlip = deriveState(mkActivity({ name: "ns", index: 0 }), today);
        expect(noSlip.slip).toBeNull();
        const withSlip = deriveState(mkActivity({ name: "s", index: 0,
            baselineEnd: new Date("2026-01-20"),
            end: new Date("2026-02-01") }), today);
        expect(withSlip.slip).not.toBeNull();
        expect(withSlip.slip!.days).toBe(12);
        expect(withSlip.slip!.direction).toBe("slipping");
    });

    it("preserves the input Activity as base (does not mutate or clone)", () => {
        const a = mkActivity({ name: "x", index: 0 });
        const state = deriveState(a, today);
        expect(state.base).toBe(a);
    });
});

describe("SlipThresholds — Format-pane override (Decision #3)", () => {
    it("DEFAULT_SLIP_THRESHOLDS matches the published constants", () => {
        expect(DEFAULT_SLIP_THRESHOLDS).toEqual({
            negligibleDays: SLIP_NEGLIGIBLE_DAYS,
            minorDays: SLIP_MINOR_DAYS,
            majorDays: SLIP_MAJOR_DAYS,
        });
    });

    it("categorizeSlip uses overridden thresholds when supplied", () => {
        const strict: SlipThresholds = { negligibleDays: 0, minorDays: 1, majorDays: 5 };
        expect(categorizeSlip(0, strict).magnitude).toBe("negligible");
        expect(categorizeSlip(1, strict).magnitude).toBe("minor");
        expect(categorizeSlip(5, strict).magnitude).toBe("major");
        expect(categorizeSlip(6, strict).magnitude).toBe("critical");
        // Same days under defaults categorize differently
        expect(categorizeSlip(1).magnitude).toBe("negligible");
        expect(categorizeSlip(5).magnitude).toBe("minor");
    });

    it("computeSlip threads thresholds through to categorization", () => {
        const lenient: SlipThresholds = { negligibleDays: 10, minorDays: 30, majorDays: 90 };
        const baselineEnd = new Date("2026-02-01");
        const forecastEnd = new Date("2026-02-09"); // 8-day slip
        // Default: 8d → major
        expect(computeSlip(baselineEnd, forecastEnd)!.magnitude).toBe("major");
        // Lenient: 8d → negligible
        expect(computeSlip(baselineEnd, forecastEnd, lenient)!.magnitude).toBe("negligible");
        expect(computeSlip(baselineEnd, forecastEnd, lenient)!.direction).toBe("on-track");
    });

    it("deriveState forwards thresholds to slip computation", () => {
        const strict: SlipThresholds = { negligibleDays: 0, minorDays: 1, majorDays: 5 };
        const today = new Date("2026-02-15");
        const activity = mkActivity({ name: "s", index: 0,
            baselineEnd: new Date("2026-02-01"),
            end: new Date("2026-02-03") }); // 2d slip
        // Default thresholds: 2d → negligible
        expect(deriveState(activity, today).slip!.magnitude).toBe("negligible");
        // Strict thresholds: 2d → minor (above negligibleDays=0 + 1)
        expect(deriveState(activity, today, strict).slip!.magnitude).toBe("major");
    });
});

describe("slipToHealthColor — EARNED escalation mapping", () => {
    const P = DEFAULT_HEALTH_PALETTE;

    it("returns null for null slip (no baseline → no escalation)", () => {
        expect(slipToHealthColor(null, P)).toBeNull();
    });

    it("returns null for on-track direction (negligible magnitude)", () => {
        expect(slipToHealthColor(categorizeSlip(0), P)).toBeNull();
        expect(slipToHealthColor(categorizeSlip(1), P)).toBeNull();
        expect(slipToHealthColor(categorizeSlip(-2), P)).toBeNull();
    });

    it("returns green for any pulled-in magnitude (ahead of schedule)", () => {
        expect(slipToHealthColor(categorizeSlip(-5),   P)).toBe(P.green);  // minor pulled-in
        expect(slipToHealthColor(categorizeSlip(-20),  P)).toBe(P.green);  // major pulled-in
        expect(slipToHealthColor(categorizeSlip(-100), P)).toBe(P.green);  // critical pulled-in
    });

    it("returns yellow for minor slipping", () => {
        expect(slipToHealthColor(categorizeSlip(5), P)).toBe(P.yellow);
        expect(slipToHealthColor(categorizeSlip(7), P)).toBe(P.yellow);
    });

    it("returns red for major slipping", () => {
        expect(slipToHealthColor(categorizeSlip(15), P)).toBe(P.red);
        expect(slipToHealthColor(categorizeSlip(30), P)).toBe(P.red);
    });

    it("returns red for critical slipping (3-color palette collapses major+critical)", () => {
        expect(slipToHealthColor(categorizeSlip(60),  P)).toBe(P.red);
        expect(slipToHealthColor(categorizeSlip(365), P)).toBe(P.red);
    });

    it("uses the caller-supplied palette (operator-customized colors)", () => {
        const custom = { green: "#0f0", yellow: "#ff0", red: "#f00", fallback: "#888" };
        expect(slipToHealthColor(categorizeSlip(-10), custom)).toBe("#0f0");
        expect(slipToHealthColor(categorizeSlip(5),   custom)).toBe("#ff0");
        expect(slipToHealthColor(categorizeSlip(50),  custom)).toBe("#f00");
    });
});
