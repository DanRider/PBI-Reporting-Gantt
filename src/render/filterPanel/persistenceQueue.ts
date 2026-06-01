// INF-3770 — debounced persistence queue.
//
// Wraps the raw pushFilters / persistSelections calls so rapid state
// mutations coalesce into one PBI round-trip per debounce window.
// Snapshots `bindings` at QUEUE time (addendum item 7) — a mid-debounce
// dataView refresh that changes the binding shape MUST NOT change the
// bindings the user clicked against. The in-visual rerender stays
// synchronous via the caller's own onChange path; only the host-side
// applyJsonFilter + persistProperties round-trips debounce.
//
// Debounce windows (filter primitives agent's Q3 cadences):
//   pushFilters  → 50ms  (below human-perception of "lag"; absorbs
//                          double-clicks without writing two filter updates)
//   persistSelections → 300ms (reasonable host-write rate for session-restore)
//
// flush() is called from visual.destroy() so the LAST debounce window
// of user state is never lost on tab close / unload.

import powerbi from "powerbi-visuals-api";
import { pushFilters, persistSelections } from "./persistence";
import { FilterDimBinding, FilterState } from "./state";

type IVisualHost = powerbi.extensibility.visual.IVisualHost;

export const PUSH_FILTERS_DEBOUNCE_MS = 50;
export const PERSIST_SELECTIONS_DEBOUNCE_MS = 300;

export interface PersistenceQueue {
    /** Schedule a debounced applyJsonFilter + persistSelections. The
     *  bindings argument is SNAPSHOTTED at call time — subsequent dataView
     *  refreshes that mutate the caller's bindings array do not affect
     *  the queued write. */
    schedule(bindings: ReadonlyArray<FilterDimBinding>): void;
    /** Fire any pending writes immediately (cancel pending timers).
     *  Idempotent — no pending work means no-op. Called from
     *  visual.destroy() to flush the last debounce window. */
    flush(): void;
}

export function createPersistenceQueue(
    host: IVisualHost,
    state: FilterState,
): PersistenceQueue {
    let pushTimer: number | null = null;
    let pushBindings: ReadonlyArray<FilterDimBinding> | null = null;
    let persistTimer: number | null = null;

    function firePush(): void {
        if (pushTimer !== null) {
            window.clearTimeout(pushTimer);
            pushTimer = null;
        }
        if (pushBindings === null) return;
        const snapshot = pushBindings;
        pushBindings = null;
        pushFilters(host, state, snapshot);
    }

    function firePersist(): void {
        if (persistTimer !== null) {
            window.clearTimeout(persistTimer);
            persistTimer = null;
        }
        persistSelections(host, state);
    }

    return {
        schedule(bindings: ReadonlyArray<FilterDimBinding>): void {
            // Snapshot bindings at queue time. .slice() captures CURRENT
            // values; the caller's array reference can be reassigned
            // before the timer fires without affecting this scheduled write.
            pushBindings = bindings.slice();
            if (pushTimer !== null) window.clearTimeout(pushTimer);
            pushTimer = window.setTimeout(firePush, PUSH_FILTERS_DEBOUNCE_MS);

            if (persistTimer !== null) window.clearTimeout(persistTimer);
            persistTimer = window.setTimeout(firePersist, PERSIST_SELECTIONS_DEBOUNCE_MS);
        },
        flush(): void {
            firePush();
            firePersist();
        },
    };
}
