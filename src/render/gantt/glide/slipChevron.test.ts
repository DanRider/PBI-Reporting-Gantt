import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderSlipChevrons } from "./slipChevron";
import { Activity } from "../../../viewmodel";

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

function nodes(g: Selection<SVGGElement, unknown, null, undefined>) {
    return g.selectAll<SVGPathElement, unknown>("path.slip-chevron").nodes();
}

describe("renderSlipChevrons (INF-3787 glide-path verb #3)", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
    });

    it("skips activities without baselineEnd (slip undefined)", () => {
        renderSlipChevrons(g, [mkActivity({ name: "no-baseline", index: 0 })], xScale, 30, null);
        expect(nodes(g)).toHaveLength(0);
    });

    it("skips activities with negligible slip (|slip| <= 2 days, on-track)", () => {
        const baselineEnd = new Date("2026-02-01");
        const acts = [
            mkActivity({ name: "exact", index: 0, end: baselineEnd, baselineEnd }),
            mkActivity({ name: "slip-1d", index: 1, end: new Date("2026-02-02"), baselineEnd }),
            mkActivity({ name: "slip-2d", index: 2, end: new Date("2026-02-03"), baselineEnd }),
            mkActivity({ name: "pull-2d", index: 3, end: new Date("2026-01-30"), baselineEnd }),
        ];
        renderSlipChevrons(g, acts, xScale, 30, null);
        expect(nodes(g)).toHaveLength(0);
    });

    it("categorizes slip magnitude per Decision #3 thresholds (minor/major/critical)", () => {
        const baselineEnd = new Date("2026-02-01");
        const acts = [
            mkActivity({ name: "minor", index: 0,  end: new Date("2026-02-06"), baselineEnd }), // +5d
            mkActivity({ name: "major", index: 1,  end: new Date("2026-02-21"), baselineEnd }), // +20d
            mkActivity({ name: "critical", index: 2, end: new Date("2026-04-01"), baselineEnd }), // +59d
        ];
        renderSlipChevrons(g, acts, xScale, 30, null);
        const paths = nodes(g);
        expect(paths).toHaveLength(3);
        const byName = (n: string) => paths.find(p => p.getAttribute("data-activity") === n)!;
        expect(byName("minor").getAttribute("data-slip-magnitude")).toBe("minor");
        expect(byName("major").getAttribute("data-slip-magnitude")).toBe("major");
        expect(byName("critical").getAttribute("data-slip-magnitude")).toBe("critical");
    });

    it("encodes slipping (forecast after baseline) as right-pointing chevron; pulled-in as left-pointing", () => {
        const baselineEnd = new Date("2026-02-01");
        const acts = [
            mkActivity({ name: "slipping", index: 0, end: new Date("2026-02-10"), baselineEnd }),  // +9d major slip
            mkActivity({ name: "pulled-in", index: 1, end: new Date("2026-01-22"), baselineEnd }), // -10d major pull
        ];
        renderSlipChevrons(g, acts, xScale, 30, null);
        const paths = nodes(g);
        const slipping = paths.find(p => p.getAttribute("data-activity") === "slipping")!;
        const pulled = paths.find(p => p.getAttribute("data-activity") === "pulled-in")!;
        expect(slipping.getAttribute("data-slip-direction")).toBe("slipping");
        expect(pulled.getAttribute("data-slip-direction")).toBe("pulled-in");
    });

    it("colors slipping by magnitude (warming) and pulled-in as green regardless of magnitude", () => {
        const baselineEnd = new Date("2026-02-01");
        const acts = [
            mkActivity({ name: "minor-slip",    index: 0, end: new Date("2026-02-06"), baselineEnd }),  // +5d
            mkActivity({ name: "major-slip",    index: 1, end: new Date("2026-02-21"), baselineEnd }),  // +20d
            mkActivity({ name: "critical-slip", index: 2, end: new Date("2026-04-01"), baselineEnd }),  // +59d
            mkActivity({ name: "minor-pull",    index: 3, end: new Date("2026-01-27"), baselineEnd }),  // -5d
            mkActivity({ name: "critical-pull", index: 4, end: new Date("2025-12-01"), baselineEnd }),  // -62d
        ];
        renderSlipChevrons(g, acts, xScale, 30, null);
        const paths = nodes(g);
        const get = (n: string) => paths.find(p => p.getAttribute("data-activity") === n)!.getAttribute("stroke");
        // distinct colors across slipping severities
        expect(get("minor-slip")).not.toBe(get("major-slip"));
        expect(get("major-slip")).not.toBe(get("critical-slip"));
        // both pulled-in variants share the same green hue
        expect(get("minor-pull")).toBe(get("critical-pull"));
        // pulled-in differs from any slipping color
        expect(get("minor-pull")).not.toBe(get("minor-slip"));
    });

    it("anchors chevron at xScale(end) ± horizontal offset, vertically centered on the row", () => {
        const baselineEnd = new Date("2026-02-01");
        const end = new Date("2026-02-10"); // +9d slipping
        const rowHeight = 30;
        renderSlipChevrons(g, [mkActivity({ name: "A", index: 2, end, baselineEnd })], xScale, rowHeight, null);
        const path = nodes(g)[0];
        const d = path.getAttribute("d")!;
        // d looks like: M<x1>,<y1> L<x2>,<y2> L<x3>,<y3>
        const numbers = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        // 3 points × 2 numbers each = 6 numbers
        expect(numbers).toHaveLength(6);
        // expected centerY = index * rowHeight + rowHeight/2 = 2*30 + 15 = 75
        const expectedCenterY = 2 * rowHeight + rowHeight / 2;
        expect(numbers[1]).toBeCloseTo(expectedCenterY - 4);  // top point y
        expect(numbers[3]).toBeCloseTo(expectedCenterY);      // tip point y
        expect(numbers[5]).toBeCloseTo(expectedCenterY + 4);  // bottom point y
        // slipping → tip on right (numbers[2]) > base on left (numbers[0])
        expect(numbers[2]).toBeGreaterThan(numbers[0]);
    });

    it("emits stroke-only path (fill=none) with semantic stroke color", () => {
        const baselineEnd = new Date("2026-02-01");
        renderSlipChevrons(g, [mkActivity({ name: "S", index: 0,
            end: new Date("2026-02-10"), baselineEnd })], xScale, 30, null);
        const path = nodes(g)[0];
        expect(path.getAttribute("fill")).toBe("none");
        expect(path.getAttribute("stroke")).toMatch(/^#[0-9a-f]{6}$/i);
        expect(path.getAttribute("stroke-width")).toBe("2");
        expect(path.getAttribute("pointer-events")).toBe("none");
    });

    it("forwards SlipThresholds override → magnitude/direction reclassification", () => {
        const baselineEnd = new Date("2026-02-01");
        const acts = [
            // 4-day slip — default classifies as "minor" (>2 + <=7),
            // strict classifies as "major" (>1 + <=5)
            mkActivity({ name: "X", index: 0,
                end: new Date("2026-02-05"), baselineEnd }),
        ];

        // Default thresholds path
        renderSlipChevrons(g, acts, xScale, 30, null);
        let path = nodes(g)[0];
        expect(path.getAttribute("data-slip-magnitude")).toBe("minor");

        // Strict override
        document.body.replaceChildren();
        const svg2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.appendChild(svg2);
        const g2 = select(svg2).append<SVGGElement>("g");
        renderSlipChevrons(g2, acts, xScale, 30, null,
            { negligibleDays: 0, minorDays: 1, majorDays: 5 });
        path = g2.selectAll<SVGPathElement, unknown>("path.slip-chevron").nodes()[0];
        expect(path.getAttribute("data-slip-magnitude")).toBe("major");
    });
});
