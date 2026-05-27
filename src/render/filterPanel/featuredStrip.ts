// INF-3739 Phase 3b — Featured-tier tab-strip render.
//
// Renders dims marked Featured (or Both) as horizontal pill groups inside
// the MountablePanel content slot. Per the operator's real-report aesthetic
// — Segment + Investment Category as native PBI slicer pill strips — each
// dim row has a label on the left and N tab pills on the right. Click a
// pill = toggle that value in the FilterState; cross-tier sync repaints
// both surfaces because FeaturedStrip and ComprehensivePanel subscribe to
// the same FilterState.
//
// Pure DOM, strict-TS clean.

import { FilterDimBinding, FilterSlotSettings, FilterState, dimLabel } from "./state";

const PILL_BG_INACTIVE = "#ffffff";
const PILL_BG_ACTIVE = "#1F77B4";
const PILL_FG_INACTIVE = "#333333";
const PILL_FG_ACTIVE = "#ffffff";
const PILL_BORDER = "#c0c0c0";
const ROW_LABEL_FG = "#444444";
const STRIP_BG = "#f6f6f8";
const STRIP_BORDER = "#c0c0c0";
const MAX_VISIBLE_PILLS_PER_DIM = 12;

export interface FeaturedStripHandle {
    render(
        bindings: ReadonlyArray<FilterDimBinding>,
        slots: ReadonlyArray<FilterSlotSettings>,
    ): void;
    element: HTMLElement;
}

export function mountFeaturedStrip(
    container: HTMLElement,
    state: FilterState,
): FeaturedStripHandle {
    const strip = document.createElement("div");
    strip.className = "filter-featured-strip";
    strip.style.cssText = [
        "display:flex",
        "flex-direction:column",
        "gap:4px",
        "padding:6px 12px",
        `background:${STRIP_BG}`,
        `border-bottom:1px solid ${STRIP_BORDER}`,
        "box-sizing:border-box",
        "width:100%",
        "font-family:'Segoe UI', system-ui, sans-serif",
        "font-size:12px",
    ].join(";");
    container.appendChild(strip);

    // Repaint on every state mutation — featured AND comprehensive both fire
    // through this listener; subscribe once at mount.
    let lastBindings: ReadonlyArray<FilterDimBinding> = [];
    let lastSlots: ReadonlyArray<FilterSlotSettings> = [];
    state.subscribe(() => repaint(lastBindings, lastSlots));

    function repaint(
        bindings: ReadonlyArray<FilterDimBinding>,
        slots: ReadonlyArray<FilterSlotSettings>,
    ): void {
        while (strip.firstChild) strip.removeChild(strip.firstChild);
        if (bindings.length === 0) return;
        for (const b of bindings) {
            const slot = slots[b.slotIndex];
            if (slot === undefined) continue;
            strip.appendChild(buildDimRow(b, slot, state));
        }
    }

    return {
        render(bindings, slots): void {
            lastBindings = bindings;
            lastSlots = slots;
            repaint(bindings, slots);
        },
        element: strip,
    };
}

function buildDimRow(
    binding: FilterDimBinding,
    slot: FilterSlotSettings,
    state: FilterState,
): HTMLDivElement {
    const row = document.createElement("div");
    row.style.cssText = [
        "display:flex",
        "flex-direction:row",
        "align-items:center",
        "gap:8px",
        "flex-wrap:wrap",
    ].join(";");

    const label = document.createElement("span");
    label.textContent = `${dimLabel(binding, slot)}:`;
    label.style.cssText = [
        `color:${ROW_LABEL_FG}`,
        "font-weight:600",
        "white-space:nowrap",
        "min-width:80px",
    ].join(";");
    row.appendChild(label);

    // "All" pill — clears the dim's selection (= no filter active).
    const selected = state.get(binding.dimName);
    const allActive = selected.size === 0;
    row.appendChild(buildPill("All", allActive, () => state.clear(binding.dimName)));

    const visible = binding.distinctValues.slice(0, MAX_VISIBLE_PILLS_PER_DIM);
    for (const v of visible) {
        const active = selected.has(v);
        row.appendChild(buildPill(v, active, () => {
            if (slot.selectionMode === "multi") {
                state.toggle(binding.dimName, v);
            } else {
                // single + search: tap = select that value alone; tap again = clear.
                if (active) state.clear(binding.dimName);
                else state.selectOne(binding.dimName, v);
            }
        }));
    }
    if (binding.distinctValues.length > MAX_VISIBLE_PILLS_PER_DIM) {
        const more = document.createElement("span");
        more.textContent = `+${binding.distinctValues.length - MAX_VISIBLE_PILLS_PER_DIM} more`;
        more.style.cssText = "color:#666;font-style:italic;padding:0 4px;";
        row.appendChild(more);
    }
    return row;
}

function buildPill(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.textContent = label;
    pill.style.cssText = [
        "padding:3px 10px",
        "border-radius:999px",
        `border:1px solid ${PILL_BORDER}`,
        `background:${active ? PILL_BG_ACTIVE : PILL_BG_INACTIVE}`,
        `color:${active ? PILL_FG_ACTIVE : PILL_FG_INACTIVE}`,
        "cursor:pointer",
        "font-size:11px",
        "line-height:1.2",
        "white-space:nowrap",
        "user-select:none",
        active ? "font-weight:600" : "font-weight:500",
    ].join(";");
    pill.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    pill.addEventListener("mouseenter", () => {
        if (!active) pill.style.background = "#e8e8ec";
    });
    pill.addEventListener("mouseleave", () => {
        if (!active) pill.style.background = PILL_BG_INACTIVE;
    });
    return pill;
}
