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

    const ticks = () => g.selectAll<SVGPathElement, unknown>("path.activity-baseline-tick").nodes();

    it("filters out activities without baselineEnd", () => {
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "no-base", index: 0 }),
            mkActivity({ name: "with-base", index: 1, baselineEnd: new Date("2026-02-15") }),
        ], xScale, 30);
        expect(ticks()).toHaveLength(1);
        expect(ticks()[0].getAttribute("data-activity")).toBe("with-base");
    });

    it("emits a T-shaped anchor path (horizontal cap + vertical stem) centered on baselineEnd x", () => {
        const baselineEnd = new Date("2026-02-15");
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "A", index: 0, baselineEnd }),
        ], xScale, 30);
        const tick = ticks()[0];
        const d = tick.getAttribute("d")!;
        // Expect 2 moves + 2 lines (M..L M..L) — cap then stem
        expect((d.match(/M/g) || []).length).toBe(2);
        expect((d.match(/L/g) || []).length).toBe(2);
        // Numbers extracted in order: [capLeftX, capY, capRightX, capY, stemX, stemTopY, stemX, stemBotY]
        const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        expect(nums).toHaveLength(8);
        const x = xScale(baselineEnd);
        expect(nums[0]).toBeCloseTo(x - 4); // cap left
        expect(nums[2]).toBeCloseTo(x + 4); // cap right
        expect(nums[4]).toBeCloseTo(x);      // stem x
        expect(nums[6]).toBeCloseTo(x);      // stem x
        expect(nums[7]).toBeGreaterThan(nums[5]); // stem extends down
    });

    it("positions anchor BELOW the forecast bar (cap y > bar bottom)", () => {
        const rowHeight = 30;
        const barH = barHeightFor(rowHeight);
        const padding = (rowHeight - barH) / 2;
        const expectedBarBottom = 0 * rowHeight + padding + barH;
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "B", index: 0, baselineEnd: new Date("2026-02-15") }),
        ], xScale, rowHeight);
        const tick = ticks()[0];
        const nums = tick.getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const capY = nums[1];
        expect(capY).toBeGreaterThan(expectedBarBottom);
    });

    it("stem has fixed length (12px) regardless of rowHeight", () => {
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "C", index: 0, baselineEnd: new Date("2026-02-15") }),
        ], xScale, 30);
        const tick = ticks()[0];
        const nums = tick.getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const length = nums[7] - nums[5]; // stemBotY - stemTopY
        expect(length).toBe(12);
    });

    it("emits darker grey stroke + thicker width for portfolio-scale visibility", () => {
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "D", index: 0, baselineEnd: new Date("2026-02-15") }),
        ], xScale, 30);
        const tick = ticks()[0];
        expect(tick.getAttribute("stroke")).toBe("#444444");
        expect(tick.getAttribute("stroke-width")).toBe("2.5");
        expect(tick.getAttribute("fill")).toBe("none");
        expect(tick.getAttribute("pointer-events")).toBe("none");
    });

    it("emits one anchor per eligible activity (multi-row)", () => {
        renderActivityBaselineTicks(g, [
            mkActivity({ name: "A", index: 0, baselineEnd: new Date("2026-02-15") }),
            mkActivity({ name: "B", index: 1, baselineEnd: new Date("2026-03-01") }),
            mkActivity({ name: "C", index: 2, baselineEnd: new Date("2026-04-01") }),
        ], xScale, 30);
        expect(ticks()).toHaveLength(3);
    });
});
