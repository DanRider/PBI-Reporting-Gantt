// INF-3770 — persistence.ts console.warn shape tests.
//
// The pre-INF-3770 code swallowed every host failure with /* harmless */.
// Post-fix: each call site emits a structured console.warn with input
// shape so client-side debugging is tractable. These tests force the
// host to throw and assert the warn payload contains the right fields.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import powerbi from "powerbi-visuals-api";
import {
    pushFilters, persistSelections, persistPin, persistWidget, persistSortOrders,
} from "./persistence";
import { FilterState, FilterDimBinding } from "./state";

type IVisualHost = powerbi.extensibility.visual.IVisualHost;

function makeBinding(dimName: string, slotIndex: number): FilterDimBinding {
    return {
        dimName,
        slotIndex,
        columnRef: {
            displayName: dimName,
            queryName: `T.${dimName}`,
            type: { text: true } as powerbi.ValueTypeDescriptor,
        } as powerbi.DataViewMetadataColumn,
        distinctValues: ["a", "b", "c"],
    };
}

function throwingHost(): IVisualHost {
    return {
        applyJsonFilter: vi.fn(() => { throw new Error("host-rejected-filter"); }),
        persistProperties: vi.fn(() => { throw new Error("host-rejected-persist"); }),
    } as unknown as IVisualHost;
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    warnSpy.mockRestore();
});

describe("INF-3770: persistence.ts emits structured console.warn on host throw", () => {
    it("pushFilters: warn carries dimCount, dims, error", () => {
        const host = throwingHost();
        const state = new FilterState();
        state.set("DimA", ["x"]);
        state.set("DimB", ["y"]);
        const bindings = [makeBinding("DimA", 0), makeBinding("DimB", 1)];

        pushFilters(host, state, bindings);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const [label, payload] = warnSpy.mock.calls[0];
        expect(label).toBe("[filterPanel] applyJsonFilter failed");
        expect(payload).toMatchObject({
            dimCount: 2,
            dims: expect.arrayContaining(["DimA", "DimB"]),
            error: expect.any(Error),
        });
    });

    it("persistSelections: warn carries activeCount, error", () => {
        const host = throwingHost();
        const state = new FilterState();
        state.set("DimA", ["x", "y"]);

        persistSelections(host, state);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const [label, payload] = warnSpy.mock.calls[0];
        expect(label).toBe("[filterPanel] persistSelections failed");
        expect(payload).toMatchObject({
            activeCount: 1,
            error: expect.any(Error),
        });
    });

    it("persistPin: warn carries slotIndex, pinned, error", () => {
        const host = throwingHost();
        persistPin(host, 3, true);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const [label, payload] = warnSpy.mock.calls[0];
        expect(label).toBe("[filterPanel] persistPin failed");
        expect(payload).toMatchObject({ slotIndex: 3, pinned: true, error: expect.any(Error) });
    });

    it("persistWidget: warn carries slotIndex, widget, error", () => {
        const host = throwingHost();
        persistWidget(host, 5, "dropdown-multi");
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const [label, payload] = warnSpy.mock.calls[0];
        expect(label).toBe("[filterPanel] persistWidget failed");
        expect(payload).toMatchObject({
            slotIndex: 5, widget: "dropdown-multi", error: expect.any(Error),
        });
    });

    it("persistSortOrders: warn carries sortOrders, error", () => {
        const host = throwingHost();
        persistSortOrders(host, [1, 0, 3, 2]);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const [label, payload] = warnSpy.mock.calls[0];
        expect(label).toBe("[filterPanel] persistSortOrders failed");
        expect(payload).toMatchObject({
            sortOrders: [1, 0, 3, 2], error: expect.any(Error),
        });
    });

    it("does NOT warn when host succeeds", () => {
        const okHost = {
            applyJsonFilter: vi.fn(),
            persistProperties: vi.fn(),
        } as unknown as IVisualHost;
        const state = new FilterState();
        state.set("DimA", ["x"]);
        pushFilters(okHost, state, [makeBinding("DimA", 0)]);
        persistSelections(okHost, state);
        persistPin(okHost, 0, true);
        persistWidget(okHost, 0, "auto");
        persistSortOrders(okHost, [0, 1]);
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
