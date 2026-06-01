// INF-3776 — focus-preservation tests for the sidebar repaint cycle.
//
// Before this fix, every FilterState mutation tore down every dim block
// (search inputs included), so users typing in dim A's search lost focus
// the moment they clicked anything in dim B. Tests assert:
//   (1) document.activeElement survives a state mutation when the focused
//       element is a sidebar search input.
//   (2) Cursor position is restored.
//   (3) Focus is NEVER hijacked from outside the sidebar body (the
//       guardrail against stealing focus from the Format pane or another
//       visual on the page).
//   (4) Graceful no-op when no input was focused before the mutation.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import powerbi from "powerbi-visuals-api";
import {
    FilterState, FilterDimBinding, FilterSlotSettings,
    HIGH_CARDINALITY_THRESHOLD,
} from "./state";
import { mountComprehensivePanel, ComprehensivePanelHandle } from "./comprehensivePanel";

// ---------- fixtures ----------

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

function makeSlot(): FilterSlotSettings {
    return {
        tier: "comprehensive",
        widget: "auto",
        defaultSelection: "all",
        labelOverride: "",
        pinned: false,
    };
}

// Many distinct values so the dim auto-resolves to dropdown-multi
// (above HIGH_CARDINALITY_THRESHOLD), which mounts a search input via
// buildDropdownWidget. Same buildSearchInput is used by the checkbox
// widget, so either widget shape would exercise the tag.
function makeHighCardValues(n: number, prefix: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(`${prefix}-${String(i).padStart(3, "0")}`);
    return out;
}

interface Mounted {
    container: HTMLElement;
    state: FilterState;
    handle: ComprehensivePanelHandle;
    body: HTMLElement;
}

function setup(): Mounted {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const state = new FilterState();
    const handle = mountComprehensivePanel(container, state, {
        onTogglePin: () => {},
        isPinned: () => false,
        onWidgetChange: () => {},
        currentWidget: () => "auto",
        isApplyToFilterPane: () => false,
        onToggleApplyToFilterPane: () => {},
        onReorder: () => {},
    });
    // The sidebar's scroll body is the second child of root
    // (header is provided externally; here root has [body, footer]).
    const root = handle.element;
    const body = root.children[0] as HTMLElement;
    return { container, state, handle, body };
}

function cleanup(container: HTMLElement) {
    if (container.parentNode) container.parentNode.removeChild(container);
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
}

// Expand a dim block by clicking its chevron. dimIndex matches the order
// in `bindings` passed to handle.render — dim blocks are emitted in that
// order. The chevron is the FIRST <button> in the block's header per
// buildDimBlock (chevron → pin → gear → optional clear-x).
function expandAndGetSearchInput(
    body: HTMLElement,
    dimIndex: number,
    dimName: string,
): HTMLInputElement {
    // dragController appends a drop-indicator element (display:none +
    // position:absolute) before render — skip it.
    const dimBlocks = (Array.from(body.children) as HTMLElement[]).filter(
        c => !(c.style.display === "none" && c.style.position === "absolute"),
    );
    const block = dimBlocks[dimIndex];
    if (block === undefined) {
        throw new Error(`No dim block at index ${dimIndex} (found ${dimBlocks.length})`);
    }
    const chevron = block.querySelector("button");
    if (!(chevron instanceof HTMLButtonElement)) {
        throw new Error(`No chevron <button> in block ${dimIndex}`);
    }
    chevron.click();
    const input = body.querySelector(
        `input[data-search-role="in-dim"][data-dim-name="${dimName}"]`,
    );
    if (!(input instanceof HTMLInputElement)) {
        throw new Error(`No search input for expanded dim ${dimName} (index ${dimIndex})`);
    }
    return input;
}

beforeEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

// ---------- TEST 1: focus + cursor preserved across state mutation ----------

