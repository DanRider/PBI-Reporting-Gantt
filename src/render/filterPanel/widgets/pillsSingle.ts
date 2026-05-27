// INF-3745 Phase A — pills-single widget renderer.
//
// Mutually exclusive segmented control. Click on inactive value sets it
// as the sole selection (replaces any prior selection). Click on an
// already-active value clears the dim. No "All" pill — same effect is
// achieved by clicking the active pill again.
//
// Multi-attempts-still-single: even if state was somehow seeded with >1
// value (e.g. round-tripped from a previous pills-multi widget choice),
// clicking any pill collapses to that single value via selectOne.

import type { WidgetHandle, WidgetRenderer, WidgetOptions } from "./widget";
import { DENSITY, buildPill } from "./widgetCommon";

export const pillsSingleRenderer: WidgetRenderer = {
    mount(host: HTMLElement, opts: WidgetOptions): WidgetHandle {
        const { binding, state, density } = opts;
        const d = DENSITY[density];

        const pillsWrap = document.createElement("div");
        pillsWrap.className = "filter-widget-pills-single";
        pillsWrap.style.cssText = [
            "display:flex",
            "flex-direction:row",
            "flex-wrap:wrap",
            `gap:${d.interPillGapPx}px`,
        ].join(";");
        host.appendChild(pillsWrap);

        function render(): void {
            while (pillsWrap.firstChild) pillsWrap.removeChild(pillsWrap.firstChild);
            const selected = state.get(binding.dimName);
            for (const v of binding.distinctValues) {
                const active = selected.has(v);
                pillsWrap.appendChild(buildPill({
                    label: v,
                    active,
                    onClick: () => {
                        if (active) {
                            // Click an active pill → clear the dim.
                            state.clear(binding.dimName);
                        } else {
                            // Single-select: replace whole selection.
                            state.selectOne(binding.dimName, v);
                        }
                    },
                    density: d,
                }));
            }
        }
        render();

        return {
            update: render,
            destroy(): void {
                if (pillsWrap.parentNode) pillsWrap.parentNode.removeChild(pillsWrap);
            },
            element: pillsWrap,
        };
    },
};
