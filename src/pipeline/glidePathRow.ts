"use strict";

import { ActivityWithState } from "../model/activityState";

// INF-3787 Phase 3 — glide-path intent producer.
//
// Pure: given an ActivityWithState, returns the ordered list of render
// layers that should fire for that activity row. Returns layer NAMES
// (not full Props) — render verbs compute their own geometry and the
// orchestrator (src/render/gantt/glidePath.ts) calls each verb against
// the full activity collection. Each verb internally filters to its
// eligible subset.
//
// This module's value is the QUERYABLE intent: a non-render consumer
// (Inspector tooltip, ARIA description, debug overlay) can ask "what
// layers does this row have?" without touching d3 or the DOM. Single
// source of truth for layer composition logic.
//
// Z-order is bottom → top by array index:
//   index 0: baselineBar  (dashed outline, behind everything)
//   index 1: bar          (forecast bar, always present — Activity.end
//                          is required, so the forecast layer is the
//                          floor of the stack)
//   index 2: actualSegment (half-height, layered on top of forecast)
//   index 3: slipChevron  (drift indicator, top of stack)
//
// Graceful degradation table (matches spec exactly):
//   !hasBaseline && !hasActual → ["bar"]
//   hasBaseline only           → ["baselineBar", "bar", "slipChevron"?]
//   hasBaseline + hasActual    → ["baselineBar", "bar", "actualSegment", "slipChevron"?]
//   hasActual only             → ["bar", "actualSegment"]   (no baseline → no chevron)
//
// slipChevron is conditional: included only when baseline is present AND
// slip is non-negligible (on-track activities show no chevron).

export type GlideLayer = "baselineBar" | "bar" | "actualSegment" | "slipChevron";

export function glidePathRow(state: ActivityWithState): GlideLayer[] {
    const layers: GlideLayer[] = [];
    if (state.hasBaseline) layers.push("baselineBar");
    layers.push("bar"); // forecast — Activity.end is required, so bar is always present
    if (state.hasActual)  layers.push("actualSegment");
    if (state.slip != null && state.slip.direction !== "on-track") {
        layers.push("slipChevron");
    }
    return layers;
}
