// INF-3739 Phases 3b/3c/3d — filter-panel state.
//
// One FilterState instance is shared by FeaturedStrip + ComprehensivePanel.
// Both surfaces are views over the same Map<dimName, Set<value>>; mutating
// in either tier fires a single render that repaints both. Pure data; no
// DOM, no PBI deps — straightforward unit-testable.

import powerbi from "powerbi-visuals-api";

export const MAX_FILTER_DIMENSIONS = 8;

export type FilterTier = "featured" | "comprehensive" | "both" | "hidden";
export type SelectionMode = "single" | "multi" | "search";

export interface FilterDimBinding {
    /** User-visible column name. Source of truth for the slot's displayName mutation. */
    dimName: string;
    /** 0-7 slotIndex in bound-role order. The slot N settings card mirrors this index. */
    slotIndex: number;
    /** PBI metadata column ref. Used to build IBasicFilter targets. */
    columnRef: powerbi.DataViewMetadataColumn;
    /** First MAX_DISTINCT_VALUES values from data, deduped + sorted. */
    distinctValues: string[];
}

export interface FilterSlotSettings {
    tier: FilterTier;
    selectionMode: SelectionMode;
    /** "all" | "none" | a literal value present in distinctValues. */
    defaultSelection: string;
    /** Empty string means "use dimName". */
    labelOverride: string;
    /** v2.2 INF-3739 — when true, the dim renders as an always-on top slicer
     *  strip ABOVE the chart in addition to appearing in the sidebar. */
    pinned: boolean;
}

/** Maximum distinct values pulled into a filter dim's dropdown. */
export const MAX_DISTINCT_VALUES = 1000;

/** Single source of truth for cross-tier sync. */
export class FilterState {
    private readonly _selections: Map<string, Set<string>> = new Map();
    private readonly _listeners: Set<() => void> = new Set();

    /** Returns the set of selected values for dimName. Empty set = "no filter active" (all values pass). */
    get(dimName: string): ReadonlySet<string> {
        return this._selections.get(dimName) ?? EMPTY_SET;
    }

    /** Replace selections for one dim. Empty set clears the filter. Fires listeners if mutated. */
    set(dimName: string, values: Iterable<string>): void {
        const next = new Set(values);
        const prev = this._selections.get(dimName);
        if (prev && setsEqual(prev, next)) return;
        if (next.size === 0) {
            if (!this._selections.has(dimName)) return;
            this._selections.delete(dimName);
        } else {
            this._selections.set(dimName, next);
        }
        this._fire();
    }

    /** Toggle one value in/out of a dim's selection. Returns the new size. */
    toggle(dimName: string, value: string): number {
        const cur = new Set(this._selections.get(dimName) ?? []);
        if (cur.has(value)) cur.delete(value);
        else cur.add(value);
        this.set(dimName, cur);
        return cur.size;
    }

    /** Single-select semantics — replaces the set. Empty value clears. */
    selectOne(dimName: string, value: string): void {
        if (value === "") this.set(dimName, []);
        else this.set(dimName, [value]);
    }

    clear(dimName?: string): void {
        if (dimName === undefined) {
            if (this._selections.size === 0) return;
            this._selections.clear();
            this._fire();
            return;
        }
        if (!this._selections.has(dimName)) return;
        this._selections.delete(dimName);
        this._fire();
    }

    /** Total dims with non-empty selections. */
    activeCount(): number {
        return this._selections.size;
    }

    /** Subscribe to mutations. Returns unsubscribe. */
    subscribe(fn: () => void): () => void {
        this._listeners.add(fn);
        return () => { this._listeners.delete(fn); };
    }

    /** Iterate (dimName, selections) for every active dim. */
    entries(): Array<[string, ReadonlySet<string>]> {
        return Array.from(this._selections.entries()).map(([k, v]) => [k, v]);
    }

    /** JSON-serializable shape for host.persistProperties. */
    toJSON(): Record<string, string[]> {
        const out: Record<string, string[]> = {};
        for (const [k, v] of this._selections) out[k] = Array.from(v).sort();
        return out;
    }

    /** Restore from persisted JSON. Silent on shape mismatch. Does NOT fire listeners. */
    static fromJSON(raw: unknown): FilterState {
        const out = new FilterState();
        if (raw === null || typeof raw !== "object") return out;
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (!Array.isArray(v)) continue;
            const stringValues = v.filter((x): x is string => typeof x === "string");
            if (stringValues.length > 0) out._selections.set(k, new Set(stringValues));
        }
        return out;
    }

    private _fire(): void {
        for (const fn of this._listeners) fn();
    }
}

const EMPTY_SET: ReadonlySet<string> = new Set();

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
}

/** v2.2 INF-3739 — distinct-value cardinality above which the sidebar widget
 *  auto-switches from a checkbox list to a multi-select dropdown. Keeps short
 *  lists readable while long lists stay scannable via a search box + chips. */
export const HIGH_CARDINALITY_THRESHOLD = 12;

/** v2.2 INF-3739 — dims whose slot is pinned render as always-on top slicer
 *  strips. Per-slot toggle persists via host.persistProperties. */
export function pinnedBindings(
    bindings: ReadonlyArray<FilterDimBinding>,
    slotSettings: ReadonlyArray<FilterSlotSettings>,
): FilterDimBinding[] {
    return bindings.filter((_, i) => {
        const s = slotSettings[i];
        return s != null && s.pinned && s.tier !== "hidden";
    });
}

/** Filter bindings for the dims that should appear in the comprehensive sidebar (everything not hidden). */
export function comprehensiveBindings(
    bindings: ReadonlyArray<FilterDimBinding>,
    slotSettings: ReadonlyArray<FilterSlotSettings>,
): FilterDimBinding[] {
    return bindings.filter((_, i) => {
        const s = slotSettings[i];
        return s != null && s.tier !== "hidden";
    });
}

/** User-facing label — slot's labelOverride wins, else dim's columnName. */
export function dimLabel(binding: FilterDimBinding, slot: FilterSlotSettings): string {
    return slot.labelOverride.trim().length > 0 ? slot.labelOverride : binding.dimName;
}
