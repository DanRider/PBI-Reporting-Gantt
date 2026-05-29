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
import { CHROME_LABEL_CSS } from "../chromeLabelStyle";

// INF-3745 — re-export PinnedDensity so existing callers (controller.ts,
// visual.ts) keep working after the cycle break that moved the canonical
// definition into state.ts.
export type { PinnedDensity };

/** Default row height — kept as a fallback sentinel only. */
export const TOP_SLICER_ROW_HEIGHT_PX = 30;

// INF-3751 animation timing — locked. Single source of truth for the
// per-widget wipe choreography. Exported so vitest can assert against
// these values when testing each behavior-map cell.
export const WIPE_MS_EXPORT = 1000;
export const WIPE_DELAY_FIRST_PIN_MS_EXPORT = 800;
export const WIPE_DELAY_DEFAULT_MS_EXPORT = 50;
export const WIPE_CLEANUP_BUFFER_MS_EXPORT = 50;
export const WIPE_EASING_EXPORT = "cubic-bezier(0.45, 0, 0.25, 1)";

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
    // INF-3751: pending reveal setTimeout. Stored so we can clearTimeout
    // when the widget is removed mid-reveal (rapid pin → unpin clicks).
    // Without cancellation, the deferred reveal would fire AFTER the
    // widget has been marked for destruction, briefly showing the
    // widget before it disappears.
    revealTimerId: number | null;
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
        // border-bottom removed — the corner count-badges hang below the
        // pill row and the original 1px divider drew right through them.
        // Whitespace separation from the slicerContainer's padding-bottom
        // gives sufficient visual division from the chrome below.
        "box-sizing:border-box",
        "width:100%",
        "font-family:'Segoe UI',system-ui,sans-serif",
        // INF-3751: per-widget wipes. Strip itself does NOT clip — each
        // cluster's clip-path handles its own wipe. overflow:visible so
        // the pill count badges (negative-positioned below pills) aren't
        // clipped by the strip's box; slicerContainer's padding-bottom:12
        // gives them room below.
        "overflow:visible",
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

    // INF-3751 timing constants. Locked per the behavior-map sketch.
    // Exported (below) so vitest can assert against them in cell tests.
    const WIPE_MS = WIPE_MS_EXPORT;
    const WIPE_DELAY_FIRST_PIN_MS = WIPE_DELAY_FIRST_PIN_MS_EXPORT;
    const WIPE_DELAY_DEFAULT_MS = WIPE_DELAY_DEFAULT_MS_EXPORT;
    const WIPE_CLEANUP_BUFFER_MS = WIPE_CLEANUP_BUFFER_MS_EXPORT;
    const WIPE_EASING = WIPE_EASING_EXPORT;

    function repaint(
        bindings: ReadonlyArray<FilterDimBinding>,
        slots: ReadonlyArray<FilterSlotSettings>,
        density: PinnedDensity,
    ): void {
        // INF-3751: per-widget wipe animations. Diff mounted vs new bindings.
        // Each individual widget cluster animates its OWN clip-path — strip
        // itself does not wipe. This handles all transitions uniformly:
        // first pin, intermediate add, intermediate remove, last unpin.
        const newSlotIndices = new Set(bindings.map(b => b.slotIndex));
        const toAnimateOut = mounted.filter(m => !newSlotIndices.has(m.slotIndex));
        const kept = mounted.filter(m => newSlotIndices.has(m.slotIndex));

        // Wipe-out animations for removed widgets. Cancel any pending
        // reveal timer first (rapid pin→unpin would otherwise show the
        // widget briefly mid-destruction). Then set clip-path:inset(100%)
        // — the transition fires — and schedule destroy + DOM removal.
        for (const m of toAnimateOut) {
            const el = m.element;
            const handle = m.handle;
            if (m.revealTimerId !== null) {
                window.clearTimeout(m.revealTimerId);
                m.revealTimerId = null;
            }
            // -10px bottom inset keeps the badge area in the clip rect
            // (matches the reveal state below).
            el.style.clipPath = "inset(0 100% -10px 0)";
            window.setTimeout(() => {
                handle.destroy();
                if (el.parentNode) el.parentNode.removeChild(el);
            }, WIPE_MS + WIPE_CLEANUP_BUFFER_MS);
        }

        mounted = kept;

        if (bindings.length === 0) {
            // Last widget being wiped out. Defer strip's vertical collapse
            // (min-height → 0) until after the wipe animation completes.
            window.setTimeout(() => {
                strip.style.minHeight = "0";
            }, WIPE_MS + WIPE_CLEANUP_BUFFER_MS);
            return;
        }

        // Non-empty path: setup strip layout styles and add NEW widgets.
        const d = DENSITY[density];
        strip.style.gap = `${d.interPillGapPx}px ${d.interClusterGapPx}px`;
        // Padding-left forced to 0 so first widget's left edge sits at
        // strip's left:36 (= funnel-clearance offset). Density's
        // stripPaddingH is preserved on the RIGHT only.
        strip.style.padding = `${d.stripPaddingV}px ${d.stripPaddingH}px ${d.stripPaddingV}px 0`;
        // Strip must be at least 34px tall so flex's align-items:center
        // places content at absolute y=17 — shares centerline with the
        // anchored funnel (top:6, height:22, center y=17).
        strip.style.minHeight = Math.max(d.rowMinHeightPx, 34) + "px";
        strip.style.alignItems = "center";

        // Determine reveal delay: only the FIRST pin (0→1 boundary) waits
        // 1050ms for the toggle row to drop first. visual.ts adds .opening
        // to documentElement for exactly this case.
        const isFirstPin = document.documentElement.classList.contains("opening");
        const revealDelay = isFirstPin ? WIPE_DELAY_FIRST_PIN_MS : WIPE_DELAY_DEFAULT_MS;

        // Add NEW widgets that aren't already mounted. Each is built in a
        // CLIPPED state (invisible) then revealed after the appropriate
        // delay — the clip-path transition fires when style.clipPath
        // changes from "inset(0 100% 0 0)" to "inset(0 0 0 0)".
        const existingSlotIndices = new Set(mounted.map(m => m.slotIndex));
        for (const b of bindings) {
            if (existingSlotIndices.has(b.slotIndex)) continue;
            const slot = slots[b.slotIndex];
            if (slot === undefined) continue;
            const resolved = resolveWidget(slot, b);
            const cluster = buildClusterShell(b, slot, density);
            const root = cluster.root;
            // Per-widget wipe via clip-path with NEGATIVE bottom inset so
            // the pill count badge (position:absolute, -bottom from pill)
            // stays within the clip rectangle. No overflow:hidden — that
            // would clip the badge along with the box. clip-path handles
            // the wipe AND lets the badge spill below the cluster's box.
            root.style.transition = `clip-path ${WIPE_MS}ms ${WIPE_EASING}`;
            root.style.clipPath = "inset(0 100% -10px 0)";
            strip.appendChild(root);
            const handle = rendererFor(resolved.kind).mount(cluster.body, {
                binding: b, slot, state, density,
            });
            const m: MountedCluster = {
                element: root,
                handle,
                kind: resolved.kind,
                slotIndex: b.slotIndex,
                revealTimerId: null,
            };
            mounted.push(m);
            // Schedule reveal — animates clip-path to fully visible after
            // the appropriate delay. Capture the timer ID so a subsequent
            // rapid-unpin can cancel it.
            m.revealTimerId = window.setTimeout(() => {
                m.revealTimerId = null;
                root.style.clipPath = "inset(0 -10px -10px 0)";
            }, revealDelay);
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
    // CHROME_LABEL_CSS is the single point of truth for color / weight /
    // size / family — shared with the toggle row labels in
    // topRightControls.ts so both surfaces stay visually identical.
    label.style.cssText = CHROME_LABEL_CSS + ";white-space:nowrap";
    cluster.appendChild(label);

    const body = document.createElement("div");
    body.style.cssText = "display:inline-flex;align-items:center;";
    cluster.appendChild(body);

    return { root: cluster, body };
}
