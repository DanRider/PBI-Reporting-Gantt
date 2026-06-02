import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderActualSegments } from "./actualSegment";
import { Activity } from "../../../viewmodel";
import { buildColorContext, ColorContext } from "../../../utils/colors";
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

describe("renderActualSegments (INF-3787 glide-path verb #2)", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = buildColorContext({ L: "#aa5500" }, {});
    });

    it("filters out activities missing either actual endpoint", () => {
        const acts: Activity[] = [
            mkActivity({ name: "with-actual", index: 0,
                actualStart: new Date("2026-01-10"), actualEnd: new Date("2026-01-25") }),
            mkActivity({ name: "no-actual-start", index: 1, actualEnd: new Date("2026-01-25") }),
            mkActivity({ name: "no-actual-end",   index: 2, actualStart: new Date("2026-01-10") }),
            mkActivity({ name: "no-actual",       index: 3 }),
        ];
        renderActualSegments(g, acts, xScale, 30, colors);
        const rects = g.selectAll<SVGRectElement, Activity>("rect.actual-segment").nodes();
        expect(rects).toHaveLength(1);
        expect(rects[0].getAttribute("data-activity")).toBe("with-actual");
    });

    it("emits solid-fill rect with lane color (no stroke, no dasharray)", () => {
        renderActualSegments(g, [
            mkActivity({ name: "A", index: 0, area: "L",
                actualStart: new Date("2026-01-10"), actualEnd: new Date("2026-01-25") }),
        ], xScale, 30, colors);
        const rect = g.select<SVGRectElement>("rect.actual-segment").node()!;
        expect(rect.getAttribute("fill")).toBe("#aa5500");
        expect(rect.getAttribute("stroke")).toBeNull();
        expect(rect.getAttribute("stroke-dasharray")).toBeNull();
        expect(rect.getAttribute("pointer-events")).toBe("none");
    });

    it("renders at half forecast-bar height, anchored at the bottom of the bar zone", () => {
        const rowHeight = 40;
        const barH = barHeightFor(rowHeight);
        const expectedActualH = Math.max(4, Math.floor(barH / 2));
        const padding = (rowHeight - barH) / 2;
        const expectedActualY = padding + (barH - expectedActualH);
        renderActualSegments(g, [
            mkActivity({ name: "row-0", index: 0,
                actualStart: new Date("2026-01-10"), actualEnd: new Date("2026-01-25") }),
        ], xScale, rowHeight, colors);
        const rect = g.select<SVGRectElement>("rect.actual-segment").node()!;
        expect(Number(rect.getAttribute("height"))).toBe(expectedActualH);
        expect(Number(rect.getAttribute("y"))).toBe(expectedActualY);
    });

    it("derives x and width from actual dates (not forecast start/end)", () => {
        const actualStart = new Date("2026-01-10");
        const actualEnd = new Date("2026-01-25");
        renderActualSegments(g, [
            mkActivity({ name: "B", index: 0,
                start: new Date("2026-01-01"),
                end: new Date("2026-04-01"),
                actualStart, actualEnd }),
        ], xScale, 30, colors);
        const rect = g.select<SVGRectElement>("rect.actual-segment").node()!;
        expect(Number(rect.getAttribute("x"))).toBeCloseTo(xScale(actualStart));
        expect(Number(rect.getAttribute("width"))).toBeCloseTo(xScale(actualEnd) - xScale(actualStart));
    });

    it("enforces minimum height floor (ACTUAL_MIN_HEIGHT_PX) when bar height is tiny", () => {
        // rowHeight=10 -> barH=Math.max(8, floor(10*0.78))=8 -> actualH=Math.max(4, floor(8/2))=4
        renderActualSegments(g, [
            mkActivity({ name: "tiny", index: 0,
                actualStart: new Date("2026-01-10"), actualEnd: new Date("2026-01-25") }),
        ], xScale, 10, colors);
        const rect = g.select<SVGRectElement>("rect.actual-segment").node()!;
        expect(Number(rect.getAttribute("height"))).toBeGreaterThanOrEqual(4);
    });

    it("clamps width to 0 when actualEnd predates actualStart", () => {
        renderActualSegments(g, [
            mkActivity({ name: "neg", index: 0,
                actualStart: new Date("2026-01-25"),
                actualEnd: new Date("2026-01-10") }),
        ], xScale, 30, colors);
        const rect = g.select<SVGRectElement>("rect.actual-segment").node()!;
        expect(Number(rect.getAttribute("width"))).toBe(0);
    });
});
