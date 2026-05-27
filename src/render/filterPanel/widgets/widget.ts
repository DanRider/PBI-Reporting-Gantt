// INF-3745 Phase A — pluggable widget renderer contract.
//
// Every concrete widget (pillsMulti / pillsSingle / dropdownMulti / future
// searchChips / rangeSlider) implements WidgetRenderer and produces a
// WidgetHandle. The top slicer strip + comprehensive sidebar dispatch a
// chosen renderer at the cluster level; the handle owns mount/update/
// destroy and exposes its root element.
//
// Pure DOM. No PBI-host deps. No FilterState mutation beyond
// state.toggle / clear / selectOne / set. Widget renderers must NOT
// subscribe to FilterState themselves — the controller subscribes once
// and re-renders by calling update() on every live handle. Widget code
// stays render-only; the cross-tier sync semantics from INF-3739 hold.

import type { FilterDimBinding, FilterSlotSettings, FilterState, PinnedDensity } from "../state";

export interface WidgetOptions {
    binding: FilterDimBinding;
    slot: FilterSlotSettings;
    state: FilterState;
    /** Density forwarded from the strip; widgets that don't care should ignore. */
    density: PinnedDensity;
}

export interface WidgetHandle {
    /** Re-render against current FilterState. Cheap; called from the
     *  controller's subscriber + after persisted-state restoration. */
    update(): void;
    /** Drop popovers, listeners, observers. Required when the user
     *  changes widget choice for a slot — the WeakMap-stored handle is
     *  destroyed before the new renderer mounts. */
    destroy(): void;
    /** The root element this widget owns. Caller appends it. */
    element: HTMLElement;
}

export interface WidgetRenderer {
    /** Mount the widget into `host` and return a WidgetHandle. The
     *  mounted DOM is `host`'s child; the returned handle.element is
     *  the renderer's own root (may equal host or be a child). */
    mount(host: HTMLElement, opts: WidgetOptions): WidgetHandle;
}
