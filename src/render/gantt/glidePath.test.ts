import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderActivityBaselineTickLayer } from "./glidePath";
import { renderBars } from "./bars";
import { Activity } from "../../viewmodel";
import { buildColorContext, ColorContext } from "../../utils/colors";

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

describe("glidePath orchestrator — activity baseline-tick layer", () => {
    let bodyG: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;
    const activities = [
        mkActivity({ name: "no-base", index: 0 }),
        mkActivity({ name: "with-base", index: 1, baselineEnd: new Date("2026-02-15") }),
        mkActivity({ name: "with-base-2", index: 2, baselineEnd: new Date("2026-03-15") }),
    ];

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        bodyG = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = buildColorContext({ L: "#3366cc" }, {});
    });

    it("preserves existing forecast bars when tick layer renders", () => {
        const barsSel = renderBars(bodyG, activities, xScale, 30, colors);
        renderActivityBaselineTickLayer(bodyG, activities, xScale, 30);
        expect(barsSel.nodes()).toHaveLength(3);
        expect(barsSel.nodes().every(n => n.classList.contains("activity-bar"))).toBe(true);
    });

    it("tick layer is a SIBLING of bodyG content (not nested)", () => {
        renderBars(bodyG, activities, xScale, 30, colors);
        renderActivityBaselineTickLayer(bodyG, activities, xScale, 30);
        const layer = bodyG.select<SVGGElement>("g.glide-baseline-tick-layer");
        expect(layer.empty()).toBe(false);
        expect(layer.node()!.parentElement).toBe(bodyG.node());
    });

    it("emits one tick per eligible activity (those with baselineEnd bound)", () => {
        renderActivityBaselineTickLayer(bodyG, activities, xScale, 30);
        // 1 no-base + 2 with-base → 2 ticks
        expect(bodyG.selectAll("line.activity-baseline-tick").nodes()).toHaveLength(2);
    });

    it("idempotent — re-renders don't duplicate the layer", () => {
        renderActivityBaselineTickLayer(bodyG, activities, xScale, 30);
        renderActivityBaselineTickLayer(bodyG, activities, xScale, 30);
        renderActivityBaselineTickLayer(bodyG, activities, xScale, 30);
        expect(bodyG.selectAll("g.glide-baseline-tick-layer").nodes()).toHaveLength(1);
    });

    it("tick layer raises to LAST child across re-renders so subsequent renderBars don't occlude it", () => {
        renderBars(bodyG, activities, xScale, 30, colors);
        renderActivityBaselineTickLayer(bodyG, activities, xScale, 30);
        renderBars(bodyG, activities, xScale, 30, colors);
        renderActivityBaselineTickLayer(bodyG, activities, xScale, 30);
        const kids = bodyG.node()!.children;
        expect(kids[kids.length - 1].classList.contains("glide-baseline-tick-layer")).toBe(true);
    });
});
