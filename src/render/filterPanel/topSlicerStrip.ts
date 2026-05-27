// INF-3739 — top slicer strip (always-on, pinned dims).
// INF-3745 Phase A — refactored to dispatch per-cluster via resolveWidget.
//
// Mounts in a DEDICATED container at the very top of the visual (top:0).
// Density-aware: pill padding / font-size / row spacing scale per the
// pinnedDensity formatting setting. Multi-dim packing via flex-wrap.
//
// Per-cluster widget choice routes through resolveWidget(slot, binding):
//   "auto" defers to cardinality + column-type rules; user-set values
//   pass through (with text-column range-slider falling back to pills).
// A WeakMap from cluster element → WidgetHandle holds the live renderer
// so subsequent renders can destroy() + remount only when the widget
// kind changes, and update() in-place otherwise.

import {
    FilterDimBinding, FilterSlotSettings, FilterState, PinnedDensity,
    dimLabel, resolveWidget, ConcreteWidget,
} from "./state";
import { DENSITY } from "./widgets/widgetCommon";
import type { WidgetHandle, WidgetRenderer } from "./widgets/widget";
import { pillsMultiRenderer } from "./widgets/pillsMulti";
import { pillsSingleRenderer } from "./widgets/pillsSingle";
import { dropdownMultiRenderer } from "./widgets/dropdownMulti";

// INF-3745 — re-export PinnedDensity so existing callers (controller.ts,
// visual.ts) keep working after the cycle break that moved the canonical
// definition into state.ts.
export type { PinnedDensity };

/** Default row height — kept as a fallback sentinel only. */
export const TOP_SLICER_ROW_HEIGHT_PX = 30;

const STRIP_BG = "#ffffff";
const STRIP_BORDER = "#c0c0c0";
const LABEL_FG = "#222";

/** INF-3745 Phase A — dispatch table. search-chips and range-slider are
 *  stubbed to their closest analog until Phase B/C land. */
function rendererFor(kind: ConcreteWidget): WidgetRenderer {
    switch (kind) {
        case "pills-multi":    return pillsMultiRenderer;
        case "pills-single":   return pillsSingleRenderer;
        case "dropdown-multi": return dropdownMultiRenderer;
        case "search-chips":   return dropdownMultiRenderer;  // Phase B will swap in real renderer
        case "range-slider":   return pillsMultiRenderer;     // Phase C will swap in real renderer
    }
}

export interface TopSlicerStripHandle {
    render(
        bindings: ReadonlyArray<FilterDimBinding>,
        slots: ReadonlyArray<FilterSlotSettings>,
        density: PinnedDensity,
    ): void;
    element: HTMLElement;
}

interface MountedCluster {
    element: HTMLElement;
    handle: WidgetHandle;
    kind: ConcreteWidget;
    slotIndex: number;
}

export function mountTopSlicerStrip(
    container: HTMLElement,
    state: FilterState,
): TopSlicerStripHandle {
    const strip = document.createElement("div");
    strip.className = "filter-top-slicer-strip";
    strip.style.cssText = [
        "display:flex",
        "flex-direction:row",
        "flex-wrap:wrap",
        "background:" + STRIP_BG,
        "border-bottom:1px solid " + STRIP_BORDER,
        "box-sizing:border-box",
        "width:100%",
        "font-family:'Segoe UI',system-ui,sans-serif",
    ].join(";");
    container.appendChild(strip);

    let mounted: MountedCluster[] = [];

    state.subscribe(() => {
        // Cheap in-place re-render on state change — no remount.
        for (const m of mounted) m.handle.update();
    });

    function teardown(): void {
        for (const m of mounted) m.handle.destroy();
        mounted = [];
        while (strip.firstChild) strip.removeChild(strip.firstChild);
    }

    function repaint(
        bindings: ReadonlyArray<FilterDimBinding>,
        slots: ReadonlyArray<FilterSlotSettings>,
        density: PinnedDensity,
    ): void {
        teardown();
        if (bindings.length === 0) {
            strip.style.display = "none";
            return;
        }
        const d = DENSITY[density];
        strip.style.display = "flex";
        strip.style.gap = `${d.interPillGapPx}px ${d.interClusterGapPx}px`;
        strip.style.padding = `${d.stripPaddingV}px ${d.stripPaddingH}px`;
        strip.style.minHeight = d.rowMinHeightPx + "px";
        strip.style.alignItems = "center";
        for (const b of bindings) {
            const slot = slots[b.slotIndex];
            if (slot === undefined) continue;
            const resolved = resolveWidget(slot, b);
            const cluster = buildClusterShell(b, slot, density);
            strip.appendChild(cluster.root);
            const handle = rendererFor(resolved.kind).mount(cluster.body, {
                binding: b, slot, state, density,
            });
            mounted.push({
                element: cluster.root,
                handle,
                kind: resolved.kind,
                slotIndex: b.slotIndex,
            });
        }
    }

    return {
        render(bindings, slots, density): void {
            repaint(bindings, slots, density);
        },
        element: strip,
    };
}

/** Build the dim cluster's label + body shell. The body is where the
 *  WidgetRenderer mounts its element. Kept tiny so the renderer is the
 *  source of truth for value-row rendering. */
function buildClusterShell(
    binding: FilterDimBinding,
    slot: FilterSlotSettings,
    density: PinnedDensity,
): { root: HTMLElement; body: HTMLElement } {
    const d = DENSITY[density];
    const cluster = document.createElement("div");
    cluster.style.cssText = [
        "display:inline-flex",
        "flex-direction:row",
        "align-items:center",
        `gap:${d.interPillGapPx + 2}px`,
        "flex-shrink:0",
    ].join(";");

    const label = document.createElement("span");
    label.textContent = dimLabel(binding, slot) + ":";
    label.style.cssText = [
        "color:" + LABEL_FG,
        "font-weight:600",
        "font-size:" + d.labelFontSizePx + "px",
        "white-space:nowrap",
    ].join(";");
    cluster.appendChild(label);

    const body = document.createElement("div");
    body.style.cssText = "display:inline-flex;align-items:center;";
    cluster.appendChild(body);

    return { root: cluster, body };
}
