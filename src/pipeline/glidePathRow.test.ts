import { describe, it, expect } from "vitest";
import { Activity } from "../viewmodel";
import { deriveState } from "../model/activityState";
import { glidePathRow } from "./glidePathRow";
import { DEFAULT_HEALTH_PALETTE } from "../utils/healthColor";

function mkActivity(over: Partial<Activity> & { name: string; index: number }): Activity {
    return {
        name: over.name,
        area: over.area ?? "L",
        start: over.start ?? new Date("2026-01-01"),
        end: over.end ?? new Date("2026-02-01"),
        index: over.index,
        note: null,
        health: over.health ?? null,
        baselineStart: over.baselineStart,
        baselineEnd: over.baselineEnd,
        actualStart: over.actualStart,
        actualEnd: over.actualEnd,
    };
}

const today = new Date("2026-02-01");
const P = DEFAULT_HEALTH_PALETTE;

describe("glidePathRow — bullet color source resolution (EARNED escalation)", () => {
    it("explicit health binding wins regardless of slip", () => {
        const state = deriveState(mkActivity({ name: "h", index: 0,
            health: "At Risk",
            baselineEnd: new Date("2026-01-15"),
            end: new Date("2026-02-15") }), today); // 31d critical slip
        const intent = glidePathRow(state, P);
        expect(intent.bulletColorSource).toBe("explicit-health");
        // bulletColor stays null on explicit path — caller resolves via
        // healthColor() so provenance + extension hooks stay separate.
        expect(intent.bulletColor).toBeNull();
        // Slip still flagged as whisker-eligible (toggle gating is caller's job).
        expect(intent.isWhiskerEligible).toBe(true);
    });

    it("slip-derived when no explicit health AND slip is non-negligible", () => {
        const state = deriveState(mkActivity({ name: "s", index: 0,
            baselineEnd: new Date("2026-01-15"),
            end: new Date("2026-02-15") }), today); // 31d critical slip
        const intent = glidePathRow(state, P);
        expect(intent.bulletColorSource).toBe("slip-derived");
        expect(intent.bulletColor).toBe(P.red);
        expect(intent.isWhiskerEligible).toBe(true);
    });

    it("lane-fallback when no explicit health AND no slip (or on-track)", () => {
        // No baseline → no slip → lane fallback
        const noSlip = deriveState(mkActivity({ name: "n", index: 0 }), today);
        expect(glidePathRow(noSlip, P).bulletColorSource).toBe("lane-fallback");
        expect(glidePathRow(noSlip, P).bulletColor).toBeNull();
        expect(glidePathRow(noSlip, P).isWhiskerEligible).toBe(false);

        // Baseline but on-track → lane fallback
        const onTrack = deriveState(mkActivity({ name: "o", index: 0,
            baselineEnd: new Date("2026-02-01"),
            end: new Date("2026-02-01") }), today);
        expect(glidePathRow(onTrack, P).bulletColorSource).toBe("lane-fallback");
        expect(glidePathRow(onTrack, P).isWhiskerEligible).toBe(false);
    });

    it("slip-derived produces yellow for minor, red for major+critical, green for pulled-in", () => {
        const minor = deriveState(mkActivity({ name: "m", index: 0,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-06") }), today); // +5d
        expect(glidePathRow(minor, P).bulletColor).toBe(P.yellow);

        const major = deriveState(mkActivity({ name: "M", index: 0,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-20") }), today); // +19d
        expect(glidePathRow(major, P).bulletColor).toBe(P.red);

        const pulled = deriveState(mkActivity({ name: "p", index: 0,
            baselineEnd: new Date("2026-02-15"), end: new Date("2026-02-01") }), today); // -14d
        expect(glidePathRow(pulled, P).bulletColor).toBe(P.green);
    });

    it("uses caller-supplied palette (theme-customized colors propagate)", () => {
        const custom = { green: "#0f0", yellow: "#ff0", red: "#f00", fallback: "#888" };
        const state = deriveState(mkActivity({ name: "x", index: 0,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-06") }), today); // +5d minor
        expect(glidePathRow(state, custom).bulletColor).toBe("#ff0");
    });

    it("empty-string health is treated as unbound (falls through to slip-derived)", () => {
        const state = deriveState(mkActivity({ name: "e", index: 0,
            health: "   ",
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-06") }), today);
        expect(glidePathRow(state, P).bulletColorSource).toBe("slip-derived");
    });
});
