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

describe("renderSlipIBeams (INF-3787 — I-beam in freed top space)", () => {
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

    it("skips on-track activities (negligible slip)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderSlipIBeams(g, [
            mkActivity({ name: "exact", index: 0, end: baselineEnd, baselineEnd }),
            mkActivity({ name: "1d-slip", index: 1, end: new Date("2026-02-02"), baselineEnd }),
        ], xScale, 30);
        expect(beams()).toHaveLength(0);
    });

    it("emits I-beam path with 3 subpaths (left cap + connector + right cap)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderSlipIBeams(g, [
            mkActivity({ name: "slip", index: 0, end: new Date("2026-02-15"), baselineEnd }),
        ], xScale, 30);
        const beam = beams()[0];
        const d = beam.getAttribute("d")!;
        // 3 M's = 3 subpath starts (left cap, connector, right cap)
        expect((d.match(/M/g) || []).length).toBe(3);
        expect((d.match(/L/g) || []).length).toBe(3);
    });

    it("orders caps by chronology (x1 = earlier of baselineEnd/forecastEnd)", () => {
        const baselineEnd = new Date("2026-02-01");
        // Slipping case: end is LATER → cap1 at baseline, cap2 at end
        renderSlipIBeams(g, [
            mkActivity({ name: "slipping", index: 0, end: new Date("2026-02-15"), baselineEnd }),
        ], xScale, 30);
        const slipNums = beams()[0].getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        // First cap at xScale(baselineEnd), second at xScale(end). Slipping → baseline < end.
        expect(slipNums[0]).toBeLessThan(slipNums[8]); // cap1.x < cap2.x

        // Pulled-in case: end is EARLIER → cap1 at end, cap2 at baseline
        document.body.replaceChildren();
        const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.appendChild(svg2);
        const g2 = select(svg2).append<SVGGElement>("g");
        renderSlipIBeams(g2, [
            mkActivity({ name: "pulled", index: 0,
                end: new Date("2026-01-15"), baselineEnd: new Date("2026-02-15") }),
        ], xScale, 30);
        const pullNums = g2.selectAll<SVGPathElement, unknown>("path.slip-ibeam").node()!.getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        expect(pullNums[0]).toBeLessThan(pullNums[8]); // still chronologically ordered
    });

    it("positions I-beam at TOP of row (in freed space when bar shrinks)", () => {
        const rowHeight = 30;
        renderSlipIBeams(g, [
            mkActivity({ name: "row-2", index: 2,
                end: new Date("2026-02-15"),
                baselineEnd: new Date("2026-02-01") }),
        ], xScale, rowHeight);
        const beam = beams()[0];
        const nums = beam.getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        // First cap is M(x1, yTop) → nums[1] is yTop
        const yTop = nums[1];
        // Row 2's top is at 60 (2 * 30); I-beam should be near there, not at row middle
        expect(yTop).toBeGreaterThanOrEqual(60);
        expect(yTop).toBeLessThan(60 + rowHeight / 2);
    });

    it("emits neutral grey stroke (no semantic color)", () => {
        renderSlipIBeams(g, [
            mkActivity({ name: "s", index: 0,
                end: new Date("2026-02-15"), baselineEnd: new Date("2026-02-01") }),
        ], xScale, 30);
        const beam = beams()[0];
        expect(beam.getAttribute("stroke")).toBe("#444444");
        expect(beam.getAttribute("fill")).toBe("none");
        expect(beam.getAttribute("pointer-events")).toBe("none");
    });

    it("forwards thresholds override to slip computation", () => {
        const baselineEnd = new Date("2026-02-01");
        // 3-day slip — default: minor (emits); strict negligibleDays=5: negligible (skipped)
        renderSlipIBeams(g, [
            mkActivity({ name: "x", index: 0, end: new Date("2026-02-04"), baselineEnd }),
        ], xScale, 30, { negligibleDays: 5, minorDays: 10, majorDays: 30 });
        expect(beams()).toHaveLength(0);
    });
});
