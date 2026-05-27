// INF-3745 Phase A — pillsSingle widget tests.

import { describe, it, expect } from "vitest";
import powerbi from "powerbi-visuals-api";
import { FilterState, FilterDimBinding, FilterSlotSettings } from "../state";
import { pillsSingleRenderer } from "./pillsSingle";

function makeBinding(values: string[]): FilterDimBinding {
    return {
        dimName: "Phase",
        slotIndex: 0,
        columnRef: { displayName: "Phase", queryName: "T.Phase", type: { text: true } as powerbi.ValueTypeDescriptor } as powerbi.DataViewMetadataColumn,
        distinctValues: values,
    };
}

function makeSlot(): FilterSlotSettings {
    return { tier: "comprehensive", widget: "pills-single", defaultSelection: "all", labelOverride: "", pinned: true };
}

describe("pillsSingle widget", () => {
    it("mounts with one pill per distinct value (no All pill)", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = pillsSingleRenderer.mount(host, {
            binding: makeBinding(["A", "B", "C"]),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const pills = h.element.querySelectorAll("button");
        expect(pills.length).toBe(3);
        expect(pills[0].textContent).toBe("A");
    });

    it("clicking inactive pill sets it as the exclusive selection", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const binding = makeBinding(["A", "B", "C"]);
        const h = pillsSingleRenderer.mount(host, { binding, slot: makeSlot(), state, density: "compact" });
        const pills = h.element.querySelectorAll("button");
        (pills[1] as HTMLButtonElement).click();
        expect(Array.from(state.get("Phase"))).toEqual(["B"]);
    });

    it("clicking active pill clears the dim", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        state.set("Phase", ["A"]);
        const binding = makeBinding(["A", "B"]);
        const h = pillsSingleRenderer.mount(host, { binding, slot: makeSlot(), state, density: "compact" });
        const pillA = h.element.querySelectorAll("button")[0] as HTMLButtonElement;
        pillA.click();
        expect(state.get("Phase").size).toBe(0);
    });

    it("clicking a different pill replaces the prior selection (no multi)", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        state.set("Phase", ["A"]);
        const binding = makeBinding(["A", "B", "C"]);
        const h = pillsSingleRenderer.mount(host, { binding, slot: makeSlot(), state, density: "compact" });
        const pills = h.element.querySelectorAll("button");
        (pills[2] as HTMLButtonElement).click(); // C
        expect(Array.from(state.get("Phase"))).toEqual(["C"]);
        expect(state.get("Phase").size).toBe(1);
    });

    it("multi-attempts collapse to single via selectOne", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        // Seed multi-value state (e.g., round-tripped from pills-multi).
        state.set("Phase", ["A", "B"]);
        const binding = makeBinding(["A", "B", "C"]);
        const h = pillsSingleRenderer.mount(host, { binding, slot: makeSlot(), state, density: "compact" });
        const pills = h.element.querySelectorAll("button");
        // C is inactive; click it.
        (pills[2] as HTMLButtonElement).click();
        expect(Array.from(state.get("Phase"))).toEqual(["C"]);
    });
});
