import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderSlipWhiskerLayer, clearSlipWhiskerLayer } from "./glidePath";
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

describe("glidePath orchestrator — slip-whisker layer integration", () => {
    let bodyG: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;
    const activities = [
        mkActivity({ name: "on-track", index: 0 }),
        mkActivity({ name: "minor-slip", index: 1,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-06") }), // +5d
        mkActivity({ name: "major-slip", index: 2,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-20") }), // +19d
    ];

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        bodyG = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = buildColorContext({ L: "#3366cc" }, {});
    });

    it("preserves existing forecast bars when whisker layer renders", () => {
        const barsSel = renderBars(bodyG, activities, xScale, 30, colors);
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        expect(barsSel.nodes()).toHaveLength(3);
        expect(barsSel.nodes().every(n => n.classList.contains("activity-bar"))).toBe(true);
    });

    it("whisker layer is appended as a SIBLING of bodyG content (not nested)", () => {
        renderBars(bodyG, activities, xScale, 30, colors);
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        const layer = bodyG.select<SVGGElement>("g.glide-whisker-layer");
        expect(layer.empty()).toBe(false);
        expect(layer.node()!.parentElement).toBe(bodyG.node());
    });

    it("whisker layer raises to LAST child across re-renders (top of z-stack)", () => {
        renderBars(bodyG, activities, xScale, 30, colors);
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        // Simulate a later renderBars call appending more children
        renderBars(bodyG, activities, xScale, 30, colors);
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        const kids = bodyG.node()!.children;
        expect(kids[kids.length - 1].classList.contains("glide-whisker-layer")).toBe(true);
    });

    it("idempotent — re-renders don't duplicate the layer", () => {
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        expect(bodyG.selectAll("g.glide-whisker-layer").nodes()).toHaveLength(1);
    });

    it("only emits whisker lines for activities with non-negligible slip", () => {
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        // 1 on-track (no baseline) + 2 slipping → 2 whiskers
        expect(bodyG.selectAll("line.slip-whisker").nodes()).toHaveLength(2);
    });

    it("clearSlipWhiskerLayer removes the layer entirely (toggle-OFF support)", () => {
        renderSlipWhiskerLayer(bodyG, activities, xScale, 30);
        expect(bodyG.select("g.glide-whisker-layer").empty()).toBe(false);
        clearSlipWhiskerLayer(bodyG);
        expect(bodyG.select("g.glide-whisker-layer").empty()).toBe(true);
    });

    it("clearSlipWhiskerLayer is a no-op when layer doesn't exist", () => {
        clearSlipWhiskerLayer(bodyG);
        expect(bodyG.select("g.glide-whisker-layer").empty()).toBe(true);
    });
});
