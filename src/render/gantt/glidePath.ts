"use strict";

import { Selection } from "d3-selection";
import { ScaleTime } from "d3-scale";
import { Activity } from "../../viewmodel";
import { HealthColorPalette, DEFAULT_HEALTH_PALETTE } from "../../utils/healthColor";
import { SlipThresholds } from "../../model/activityState";
import { renderSlipWhiskers } from "./glide/slipWhisker";

// INF-3787 Phase 5 re-spec — slip-whisker layer orchestrator.
//
// Per the EARNED-escalation principle (vault capture
// 2026-06-02-earned-escalation-principle.md), default render is
// unchanged from v2.2.0.3 — slip escalation lives entirely in the
// activity-label bullet (via slipToHealthColor + the existing
// healthPalette resolution chain). This orchestrator handles the ONE
// opt-in glide chrome layer: the slip whisker, rendered only when
// settings.glidePath.showSlipWhisker is true.
//
// SVG layering: appends g.glide-whisker-layer as the LAST child of the
// parent so the whisker draws over forecast bars (visually it's a thin
// dashed line extending from forecast-end toward baseline-end — by
// rendering above bars the dashed pattern stays visible against any
// underlying lane color). Idempotent across re-renders.

export interface GlidePathOptions {
    /** Format-pane override; omit to use DEFAULT_SLIP_THRESHOLDS. */
    slipThresholds?: SlipThresholds;
    /** Custom health palette (operator-themed); omit for defaults. */
    healthPalette?: HealthColorPalette;
}

const WHISKER_LAYER_CLASS = "glide-whisker-layer";

/**
 * Render the slip-whisker layer into the parent. Idempotent —
 * existing g.glide-whisker-layer is reused across re-renders and
 * raised to last-child to preserve top-of-stack z-order.
 *
 * Caller decides whether to invoke (gated on settings.glidePath
 * .showSlipWhisker). When the toggle is OFF, caller MUST also clear
 * any existing layer; see `clearSlipWhiskerLayer` below.
 */
export function renderSlipWhiskerLayer(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    activities: Activity[],
    xScale: ScaleTime<number, number>,
    rowHeight: number,
    options: GlidePathOptions = {},
): void {
    const layer = ensureSiblingLayer(parent, WHISKER_LAYER_CLASS);
    renderSlipWhiskers(
        layer,
        activities,
        xScale,
        rowHeight,
        options.healthPalette ?? DEFAULT_HEALTH_PALETTE,
        options.slipThresholds,
    );
}

/**
 * Remove the whisker layer if present. Call when the Format-pane
 * toggle is OFF so stale whiskers from a previous render don't
 * persist across user toggle interactions.
 */
export function clearSlipWhiskerLayer(
    parent: Selection<SVGGElement, unknown, null, undefined>,
): void {
    parent.select<SVGGElement>(`g.${WHISKER_LAYER_CLASS}`).remove();
}

function ensureSiblingLayer(
    parent: Selection<SVGGElement, unknown, null, undefined>,
    cls: string,
): Selection<SVGGElement, unknown, null, undefined> {
    let layer = parent.select<SVGGElement>(`g.${cls}`);
    if (layer.empty()) {
        layer = parent.append<SVGGElement>("g").attr("class", cls);
    } else {
        layer.raise();
    }
    return layer;
}
