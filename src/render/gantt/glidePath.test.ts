import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderGlidePathBaseline, renderGlidePathOverlays } from "./glidePath";
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

describe("glidePath integration — structural regression around bodyG", () => {
    let bodyG: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;
    const activities = [
        mkActivity({ name: "a1", index: 0 }),
        mkActivity({ name: "a2", index: 1 }),
        mkActivity({ name: "a3", index: 2 }),
    ];

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        bodyG = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = buildColorContext({ L: "#3366cc" }, {});
    });

    function callVisualUpdate(acts: Activity[]) {
        // Mirrors src/visual.ts:1476-1493 — the exact call sequence wired
        // in Phase 5. If this test passes, the integration regression
        // surface is covered without needing PBI Desktop.
        renderGlidePathBaseline(bodyG, acts, xScale, 30, colors);
        const barsSel = renderBars(bodyG, acts, xScale, 30, colors);
        renderGlidePathOverlays(bodyG, acts, xScale, 30, colors);
        return barsSel;
    }

    it("preserves existing forecast bars (renderBars still produces SVGRectElements with .activity-bar class)", () => {
        const barsSel = callVisualUpdate(activities);
        expect(barsSel.nodes()).toHaveLength(3);
        expect(barsSel.nodes().every(n => n.classList.contains("activity-bar"))).toBe(true);
    });

    it("with NO glide-path bindings: zero baseline, actual, or chevron elements emitted (graceful degradation)", () => {
        callVisualUpdate(activities);
        expect(bodyG.selectAll("rect.baseline-bar").nodes()).toHaveLength(0);
        expect(bodyG.selectAll("rect.actual-segment").nodes()).toHaveLength(0);
        expect(bodyG.selectAll("path.slip-chevron").nodes()).toHaveLength(0);
    });

    it("baseline layer ends up as FIRST child of bodyG (z-bottom)", () => {
        callVisualUpdate(activities);
        const firstChild = bodyG.node()!.children[0];
        expect(firstChild.classList.contains("glide-baseline-layer")).toBe(true);
    });

    it("chevron layer ends up as LAST child of bodyG (z-top)", () => {
        callVisualUpdate(activities);
        const kids = bodyG.node()!.children;
        const lastChild = kids[kids.length - 1];
        expect(lastChild.classList.contains("glide-chevron-layer")).toBe(true);
    });

    it("actual layer sits between forecast bars and chevron layer in DOM order", () => {
        callVisualUpdate(activities);
        const kids = Array.from(bodyG.node()!.children);
        const actualIdx = kids.findIndex(c => c.classList.contains("glide-actual-layer"));
        const chevronIdx = kids.findIndex(c => c.classList.contains("glide-chevron-layer"));
        const lastBarIdx = Math.max(...kids.map((c, i) => c.classList.contains("activity-bar") ? i : -1));
        expect(actualIdx).toBeGreaterThan(lastBarIdx);
        expect(actualIdx).toBeLessThan(chevronIdx);
    });

    it("re-render preserves layer positioning (z-order survives multiple update() calls)", () => {
        callVisualUpdate(activities);
        callVisualUpdate(activities);
        callVisualUpdate(activities);
        const kids = bodyG.node()!.children;
        expect(kids[0].classList.contains("glide-baseline-layer")).toBe(true);
        expect(kids[kids.length - 1].classList.contains("glide-chevron-layer")).toBe(true);
    });

    it("re-render does NOT duplicate layer groups (idempotent ensure-then-render)", () => {
        callVisualUpdate(activities);
        callVisualUpdate(activities);
        callVisualUpdate(activities);
        expect(bodyG.selectAll("g.glide-baseline-layer").nodes()).toHaveLength(1);
        expect(bodyG.selectAll("g.glide-actual-layer").nodes()).toHaveLength(1);
        expect(bodyG.selectAll("g.glide-chevron-layer").nodes()).toHaveLength(1);
    });

    it("WITH glide-path bindings: layers populate correctly without disturbing forecast bars", () => {
        const acts = [
            // baseline-only, on-track (end matches baselineEnd → no chevron)
            mkActivity({ name: "with-baseline", index: 0,
                baselineStart: new Date("2026-01-15"),
                baselineEnd: new Date("2026-02-01"),
                end: new Date("2026-02-01") }),
            // actual-only, no baseline → no chevron
            mkActivity({ name: "with-actual", index: 1,
                actualStart: new Date("2026-01-10"),
                actualEnd: new Date("2026-01-25") }),
            // baseline-only, slipping 31d → critical chevron (the only one)
            mkActivity({ name: "slipping", index: 2,
                baselineEnd: new Date("2026-01-15"),
                end: new Date("2026-02-15") })
        ];
        const barsSel = callVisualUpdate(acts);
        // Forecast bars still emit for all 3 activities (unchanged from v2.2.0.3).
        expect(barsSel.nodes()).toHaveLength(3);
        // Baseline outline for the 1 activity with both baseline dates.
        expect(bodyG.selectAll("rect.baseline-bar").nodes()).toHaveLength(1);
        // Actual segment for the 1 activity with both actual dates.
        expect(bodyG.selectAll("rect.actual-segment").nodes()).toHaveLength(1);
        // Slip chevron for the 1 activity with baseline + non-negligible slip.
        expect(bodyG.selectAll("path.slip-chevron").nodes()).toHaveLength(1);
    });

    it("barsSel from renderBars carries Activity data after glide layers wrap it (selection wiring preserved)", () => {
        const barsSel = callVisualUpdate(activities);
        // Selection-wiring downstream in visual.ts reads the bound datum
        // off barsSel to drive click handlers. If the data-join is
        // intact, datum() returns the Activity for each rect.
        const data = barsSel.nodes().map(n => select(n).datum() as Activity);
        expect(data.map(d => d.name)).toEqual(["a1", "a2", "a3"]);
    });
});
