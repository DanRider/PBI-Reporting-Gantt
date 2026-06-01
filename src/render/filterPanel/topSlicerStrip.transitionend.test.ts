// INF-3771 — top-slicer-strip cleanup gated on clip-path transitionend
// (with WIPE_FALLBACK_MS guard). Extracted from topSlicerStrip.test.ts
// to keep that file under the 400-LOC cap.
//
// Pre-INF-3771: cleanup fired on a fixed setTimeout (WIPE_MS + buffer);
// on slow hosts the transition was still mid-flight when destroy ran,
// producing the "snap-to-gone" artifact.
// Post-fix: cleanup waits for transitionend, with a fallback timer so
// rare GPU-driver skips still get cleaned up eventually.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import powerbi from "powerbi-visuals-api";
import { FilterState, FilterDimBinding, FilterSlotSettings } from "./state";
import {
    mountTopSlicerStrip,
    WIPE_DELAY_DEFAULT_MS_EXPORT,
    WIPE_FALLBACK_MS_EXPORT,
} from "./topSlicerStrip";

// ---------- fixtures (duplicated from topSlicerStrip.test.ts — self-contained per file) ----------

function makeBinding(dimName: string, slotIndex: number, values: string[]): FilterDimBinding {
    return {
        dimName,
        slotIndex,
        columnRef: {
            displayName: dimName,
            queryName: `T.${dimName}`,
            type: { text: true } as powerbi.ValueTypeDescriptor,
        } as powerbi.DataViewMetadataColumn,
        distinctValues: values,
    };
}

function makeSlot(_slotIndex: number): FilterSlotSettings {
    return {
        tier: "comprehensive",
        widget: "pills-multi",
        defaultSelection: "all",
        labelOverride: "",
        pinned: true,
    };
}

function setup() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const state = new FilterState();
    const handle = mountTopSlicerStrip(container, state);
    const strip = container.firstElementChild as HTMLElement;
    return { container, state, handle, strip };
}

function cleanup(container: HTMLElement) {
    document.documentElement.classList.remove("opening", "closing");
    if (container.parentNode) container.parentNode.removeChild(container);
}

/** Fire a synthetic clip-path transitionend. jsdom does not auto-fire
 *  CSS transitions, so tests must drive the cleanup path explicitly. */
function fireClipPathTransitionEnd(el: HTMLElement): void {
    const ev = new Event("transitionend", { bubbles: true });
    Object.assign(ev, { propertyName: "clip-path" });
    el.dispatchEvent(ev);
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove("opening", "closing");
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

describe("INF-3771: widget cleanup is gated on clip-path transitionend (with fallback)", () => {
    it("transitionend with propertyName=clip-path drives immediate cleanup", () => {
        const { handle, strip, container } = setup();
        handle.render(
            [makeBinding("Phase", 0, ["A"]), makeBinding("Area", 1, ["X"])],
            [makeSlot(0), makeSlot(1)],
            "compact",
        );
        vi.advanceTimersByTime(WIPE_DELAY_DEFAULT_MS_EXPORT + 10);
        const removed = strip.children[1] as HTMLElement;

        handle.render([makeBinding("Phase", 0, ["A"])], [makeSlot(0)], "compact");
        expect(strip.children.length).toBe(2); // still in DOM

        fireClipPathTransitionEnd(removed);
        expect(strip.children.length).toBe(1);

        cleanup(container);
    });

    it("transitionend with a different propertyName does NOT trigger cleanup", () => {
        const { handle, strip, container } = setup();
        handle.render(
            [makeBinding("Phase", 0, ["A"]), makeBinding("Area", 1, ["X"])],
            [makeSlot(0), makeSlot(1)],
            "compact",
        );
        vi.advanceTimersByTime(WIPE_DELAY_DEFAULT_MS_EXPORT + 10);
        const removed = strip.children[1] as HTMLElement;

        handle.render([makeBinding("Phase", 0, ["A"])], [makeSlot(0)], "compact");

        // Fire a transitionend for a DIFFERENT property (e.g. opacity).
        const ev = new Event("transitionend", { bubbles: true });
        Object.assign(ev, { propertyName: "opacity" });
        removed.dispatchEvent(ev);

        // Cleanup must NOT have fired — propertyName filter rejected it.
        expect(strip.children.length).toBe(2);

        cleanup(container);
    });

    it("fallback timer fires cleanup if transitionend never arrives", () => {
        const { handle, strip, container } = setup();
        handle.render(
            [makeBinding("Phase", 0, ["A"]), makeBinding("Area", 1, ["X"])],
            [makeSlot(0), makeSlot(1)],
            "compact",
        );
        vi.advanceTimersByTime(WIPE_DELAY_DEFAULT_MS_EXPORT + 10);

        handle.render([makeBinding("Phase", 0, ["A"])], [makeSlot(0)], "compact");
        expect(strip.children.length).toBe(2);

        // No transitionend fired. Just under fallback — still pending.
        vi.advanceTimersByTime(WIPE_FALLBACK_MS_EXPORT - 10);
        expect(strip.children.length).toBe(2);

        // Cross fallback deadline — cleanup fires.
        vi.advanceTimersByTime(20);
        expect(strip.children.length).toBe(1);

        cleanup(container);
    });

    it("cleanup does NOT double-fire if transitionend arrives after fallback", () => {
        const { handle, strip, container } = setup();
        handle.render(
            [makeBinding("Phase", 0, ["A"]), makeBinding("Area", 1, ["X"])],
            [makeSlot(0), makeSlot(1)],
            "compact",
        );
        vi.advanceTimersByTime(WIPE_DELAY_DEFAULT_MS_EXPORT + 10);
        const removed = strip.children[1] as HTMLElement;

        handle.render([makeBinding("Phase", 0, ["A"])], [makeSlot(0)], "compact");

        // Fallback fires first.
        vi.advanceTimersByTime(WIPE_FALLBACK_MS_EXPORT + 10);
        expect(strip.children.length).toBe(1);

        // Late transitionend on now-removed element. Idempotent fired-once
        // guard means this is a no-op.
        fireClipPathTransitionEnd(removed);
        expect(strip.children.length).toBe(1);

        cleanup(container);
    });

    it("strip collapse waits for LAST removed widget's cleanup", () => {
        const { handle, strip, container } = setup();
        handle.render(
            [makeBinding("Phase", 0, ["A"]), makeBinding("Area", 1, ["X"])],
            [makeSlot(0), makeSlot(1)],
            "compact",
        );
        vi.advanceTimersByTime(WIPE_DELAY_DEFAULT_MS_EXPORT + 10);
        const w0 = strip.children[0] as HTMLElement;
        const w1 = strip.children[1] as HTMLElement;
        expect(parseInt(strip.style.minHeight, 10)).toBeGreaterThanOrEqual(34);

        // Unpin BOTH — both go into wipe.
        handle.render([], [], "compact");

        // Fire transitionend on first only — strip MUST stay tall (last
        // widget still wiping).
        fireClipPathTransitionEnd(w0);
        expect(strip.children.length).toBe(1);
        expect(parseInt(strip.style.minHeight, 10)).toBeGreaterThanOrEqual(34);

        // Fire on the last — strip collapses now.
        fireClipPathTransitionEnd(w1);
        expect(strip.children.length).toBe(0);
        expect(strip.style.minHeight).toBe("0px");

        cleanup(container);
    });
});
