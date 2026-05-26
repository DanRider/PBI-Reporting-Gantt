// v2.2 B3 — healthColor() resolver tests.

import { describe, it, expect } from "vitest";
import { healthColor, DEFAULT_HEALTH_PALETTE, HealthColorPalette } from "./healthColor";

const P = DEFAULT_HEALTH_PALETTE;

describe("healthColor — null / empty / whitespace input", () => {
    it("returns fallback for null", () => {
        expect(healthColor(null)).toBe(P.fallback);
    });
    it("returns fallback for empty string", () => {
        expect(healthColor("")).toBe(P.fallback);
    });
    it("returns fallback for whitespace-only string", () => {
        expect(healthColor("   ")).toBe(P.fallback);
    });
});

describe("healthColor — literal color names (the prior regex's only path)", () => {
    it("Green -> green", () => { expect(healthColor("Green")).toBe(P.green); });
    it("GREEN -> green (case-insensitive)", () => { expect(healthColor("GREEN")).toBe(P.green); });
    it("Yellow -> yellow", () => { expect(healthColor("Yellow")).toBe(P.yellow); });
    it("Amber -> yellow", () => { expect(healthColor("Amber")).toBe(P.yellow); });
    it("Red -> red", () => { expect(healthColor("Red")).toBe(P.red); });
});

describe("healthColor — single-letter codes", () => {
    it("G -> green", () => { expect(healthColor("G")).toBe(P.green); });
    it("Y -> yellow", () => { expect(healthColor("Y")).toBe(P.yellow); });
    it("R -> red", () => { expect(healthColor("R")).toBe(P.red); });
});

describe("healthColor — semantic status strings (the new path)", () => {
    it("On Track -> green", () => { expect(healthColor("On Track")).toBe(P.green); });
    it("on-track -> green", () => { expect(healthColor("on-track")).toBe(P.green); });
    it("OnTrack -> green", () => { expect(healthColor("OnTrack")).toBe(P.green); });
    it("OK -> green", () => { expect(healthColor("OK")).toBe(P.green); });
    it("Complete -> green", () => { expect(healthColor("Complete")).toBe(P.green); });
    it("Completed -> green (substring)", () => { expect(healthColor("Completed")).toBe(P.green); });
    it("Done -> green", () => { expect(healthColor("Done")).toBe(P.green); });
    it("Good -> green", () => { expect(healthColor("Good")).toBe(P.green); });

    it("At Risk -> yellow", () => { expect(healthColor("At Risk")).toBe(P.yellow); });
    it("at_risk -> yellow", () => { expect(healthColor("at_risk")).toBe(P.yellow); });
    it("Warning -> yellow", () => { expect(healthColor("Warning")).toBe(P.yellow); });
    it("Caution -> yellow", () => { expect(healthColor("Caution")).toBe(P.yellow); });

    it("Off Track -> red", () => { expect(healthColor("Off Track")).toBe(P.red); });
    it("off-track -> red", () => { expect(healthColor("off-track")).toBe(P.red); });
    it("Blocked -> red", () => { expect(healthColor("Blocked")).toBe(P.red); });
    it("Critical -> red", () => { expect(healthColor("Critical")).toBe(P.red); });
    it("Bad -> red", () => { expect(healthColor("Bad")).toBe(P.red); });
});

describe("healthColor — false-positive avoidance", () => {
    it("'oktoberfest' does NOT match OK (word boundary)", () => {
        expect(healthColor("oktoberfest")).toBe(P.fallback);
    });
    it("'badass' does NOT match Bad (word boundary)", () => {
        expect(healthColor("badass")).toBe(P.fallback);
    });
    it("unrecognized status -> fallback", () => {
        expect(healthColor("Pending")).toBe(P.fallback);
    });
    it("numeric string -> fallback", () => {
        expect(healthColor("42")).toBe(P.fallback);
    });
});

describe("healthColor — custom palette respected", () => {
    const custom: HealthColorPalette = {
        green: "#00ff00", yellow: "#ffff00", red: "#ff0000", fallback: "#cccccc",
    };
    it("uses custom green", () => { expect(healthColor("On Track", custom)).toBe(custom.green); });
    it("uses custom yellow", () => { expect(healthColor("At Risk", custom)).toBe(custom.yellow); });
    it("uses custom red", () => { expect(healthColor("Off Track", custom)).toBe(custom.red); });
    it("uses custom fallback", () => { expect(healthColor("Unknown", custom)).toBe(custom.fallback); });
});

describe("healthColor — whitespace trimming", () => {
    it("'  Green  ' -> green (trimmed)", () => { expect(healthColor("  Green  ")).toBe(P.green); });
    it("'\\t On Track \\n' -> green (trimmed)", () => { expect(healthColor("\t On Track \n")).toBe(P.green); });
});