describe("INF-3776: search input focus + cursor preserved across FilterState mutation", () => {
    it("typing in dim A's search, then mutating dim B's state, leaves dim A focused with cursor intact", () => {
        const { container, state, handle, body } = setup();
        const bindings = [
            makeBinding("DimA", 0, makeHighCardValues(HIGH_CARDINALITY_THRESHOLD + 1, "a")),
            makeBinding("DimB", 1, makeHighCardValues(HIGH_CARDINALITY_THRESHOLD + 1, "b")),
        ];
        const slots = [makeSlot(), makeSlot()];

        handle.render(bindings, slots);

        // Expand dim A so its search input mounts. Focus, type, set cursor.
        const searchA = expandAndGetSearchInput(body, 0, "DimA");
        searchA.focus();
        expect(document.activeElement).toBe(searchA);
        searchA.value = "abc";
        searchA.dispatchEvent(new Event("input"));      // searchQueries.set('DimA','abc')
        searchA.setSelectionRange(3, 3);

        // Mutate FilterState — this fires state.subscribe → repaint → tear-down.
        state.toggle("DimB", "b-000");

        // After repaint, dim A's old search input is GONE (it was a child
        // of the torn-down dim block). The NEW input must exist and own focus.
        // Iterate candidates (avoid CSS.escape — jsdom env may lack the global).
        let restoredInput: HTMLInputElement | null = null;
        const cands = body.querySelectorAll('input[data-search-role="in-dim"]');
        for (let i = 0; i < cands.length; i++) {
            const c = cands.item(i);
            if (c instanceof HTMLInputElement && c.dataset.dimName === "DimA") {
                restoredInput = c;
                break;
            }
        }
        expect(restoredInput).not.toBeNull();
        expect(restoredInput).not.toBe(searchA); // proves DOM was torn down + rebuilt
        restoredInput = restoredInput as HTMLInputElement;

        // The load-bearing assertion per guardrail #4 — activeElement.
        expect(document.activeElement).toBe(restoredInput);
        // Value preserved (came back through searchQueries closure Map).
        expect(restoredInput.value).toBe("abc");
        // Cursor position preserved.
        expect(restoredInput.selectionStart).toBe(3);

        cleanup(container);
    });
});

// ---------- TEST 2: no focus hijack from outside the sidebar ----------

describe("INF-3776: focus restore is scoped to sidebar body (no hijack from elsewhere)", () => {
    it("active element outside the sidebar body is NOT hijacked on state mutation", () => {
        const { container, state, handle, body } = setup();

        // A second input lives OUTSIDE the sidebar — simulates the Format
        // pane / another visual / anywhere on the page that isn't us.
        const outsideInput = document.createElement("input");
        outsideInput.type = "text";
        outsideInput.dataset.searchRole = "in-dim"; // deliberately wears OUR tag — tests that we ALSO check body containment
        outsideInput.dataset.dimName = "Something";
        document.body.appendChild(outsideInput);
        outsideInput.focus();
        expect(document.activeElement).toBe(outsideInput);

        // Mount + render bindings, expand one, then put state into a known shape.
        const bindings = [makeBinding("DimA", 0, ["x", "y", "z"])];
        const slots = [makeSlot()];
        handle.render(bindings, slots);

        // Mutate state — the repaint will fire. Outside-the-body focus must survive.
        state.toggle("DimA", "x");

        // Outside input still owns focus. Sidebar did not steal it.
        expect(document.activeElement).toBe(outsideInput);

        cleanup(container);
    });
});

// ---------- TEST 3: graceful no-op when nothing was focused ----------

describe("INF-3776: graceful no-op when no sidebar input was focused", () => {
    it("state mutation with nothing focused does not throw and does not move focus", () => {
        const { container, state, handle } = setup();
        const bindings = [makeBinding("DimA", 0, ["one", "two"])];
        const slots = [makeSlot()];
        handle.render(bindings, slots);

        // Ensure nothing in the sidebar has focus.
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        const before = document.activeElement;

        // Should not throw.
        expect(() => state.toggle("DimA", "one")).not.toThrow();

        // Focus didn't move. (In jsdom, activeElement is usually <body> when
        // nothing else is focused — we just assert it didn't change.)
        expect(document.activeElement).toBe(before);

        cleanup(container);
    });
});
