import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderSlipIBeams } from "./slipIBeam";
import { Activity } from "../../../viewmodel";

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

describe("renderSlipIBeams (INF-3787 — vertical I-beam at baseline-end date)", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
    });

    const beams = () => g.selectAll<SVGPathElement, unknown>("path.slip-ibeam").nodes();

    it("skips activities without baselineEnd", () => {
        renderSlipIBeams(g, [mkActivity({ name: "no-base", index: 0 })], xScale, 30);
        expect(beams()).toHaveLength(0);
    });

    it("skips on-track activities (slip <= negligible threshold)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderSlipIBeams(g, [
            mkActivity({ name: "exact", index: 0, end: baselineEnd, baselineEnd }),
            mkActivity({ name: "1d-slip", index: 1, end: new Date("2026-02-02"), baselineEnd }),
        ], xScale, 30);
        expect(beams()).toHaveLength(0);
    });

    it("emits I-beam path with 3 subpaths (top cap + vertical stem + bottom cap)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderSlipIBeams(g, [
            mkActivity({ name: "S", index: 0, end: new Date("2026-02-15"), baselineEnd }),
        ], xScale, 30);
        const beam = beams()[0];
        const d = beam.getAttribute("d")!;
        expect((d.match(/M/g) || []).length).toBe(3); // 3 subpaths
        expect((d.match(/L/g) || []).length).toBe(3);
    });

    it("vertical stem is centered at xScale(baselineEnd) — not at forecast end", () => {
        const baselineEnd = new Date("2026-02-01");
        const forecastEnd = new Date("2026-04-01");
        renderSlipIBeams(g, [
            mkActivity({ name: "A", index: 0, end: forecastEnd, baselineEnd }),
        ], xScale, 30);
        const nums = beams()[0].getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        // Subpath 2 is M(x, yTop) L(x, yBottom) → nums[4] and nums[6] are both stem x
        expect(nums[4]).toBeCloseTo(xScale(baselineEnd));
        expect(nums[6]).toBeCloseTo(xScale(baselineEnd));
        // Stem x must NOT equal forecast end x
        expect(nums[4]).not.toBeCloseTo(xScale(forecastEnd));
    });

    it("top and bottom caps span symmetrically around the baseline x (cap half-width = 4px)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderSlipIBeams(g, [
            mkActivity({ name: "C", index: 0, end: new Date("2026-02-15"), baselineEnd }),
        ], xScale, 30);
        const nums = beams()[0].getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const x = xScale(baselineEnd);
        // Subpath 1 (top cap):    M(x-4, yTop)    L(x+4, yTop)
        // Subpath 3 (bottom cap): M(x-4, yBottom) L(x+4, yBottom)
        expect(nums[0]).toBeCloseTo(x - 4);
        expect(nums[2]).toBeCloseTo(x + 4);
        expect(nums[8]).toBeCloseTo(x - 4);
        expect(nums[10]).toBeCloseTo(x + 4);
        // Top cap y === stem yTop; bottom cap y === stem yBottom
        expect(nums[1]).toBe(nums[5]);
        expect(nums[9]).toBe(nums[7]);
    });

    it("vertical span matches the SHRUNKEN bar's rendered y range (caps on bar edges)", () => {
        // Bullet-chart convention: the comparative tick lives ON the
        // featured measure. I-beam yTop = bar top edge, yBottom = bar
        // bottom edge, stem bisects the shrunken bar at baseline-end x.
        const rowHeight = 30;
        renderSlipIBeams(g, [
            mkActivity({ name: "row-1", index: 1,
                end: new Date("2026-02-15"),
                baselineEnd: new Date("2026-02-01") }),
        ], xScale, rowHeight);
        const nums = beams()[0].getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const yTop = nums[1];
        const yBottom = nums[7];
        // barH(30) = max(8, floor(30*0.78)) = 23
        // shrunkBarH(30) = max(8, floor(23*0.7)) = 16
        // padding = (30-23)/2 = 3.5
        // shiftedYOffset = 3.5 + (23 - 16) = 10.5
        // I-beam yTop = 1*30 + 10.5 = 40.5
        // I-beam yBottom = 40.5 + 16 = 56.5
        const expectedTop = 1 * 30 + 10.5;
        const expectedBot = expectedTop + 16;
        expect(yTop).toBeCloseTo(expectedTop);
        expect(yBottom).toBeCloseTo(expectedBot);
    });

    it("emits neutral grey stroke (no semantic color signal)", () => {
        renderSlipIBeams(g, [
            mkActivity({ name: "s", index: 0,
                end: new Date("2026-02-15"), baselineEnd: new Date("2026-02-01") }),
        ], xScale, 30);
        const beam = beams()[0];
        expect(beam.getAttribute("stroke")).toBe("#444444");
        expect(beam.getAttribute("fill")).toBe("none");
        expect(beam.getAttribute("stroke-width")).toBe("1.8");
        expect(beam.getAttribute("pointer-events")).toBe("none");
    });

    it("forwards thresholds override to slip computation", () => {
        const baselineEnd = new Date("2026-02-01");
        renderSlipIBeams(g, [
            mkActivity({ name: "x", index: 0, end: new Date("2026-02-04"), baselineEnd }),
        ], xScale, 30, { negligibleDays: 5, minorDays: 10, majorDays: 30 });
        expect(beams()).toHaveLength(0);
    });
});
