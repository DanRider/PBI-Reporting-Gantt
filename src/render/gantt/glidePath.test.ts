import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderSlipIBeamLayer } from "./glidePath";
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

describe("glidePath orchestrator — slip I-beam layer", () => {
    let bodyG: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;
    const activities = [
        mkActivity({ name: "no-base", index: 0 }),
        mkActivity({ name: "shifted-minor", index: 1,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-06") }), // 5d
        mkActivity({ name: "shifted-major", index: 2,
            baselineEnd: new Date("2026-02-01"), end: new Date("2026-02-20") }), // 19d
    ];

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        bodyG = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = buildColorContext({ L: "#3366cc" }, {});
    });

    it("preserves existing forecast bars when I-beam layer renders", () => {
        const barsSel = renderBars(bodyG, activities, xScale, 30, colors);
        renderSlipIBeamLayer(bodyG, activities, xScale, 30);
        expect(barsSel.nodes()).toHaveLength(3);
        expect(barsSel.nodes().every(n => n.classList.contains("activity-bar"))).toBe(true);
    });

    it("I-beam layer is a SIBLING of bodyG content (not nested)", () => {
        renderBars(bodyG, activities, xScale, 30, colors);
        renderSlipIBeamLayer(bodyG, activities, xScale, 30);
        const layer = bodyG.select<SVGGElement>("g.glide-ibeam-layer");
        expect(layer.empty()).toBe(false);
        expect(layer.node()!.parentElement).toBe(bodyG.node());
    });

    it("emits one I-beam per shifted activity (filters non-baseline + on-track)", () => {
        renderSlipIBeamLayer(bodyG, activities, xScale, 30);
        // 1 no-base + 2 shifted → 2 I-beams
        expect(bodyG.selectAll("path.slip-ibeam").nodes()).toHaveLength(2);
    });

    it("idempotent — re-renders don't duplicate the layer", () => {
        renderSlipIBeamLayer(bodyG, activities, xScale, 30);
        renderSlipIBeamLayer(bodyG, activities, xScale, 30);
        renderSlipIBeamLayer(bodyG, activities, xScale, 30);
        expect(bodyG.selectAll("g.glide-ibeam-layer").nodes()).toHaveLength(1);
    });

    it("I-beam layer raises to LAST child after subsequent renderBars to preserve z-order", () => {
        renderBars(bodyG, activities, xScale, 30, colors);
        renderSlipIBeamLayer(bodyG, activities, xScale, 30);
        renderBars(bodyG, activities, xScale, 30, colors);
        renderSlipIBeamLayer(bodyG, activities, xScale, 30);
        const kids = bodyG.node()!.children;
        expect(kids[kids.length - 1].classList.contains("glide-ibeam-layer")).toBe(true);
    });
});

describe("renderBars — shifted-set bar shrink (INF-3787)", () => {
    let bodyG: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;
    const activities = [
        mkActivity({ name: "normal", index: 0 }),
        mkActivity({ name: "shifted", index: 1 }),
    ];

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        bodyG = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = buildColorContext({ L: "#3366cc" }, {});
    });

    it("with empty shiftedSet: every bar renders at normal height (backward compat)", () => {
        const sel = renderBars(bodyG, activities, xScale, 30, colors);
        const heights = sel.nodes().map(n => Number(n.getAttribute("height")));
        expect(heights[0]).toBe(heights[1]); // both normal
    });

    it("with shiftedSet containing one activity: that bar shrinks to ~70% height", () => {
        const sel = renderBars(bodyG, activities, xScale, 30, colors, new Set(["shifted"]));
        const normal = sel.nodes().find(n => n.getAttribute("data-activity") === "normal")!;
        const shifted = sel.nodes().find(n => n.getAttribute("data-activity") === "shifted")!;
        const normalH = Number(normal.getAttribute("height"));
        const shiftedH = Number(shifted.getAttribute("height"));
        expect(shiftedH).toBeLessThan(normalH);
        expect(shiftedH / normalH).toBeCloseTo(0.7, 1);
    });

    it("shifted bar is bottom-anchored within the normal bar zone (y shifted DOWN by freed top space)", () => {
        const sel = renderBars(bodyG, activities, xScale, 30, colors, new Set(["shifted"]));
        const normal = sel.nodes().find(n => n.getAttribute("data-activity") === "normal")!;
        const shifted = sel.nodes().find(n => n.getAttribute("data-activity") === "shifted")!;
        const normalY = Number(normal.getAttribute("y"));
        // Both rows are at index 0 vs 1, so normalize by their row positions.
        // Normal at index 0: y = padding.
        // Shifted at index 1: y = 1*30 + padding + (barH - shrunkBarH).
        // The shifted bar's y MINUS its row top (1*30 = 30) > the normal bar's y MINUS its row top (0).
        const normalOffset = normalY - 0 * 30;
        const shiftedOffset = Number(shifted.getAttribute("y")) - 1 * 30;
        expect(shiftedOffset).toBeGreaterThan(normalOffset);
    });

    it("shifted bar carries 'activity-bar-shifted' class for stylesheet/test hooks", () => {
        const sel = renderBars(bodyG, activities, xScale, 30, colors, new Set(["shifted"]));
        const shifted = sel.nodes().find(n => n.getAttribute("data-activity") === "shifted")!;
        const normal = sel.nodes().find(n => n.getAttribute("data-activity") === "normal")!;
        expect(shifted.classList.contains("activity-bar-shifted")).toBe(true);
        expect(normal.classList.contains("activity-bar-shifted")).toBe(false);
    });
});
