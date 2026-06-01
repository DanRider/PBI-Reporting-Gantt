// INF-3774 — attachOutsideClickGuard tests.
//
// The shared helper replaces the prior setTimeout(0)-deferred document
// click attach in dropdownMulti + widgetPicker. Tests verify the four
// behavioral cells:
//   1. Click inside the trigger element → onOutside NOT called.
//   2. Click inside the popover (portaled to document.body) → NOT called.
//   3. Click truly outside both → onOutside called once.
//   4. After dispose(), no further outside clicks fire onOutside.
//
// Capture-phase attach is verified by guards inside the helper itself —
// jsdom dispatches click events through document capture before bubble.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { attachOutsideClickGuard } from "./widgetCommon";

interface Mounted {
    trigger: HTMLElement;
    popover: HTMLElement;
    outside: HTMLElement;
    onOutside: ReturnType<typeof vi.fn>;
    dispose: () => void;
}

function setup(): Mounted {
    // In-place trigger (sits in sidebar/strip).
    const trigger = document.createElement("button");
    trigger.textContent = "trigger";
    document.body.appendChild(trigger);

    // Popover lives on document.body — same as real dropdownMulti / widgetPicker.
    const popover = document.createElement("div");
    popover.textContent = "popover";
    document.body.appendChild(popover);

    // A truly-outside element.
    const outside = document.createElement("div");
    outside.textContent = "outside";
    document.body.appendChild(outside);

    const onOutside = vi.fn();
    const guard = attachOutsideClickGuard(trigger, popover, onOutside);

    return { trigger, popover, outside, onOutside, dispose: () => guard.dispose() };
}

beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

describe("INF-3774: attachOutsideClickGuard", () => {
    it("click inside trigger does NOT fire onOutside", () => {
        const m = setup();
        m.trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(m.onOutside).not.toHaveBeenCalled();
        m.dispose();
    });

    it("click inside popover (portaled to body) does NOT fire onOutside", () => {
        const m = setup();
        m.popover.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(m.onOutside).not.toHaveBeenCalled();
        m.dispose();
    });

    it("click outside both fires onOutside exactly once", () => {
        const m = setup();
        m.outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(m.onOutside).toHaveBeenCalledTimes(1);
        m.dispose();
    });

    it("after dispose, outside click does NOT fire onOutside", () => {
        const m = setup();
        m.dispose();
        m.outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(m.onOutside).not.toHaveBeenCalled();
    });

    it("dispose is idempotent (calling twice does not throw)", () => {
        const m = setup();
        m.dispose();
        expect(() => m.dispose()).not.toThrow();
    });

    it("click on a descendant of trigger is treated as inside", () => {
        const m = setup();
        const child = document.createElement("span");
        m.trigger.appendChild(child);
        child.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(m.onOutside).not.toHaveBeenCalled();
        m.dispose();
    });

    it("click on a descendant of popover is treated as inside", () => {
        const m = setup();
        const child = document.createElement("input");
        m.popover.appendChild(child);
        child.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(m.onOutside).not.toHaveBeenCalled();
        m.dispose();
    });
});
