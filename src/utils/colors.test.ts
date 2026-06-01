// INF-3782 — areaColor() cyclic-palette fallback tests.
//
// Pre-fix: areaBindings caps at 8 slot colors; areas beyond the cap fell
// back to a uniform FALLBACK_COLOR ("#888") and rendered as indistinguishable
// grey rows. Operator-reported on a client deployment with 12+ areas.
//
// Post-fix: areaColor() deterministically hashes the area name into the
// existing bound palette so beyond-cap lanes cycle through slot colors
// rather than collapsing to grey.

import { describe, it, expect } from "vitest";
import { areaColor, buildColorContext } from "./colors";

const EIGHT_SLOT_PALETTE: Record<string, string> = {
    "Production":          "#1F77B4",
    "Product Development": "#FF7F0E",
    "Supply Chain":        "#2CA02C",
    "Engineering":         "#D62728",
    "Operations":          "#9467BD",
    "Finance":             "#8C564B",
    "Marketing":           "#E377C2",
    "Sales":               "#7F7F7F",
};

describe("INF-3782: areaColor cyclic fallback for areas beyond 8-slot bind cap", () => {
    it("returns the exact bound color when area is in the palette", () => {
        const ctx = buildColorContext(EIGHT_SLOT_PALETTE, {});
        expect(areaColor("Production", ctx)).toBe("#1F77B4");
        expect(areaColor("Sales", ctx)).toBe("#7F7F7F");
    });

    it("unbound areas cycle into the bound palette (never grey fallback)", () => {
        const ctx = buildColorContext(EIGHT_SLOT_PALETTE, {});
        const paletteValues = Object.values(EIGHT_SLOT_PALETTE);

        // Areas 9, 10, 11 — unbound; must map to one of the 8 slot colors.
        for (const unboundArea of ["UnboundArea1", "Lane9", "ExtraArea"]) {
            const color = areaColor(unboundArea, ctx);
            expect(paletteValues).toContain(color);
            // Must NOT be the uniform grey fallback.
            expect(color).not.toBe("#888888");
        }
    });

    it("same unbound area always yields the same color (deterministic hash)", () => {
        const ctx = buildColorContext(EIGHT_SLOT_PALETTE, {});
        const first = areaColor("ConsistentArea", ctx);
        const second = areaColor("ConsistentArea", ctx);
        const third = areaColor("ConsistentArea", ctx);
        expect(first).toBe(second);
        expect(second).toBe(third);
    });

    it("different unbound areas can produce different colors (palette spread)", () => {
        const ctx = buildColorContext(EIGHT_SLOT_PALETTE, {});
        // Probe many area names; expect at least 2 distinct colors are
        // produced across them (smoke check that we're cycling, not pinned).
        const probes = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
        const colors = new Set(probes.map(p => areaColor(p, ctx)));
        expect(colors.size).toBeGreaterThan(1);
    });

    it("empty palette falls back to grey (no cycle target available)", () => {
        const ctx = buildColorContext({}, {});
        // No bound colors → must use uniform fallback.
        expect(areaColor("Anything", ctx)).toBe("#888888");
    });
});
