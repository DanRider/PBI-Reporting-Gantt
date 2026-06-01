// INF-3739 — FilterState unit tests.
// INF-3745 Phase A — resolveWidget tests appended below.

import { describe, it, expect, vi } from "vitest";
import powerbi from "powerbi-visuals-api";
import {
    FilterState, FilterSlotSettings, FilterDimBinding, SlotWidget, resolveWidget,
} from "./state";

function makeBinding(
    distinctCount: number,
    typeFlags: { text?: boolean; numeric?: boolean; integer?: boolean; dateTime?: boolean } = { text: true },
): FilterDimBinding {
    const distinctValues = Array.from({ length: distinctCount }, (_, i) => `v${i}`);
    const type = typeFlags as powerbi.ValueTypeDescriptor;
    const columnRef = {
        displayName: "test",
        queryName: "T.test",
        type,
    } as powerbi.DataViewMetadataColumn;
    return { dimName: "test", slotIndex: 0, columnRef, distinctValues };
}

function makeSlot(widget: SlotWidget): FilterSlotSettings {
    return { tier: "comprehensive", widget, defaultSelection: "all", labelOverride: "", pinned: false };
}

describe("FilterState", () => {
    it("starts empty", () => {
        const s = new FilterState();
        expect(s.activeCount()).toBe(0);
        expect(Array.from(s.get("any"))).toEqual([]);
    });

    it("set + get round-trip preserves order-independent equality", () => {
        const s = new FilterState();
        s.set("Segment", ["Commercial", "Medicare"]);
        const got = Array.from(s.get("Segment")).sort();
        expect(got).toEqual(["Commercial", "Medicare"]);
        expect(s.activeCount()).toBe(1);
    });

    it("set with empty iterable clears the dim", () => {
        const s = new FilterState();
        s.set("Segment", ["A", "B"]);
        s.set("Segment", []);
        expect(s.activeCount()).toBe(0);
    });

    it("toggle adds when absent, removes when present", () => {
        const s = new FilterState();
        expect(s.toggle("A", "x")).toBe(1);
        expect(s.toggle("A", "y")).toBe(2);
        expect(s.toggle("A", "x")).toBe(1);
        expect(Array.from(s.get("A"))).toEqual(["y"]);
    });

    it("selectOne replaces the entire set", () => {
        const s = new FilterState();
        s.set("Region", ["East", "West"]);
        s.selectOne("Region", "North");
        expect(Array.from(s.get("Region"))).toEqual(["North"]);
    });

    it("selectOne with empty string clears the dim", () => {
        const s = new FilterState();
        s.set("Region", ["East"]);
        s.selectOne("Region", "");
        expect(s.activeCount()).toBe(0);
    });

    it("clear(dimName) drops only that dim", () => {
        const s = new FilterState();
        s.set("A", ["1"]); s.set("B", ["2"]);
        s.clear("A");
        expect(s.activeCount()).toBe(1);
        expect(Array.from(s.get("B"))).toEqual(["2"]);
    });

    it("clear() with no arg drops all dims", () => {
        const s = new FilterState();
        s.set("A", ["1"]); s.set("B", ["2"]); s.set("C", ["3"]);
        s.clear();
        expect(s.activeCount()).toBe(0);
    });

    it("subscribe fires on set, toggle, clear", () => {
        const s = new FilterState();
        let fires = 0;
        const unsub = s.subscribe(() => { fires += 1; });
        s.set("A", ["1"]);          // +1
        s.toggle("A", "2");         // +1
        s.toggle("A", "2");         // +1  (removing "2")
        s.clear("A");               // +1
        expect(fires).toBe(4);
        unsub();
        s.set("B", ["x"]);          // no fire after unsub
        expect(fires).toBe(4);
    });

    it("subscribe does NOT fire when set is a no-op (same values)", () => {
        const s = new FilterState();
        s.set("A", ["1", "2"]);
        let fires = 0;
        s.subscribe(() => { fires += 1; });
        s.set("A", ["2", "1"]);     // same set; no fire
        expect(fires).toBe(0);
    });

    it("subscribe does NOT fire when clearing an already-empty dim", () => {
        const s = new FilterState();
        let fires = 0;
        s.subscribe(() => { fires += 1; });
        s.clear("nonexistent");
        expect(fires).toBe(0);
    });

    it("toJSON shape is dim → sorted values array", () => {
        const s = new FilterState();
        s.set("Segment", ["Medicare", "Commercial"]);
        s.set("Category", ["Tech"]);
        const j = s.toJSON();
        expect(j).toEqual({
            Segment: ["Commercial", "Medicare"],
            Category: ["Tech"],
        });
    });

    it("fromJSON restores selections without firing listeners", () => {
        const s = FilterState.fromJSON({
            Segment: ["Commercial"],
            Category: ["Tech", "Ops"],
        });
        expect(s.activeCount()).toBe(2);
        expect(Array.from(s.get("Segment"))).toEqual(["Commercial"]);
        expect(new Set(s.get("Category"))).toEqual(new Set(["Tech", "Ops"]));
    });

    it("fromJSON tolerates malformed input", () => {
        expect(FilterState.fromJSON(null).activeCount()).toBe(0);
        expect(FilterState.fromJSON("not-an-object").activeCount()).toBe(0);
        expect(FilterState.fromJSON({ A: "not-an-array" }).activeCount()).toBe(0);
        expect(FilterState.fromJSON({ A: [1, 2, null] }).activeCount()).toBe(0);
    });

    it("fromJSON skips non-string array entries but keeps string entries", () => {
        const s = FilterState.fromJSON({ A: ["x", 1, "y", null, "z"] });
        // Filters out non-strings; keeps x, y, z
        expect(new Set(s.get("A"))).toEqual(new Set(["x", "y", "z"]));
    });

    it("entries returns one tuple per active dim", () => {
        const s = new FilterState();
        s.set("A", ["1"]); s.set("B", ["2", "3"]);
        const e = s.entries().map(([k, v]) => [k, Array.from(v).sort()]).sort();
        expect(e).toEqual([["A", ["1"]], ["B", ["2", "3"]]]);
    });

    it("cross-tier sync semantic: same state mutated via two paths fires both subscribers", () => {
        const s = new FilterState();
        let aFires = 0, bFires = 0;
        s.subscribe(() => { aFires += 1; });
        s.subscribe(() => { bFires += 1; });
        // FeaturedStrip-style mutation
        s.selectOne("Segment", "Commercial");
        // ComprehensivePanel-style mutation on same state
        s.toggle("Segment", "Medicare");
        expect(aFires).toBe(2);
        expect(bFires).toBe(2);
        // Both subscribers observe the same final state
        expect(new Set(s.get("Segment"))).toEqual(new Set(["Commercial", "Medicare"]));
    });

    it("persistence round-trip: toJSON → JSON.stringify → JSON.parse → fromJSON", () => {
        const s = new FilterState();
        s.set("Segment", ["Commercial", "Medicare"]);
        s.set("Category", ["Tech"]);
        const wire = JSON.stringify(s.toJSON());
        const restored = FilterState.fromJSON(JSON.parse(wire));
        expect(restored.activeCount()).toBe(2);
        expect(new Set(restored.get("Segment"))).toEqual(new Set(["Commercial", "Medicare"]));
        expect(new Set(restored.get("Category"))).toEqual(new Set(["Tech"]));
    });
});

