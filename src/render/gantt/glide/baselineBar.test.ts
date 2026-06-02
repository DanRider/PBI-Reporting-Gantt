import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderBaselineBars } from "./baselineBar";
import { Activity } from "../../../viewmodel";
import { buildColorContext, ColorContext } from "../../../utils/colors";

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

describe("renderBaselineBars (INF-3787 glide-path verb #1)", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = buildColorContext({ L: "#3366cc" }, {});
    });

    it("filters out activities missing either baseline endpoint", () => {
        const acts: Activity[] = [
            mkActivity({ name: "with-baseline", index: 0,
                baselineStart: new Date("2026-01-15"), baselineEnd: new Date("2026-02-15") }),
            mkActivity({ name: "no-baseline-start", index: 1, baselineEnd: new Date("2026-02-15") }),
            mkActivity({ name: "no-baseline-end",   index: 2, baselineStart: new Date("2026-01-15") }),
            mkActivity({ name: "no-baseline",       index: 3 }),
        ];
        renderBaselineBars(g, acts, xScale, 30, colors);
        const rects = g.selectAll<SVGRectElement, Activity>("rect.baseline-bar").nodes();
        expect(rects).toHaveLength(1);
        expect(rects[0].getAttribute("data-activity")).toBe("with-baseline");
    });

    it("emits dashed outline with lane-color stroke and no fill", () => {
        renderBaselineBars(g, [
            mkActivity({ name: "B", index: 0, area: "L",
                baselineStart: new Date("2026-01-15"), baselineEnd: new Date("2026-02-15") }),
        ], xScale, 30, colors);
        const rect = g.select<SVGRectElement>("rect.baseline-bar").node()!;
        expect(rect.getAttribute("fill")).toBe("none");
        expect(rect.getAttribute("stroke-dasharray")).toBe("4 2");
        expect(rect.getAttribute("stroke")).toBe("#3366cc");
        expect(rect.getAttribute("stroke-width")).toBe("1.5");
        expect(rect.getAttribute("pointer-events")).toBe("none");
    });

    it("derives x and width from baseline dates (not forecast start/end)", () => {
        const baselineStart = new Date("2026-01-15");
        const baselineEnd = new Date("2026-02-01");
        renderBaselineBars(g, [
            mkActivity({ name: "C", index: 0,
                start: new Date("2026-01-01"),
                end: new Date("2026-04-01"),
                baselineStart, baselineEnd }),
        ], xScale, 30, colors);
        const rect = g.select<SVGRectElement>("rect.baseline-bar").node()!;
        expect(Number(rect.getAttribute("x"))).toBeCloseTo(xScale(baselineStart));
        expect(Number(rect.getAttribute("width"))).toBeCloseTo(xScale(baselineEnd) - xScale(baselineStart));
    });

    it("clamps width to 0 when baselineEnd predates baselineStart", () => {
        renderBaselineBars(g, [
            mkActivity({ name: "D", index: 0,
                baselineStart: new Date("2026-02-15"),
                baselineEnd: new Date("2026-01-15") }),
        ], xScale, 30, colors);
        const rect = g.select<SVGRectElement>("rect.baseline-bar").node()!;
        expect(Number(rect.getAttribute("width"))).toBe(0);
    });

    it("positions y at the activity's row + bar padding (aligns with forecast bar)", () => {
        const rowHeight = 40;
        renderBaselineBars(g, [
            mkActivity({ name: "row-3", index: 3,
                baselineStart: new Date("2026-01-15"), baselineEnd: new Date("2026-02-15") }),
        ], xScale, rowHeight, colors);
        const rect = g.select<SVGRectElement>("rect.baseline-bar").node()!;
        const barH = Number(rect.getAttribute("height"));
        const padding = (rowHeight - barH) / 2;
        expect(Number(rect.getAttribute("y"))).toBe(3 * rowHeight + padding);
    });
});
