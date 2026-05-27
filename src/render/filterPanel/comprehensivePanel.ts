// INF-3739 — Comprehensive-tier sidebar render.
//
// Renders every bound filter dim (except those tier-marked "hidden") as a
// vertical stack inside the sidebar. Each dim block has: header (dim label +
// active count badge + pin button), search box, scrollable value widget.
// Widget shape auto-switches by cardinality: ≤ HIGH_CARDINALITY_THRESHOLD
// distinct values → inline checkbox list; > threshold → searchable dropdown.
// Footer has a global "Clear all" button. Subscribes to the same FilterState
// as the top slicer strip; cross-tier sync is implicit.
//
// Pin button on each dim: click toggles that slot's pinned state via the
// controller. Pinned dims also render as always-on pill rows above the chart.

import {
    FilterDimBinding, FilterSlotSettings, FilterState,
    HIGH_CARDINALITY_THRESHOLD, dimLabel,
} from "./state";
import { buildDropdownWidget, buildSearchInput, buildCheckRow } from "./widgets/searchChips";

const SIDEBAR_BG = "#ffffff";
const SIDEBAR_BORDER = "#c0c0c0";
const BADGE_BG = "#1F77B4";
const BADGE_FG = "#ffffff";
const FOOTER_BG = "#f6f6f8";
const MAX_LIST_HEIGHT_PX = 180;
const PIN_ACTIVE_FG = "#1F77B4";
const PIN_INACTIVE_FG = "#999";

export interface ComprehensivePanelOptions {
    /** Called when the user clicks the pin icon on a dim header. */
    onTogglePin: (slotIndex: number) => void;
    /** True if the slot is currently pinned (drives the icon's filled/outlined state). */
    isPinned: (slotIndex: number) => boolean;
}

export interface ComprehensivePanelHandle {
    render(
        bindings: ReadonlyArray<FilterDimBinding>,
        slots: ReadonlyArray<FilterSlotSettings>,
    ): void;
    element: HTMLElement;
}

export function mountComprehensivePanel(
    container: HTMLElement,
    state: FilterState,
    options: ComprehensivePanelOptions,
): ComprehensivePanelHandle {
    const root = document.createElement("div");
    root.className = "filter-comprehensive-panel";
    root.style.cssText = [
        "display:flex",
        "flex-direction:column",
        "height:100%",
        "width:100%",
        `background:${SIDEBAR_BG}`,
        "box-sizing:border-box",
        "font-family:'Segoe UI', system-ui, sans-serif",
        "font-size:12px",
    ].join(";");
    container.appendChild(root);

    // NOTE: header (title + × close button) is provided by the controller's
    // buildSidebarComposition wrapper at the MountablePanel content slot.

    const body = document.createElement("div");
    body.style.cssText = [
        "flex:1",
        "overflow-y:auto",
        "padding:8px",
        "box-sizing:border-box",
    ].join(";");
    root.appendChild(body);

    const footer = document.createElement("div");
    footer.style.cssText = [
        "padding:8px 12px",
        `background:${FOOTER_BG}`,
        `border-top:1px solid ${SIDEBAR_BORDER}`,
        "display:flex",
        "justify-content:space-between",
        "align-items:center",
        "flex-shrink:0",
    ].join(";");
    const activeLabel = document.createElement("span");
    activeLabel.style.cssText = "color:#666;font-size:11px;";
    footer.appendChild(activeLabel);
    const clearAllBtn = document.createElement("button");
    clearAllBtn.type = "button";
    clearAllBtn.textContent = "Clear all";
    clearAllBtn.style.cssText = [
        "background:transparent",
        "border:1px solid #c0c0c0",
        "border-radius:3px",
        "padding:3px 10px",
        "cursor:pointer",
        "font-size:11px",
        "color:#444",
    ].join(";");
    clearAllBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.clear();
    });
    footer.appendChild(clearAllBtn);
    root.appendChild(footer);

    let lastBindings: ReadonlyArray<FilterDimBinding> = [];
    let lastSlots: ReadonlyArray<FilterSlotSettings> = [];
    const searchQueries: Map<string, string> = new Map();
    const dropdownOpen: Map<string, boolean> = new Map();

    state.subscribe(() => repaint());

    function repaint(): void {
        while (body.firstChild) body.removeChild(body.firstChild);
        if (lastBindings.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "Bind columns to 'Filter Dimensions' in the Build pane to enable filters.";
            empty.style.cssText = "color:#888;font-style:italic;padding:12px;font-size:11px;line-height:1.4;";
            body.appendChild(empty);
        } else {
            for (const b of lastBindings) {
                const slot = lastSlots[b.slotIndex];
                if (slot === undefined) continue;
                body.appendChild(buildDimBlock(b, slot, state, searchQueries, dropdownOpen, options));
            }
        }
        const count = state.activeCount();
        activeLabel.textContent = count === 0 ? "No active filters" :
            count === 1 ? "1 active filter" : `${count} active filters`;
    }

    return {
        render(bindings, slots): void {
            lastBindings = bindings;
            lastSlots = slots;
            repaint();
        },
        element: root,
    };
}

