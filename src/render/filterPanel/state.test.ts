// INF-3739 — FilterState unit tests.

import { describe, it, expect } from "vitest";
import { FilterState } from "./state";

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
