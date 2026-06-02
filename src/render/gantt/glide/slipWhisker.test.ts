import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderSlipWhiskers } from "./slipWhisker";
import { Activity } from "../../../viewmodel";
import { DEFAULT_HEALTH_PALETTE } from "../../../utils/healthColor";

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

describe("renderSlipWhiskers (INF-3787 opt-in chrome)", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    const P = DEFAULT_HEALTH_PALETTE;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
    });

    const nodes = () => g.selectAll<SVGLineElement, unknown>("line.slip-whisker").nodes();

    it("skips activities without baselineEnd (slip undefined)", () => {
        renderSlipWhiskers(g, [mkActivity({ name: "no-base", index: 0 })], xScale, 30);
        expect(nodes()).toHaveLength(0);
    });

    it("skips on-track activities (|slip| <= negligible threshold)", () => {
        const baselineEnd = new Date("2026-02-01");
        const acts = [
            mkActivity({ name: "exact",   index: 0, end: baselineEnd,           baselineEnd }),
            mkActivity({ name: "slip-1d", index: 1, end: new Date("2026-02-02"), baselineEnd }),
            mkActivity({ name: "pull-1d", index: 2, end: new Date("2026-01-31"), baselineEnd }),
        ];
        renderSlipWhiskers(g, acts, xScale, 30);
        expect(nodes()).toHaveLength(0);
    });

    it("emits a horizontal line per shifted activity from forecast-end to baseline-end", () => {
        const baselineEnd = new Date("2026-02-01");
        const end = new Date("2026-02-10"); // 9d slipping → minor
        renderSlipWhiskers(g, [mkActivity({ name: "S", index: 0, end, baselineEnd })], xScale, 30);
        const line = nodes()[0];
        expect(line).toBeDefined();
        expect(Number(line.getAttribute("x1"))).toBeCloseTo(xScale(end));
        expect(Number(line.getAttribute("x2"))).toBeCloseTo(xScale(baselineEnd));
        expect(line.getAttribute("y1")).toBe(line.getAttribute("y2"));
    });

    it("colors slipping minor with palette yellow, major/critical with red, pulled-in with green", () => {
        const baselineEnd = new Date("2026-02-01");
        const acts = [
            mkActivity({ name: "minor-slip",    index: 0, end: new Date("2026-02-06"), baselineEnd }), // +5d
            mkActivity({ name: "major-slip",    index: 1, end: new Date("2026-02-21"), baselineEnd }), // +20d
            mkActivity({ name: "critical-slip", index: 2, end: new Date("2026-04-01"), baselineEnd }), // +59d
            mkActivity({ name: "minor-pull",    index: 3, end: new Date("2026-01-27"), baselineEnd }), // -5d
            mkActivity({ name: "critical-pull", index: 4, end: new Date("2025-12-01"), baselineEnd }), // -62d
        ];
        renderSlipWhiskers(g, acts, xScale, 30);
        const get = (n: string) => nodes().find(l => l.getAttribute("data-activity") === n)!.getAttribute("stroke");
        expect(get("minor-slip")).toBe(P.yellow);
        expect(get("major-slip")).toBe(P.red);
        expect(get("critical-slip")).toBe(P.red);
        expect(get("minor-pull")).toBe(P.green);
        expect(get("critical-pull")).toBe(P.green);
    });

    it("emits stroke-only dashed line (no fill, dasharray=3 2)", () => {
        const baselineEnd = new Date("2026-02-01");
        renderSlipWhiskers(g, [mkActivity({ name: "S", index: 0,
            end: new Date("2026-02-10"), baselineEnd })], xScale, 30);
        const line = nodes()[0];
        expect(line.getAttribute("stroke-dasharray")).toBe("3 2");
        expect(line.getAttribute("stroke-width")).toBe("1.5");
        expect(line.getAttribute("pointer-events")).toBe("none");
    });

    it("positions whisker at vertical center of activity row", () => {
        const rowHeight = 40;
        const baselineEnd = new Date("2026-02-01");
        renderSlipWhiskers(g, [mkActivity({ name: "row-2", index: 2,
            end: new Date("2026-02-10"), baselineEnd })], xScale, rowHeight);
        const line = nodes()[0];
        // y = index*rH + padding + barH/2 = 2*40 + padding + barH/2
        // barH = max(8, floor(40*0.78)) = 31; padding = (40-31)/2 = 4.5
        // y = 80 + 4.5 + 15.5 = 100
        expect(Number(line.getAttribute("y1"))).toBeCloseTo(100, 0);
    });

    it("forwards SlipThresholds override → eligibility reclassifies", () => {
        const baselineEnd = new Date("2026-02-01");
        // 1-day slip — default: negligible (skipped); strict: minor (emits)
        const acts = [mkActivity({ name: "tight", index: 0,
            end: new Date("2026-02-02"), baselineEnd })];

        renderSlipWhiskers(g, acts, xScale, 30); // default thresholds
        expect(nodes()).toHaveLength(0);

        document.body.replaceChildren();
        const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.appendChild(svg2);
        const g2 = select(svg2).append<SVGGElement>("g");
        renderSlipWhiskers(g2, acts, xScale, 30, P,
            { negligibleDays: 0, minorDays: 5, majorDays: 30 });
        expect(g2.selectAll<SVGLineElement, unknown>("line.slip-whisker").nodes()).toHaveLength(1);
    });
});