function buildDimBlock(
    binding: FilterDimBinding,
    slot: FilterSlotSettings,
    state: FilterState,
    searchQueries: Map<string, string>,
    dropdownOpen: Map<string, boolean>,
    options: ComprehensivePanelOptions,
): HTMLDivElement {
    const block = document.createElement("div");
    block.style.cssText = "margin-bottom:14px;";

    const hdr = document.createElement("div");
    hdr.style.cssText = [
        "display:flex",
        "align-items:center",
        "gap:6px",
        "padding:4px 0",
        "border-bottom:1px solid #e0e0e0",
        "margin-bottom:4px",
    ].join(";");

    const pinBtn = buildPinButton(options.isPinned(binding.slotIndex), () => {
        options.onTogglePin(binding.slotIndex);
    });
    hdr.appendChild(pinBtn);

    const hdrLabel = document.createElement("span");
    hdrLabel.textContent = dimLabel(binding, slot);
    hdrLabel.style.cssText = "font-weight:600;color:#222;flex:1;";
    hdr.appendChild(hdrLabel);

    const selected = state.get(binding.dimName);
    if (selected.size > 0) {
        const badge = document.createElement("span");
        badge.textContent = String(selected.size);
        badge.style.cssText = [
            `background:${BADGE_BG}`,
            `color:${BADGE_FG}`,
            "border-radius:999px",
            "padding:1px 8px",
            "font-size:10px",
            "font-weight:600",
            "min-width:18px",
            "text-align:center",
        ].join(";");
        hdr.appendChild(badge);
    }
    block.appendChild(hdr);

    const isHighCardinality = binding.distinctValues.length > HIGH_CARDINALITY_THRESHOLD;
    if (isHighCardinality) {
        block.appendChild(buildDropdownWidget(binding, state, searchQueries, dropdownOpen));
    } else {
        block.appendChild(buildCheckboxWidget(binding, state, searchQueries));
    }

    return block;
}

function buildPinButton(active: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = active ? "Unpin from top slicer strip" : "Pin as top slicer strip";
    btn.style.cssText = [
        "background:transparent",
        "border:none",
        "cursor:pointer",
        "padding:2px 4px",
        "line-height:0",
        "border-radius:3px",
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "transition:background 100ms ease",
    ].join(";");
    // Clean inline SVG push-pin — outlined when inactive, filled when active.
    // Crisp 16px viewBox; no platform-emoji rendering inconsistency.
    const SVG_NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.style.pointerEvents = "none";
    const path = document.createElementNS(SVG_NS, "path");
    // Push-pin shape: cap at top, body tapering, stem at bottom.
    path.setAttribute("d", "M6 1 L10 1 L11 4 L11 7 L13 9 L13 10 L9 10 L9 14 L8 15 L7 14 L7 10 L3 10 L3 9 L5 7 L5 4 Z");
    if (active) {
        path.setAttribute("fill", PIN_ACTIVE_FG);
        path.setAttribute("stroke", PIN_ACTIVE_FG);
    } else {
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", PIN_INACTIVE_FG);
        path.setAttribute("stroke-width", "1.2");
        path.setAttribute("stroke-linejoin", "round");
    }
    svg.appendChild(path);
    btn.appendChild(svg);
    btn.addEventListener("mouseenter", () => { btn.style.background = "#f0f0f3"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; });
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

function buildCheckboxWidget(
    binding: FilterDimBinding,
    state: FilterState,
    searchQueries: Map<string, string>,
): HTMLDivElement {
    const wrap = document.createElement("div");
    const search = buildSearchInput(binding.dimName, searchQueries, () => renderList());
    wrap.appendChild(search);

    const list = document.createElement("div");
    list.style.cssText = [
        `max-height:${MAX_LIST_HEIGHT_PX}px`,
        "overflow-y:auto",
        "border:1px solid #e0e0e0",
        "border-radius:3px",
    ].join(";");
    wrap.appendChild(list);

    function renderList(): void {
        const q = (searchQueries.get(binding.dimName) ?? "").toLowerCase();
        while (list.firstChild) list.removeChild(list.firstChild);
        const matches = binding.distinctValues.filter(v => v.toLowerCase().includes(q));
        if (matches.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No matches";
            empty.style.cssText = "padding:6px 8px;color:#888;font-style:italic;font-size:11px;";
            list.appendChild(empty);
            return;
        }
        for (const v of matches) {
            list.appendChild(buildCheckRow(binding, v, state.get(binding.dimName).has(v), state));
        }
    }
    renderList();
    return wrap;
}

// buildDropdownWidget + buildChip + buildSearchInput + buildCheckRow
// extracted to widgets/searchChips.ts (file-size cap; pre-stages INF-3744 Phase B).
