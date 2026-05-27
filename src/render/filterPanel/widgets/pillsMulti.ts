// INF-3745 Phase A — pills-multi widget renderer.
//
// Extracted from topSlicerStrip.ts buildDimCluster pill-row logic. Same
// multi-toggle semantics:
//   - "All" pill clears the dim's selection (active when empty).
//   - Each value pill toggles in/out of the selection independently.
//   - Pills wrap inline via flex.

import type { WidgetHandle, WidgetRenderer, WidgetOptions } from "./widget";
import { DENSITY, buildPill } from "./widgetCommon";

export const pillsMultiRenderer: WidgetRenderer = {
    mount(host: HTMLElement, opts: WidgetOptions): WidgetHandle {
        const { binding, state, density } = opts;
        const d = DENSITY[density];

        const pillsWrap = document.createElement("div");
        pillsWrap.className = "filter-widget-pills-multi";
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
            const allActive = selected.size === 0;
            pillsWrap.appendChild(buildPill({
                label: "All",
                active: allActive,
                onClick: () => state.clear(binding.dimName),
                density: d,
            }));
            for (const v of binding.distinctValues) {
                pillsWrap.appendChild(buildPill({
                    label: v,
                    active: selected.has(v),
                    onClick: () => state.toggle(binding.dimName, v),
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
