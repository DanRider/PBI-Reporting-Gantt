// INF-3778 — drag-controller snapshot tests.
//
// Pre-fix: getVisibleSlotIndices() was called at pointerup time. If
// FilterState mutated mid-drag, the visible-slots list could differ from
// the one the user started dragging against — drop math produced the
// wrong reorder. Post-fix: snapshot frozen at pointerdown; if snapshot
// differs from current at drop time, abort with a warn.
//
// Tests verify both halves of the contract:
//   1. Normal drag (no mid-drag mutation) → onReorder fires; no warn.
//   2. Mid-drag mutation → onReorder aborted; console.warn called.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountDragController } from "./dragReorder";

// jsdom's PointerEvent constructor is sometimes missing entirely.
// Use a plain Event and bolt on the properties the controller reads.
function makePointerEvent(
    type: string,
    props: { clientY: number; pointerId?: number },
): Event {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, {
        clientY: props.clientY,
        clientX: 0,
        pointerId: props.pointerId ?? 1,
    });
    return ev;
}

interface Mounted {
    body: HTMLElement;
    handles: HTMLElement[];   // grab handles in slot-index order [0..3]
    blocks: HTMLElement[];     // dim blocks in slot-index order
    onReorder: ReturnType<typeof vi.fn>;
    visibleSlots: { current: ReadonlyArray<number> };
}

function setup(initialSlots: ReadonlyArray<number>): Mounted {
    const body = document.createElement("div");
    document.body.appendChild(body);

    // Use a wrapper object so the test can mutate the stub return between
    // pointerdown and pointerup without rebinding the closure.
    const visibleSlots = { current: initialSlots };
    const onReorder = vi.fn();

    const controller = mountDragController(body, {
        getVisibleSlotIndices: () => visibleSlots.current,
        onReorder,
    });

    // For each slot, create a block + a grab handle. Attach handle to
    // body so it inherits pointer-event support.
    const blocks: HTMLElement[] = [];
    const handles: HTMLElement[] = [];
    for (const slot of initialSlots) {
        const block = document.createElement("div");
        block.dataset.slotIndex = String(slot);
        body.appendChild(block);
        blocks.push(block);

        const handle = document.createElement("span");
        block.appendChild(handle);
        controller.attachDragHandle(handle, block, slot);
        handles.push(handle);
    }

    return { body, handles, blocks, onReorder, visibleSlots };
}

function cleanup(body: HTMLElement) {
    if (body.parentNode) body.parentNode.removeChild(body);
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
}

beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

describe("INF-3778: drag snapshot prevents stale-closure drop", () => {
    it("normal drag (no mid-drag mutation) fires onReorder, no warn", () => {
        const { body, handles, onReorder } = setup([0, 1, 2, 3]);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        // Drag slot-2's handle. pointerdown → pointermove (above 5px
        // threshold to mark dragging=true) → pointerup. Without mid-drag
        // mutation, the snapshot equals current at drop time → onReorder fires.
        const handle = handles[2];
        handle.dispatchEvent(makePointerEvent("pointerdown", { clientY: 100 }));
        handle.dispatchEvent(makePointerEvent("pointermove", { clientY: 150 }));
        handle.dispatchEvent(makePointerEvent("pointerup",   { clientY: 150 }));

        expect(onReorder).toHaveBeenCalledTimes(1);
        expect(warnSpy).not.toHaveBeenCalled();

        // Sanity: the emitted sortOrders array is length 8 (MAX_FILTER_DIMENSIONS).
        const call = onReorder.mock.calls[0][0] as ReadonlyArray<number>;
        expect(call.length).toBe(8);

        warnSpy.mockRestore();
        cleanup(body);
    });

    it("drag with mid-drag mutation aborts with console.warn, onReorder NOT called", () => {
        const { body, handles, onReorder, visibleSlots } = setup([0, 1, 2, 3]);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const handle = handles[2];
        handle.dispatchEvent(makePointerEvent("pointerdown", { clientY: 100 }));
        handle.dispatchEvent(makePointerEvent("pointermove", { clientY: 150 }));

        // SIMULATE mid-drag mutation: dim 1 disappears (state-driven
        // repaint would update lastBindings, which getVisibleSlotIndices
        // reads. The drag-controller's pointerdown snapshotted [0,1,2,3];
        // now current returns [0,2,3]. Snapshot vs current differ.
        visibleSlots.current = [0, 2, 3];

        handle.dispatchEvent(makePointerEvent("pointerup", { clientY: 150 }));

        // The drop must be aborted — no incorrect reorder lands.
        expect(onReorder).not.toHaveBeenCalled();
        // And a warn must be emitted so client-side debugging is possible.
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const warnArgs = warnSpy.mock.calls[0];
        expect(String(warnArgs[0])).toContain("[dragReorder]");
        expect(String(warnArgs[0])).toContain("mid-drag");

        warnSpy.mockRestore();
        cleanup(body);
    });

    it("identical-shape mid-drag refresh (same values) still drops normally", () => {
        // Edge case: lastBindings is a NEW array but with the same slot
        // indices (common when a dataView refresh re-emits unchanged dims).
        // The fix must compare VALUES, not array identity — otherwise every
        // refresh would falsely abort.
        const { body, handles, onReorder, visibleSlots } = setup([0, 1, 2, 3]);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const handle = handles[2];
        handle.dispatchEvent(makePointerEvent("pointerdown", { clientY: 100 }));
        handle.dispatchEvent(makePointerEvent("pointermove", { clientY: 150 }));

        // Replace with a new array containing the same slot indices.
        visibleSlots.current = [0, 1, 2, 3];

        handle.dispatchEvent(makePointerEvent("pointerup", { clientY: 150 }));

        expect(onReorder).toHaveBeenCalledTimes(1);
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
        cleanup(body);
    });

    it("pointerdown without drag (no movement above threshold) does NOT fire onReorder", () => {
        // No regression on the existing "click without drag" path: dragState
        // is set, but dragging stays false because pointermove never crosses
        // DRAG_THRESHOLD_PX. pointerup early-exits before snapshot comparison.
        const { body, handles, onReorder } = setup([0, 1, 2, 3]);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const handle = handles[2];
        handle.dispatchEvent(makePointerEvent("pointerdown", { clientY: 100 }));
        handle.dispatchEvent(makePointerEvent("pointerup",   { clientY: 102 }));

        expect(onReorder).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
        cleanup(body);
    });
});
