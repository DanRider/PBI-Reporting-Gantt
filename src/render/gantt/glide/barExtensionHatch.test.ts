import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import {
    renderBarExtensionHatches,
    ensureBarHatchPattern,
    BAR_HATCH_PATTERN_ID,
} from "./barExtensionHatch";
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

describe("ensureBarHatchPattern", () => {
    let svg: Selection<SVGSVGElement, unknown, null, undefined>;

    beforeEach(() => {
        const root = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(root);
        svg = select(root as SVGSVGElement);
    });

    it("creates a <defs> + <pattern> on first call", () => {
        ensureBarHatchPattern(svg);
        expect(svg.selectAll(`defs > pattern#${BAR_HATCH_PATTERN_ID}`).nodes()).toHaveLength(1);
    });

    it("is idempotent — does not duplicate pattern across multiple calls", () => {
        ensureBarHatchPattern(svg);
        ensureBarHatchPattern(svg);
        ensureBarHatchPattern(svg);
        expect(svg.selectAll(`defs > pattern#${BAR_HATCH_PATTERN_ID}`).nodes()).toHaveLength(1);
    });

    it("pattern emits a diagonal-stripe via rotate(45) + single internal line", () => {
        ensureBarHatchPattern(svg);
        const pattern = svg.select(`pattern#${BAR_HATCH_PATTERN_ID}`);
        expect(pattern.attr("patternTransform")).toBe("rotate(45)");
        expect(pattern.selectAll("line").nodes()).toHaveLength(1);
    });
});

describe("renderBarExtensionHatches", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
    });

    const hatches = () => g.selectAll<SVGRectElement, unknown>("rect.bar-extension-hatch").nodes();

    it("skips activities without baselineEnd", () => {
        renderBarExtensionHatches(g, [mkActivity({ name: "no-base", index: 0 })], xScale, 30);
        expect(hatches()).toHaveLength(0);
    });

    it("skips on-track activities (|slip| <= negligible)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderBarExtensionHatches(g, [
            mkActivity({ name: "exact", index: 0, end: baselineEnd, baselineEnd }),
            mkActivity({ name: "1d", index: 1, end: new Date("2026-02-02"), baselineEnd }),
        ], xScale, 30);
        expect(hatches()).toHaveLength(0);
    });

    it("renders rect from min(baseline,forecast) to max — width = |slip| in pixels", () => {
        const baselineEnd = new Date("2026-02-01");
        const forecastEnd = new Date("2026-02-15");
        renderBarExtensionHatches(g, [
            mkActivity({ name: "slipping", index: 0, end: forecastEnd, baselineEnd }),
        ], xScale, 30);
        const rect = hatches()[0];
        expect(Number(rect.getAttribute("x"))).toBeCloseTo(xScale(baselineEnd));
        expect(Number(rect.getAttribute("width"))).toBeCloseTo(xScale(forecastEnd) - xScale(baselineEnd));
    });

    it("handles pull-in: hatched zone runs from forecast-end to baseline-end", () => {
        const baselineEnd = new Date("2026-02-15");
        const forecastEnd = new Date("2026-02-01");
        renderBarExtensionHatches(g, [
            mkActivity({ name: "pulled", index: 0, end: forecastEnd, baselineEnd }),
        ], xScale, 30);
        const rect = hatches()[0];
        expect(Number(rect.getAttribute("x"))).toBeCloseTo(xScale(forecastEnd));
        expect(Number(rect.getAttribute("width"))).toBeCloseTo(xScale(baselineEnd) - xScale(forecastEnd));
    });

    it("uses the hatch pattern URL as fill", () => {
        renderBarExtensionHatches(g, [
            mkActivity({ name: "s", index: 0,
                end: new Date("2026-02-15"), baselineEnd: new Date("2026-02-01") }),
        ], xScale, 30);
        expect(hatches()[0].getAttribute("fill")).toBe(`url(#${BAR_HATCH_PATTERN_ID})`);
        expect(hatches()[0].getAttribute("pointer-events")).toBe("none");
    });

    it("y/height align with the forecast bar zone", () => {
        const rowHeight = 30;
        renderBarExtensionHatches(g, [
            mkActivity({ name: "row-2", index: 2,
                end: new Date("2026-02-15"), baselineEnd: new Date("2026-02-01") }),
        ], xScale, rowHeight);
        const rect = hatches()[0];
        // y = index * rowHeight + padding (= (rowHeight - barH) / 2)
        // barH for rowHeight=30 is max(8, floor(30*0.78)) = 23 → padding = 3.5
        expect(Number(rect.getAttribute("y"))).toBeCloseTo(2 * 30 + 3.5);
        expect(Number(rect.getAttribute("height"))).toBeCloseTo(23);
    });
});
