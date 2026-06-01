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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountSplitterBar, SplitterHandle, SplitterOptions } from "./splitterBar";

interface Mounted {
    root: HTMLElement;
    handle: SplitterHandle;
}

function setup(initialPct = 0.6, overrides: Partial<SplitterOptions> = {}): Mounted {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const handle = mountSplitterBar(root, {
        initialPct,
        minGanttPx: 40,
        minMatrixPx: 40,
        onChange: () => {},
        ...overrides,
    });
    return { root, handle };
}

// INF-379X — synthetic pointer event helper. jsdom's PointerEvent
// constructor is sometimes missing; bolt the properties the splitter
// reads onto a plain Event.
function pointerEvent(type: string, props: { clientY: number; pointerId?: number }): Event {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, {
        clientY: props.clientY,
        clientX: 0,
        pointerId: props.pointerId ?? 1,
    });
    return ev;
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

// ---------- INF-379X: drag-time rAF coalesce + onLiveDrag fast-path ----------

describe("INF-379X: pointermove rAF-coalesces, pointerup commits via onChange", () => {
    // Mock requestAnimationFrame so test can flush deterministically.
    let rafQueue: Array<() => void>;

    beforeEach(() => {
        rafQueue = [];
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(
            (cb: FrameRequestCallback): number => {
                const id = rafQueue.length + 1;
                rafQueue.push(() => cb(0));
                return id;
            },
        );
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id: number): void => {
            if (id >= 1 && id <= rafQueue.length) rafQueue[id - 1] = () => {};
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function flushRAF(): void {
        const queued = rafQueue;
        rafQueue = [];
        for (const fn of queued) fn();
    }

    /** jsdom doesn't implement Element.{set,has,release}PointerCapture for
     *  synthetic Event dispatches — patch in benign stubs so the splitter's
     *  pointer-capture calls don't throw during the test pointer-event flow.
     *  Production browsers handle these natively; the patch is test-only. */
    function patchPointerCapture(bar: HTMLElement): void {
        let captured = false;
        bar.setPointerCapture = ((_id: number) => { captured = true; }) as typeof bar.setPointerCapture;
        bar.releasePointerCapture = ((_id: number) => { captured = false; }) as typeof bar.releasePointerCapture;
        bar.hasPointerCapture = ((_id: number) => captured) as typeof bar.hasPointerCapture;
    }

    function setupDraggable(opts: {
        onChange: ReturnType<typeof vi.fn>;
        onLiveDrag?: ReturnType<typeof vi.fn>;
    }): { bar: HTMLElement } {
        const root = document.createElement("div");
        document.body.appendChild(root);
        const handle = mountSplitterBar(root, {
            initialPct: 0.6,
            minGanttPx: 40,
            minMatrixPx: 40,
            onChange: opts.onChange,
            ...(opts.onLiveDrag ? { onLiveDrag: opts.onLiveDrag } : {}),
        });
        // Populate lastViewportHeight (primitive caches it on every
        // ganttHeightPx call — real PBI update() does the same each frame).
        handle.ganttHeightPx(600);
        const bar = root.firstElementChild as HTMLElement;
        patchPointerCapture(bar);
        return { bar };
    }

    it("multiple pointermove events within one frame coalesce into ONE rAF callback", () => {
        const onChange = vi.fn();
        const onLiveDrag = vi.fn();
        const { bar } = setupDraggable({ onChange, onLiveDrag });

        bar.dispatchEvent(pointerEvent("pointerdown", { clientY: 100 }));
        // Five pointermove events "within one frame".
        bar.dispatchEvent(pointerEvent("pointermove", { clientY: 110 }));
        bar.dispatchEvent(pointerEvent("pointermove", { clientY: 120 }));
        bar.dispatchEvent(pointerEvent("pointermove", { clientY: 130 }));
        bar.dispatchEvent(pointerEvent("pointermove", { clientY: 140 }));
        bar.dispatchEvent(pointerEvent("pointermove", { clientY: 150 }));

        // Exactly ONE rAF queued; callbacks not yet fired.
        expect(rafQueue.length).toBe(1);
        expect(onLiveDrag).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();

        // Flush the frame — onLiveDrag fires ONCE (fast-path).
        flushRAF();
        expect(onLiveDrag).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("falls back to onChange during drag when onLiveDrag is omitted", () => {
        const onChange = vi.fn();
        const { bar } = setupDraggable({ onChange });

        bar.dispatchEvent(pointerEvent("pointerdown", { clientY: 100 }));
        bar.dispatchEvent(pointerEvent("pointermove", { clientY: 150 }));
        expect(rafQueue.length).toBe(1);

        flushRAF();
        // Without onLiveDrag, drag-frame callback falls back to onChange.
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("pointerup after drag-in-flight commits via onChange (full settle); stale onLiveDrag does NOT fire", () => {
        const onChange = vi.fn();
        const onLiveDrag = vi.fn();
        const { bar } = setupDraggable({ onChange, onLiveDrag });

        bar.dispatchEvent(pointerEvent("pointerdown", { clientY: 100 }));
        bar.dispatchEvent(pointerEvent("pointermove", { clientY: 200 }));
        expect(rafQueue.length).toBe(1);

        // User releases. pointerup must cancel the pending rAF and
        // fire onChange synchronously.
        bar.dispatchEvent(pointerEvent("pointerup", { clientY: 200 }));
        expect(onChange).toHaveBeenCalledTimes(1);

        // Stale onLiveDrag must NOT fire even after a flush.
        flushRAF();
        expect(onLiveDrag).not.toHaveBeenCalled();
    });

    it("pointerup with no pending drag does NOT fire onChange", () => {
        const onChange = vi.fn();
        const onLiveDrag = vi.fn();
        const { bar } = setupDraggable({ onChange, onLiveDrag });

        bar.dispatchEvent(pointerEvent("pointerdown", { clientY: 100 }));
        // No pointermove — no rAF queued.
        bar.dispatchEvent(pointerEvent("pointerup", { clientY: 100 }));

        expect(onChange).not.toHaveBeenCalled();
        expect(onLiveDrag).not.toHaveBeenCalled();
    });

    it("pointercancel cancels pending rAF and fires NO callback (touch interrupted)", () => {
        const onChange = vi.fn();
        const onLiveDrag = vi.fn();
        const { bar } = setupDraggable({ onChange, onLiveDrag });

        bar.dispatchEvent(pointerEvent("pointerdown", { clientY: 100 }));
        bar.dispatchEvent(pointerEvent("pointermove", { clientY: 150 }));
        expect(rafQueue.length).toBe(1);

        const cancelEv = new Event("pointercancel", { bubbles: true, cancelable: true });
        Object.assign(cancelEv, { pointerId: 1, clientY: 150, clientX: 0 });
        bar.dispatchEvent(cancelEv);

        // Pending rAF cancelled; flushing must be a no-op.
        flushRAF();
        expect(onChange).not.toHaveBeenCalled();
        expect(onLiveDrag).not.toHaveBeenCalled();
    });
});
