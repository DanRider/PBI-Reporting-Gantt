// INF-3745 Phase A — dropdownMulti widget tests.
//
// Post search-chips consolidation: the popover is portaled to
// document.body to escape the slicer-strip's stacking context.
// Tests query the popover via document.body; afterEach removes any
// stray popovers so tests don't bleed into each other.

import { describe, it, expect, afterEach } from "vitest";
import powerbi from "powerbi-visuals-api";
import { FilterState, FilterDimBinding, FilterSlotSettings } from "../state";
import { dropdownMultiRenderer } from "./dropdownMulti";

function makeBinding(values: string[]): FilterDimBinding {
    return {
        dimName: "Activity",
        slotIndex: 0,
        columnRef: { displayName: "Activity", queryName: "T.Activity", type: { text: true } as powerbi.ValueTypeDescriptor } as powerbi.DataViewMetadataColumn,
        distinctValues: values,
    };
}

function makeSlot(): FilterSlotSettings {
    return { tier: "comprehensive", widget: "dropdown-multi", defaultSelection: "all", labelOverride: "", pinned: true };
}

const TWENTY_FOUR = Array.from({ length: 24 }, (_, i) => `Act${i.toString().padStart(2, "0")}`);

function getPopover(): HTMLDivElement {
    return document.body.querySelector(".filter-widget-dropdown-popover") as HTMLDivElement;
}

describe("dropdownMulti widget", () => {
    afterEach(() => {
        // Clean up any portaled popovers between tests.
        document.body.querySelectorAll(".filter-widget-dropdown-popover").forEach((el) => el.remove());
    });

    it("mounts in collapsed state — trigger button visible, popover hidden", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = dropdownMultiRenderer.mount(host, {
            binding: makeBinding(TWENTY_FOUR),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const trigger = h.element.querySelector(".filter-widget-dropdown-trigger") as HTMLButtonElement;
        const popover = getPopover();
        expect(trigger).toBeTruthy();
        expect(popover.style.display).toBe("none");
        expect(trigger.textContent).toContain("Activity");
        expect(trigger.textContent).toContain("All");
    });

    it("clicking trigger opens the popover", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = dropdownMultiRenderer.mount(host, {
            binding: makeBinding(TWENTY_FOUR),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const trigger = h.element.querySelector(".filter-widget-dropdown-trigger") as HTMLButtonElement;
        trigger.click();
        const popover = getPopover();
        expect(popover.style.display).toBe("flex");
    });

    it("popover lists all distinct values as checkbox rows", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = dropdownMultiRenderer.mount(host, {
            binding: makeBinding(TWENTY_FOUR),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const trigger = h.element.querySelector(".filter-widget-dropdown-trigger") as HTMLButtonElement;
        trigger.click();
        const popover = getPopover();
        const checkboxes = popover.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(24);
    });

    it("search input filters the list", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = dropdownMultiRenderer.mount(host, {
            binding: makeBinding(["Build", "Discovery", "Deploy", "Design"]),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const trigger = h.element.querySelector(".filter-widget-dropdown-trigger") as HTMLButtonElement;
        trigger.click();
        const popover = getPopover();
        const search = popover.querySelector('input[type="text"]') as HTMLInputElement;
        search.value = "de";
        search.dispatchEvent(new Event("input"));
        const checkboxes = popover.querySelectorAll('input[type="checkbox"]');
        // Matches "Deploy" and "Design" (case-insensitive contains "de").
        // "Discovery" lacks the substring "de".
        expect(checkboxes.length).toBe(2);
    });

    it("clicking a checkbox toggles state", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = dropdownMultiRenderer.mount(host, {
            binding: makeBinding(["Build", "Discovery"]),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const trigger = h.element.querySelector(".filter-widget-dropdown-trigger") as HTMLButtonElement;
        trigger.click();
        const popover = getPopover();
        const checkboxes = popover.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        checkboxes[0].click();
        expect(state.get("Activity").has("Build")).toBe(true);
    });

    it("Done button closes the popover", () => {
        const host = document.createElement("div");
        const state = new FilterState();
        const h = dropdownMultiRenderer.mount(host, {
            binding: makeBinding(["Build"]),
            slot: makeSlot(),
            state,
            density: "compact",
        });
        const trigger = h.element.querySelector(".filter-widget-dropdown-trigger") as HTMLButtonElement;
        trigger.click();
        const popover = getPopover();
        expect(popover.style.display).toBe("flex");
        // Find the Done button by text content
        const buttons = Array.from(popover.querySelectorAll("button")) as HTMLButtonElement[];
        const done = buttons.find(b => b.textContent === "Done") as HTMLButtonElement;
        done.click();
        expect(popover.style.display).toBe("none");
    });
});
