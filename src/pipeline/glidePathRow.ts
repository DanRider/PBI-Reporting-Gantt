"use strict";

import { ActivityWithState } from "../model/activityState";
import { slipToHealthColor } from "../model/activityState";
import { HealthColorPalette, DEFAULT_HEALTH_PALETTE } from "../utils/healthColor";

// INF-3787 Phase 5 re-spec — glide-path intent producer (EARNED-
// escalation shape).
//
// Per the EARNED-escalation principle, slip escalation lives in the
// activity-label BULLET (via slipToHealthColor) by default; full glide
// chrome (slip whisker) is opt-in. This module's value is the
// QUERYABLE intent surface: non-render consumers (Inspector tooltips,
// ARIA descriptions, debug overlays) can ask "how is this row
// presented?" without touching d3.
//
// The original Phase 3 intent producer returned a layered render-call
// list (baselineBar / bar / actualSegment / slipChevron). After the
// pivot, all three of those layers retired; the intent is now just two
// pieces of presentation state per row:
//
//   bulletColorSource: "explicit-health" | "slip-derived" | "lane-fallback"
//   showWhisker:       boolean (true when slip is non-negligible AND
//                                the operator has toggled "Show slip
//                                whisker" ON)
//
// Caller composes this against the bullet render priority + the
// whisker toggle.

export type BulletColorSource = "explicit-health" | "slip-derived" | "lane-fallback";

export interface GlidePathRowIntent {
    /** Where the activity bullet's color comes from. */
    bulletColorSource: BulletColorSource;
    /** Resolved bullet color string (null when source = lane-fallback;
     *  caller resolves lane color from its own ColorContext). */
    bulletColor: string | null;
    /** True when this activity has a non-negligible slip and the
     *  whisker layer is enabled. Caller still owns the toggle gating
     *  but uses this to enumerate which rows would whisker if ON. */
    isWhiskerEligible: boolean;
}

/**
 * Pure — derive the per-row presentation intent for an
 * ActivityWithState. Caller passes the palette so theme-customized
 * colors flow through.
 */
export function glidePathRow(
    state: ActivityWithState,
    palette: HealthColorPalette = DEFAULT_HEALTH_PALETTE,
): GlidePathRowIntent {
    const hasExplicitHealth = state.base.health != null && state.base.health.trim().length > 0;

    if (hasExplicitHealth) {
        return {
            bulletColorSource: "explicit-health",
            bulletColor: null, // caller resolves via healthColor(base.health, palette) — kept separate for provenance
            isWhiskerEligible: isWhiskerEligible(state),
        };
    }

    const slipColor = slipToHealthColor(state.slip, palette);
    if (slipColor != null) {
        return {
            bulletColorSource: "slip-derived",
            bulletColor: slipColor,
            isWhiskerEligible: true, // slipColor non-null ⇔ non-negligible slip
        };
    }

    return {
        bulletColorSource: "lane-fallback",
        bulletColor: null,
        isWhiskerEligible: false,
    };
}

function isWhiskerEligible(state: ActivityWithState): boolean {
    return state.slip != null && state.slip.direction !== "on-track";
}
