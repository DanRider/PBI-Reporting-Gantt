import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderBaselineMarkLayer } from "./glidePath";
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

describe("glidePath orchestrator — baseline-mark layer", () => {
    let bodyG: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;
    const activities = [
        mkActivity({ name: "no-base", index: 0 }),
        mkActivity({ name: "slip-minor", index: 1,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-06") }), // 5d
        mkActivity({ name: "slip-major", index: 2,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-20") }), // 19d
    ];

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        bodyG = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = buildColorContext({ L: "#3366cc" }, {});
    });

    it("preserves existing forecast bars when mark layer renders", () => {
        const barsSel = renderBars(bodyG, activities, xScale, 30, colors);
        renderBaselineMarkLayer(bodyG, activities, xScale, 30);
        expect(barsSel.nodes()).toHaveLength(3);
        expect(barsSel.nodes().every(n => n.classList.contains("activity-bar"))).toBe(true);
    });

    it("mark layer is a SIBLING of bodyG content (not nested)", () => {
        renderBars(bodyG, activities, xScale, 30, colors);
        renderBaselineMarkLayer(bodyG, activities, xScale, 30);
        const layer = bodyG.select<SVGGElement>("g.glide-baseline-mark-layer");
        expect(layer.empty()).toBe(false);
        expect(layer.node()!.parentElement).toBe(bodyG.node());
    });

    it("emits one mark per shifted activity (filters non-baseline + on-track)", () => {
        renderBaselineMarkLayer(bodyG, activities, xScale, 30);
        // 1 no-base + 2 shifted → 2 marks
        expect(bodyG.selectAll("path.baseline-mark").nodes()).toHaveLength(2);
    });

    it("idempotent — re-renders don't duplicate the layer", () => {
        renderBaselineMarkLayer(bodyG, activities, xScale, 30);
        renderBaselineMarkLayer(bodyG, activities, xScale, 30);
        renderBaselineMarkLayer(bodyG, activities, xScale, 30);
        expect(bodyG.selectAll("g.glide-baseline-mark-layer").nodes()).toHaveLength(1);
    });

    it("mark layer raises to LAST child after subsequent renderBars (paints over bars)", () => {
        renderBars(bodyG, activities, xScale, 30, colors);
        renderBaselineMarkLayer(bodyG, activities, xScale, 30);
        renderBars(bodyG, activities, xScale, 30, colors);
        renderBaselineMarkLayer(bodyG, activities, xScale, 30);
        const kids = bodyG.node()!.children;
        expect(kids[kids.length - 1].classList.contains("glide-baseline-mark-layer")).toBe(true);
    });
});
