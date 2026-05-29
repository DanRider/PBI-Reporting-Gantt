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

/** v2.2 INF-3739 — top slicer strip vertical compactness setting. Lives
 *  here (not topSlicerStrip.ts) so widget renderers can import without
 *  circular deps from topSlicerStrip (which itself imports renderers). */
export type PinnedDensity = "comfortable" | "compact" | "dense";

/** v2.3 INF-3745 Phase A — per-slot widget polymorphism. "auto" defers to
 *  resolveWidget() which picks by column type and distinct cardinality.
 *  Concrete widgets are the values that ResolvedWidget.kind can take. */
export type SlotWidget =
    | "auto"
    | "pills-multi"
    | "pills-single"
    | "dropdown-multi"
    | "search-chips"
    | "range-slider";

export type ConcreteWidget = Exclude<SlotWidget, "auto">;

export interface ResolvedWidget {
    /** Concrete renderer kind. Never "auto" — auto-resolution happens here. */
    kind: ConcreteWidget;
    /** Explains why this kind was picked. Useful for debugging + test assertions. */
    reason: "user-set" | "auto-cardinality" | "auto-datatype" | "fallback-incompatible";
}

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
    /** v2.3 INF-3745 — per-slot widget choice. Replaces selectionMode as the
     *  per-slot rendering control. "auto" routes through resolveWidget. */
    widget: SlotWidget;
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
    /** Row tuples for faceted-count computation. Each row is a Map of
     *  dimName→value (only filter-dim columns present). Populated by the
     *  controller via setRows() each dataView refresh. Empty rows array
     *  means getValueCounts returns an empty map (graceful fallback). */
    private _rows: ReadonlyArray<ReadonlyMap<string, string>> = [];

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

    /** Populate the row source for faceted-count computation. Called by
     *  the controller on each dataView refresh. Rows are dimName→value
     *  maps, one per data record. Does NOT fire listeners (this is data,
     *  not user selection). */
    setRows(rows: ReadonlyArray<ReadonlyMap<string, string>>): void {
        this._rows = rows;
    }

    /** Faceted counts — for each distinct value of dimName, the number of
     *  rows that match THAT value AND pass all OTHER currently-active
     *  filters. Returns an empty map if no rows are set. The dim being
     *  queried is EXCLUDED from the filter set (so its pill counts show
     *  what would happen if you toggled them, not just current matches). */
    getValueCounts(dimName: string): Map<string, number> {
        const counts = new Map<string, number>();
        if (this._rows.length === 0) return counts;
        // Snapshot OTHER active filters once outside the row loop.
        const otherFilters: Array<[string, ReadonlySet<string>]> = [];
        for (const [dn, sel] of this._selections) {
            if (dn === dimName) continue;
            if (sel.size === 0) continue;
            otherFilters.push([dn, sel]);
        }
        rowLoop: for (const row of this._rows) {
            for (const [dn, sel] of otherFilters) {
                const v = row.get(dn);
                if (v === undefined || !sel.has(v)) continue rowLoop;
            }
            const v = row.get(dimName);
            if (v === undefined) continue;
            counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        return counts;
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

/** v2.3 INF-3745 Phase A — cardinality bands for the "auto" widget rule.
 *  Tunable knob; chosen to match the spec's table after search-chips
 *  was consolidated into dropdown-multi:
 *      text + ≤AUTO_PILLS_MAX → pills-multi
 *      text + >AUTO_PILLS_MAX → dropdown-multi */
export const AUTO_PILLS_MAX = 8;

/** True if the column's metadata type is numeric. */
function isNumericType(col: powerbi.DataViewMetadataColumn): boolean {
    const t = col.type;
    if (t == null) return false;
    return !!(t.numeric || t.integer);
}

/** True if the column's metadata type is dateTime. */
function isDateTimeType(col: powerbi.DataViewMetadataColumn): boolean {
    const t = col.type;
    if (t == null) return false;
    return !!t.dateTime;
}

/**
 * v2.3 INF-3745 Phase A — resolve a slot's widget choice to a concrete
 * renderer kind. Handles three branches:
 *   - slot.widget === "auto" → auto-pick by column type + cardinality.
 *   - slot.widget === a concrete kind that's COMPATIBLE with binding →
 *     pass through with reason "user-set".
 *   - slot.widget === a concrete kind INCOMPATIBLE with binding (e.g.,
 *     "range-slider" on a text column) → fall back to pills-multi with
 *     reason "fallback-incompatible" and emit a console.warn so the
 *     mismatch is visible during development.
 */
export function resolveWidget(
    slot: FilterSlotSettings,
    binding: FilterDimBinding,
): ResolvedWidget {
    const isNumeric = isNumericType(binding.columnRef);
    const isDateTime = isDateTimeType(binding.columnRef);
    const isOrdinal = isNumeric || isDateTime;

    if (slot.widget === "auto") {
        if (isOrdinal) {
            return { kind: "range-slider", reason: "auto-datatype" };
        }
        const n = binding.distinctValues.length;
        if (n <= AUTO_PILLS_MAX) return { kind: "pills-multi", reason: "auto-cardinality" };
        // Text columns of any cardinality > AUTO_PILLS_MAX route to
        // dropdown-multi. The "search-chips" enum value is kept for
        // backward-compat with persisted settings (dispatched to the
        // dropdown-multi renderer in topSlicerStrip) but is no longer a
        // user-facing choice in the picker — visually identical to
        // dropdown-multi, so consolidating reduces confusion.
        return { kind: "dropdown-multi", reason: "auto-cardinality" };
    }

    // User picked a concrete widget. Range-slider on text → fallback.
    if (slot.widget === "range-slider" && !isOrdinal) {
        console.warn(
            `[filterPanel] range-slider requested for non-ordinal column "${binding.dimName}" — falling back to pills-multi.`,
        );
        return { kind: "pills-multi", reason: "fallback-incompatible" };
    }

    return { kind: slot.widget, reason: "user-set" };
}
