// INF-3768+3772 — sum-invariant guardrail for the splitter primitive.
//
// The composed layout in visual.ts must satisfy at all pin counts:
//   topSlicerHeightPx + ganttHeightPx + splitterBarHeightPx + matrixHeightPx
//   === viewport.height
// The splitter primitive itself satisfies the reduced invariant:
//   ganttHeightPx(H) + matrixHeightPx(H) + barHeightPx() === H
// for any input H (when neither region is hidden and the bar is visible).
//
// These tests lock that contract so a future refactor (Track A's
// vertical-stack rebuild INF-3769) cannot silently regress it.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountSplitterBar, SplitterHandle } from "./splitterBar";

interface Mounted {
    root: HTMLElement;
    handle: SplitterHandle;
}

function setup(initialPct = 0.6): Mounted {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const handle = mountSplitterBar(root, {
        initialPct,
        minGanttPx: 40,
        minMatrixPx: 40,
        onChange: () => {},
    });
    return { root, handle };
}

beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

describe("INF-3768+3772: splitter primitive sum invariant", () => {
    it("ganttHeightPx(H) + matrixHeightPx(H) + barHeightPx() === H for any H", () => {
        const { handle } = setup(0.6);
        for (const H of [200, 400, 600, 800, 1200]) {
            const g = handle.ganttHeightPx(H);
            const m = handle.matrixHeightPx(H);
            const b = handle.barHeightPx();
            expect(g + m + b).toBe(H);
        }
    });

    it("invariant holds across a sweep of userPct (init values)", () => {
        for (const pct of [0.1, 0.25, 0.5, 0.75, 0.9]) {
            const { handle } = setup(pct);
            const H = 600;
            const g = handle.ganttHeightPx(H);
            const m = handle.matrixHeightPx(H);
            const b = handle.barHeightPx();
            expect(g + m + b).toBe(H);
            while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
        }
    });

    it("composed invariant: topSlicer + primitive(viewport - topSlicer) === viewport for any topSlicer", () => {
        const { handle } = setup(0.6);
        const viewport = 800;
        // This is the visual.ts pattern: pass (viewport - topSlicer) to the
        // primitive, sum the three primitive outputs, add topSlicer, get viewport.
        for (const topSlicer of [0, 36, 72, 108, 144]) {
            const splitterViewportHeight = Math.max(0, viewport - topSlicer);
            const g = handle.ganttHeightPx(splitterViewportHeight);
            const m = handle.matrixHeightPx(splitterViewportHeight);
            const b = handle.barHeightPx();
            expect(topSlicer + g + b + m).toBe(viewport);
        }
    });

    it("both regions shrink proportionally as topSlicer grows (INF-3768 core contract)", () => {
        const { handle } = setup(0.6);
        const viewport = 800;
        // Pre-fix bug: matrix stayed CONSTANT as topSlicer grew; gantt
        // absorbed ALL the shrinkage. Post-fix: both shrink together.
        const baseline = {
            gantt: handle.ganttHeightPx(viewport),
            matrix: handle.matrixHeightPx(viewport),
        };
        const withStrip = {
            gantt: handle.ganttHeightPx(viewport - 100),
            matrix: handle.matrixHeightPx(viewport - 100),
        };
        // BOTH must be smaller — neither stays constant.
        expect(withStrip.gantt).toBeLessThan(baseline.gantt);
        expect(withStrip.matrix).toBeLessThan(baseline.matrix);
    });
});