describe("resolveWidget (INF-3745 Phase A)", () => {
    it("auto + numeric column → range-slider (auto-datatype)", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(50, { numeric: true }));
        expect(r.kind).toBe("range-slider");
        expect(r.reason).toBe("auto-datatype");
    });

    it("auto + integer column → range-slider (auto-datatype)", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(50, { integer: true }));
        expect(r.kind).toBe("range-slider");
        expect(r.reason).toBe("auto-datatype");
    });

    it("auto + dateTime column → range-slider (auto-datatype)", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(30, { dateTime: true }));
        expect(r.kind).toBe("range-slider");
        expect(r.reason).toBe("auto-datatype");
    });

    it("auto + text + 3 values → pills-multi (auto-cardinality)", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(3, { text: true }));
        expect(r.kind).toBe("pills-multi");
        expect(r.reason).toBe("auto-cardinality");
    });

    it("auto + text + 8 values (boundary) → pills-multi", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(8, { text: true }));
        expect(r.kind).toBe("pills-multi");
    });

    it("auto + text + 9 values → dropdown-multi (auto-cardinality)", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(9, { text: true }));
        expect(r.kind).toBe("dropdown-multi");
        expect(r.reason).toBe("auto-cardinality");
    });

    it("auto + text + 24 values (the fixture's Activity case) → dropdown-multi", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(24, { text: true }));
        expect(r.kind).toBe("dropdown-multi");
    });

    it("auto + text + 100 values (boundary) → dropdown-multi", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(100, { text: true }));
        expect(r.kind).toBe("dropdown-multi");
    });

    it("auto + text + 200 values → dropdown-multi (auto-cardinality, post search-chips consolidation)", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(200, { text: true }));
        expect(r.kind).toBe("dropdown-multi");
        expect(r.reason).toBe("auto-cardinality");
    });

    it("user-set pills-single → pass through (user-set)", () => {
        const r = resolveWidget(makeSlot("pills-single"), makeBinding(5, { text: true }));
        expect(r.kind).toBe("pills-single");
        expect(r.reason).toBe("user-set");
    });

    it("user-set dropdown-multi → pass through (user-set)", () => {
        const r = resolveWidget(makeSlot("dropdown-multi"), makeBinding(5, { text: true }));
        expect(r.kind).toBe("dropdown-multi");
        expect(r.reason).toBe("user-set");
    });

    it("range-slider + text column → fallback to pills-multi + console.warn", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => { /* noop */ });
        const r = resolveWidget(makeSlot("range-slider"), makeBinding(5, { text: true }));
        expect(r.kind).toBe("pills-multi");
        expect(r.reason).toBe("fallback-incompatible");
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it("range-slider + numeric column → pass through (user-set)", () => {
        const r = resolveWidget(makeSlot("range-slider"), makeBinding(50, { numeric: true }));
        expect(r.kind).toBe("range-slider");
        expect(r.reason).toBe("user-set");
    });

    it("auto + text + 0 values (empty) → pills-multi (still cardinality-driven)", () => {
        const r = resolveWidget(makeSlot("auto"), makeBinding(0, { text: true }));
        expect(r.kind).toBe("pills-multi");
    });
});

