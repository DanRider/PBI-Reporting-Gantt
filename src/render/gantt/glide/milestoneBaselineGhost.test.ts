import { describe, it, expect, beforeEach } from "vitest";
import { select, Selection } from "d3-selection";
import { scaleTime, ScaleTime } from "d3-scale";
import { renderMilestoneBaselineGhosts } from "./milestoneBaselineGhost";
import { Milestone } from "../../../viewmodel";
import { buildColorContext, buildMilestoneConfigMap, ColorContext } from "../../../utils/colors";

function mkMilestone(over: Partial<Milestone> & { id: string; type: string }): Milestone {
    return {
        activity: over.activity ?? "Act",
        date: over.date ?? new Date("2026-02-15"),
        type: over.type,
        label: over.label ?? null,
        labelPos: over.labelPos ?? "R",
        id: over.id,
        parentRowIndex: over.parentRowIndex ?? 0,
        note: over.note ?? null,
        owner: null, status: null, externalUrl: null, health: null,
        baselineDate: over.baselineDate,
    };
}

function mkColors(): ColorContext {
    const settings = {
        type1Color:      { value: { value: "#FFC000" } },
        type1Symbol:     { value: { value: "star" } },
        type1Size:       { value: 8 },
        type1ShowMarker: { value: true },
        type2Color:      { value: { value: "#000000" } },
        type2Symbol:     { value: { value: "circle" } },
        type2Size:       { value: 8 },
        type2ShowMarker: { value: true },
    };
    const cfg = buildMilestoneConfigMap([
        { typeName: "Major", slotIndex: 0 },
        { typeName: "Minor", slotIndex: 1 },
    ], settings);
    return buildColorContext({}, cfg);
}

describe("renderMilestoneBaselineGhosts (INF-3787)", () => {
    let g: Selection<SVGGElement, unknown, null, undefined>;
    let xScale: ScaleTime<number, number>;
    let colors: ColorContext;

    beforeEach(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        document.body.replaceChildren(svg);
        g = select(svg).append<SVGGElement>("g");
        xScale = scaleTime().domain([new Date("2026-01-01"), new Date("2026-06-01")]).range([0, 500]);
        colors = mkColors();
    });

    const ghosts = () => g.selectAll<SVGPathElement, unknown>("path.milestone-baseline-ghost").nodes();
    const connectors = () => g.selectAll<SVGLineElement, unknown>("line.milestone-baseline-connector").nodes();

    it("filters out milestones without baselineDate", () => {
        renderMilestoneBaselineGhosts(g, [
            mkMilestone({ id: "m1", type: "Major" }),
            mkMilestone({ id: "m2", type: "Major", baselineDate: new Date("2026-02-01") }),
        ], xScale, 30, colors);
        expect(ghosts()).toHaveLength(1);
        expect(connectors()).toHaveLength(1);
    });

    it("filters out milestones where baselineDate === date (no shift)", () => {
        const d = new Date("2026-02-15");
        renderMilestoneBaselineGhosts(g, [
            mkMilestone({ id: "m1", type: "Major", date: d, baselineDate: d }),
        ], xScale, 30, colors);
        expect(ghosts()).toHaveLength(0);
        expect(connectors()).toHaveLength(0);
    });

    it("filters out milestones with parentRowIndex === -1 (unparented)", () => {
        renderMilestoneBaselineGhosts(g, [
            mkMilestone({ id: "m1", type: "Major", baselineDate: new Date("2026-02-01"),
                parentRowIndex: -1 }),
        ], xScale, 30, colors);
        expect(ghosts()).toHaveLength(0);
    });

    it("filters out milestones whose type has showMarker=false", () => {
        const cfg = colors.milestoneConfig;
        cfg.Major = { ...cfg.Major, showMarker: false };
        renderMilestoneBaselineGhosts(g, [
            mkMilestone({ id: "m1", type: "Major",
                date: new Date("2026-02-15"),
                baselineDate: new Date("2026-02-01") }),
        ], xScale, 30, colors);
        expect(ghosts()).toHaveLength(0);
    });

    it("renders hollow path (fill=none, stroke=type color) at baseline x", () => {
        const baselineDate = new Date("2026-02-01");
        renderMilestoneBaselineGhosts(g, [
            mkMilestone({ id: "m1", type: "Major",
                date: new Date("2026-02-15"), baselineDate }),
        ], xScale, 30, colors);
        const ghost = ghosts()[0];
        expect(ghost.getAttribute("fill")).toBe("none");
        expect(ghost.getAttribute("stroke")).toBe("#FFC000");
        expect(ghost.getAttribute("stroke-width")).toBe("1.5");
    });

    it("emits dashed connector from baseline x to current x", () => {
        const baselineDate = new Date("2026-02-01");
        const date = new Date("2026-02-15");
        renderMilestoneBaselineGhosts(g, [
            mkMilestone({ id: "m1", type: "Major", date, baselineDate }),
        ], xScale, 30, colors);
        const conn = connectors()[0];
        expect(Number(conn.getAttribute("x1"))).toBeCloseTo(xScale(baselineDate));
        expect(Number(conn.getAttribute("x2"))).toBeCloseTo(xScale(date));
        expect(conn.getAttribute("y1")).toBe(conn.getAttribute("y2"));
        expect(conn.getAttribute("stroke-dasharray")).toBe("2 2");
    });

    it("connector + ghost share the same parent-row centerline (y)", () => {
        const rowHeight = 30;
        renderMilestoneBaselineGhosts(g, [
            mkMilestone({ id: "m1", type: "Major", parentRowIndex: 3,
                date: new Date("2026-02-15"),
                baselineDate: new Date("2026-02-01") }),
        ], xScale, rowHeight, colors);
        const conn = connectors()[0];
        const expectedCy = 3 * rowHeight + rowHeight / 2;
        expect(Number(conn.getAttribute("y1"))).toBe(expectedCy);
    });
});
