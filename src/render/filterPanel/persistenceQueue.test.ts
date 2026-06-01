// INF-3770 — persistenceQueue debounce + flush + snapshot-bindings tests.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import powerbi from "powerbi-visuals-api";
import {
    createPersistenceQueue,
    PUSH_FILTERS_DEBOUNCE_MS,
    PERSIST_SELECTIONS_DEBOUNCE_MS,
} from "./persistenceQueue";
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
        distinctValues: ["a", "b"],
    };
}

function fakeHost() {
    return {
        applyJsonFilter: vi.fn(),
        persistProperties: vi.fn(),
    } as unknown as IVisualHost & {
        applyJsonFilter: ReturnType<typeof vi.fn>;
        persistProperties: ReturnType<typeof vi.fn>;
    };
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("INF-3770: persistenceQueue debounces rapid calls", () => {
    it("five rapid schedules coalesce into one applyJsonFilter + one persistProperties", () => {
        const host = fakeHost();
        const state = new FilterState();
        state.set("DimA", ["x"]);
        const bindings = [makeBinding("DimA", 0)];
        const q = createPersistenceQueue(host, state);

        for (let i = 0; i < 5; i++) q.schedule(bindings);

        // Nothing fires before the debounce windows elapse.
        expect(host.applyJsonFilter).not.toHaveBeenCalled();
        expect(host.persistProperties).not.toHaveBeenCalled();

        // Advance past push window — applyJsonFilter fires once.
        vi.advanceTimersByTime(PUSH_FILTERS_DEBOUNCE_MS + 1);
        expect(host.applyJsonFilter).toHaveBeenCalledTimes(1);
        expect(host.persistProperties).not.toHaveBeenCalled(); // 300ms not yet elapsed

        // Advance past persist window — persistProperties fires once.
        vi.advanceTimersByTime(PERSIST_SELECTIONS_DEBOUNCE_MS);
        expect(host.persistProperties).toHaveBeenCalledTimes(1);
    });

    it("flush() fires pending writes immediately and cancels timers", () => {
        const host = fakeHost();
        const state = new FilterState();
        state.set("DimA", ["x"]);
        const q = createPersistenceQueue(host, state);

        q.schedule([makeBinding("DimA", 0)]);
        q.flush();

        // Both fired synchronously inside flush().
        expect(host.applyJsonFilter).toHaveBeenCalledTimes(1);
        expect(host.persistProperties).toHaveBeenCalledTimes(1);

        // Advancing time afterward must NOT double-fire — timers were cancelled.
        vi.advanceTimersByTime(10_000);
        expect(host.applyJsonFilter).toHaveBeenCalledTimes(1);
        expect(host.persistProperties).toHaveBeenCalledTimes(1);
    });

    it("flush() with no pending work is a no-op", () => {
        const host = fakeHost();
        const state = new FilterState();
        const q = createPersistenceQueue(host, state);

        q.flush();
        q.flush();

        // persistSelections still fires (it has no pending-flag — always
        // safe to fire-and-forget current state).
        expect(host.persistProperties).toHaveBeenCalledTimes(2);
        // applyJsonFilter only fires if bindings were scheduled.
        expect(host.applyJsonFilter).not.toHaveBeenCalled();
    });

    it("bindings are snapshotted at queue time — mid-debounce mutation does not leak", () => {
        const host = fakeHost();
        const state = new FilterState();
        state.set("DimA", ["x"]);
        const initialBindings = [makeBinding("DimA", 0), makeBinding("DimB", 1)];
        const q = createPersistenceQueue(host, state);

        q.schedule(initialBindings);
        // Mutate the caller's array AFTER scheduling — like a mid-debounce
        // dataView refresh would. The snapshot must NOT reflect this change.
        initialBindings.length = 0;
        initialBindings.push(makeBinding("DimX", 9)); // entirely different shape

        vi.advanceTimersByTime(PUSH_FILTERS_DEBOUNCE_MS + 1);

        // applyJsonFilter was called with filters derived from the ORIGINAL
        // bindings (DimA selection passes through). DimX is unbound in state
        // so no filter for it; DimA's filter must still apply.
        expect(host.applyJsonFilter).toHaveBeenCalledTimes(1);
        const filterArg = host.applyJsonFilter.mock.calls[0][0];
        // filterArg is a (typed-as-single but actually array) IFilter[].
        // It contains the DimA filter if the snapshot was preserved.
        const arr = filterArg as unknown as Array<{ target?: { column?: string } }>;
        const hasDimA = arr.some(f => f.target?.column === "DimA");
        expect(hasDimA).toBe(true);
    });

    it("schedule restarts the debounce window (sliding, not fixed)", () => {
        const host = fakeHost();
        const state = new FilterState();
        state.set("DimA", ["x"]);
        const q = createPersistenceQueue(host, state);

        q.schedule([makeBinding("DimA", 0)]);
        vi.advanceTimersByTime(PUSH_FILTERS_DEBOUNCE_MS - 10);
        // Schedule again BEFORE the window elapses — push timer should restart.
        q.schedule([makeBinding("DimA", 0)]);
        vi.advanceTimersByTime(PUSH_FILTERS_DEBOUNCE_MS - 10);
        // Total elapsed = ~80ms, but window restarted at 40ms → still pending.
        expect(host.applyJsonFilter).not.toHaveBeenCalled();
        vi.advanceTimersByTime(20);
        expect(host.applyJsonFilter).toHaveBeenCalledTimes(1);
    });
});
