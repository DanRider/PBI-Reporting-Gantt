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

    // INF-3818 — stress test: 25 distinct swim lanes. Operator-reported
    // "lanes 9+ go grey on v2.2.0.3" symptom; INF-3782's fix is in v2.2.0.3
    // but we add explicit 25-lane coverage as a regression guard. Two
    // assertions: (1) zero greys across all 25 lanes; (2) the hash spreads
    // across ≥ 6 of the 8 palette colors (allows for hash collisions but
    // catches a pin-all-to-slot1 regression). Lane names mirror the kind of
    // real-world operator naming that triggered the bug in the field.
    it("25 distinct swim lanes — none grey, spread across ≥6 palette colors", () => {
        const ctx = buildColorContext(EIGHT_SLOT_PALETTE, {});
        const paletteValues = new Set(Object.values(EIGHT_SLOT_PALETTE));
        const lanes = [
            // First 8 — exact-match to bound palette (no hash needed)
            "Production", "Product Development", "Supply Chain", "Engineering",
            "Operations", "Finance", "Marketing", "Sales",
            // Lanes 9-25 — unbound; must hash into the palette
            "Quality Assurance", "Logistics", "Customer Success", "HR",
            "Procurement", "IT Infrastructure", "Compliance", "Research",
            "Field Services", "Training", "Facilities", "Security",
            "Legal", "Risk Management", "Analytics", "Strategy", "Innovation",
        ];
        expect(lanes.length).toBe(25);

        const colors = lanes.map(l => areaColor(l, ctx));

        // Assertion 1 — no lane returns the uniform grey fallback.
        for (let i = 0; i < lanes.length; i++) {
            expect(colors[i]).not.toBe("#888888");
            expect(paletteValues.has(colors[i])).toBe(true);
        }

        // Assertion 2 — palette spread. With 25 lanes hashing into 8 slots,
        // we expect coverage of most/all slots. ≥6 catches a pin-all-to-one
        // regression; tolerates the occasional unlucky hash collision.
        const distinctColors = new Set(colors);
        expect(distinctColors.size).toBeGreaterThanOrEqual(6);
    });

    // INF-3818 — determinism stress: the same lane name produces the same
    // color across 100 repeated invocations. Catches accidental introduction
    // of non-deterministic state into the hash path (e.g., a Math.random
    // refactor that would land each render at a different color).
    it("100x repeated lookups of the same unbound lane name are stable", () => {
        const ctx = buildColorContext(EIGHT_SLOT_PALETTE, {});
        const expected = areaColor("ProgramOffice", ctx);
        for (let i = 0; i < 100; i++) {
            expect(areaColor("ProgramOffice", ctx)).toBe(expected);
        }
    });
});

// INF-3823 — data-bound areaColor data role overrides the Format Pane slot
// and INF-3782 hash-wrap fallback. Resolution order at areaColor():
// (1) data-bound hex (NEW) → (2) exact slot match (existing) →
// (3) hash wrap into slot palette (INF-3782 existing). Invalid hex falls
// THROUGH to (2)/(3) rather than rendering a broken color.
describe("INF-3823: data-bound areaColor role wins over slot and hash fallback", () => {
    it("data-bound color wins over exact slot binding", () => {
        // Engineering IS in the 8-slot palette as "#D62728". With a
        // data-bound override of "#FFFF00", the data-bound value must win.
        const ctx = buildColorContext(
            EIGHT_SLOT_PALETTE,
            {},
            undefined,
            { "Engineering": "#FFFF00" },
        );
        expect(areaColor("Engineering", ctx)).toBe("#FFFF00");
        // Sanity: the slot color is still in the palette but NOT what we got.
        expect(areaColor("Engineering", ctx)).not.toBe("#D62728");
    });

    it("invalid hex falls through to slot/hash (does NOT render the bad value)", () => {
        // "yellow" (CSS name, not hex) MUST fail the /^#[0-9A-Fa-f]{6}$/
        // gate and the resolution must fall through to the slot match.
        // Engineering's exact slot color is "#D62728".
        const ctx = buildColorContext(
            EIGHT_SLOT_PALETTE,
            {},
            undefined,
            { "Engineering": "yellow" },
        );
        const result = areaColor("Engineering", ctx);
        expect(result).not.toBe("yellow");
        expect(result).toBe("#D62728");

        // Also probe a few other invalid shapes that operators might paste
        // — empty string, short hex, 8-digit hex, missing hash, garbage.
        for (const badHex of ["", "#FFF", "#FFFFFFFF", "FF00AA", "not-a-color"]) {
            const c2 = buildColorContext(
                EIGHT_SLOT_PALETTE,
                {},
                undefined,
                { "Engineering": badHex },
            );
            expect(areaColor("Engineering", c2)).toBe("#D62728");
        }
    });

    it("partial binding — only bound areas use the override; others fall to slot/hash", () => {
        // Only Engineering is data-bound. Production must still resolve
        // via exact slot match. An unbound non-slot lane must hash-wrap
        // into the palette (no grey, never undefined).
        const ctx = buildColorContext(
            EIGHT_SLOT_PALETTE,
            {},
            undefined,
            { "Engineering": "#FFFF00" },
        );
        // Bound — data-bound wins.
        expect(areaColor("Engineering", ctx)).toBe("#FFFF00");
        // Unbound but in slot palette — slot match wins (existing path).
        expect(areaColor("Production", ctx)).toBe("#1F77B4");
        expect(areaColor("Sales", ctx)).toBe("#7F7F7F");
        // Unbound AND not in slot palette — INF-3782 hash wrap. Must land
        // somewhere in the palette, must NOT be grey, must NOT be undefined.
        const paletteValues = new Set(Object.values(EIGHT_SLOT_PALETTE));
        const hashed = areaColor("UnboundLane9", ctx);
        expect(hashed).toBeDefined();
        expect(hashed).not.toBe("#888888");
        expect(paletteValues.has(hashed)).toBe(true);
    });
});
