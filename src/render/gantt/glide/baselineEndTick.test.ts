import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderActivityBaselineTicks } from "./baselineEndTick";
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

describe("renderActivityBaselineTicks (INF-3787 activity baseline-end tick)", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
    });

    const ticks = () => g.selectAll<SVGLineElement, unknown>("line.activity-baseline-tick").nodes();

    it("filters out activities without baselineEnd", () => {
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "no-base", index: 0 }),
            mkActivity({ name: "with-base", index: 1, baselineEnd: new Date("2026-02-15") }),
        ], xScale, 30);
        expect(ticks()).toHaveLength(1);
        expect(ticks()[0].getAttribute("data-activity")).toBe("with-base");
    });

    it("renders short vertical tick at baselineEnd x-position", () => {
        const baselineEnd = new Date("2026-02-15");
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "A", index: 0, baselineEnd }),
        ], xScale, 30);
        const tick = ticks()[0];
        const x = xScale(baselineEnd);
        expect(Number(tick.getAttribute("x1"))).toBeCloseTo(x);
        expect(Number(tick.getAttribute("x2"))).toBeCloseTo(x);
    });

    it("positions tick BELOW the forecast bar (yTop > bar bottom)", () => {
        const rowHeight = 30;
        const barH = barHeightFor(rowHeight);
        const padding = (rowHeight - barH) / 2;
        const expectedBarBottom = 0 * rowHeight + padding + barH;
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "B", index: 0, baselineEnd: new Date("2026-02-15") }),
        ], xScale, rowHeight);
        const tick = ticks()[0];
        const yTop = Number(tick.getAttribute("y1"));
        const yBottom = Number(tick.getAttribute("y2"));
        expect(yTop).toBeGreaterThan(expectedBarBottom);
        expect(yBottom).toBeGreaterThan(yTop);
    });

    it("tick has fixed length (6px) regardless of rowHeight", () => {
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "C", index: 0, baselineEnd: new Date("2026-02-15") }),
        ], xScale, 30);
        const tick = ticks()[0];
        const length = Number(tick.getAttribute("y2")) - Number(tick.getAttribute("y1"));
        expect(length).toBe(6);
    });

    it("emits neutral grey stroke (no semantic color signal)", () => {
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "D", index: 0, baselineEnd: new Date("2026-02-15") }),
        ], xScale, 30);
        const tick = ticks()[0];
        expect(tick.getAttribute("stroke")).toBe("#777777");
        expect(tick.getAttribute("stroke-width")).toBe("1.5");
        expect(tick.getAttribute("pointer-events")).toBe("none");
    });

    it("emits one tick per eligible activity (multi-row)", () => {
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "A", index: 0, baselineEnd: new Date("2026-02-15") }),
            mkActivity({ name: "B", index: 1, baselineEnd: new Date("2026-03-01") }),
            mkActivity({ name: "C", index: 2, baselineEnd: new Date("2026-04-01") }),
        ], xScale, 30);
        expect(ticks()).toHaveLength(3);
    });
});