// ---------- INF-3777: getValueCounts memoization ----------

describe("FilterState.getValueCounts memoization (INF-3777)", () => {
    // Build a small row set with two dims that share a few values, so
    // counts are non-trivial and we can verify correctness across the
    // cache boundary.
    function makeRows(): ReadonlyArray<ReadonlyMap<string, string>> {
        const rows: Array<Map<string, string>> = [];
        for (let i = 0; i < 10; i++) {
            const r = new Map<string, string>();
            r.set("DimA", i % 2 === 0 ? "even" : "odd");
            r.set("DimB", i % 3 === 0 ? "third" : "other");
            rows.push(r);
        }
        return rows;
    }

    // TypeScript `private` is compile-time only — the method exists on
    // the prototype at runtime and vi.spyOn can intercept it.
    function spyCompute(s: FilterState) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return vi.spyOn(s as any, "_computeValueCounts");
    }

    it("returns identical results across cache boundary (correctness)", () => {
        const s = new FilterState();
        s.setRows(makeRows());
        const first = s.getValueCounts("DimA");
        const second = s.getValueCounts("DimA");
        // Same Map instance returned on cache hit — proves we didn't recompute.
        expect(second).toBe(first);
        expect(first.get("even")).toBe(5);
        expect(first.get("odd")).toBe(5);
    });

    it("second call with no mutation is a cache HIT (compute fires once)", () => {
        const s = new FilterState();
        s.setRows(makeRows());
        const spy = spyCompute(s);
        s.getValueCounts("DimA");
        s.getValueCounts("DimA");
        s.getValueCounts("DimA");
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it("state mutation invalidates cache (compute fires again)", () => {
        const s = new FilterState();
        s.setRows(makeRows());
        const spy = spyCompute(s);
        s.getValueCounts("DimA");
        expect(spy).toHaveBeenCalledTimes(1);

        s.toggle("DimB", "third"); // _fire → cache.clear

        s.getValueCounts("DimA");
        expect(spy).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });

    it("setRows invalidates cache (compute fires again)", () => {
        const s = new FilterState();
        s.setRows(makeRows());
        const spy = spyCompute(s);
        s.getValueCounts("DimA");
        expect(spy).toHaveBeenCalledTimes(1);

        s.setRows(makeRows()); // fresh rows → cache.clear

        s.getValueCounts("DimA");
        expect(spy).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });

    it("post-mutation counts reflect the NEW state (not stale cache)", () => {
        const s = new FilterState();
        s.setRows(makeRows());
        // Initially no filter on DimB; DimA's even/odd both count 5.
        let counts = s.getValueCounts("DimA");
        expect(counts.get("even")).toBe(5);
        expect(counts.get("odd")).toBe(5);

        // Now filter DimB → only "third" rows pass. Of 10 rows, indices
        // 0,3,6,9 have DimB=third; of those, evens=0,6 → 2; odds=3,9 → 2.
        s.set("DimB", ["third"]);
        counts = s.getValueCounts("DimA");
        expect(counts.get("even")).toBe(2);
        expect(counts.get("odd")).toBe(2);
    });

    it("different dimNames are cached independently (per-dim entries)", () => {
        const s = new FilterState();
        s.setRows(makeRows());
        const spy = spyCompute(s);
        s.getValueCounts("DimA"); // compute #1
        s.getValueCounts("DimB"); // compute #2 (different dim)
        s.getValueCounts("DimA"); // hit
        s.getValueCounts("DimB"); // hit
        expect(spy).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });
});
