import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderBaselineMarks } from "./baselineMark";
import { Activity } from "../../../viewmodel";
import { barHeightFor } from "../bars";

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

describe("renderBaselineMarks (INF-3787 — bullet-chart comparative tick)", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
    });

    const marks = () => g.selectAll<SVGPathElement, unknown>("path.baseline-mark").nodes();

    it("skips activities without baselineEnd", () => {
        renderBaselineMarks(g, [mkActivity({ name: "no-base", index: 0 })], xScale, 30);
        expect(marks()).toHaveLength(0);
    });

    it("skips on-track activities (|slip| <= negligible threshold)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderBaselineMarks(g, [
            mkActivity({ name: "exact", index: 0, end: baselineEnd, baselineEnd }),
            mkActivity({ name: "1d-slip", index: 1, end: new Date("2026-02-02"), baselineEnd }),
        ], xScale, 30);
        expect(marks()).toHaveLength(0);
    });

    it("renders ONE path per shifted activity (slipping or pulled-in)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderBaselineMarks(g, [
            mkActivity({ name: "slipping", index: 0, end: new Date("2026-02-15"), baselineEnd }),
            mkActivity({ name: "pulled",  index: 1, end: new Date("2026-01-15"), baselineEnd }),
            mkActivity({ name: "on-track", index: 2, end: baselineEnd, baselineEnd }),
        ], xScale, 30);
        expect(marks()).toHaveLength(2);
    });

    it("path is a single 2-point line (M ... L ...) — no multi-subpath", () => {
        const baselineEnd = new Date("2026-02-01");
        renderBaselineMarks(g, [
            mkActivity({ name: "s", index: 0, end: new Date("2026-02-15"), baselineEnd }),
        ], xScale, 30);
        const d = marks()[0].getAttribute("d")!;
        expect((d.match(/M/g) || []).length).toBe(1);
        expect((d.match(/L/g) || []).length).toBe(1);
    });

    it("tick x-position matches xScale(baselineEnd), NOT forecast end", () => {
        const baselineEnd = new Date("2026-02-01");
        const forecastEnd = new Date("2026-04-01");
        renderBaselineMarks(g, [
            mkActivity({ name: "A", index: 0, end: forecastEnd, baselineEnd }),
        ], xScale, 30);
        const nums = marks()[0].getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        // M(x, yTop) L(x, yBottom) — nums[0] and nums[2] both equal x
        expect(nums[0]).toBeCloseTo(xScale(baselineEnd));
        expect(nums[2]).toBeCloseTo(xScale(baselineEnd));
        expect(nums[0]).not.toBeCloseTo(xScale(forecastEnd));
    });

    it("tick y range matches the bar's y range (inset by 1px from top + bottom)", () => {
        const rowHeight = 30;
        const barH = barHeightFor(rowHeight);
        const padding = (rowHeight - barH) / 2;
        renderBaselineMarks(g, [
            mkActivity({ name: "row-2", index: 2,
                end: new Date("2026-02-15"),
                baselineEnd: new Date("2026-02-01") }),
        ], xScale, rowHeight);
        const nums = marks()[0].getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const yTop = nums[1];
        const yBottom = nums[3];
        // Expected: yTop = rowTop + padding + 1, yBottom = rowTop + padding + barH - 1
        const rowTop = 2 * rowHeight;
        expect(yTop).toBeCloseTo(rowTop + padding + 1);
        expect(yBottom).toBeCloseTo(rowTop + padding + barH - 1);
        // Stem height should equal (barH - 2 * inset)
        expect(yBottom - yTop).toBeCloseTo(barH - 2);
    });

    it("emits dark slate stroke + 2px width (high contrast against any lane color)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderBaselineMarks(g, [
            mkActivity({ name: "s", index: 0, end: new Date("2026-02-15"), baselineEnd }),
        ], xScale, 30);
        const mark = marks()[0];
        expect(mark.getAttribute("stroke")).toBe("#1f2937");
        expect(mark.getAttribute("stroke-width")).toBe("2");
        expect(mark.getAttribute("fill")).toBe("none");
        expect(mark.getAttribute("pointer-events")).toBe("none");
    });

    it("forwards SlipThresholds override → eligibility reclassifies", () => {
        const baselineEnd = new Date("2026-02-01");
        // 3-day slip: default = minor (emits); strict negligibleDays=5 = on-track (skipped)
        renderBaselineMarks(g, [
            mkActivity({ name: "x", index: 0, end: new Date("2026-02-04"), baselineEnd }),
        ], xScale, 30, { negligibleDays: 5, minorDays: 10, majorDays: 30 });
        expect(marks()).toHaveLength(0);
    });
});
