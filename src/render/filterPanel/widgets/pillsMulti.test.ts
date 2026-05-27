// INF-3745 Phase A — pillsMulti widget tests.

import { describe, it, expect } from "vitest";
import powerbi from "powerbi-visuals-api";
import { FilterState, FilterDimBinding, FilterSlotSettings } from "../state";
import { pillsMultiRenderer } from "./pillsMulti";

function makeBinding(values: string[]): FilterDimBinding {
    return {
        dimName: "Phase",
        slotIndex: 0,
        columnRef: { displayName: "Phase", queryName: "T.Phase", type: { text: true } as powerbi.ValueTypeDescriptor } as powerbi.DataViewMetadataColumn,
        distinctValues: values,
    };
}

function makeSlot(): FilterSlotSettings {
    return { tier: "comprehensive", widget: "pills-multi", defaultSelection: "all", labelOverride: "", pinned: true };
}

describe("pillsMulti widget", () => {
    it("mounts with All + one pill per distinct value", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = pillsMultiRenderer.mount(host, {
            binding: makeBinding(["A", "B", "C"]),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const pills = h.element.querySelectorAll("button");
        expect(pills.length).toBe(4); // All + 3
        expect(pills[0].textContent).toBe("All");
        expect(pills[1].textContent).toBe("A");
    });

    it("clicking a pill adds the value to selection (toggle)", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const binding = makeBinding(["A", "B"]);
        const h = pillsMultiRenderer.mount(host, { binding, slot: makeSlot(), state, density: "compact" });
        const pillA = h.element.querySelectorAll("button")[1] as HTMLButtonElement;
        pillA.click();
        expect(state.get("Phase").has("A")).toBe(true);
    });

    it("clicking an active pill removes the value (toggle out)", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        state.set("Phase", ["A"]);
        const binding = makeBinding(["A", "B"]);
        const h = pillsMultiRenderer.mount(host, { binding, slot: makeSlot(), state, density: "compact" });
        const pillA = h.element.querySelectorAll("button")[1] as HTMLButtonElement;
        pillA.click();
        expect(state.get("Phase").size).toBe(0);
    });

    it("clicking All clears the dim's selection", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        state.set("Phase", ["A", "B"]);
        const h = pillsMultiRenderer.mount(host, {
            binding: makeBinding(["A", "B", "C"]),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const allPill = h.element.querySelectorAll("button")[0] as HTMLButtonElement;
        allPill.click();
        expect(state.get("Phase").size).toBe(0);
    });

    it("multi-select keeps both selections", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const binding = makeBinding(["A", "B", "C"]);
        const h = pillsMultiRenderer.mount(host, { binding, slot: makeSlot(), state, density: "compact" });
        const pills = h.element.querySelectorAll("button");
        (pills[1] as HTMLButtonElement).click();
        (pills[2] as HTMLButtonElement).click();
        expect(state.get("Phase").size).toBe(2);
        expect(state.get("Phase").has("A")).toBe(true);
        expect(state.get("Phase").has("B")).toBe(true);
    });

    it("destroy() removes the renderer's element from its parent", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = pillsMultiRenderer.mount(host, {
            binding: makeBinding(["A"]),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        expect(host.children.length).toBe(1);
        h.destroy();
        expect(host.children.length).toBe(0);
    });
});
