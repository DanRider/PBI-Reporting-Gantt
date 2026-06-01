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
    FilterDimBinding, FilterSlotSettings, FilterState, SlotWidget,
    HIGH_CARDINALITY_THRESHOLD, dimLabel, resolveWidget, ConcreteWidget,
} from "./state";
import { buildDropdownWidget, buildSearchInput, buildCheckRow } from "./widgets/searchChips";
import { buildWidgetPickerButton } from "./widgets/widgetPicker";
import { buildClearButton } from "./widgets/widgetCommon";
import type { WidgetRenderer } from "./widgets/widget";
import { pillsMultiRenderer } from "./widgets/pillsMulti";
import { pillsSingleRenderer } from "./widgets/pillsSingle";
import { dropdownMultiRenderer } from "./widgets/dropdownMulti";
import { DragReorderController, mountDragController } from "./dragReorder";

/** Map a resolved slicer-widget kind to its concrete renderer for use in
 *  the sidebar's expanded dim block when "Apply to filter pane" is on.
 *  search-chips + range-slider are stubbed to dropdownMulti / pillsMulti
 *  the same way the slicer dispatches today. */
function sidebarRendererFor(kind: ConcreteWidget): WidgetRenderer {
    switch (kind) {
        case "pills-multi":    return pillsMultiRenderer;
        case "pills-single":   return pillsSingleRenderer;
        case "dropdown-multi": return dropdownMultiRenderer;
        case "search-chips":   return dropdownMultiRenderer;
        case "range-slider":   return pillsMultiRenderer;
    }
}

const SIDEBAR_BG = "#ffffff";
const SIDEBAR_BORDER = "#c0c0c0";
// Selection-count badge (in each dim header) — green to distinguish it
// from the blue faceted-count badges on individual values. Green reads
// as "result of your action" / "active state"; blue stays for the
// read-only cross-filter metadata.
const BADGE_BG = "#2ca02c";
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
    /** INF-3745 Phase A — called when the user picks a widget in the gear flyout. */
    onWidgetChange: (slotIndex: number, widget: SlotWidget) => void;
    /** INF-3745 Phase A — current widget choice for the slot (drives the
     *  flyout's check-marker and the gear's filled/outlined state). */
    currentWidget: (slotIndex: number) => SlotWidget;
    /** True when the slicer's widget should also drive the sidebar's
     *  expanded value rendering for this dim (Apply to filter pane). */
    isApplyToFilterPane: (slotIndex: number) => boolean;
    /** Called when the user toggles the "Apply to filter pane" checkbox
     *  in the gear flyout. */
    onToggleApplyToFilterPane: (slotIndex: number) => void;
    /** INF-3758 — called when the user drops a dim block at a new position.
     *  Receives the full 8-element sortOrders array (slot index → sortOrder).
     *  Slots not in the visible-dragged set get sortOrder + 1000 as a
     *  high-number placeholder so they sort AFTER visible ones. */
    onReorder?: (newSortOrders: ReadonlyArray<number>) => void;
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
    // Per-dim collapsed state. Persists across re-renders (lives in
    // mount-closure). Default expanded; user clicks the chevron to fold
    // a dim to just its header row — important when many dims are bound.
    const collapsed: Map<string, boolean> = new Map();

    // INF-3758 — drag-reorder controller. Lives outside comprehensivePanel
    // to keep this file under the 400-LOC cap.
    const dragController = mountDragController(body, {
        getVisibleSlotIndices: () => lastBindings.map(b => b.slotIndex),
        onReorder: (newSortOrders) => options.onReorder?.(newSortOrders),
    });

    state.subscribe(() => repaint());

    function repaint(): void {
        // INF-3776 — focus preservation snapshot. Without this, every
        // FilterState mutation tears down the search input DOM below and
        // the recreated input has no focus — next keystroke goes to body.
        // Scope to body.contains() so we never steal focus from the Format
        // pane, another visual on the page, or anything else outside the
        // sidebar.
        const active = document.activeElement;
        const wasInsideSidebarSearch =
            active instanceof HTMLInputElement &&
            active.dataset.searchRole === "in-dim" &&
            body.contains(active);
        const focusDimName = wasInsideSidebarSearch ? (active.dataset.dimName ?? null) : null;
        const focusSelStart = wasInsideSidebarSearch ? (active.selectionStart ?? 0) : 0;

        // Preserve the drop indicator across repaints — it's the only child
        // we don't tear down.
        const children = Array.from(body.children);
        for (const c of children) {
            if ((c as HTMLElement).style.display === "none" && (c as HTMLElement).style.position === "absolute") continue; // drop indicator
            body.removeChild(c);
        }
        if (lastBindings.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "Bind columns to 'Filter Dimensions' in the Build pane to enable filters.";
            empty.style.cssText = "color:#888;font-style:italic;padding:12px;font-size:11px;line-height:1.4;";
            body.appendChild(empty);
        } else {
            for (const b of lastBindings) {
                const slot = lastSlots[b.slotIndex];
                if (slot === undefined) continue;
                body.appendChild(buildDimBlock(
                    b, slot, state, searchQueries, dropdownOpen, collapsed,
                    repaint, options, dragController,
                ));
            }
        }
        const count = state.activeCount();
        activeLabel.textContent = count === 0 ? "No active filters" :
            count === 1 ? "1 active filter" : `${count} active filters`;

        // INF-3776 — restore focus on the rebuilt input. Iterate candidates
        // matching the static role attribute (selector-safe) and compare
        // dataset.dimName by JS string equality — avoids CSS.escape gymnastics
        // for dimNames that can contain quotes, brackets, or other CSS
        // selector metacharacters (column displayNames are user-controlled).
        if (focusDimName !== null) {
            const candidates = body.querySelectorAll(
                'input[data-search-role="in-dim"]',
            );
            for (let i = 0; i < candidates.length; i++) {
                const c = candidates.item(i);
                if (c instanceof HTMLInputElement && c.dataset.dimName === focusDimName) {
                    c.focus();
                    try {
                        c.setSelectionRange(focusSelStart, focusSelStart);
                    } catch {
                        // setSelectionRange not supported on this input type — silent ok
                    }
                    break;
                }
            }
        }
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
    collapsed: Map<string, boolean>,
    repaint: () => void,
    options: ComprehensivePanelOptions,
    dragController: DragReorderController,
): HTMLDivElement {
    // Default collapsed — dims with many bound rows would otherwise blow
    // out the sidebar height. User clicks the chevron to expand. Once
    // toggled, the state persists in the closure Map across re-renders.
    const isCollapsed = collapsed.get(binding.dimName) !== false;
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

    // Chevron — toggles the dim block's collapsed state. Folded blocks
    // show only this header row (one control line) so a sidebar with
    // many bound dims doesn't run off-screen.
    const chevron = buildChevronToggle(isCollapsed, () => {
        collapsed.set(binding.dimName, !isCollapsed);
        repaint();
    });
    hdr.appendChild(chevron);

    const pinBtn = buildPinButton(options.isPinned(binding.slotIndex), () => {
        options.onTogglePin(binding.slotIndex);
    });
    hdr.appendChild(pinBtn);

    // INF-3745 Phase A — gear button next to pin opens the widget picker
    // flyout. Mirrors the pin pattern's host-persistProperties round-trip
    // via the controller's setWidget method.
    const gearBtn = buildWidgetPickerButton({
        binding,
        currentWidget: options.currentWidget(binding.slotIndex),
        onPick: (widget) => options.onWidgetChange(binding.slotIndex, widget),
        applyToFilterPane: options.isApplyToFilterPane(binding.slotIndex),
        onToggleApplyToFilterPane: () => options.onToggleApplyToFilterPane(binding.slotIndex),
    });
    hdr.appendChild(gearBtn);

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
        // Per-dim clear-✕ — visible only when this dim has an active
        // selection. Sits at the right end of the header row, beside
        // the count badge.
        hdr.appendChild(buildClearButton(() => state.clear(binding.dimName)));
    }

    // INF-3758 — grab handle on the right end of the header. Click and
    // drag to reorder dim blocks. Visual: two-column dots universal
    // drag affordance. The drag controller wires pointer events.
    const grab = document.createElement("span");
    grab.textContent = "\u22ee\u22ee"; // ⋮⋮
    grab.title = "Drag to reorder";
    grab.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "width:14px",
        "height:18px",
        "color:#999",
        "font-size:14px",
        "font-weight:700",
        "line-height:1",
        "letter-spacing:-2px",
        "cursor:grab",
        "user-select:none",
        "flex-shrink:0",
        "touch-action:none",
    ].join(";");
    grab.addEventListener("mouseenter", () => { grab.style.color = "#555"; });
    grab.addEventListener("mouseleave", () => { grab.style.color = "#999"; });
    hdr.appendChild(grab);
    dragController.attachDragHandle(grab, block, binding.slotIndex);

    block.appendChild(hdr);

    // When collapsed, the dim shows ONLY the header row. The value list
    // (search + checkboxes / dropdown) is skipped.
    if (!isCollapsed) {
        if (options.isApplyToFilterPane(binding.slotIndex)) {
            // Mirror the slicer's widget: resolve the user's pick (or
            // auto-rule) then mount the same renderer the slicer uses.
            const resolved = resolveWidget(slot, binding);
            const renderer = sidebarRendererFor(resolved.kind);
            const host = document.createElement("div");
            renderer.mount(host, { binding, slot, state, density: "compact" });
            block.appendChild(host);
        } else {
            const isHighCardinality = binding.distinctValues.length > HIGH_CARDINALITY_THRESHOLD;
            if (isHighCardinality) {
                block.appendChild(buildDropdownWidget(binding, state, searchQueries, dropdownOpen));
            } else {
                block.appendChild(buildCheckboxWidget(binding, state, searchQueries));
            }
        }
    }

    return block;
}

/** Small chevron-toggle button for dim block collapse. ▾ when the block
 *  is expanded (value list visible); ▸ when collapsed (header only). */
function buildChevronToggle(collapsed: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = collapsed ? "Expand" : "Collapse";
    btn.textContent = collapsed ? "\u25b8" : "\u25be";
    btn.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "width:18px",
        "height:18px",
        "padding:0",
        "border:none",
        "background:transparent",
        "color:#555",
        "font-size:14px",
        "line-height:1",
        "cursor:pointer",
        "user-select:none",
        "flex-shrink:0",
    ].join(";");
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
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
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.style.pointerEvents = "none";
    const path = document.createElementNS(SVG_NS, "path");
    // INF-3757: Material Icons push_pin path — universally recognizable
    // vertical pushpin (cap + body + needle). Solid-filled in both states;
    // active = blue, inactive = gray (color is the affordance, not outline).
    path.setAttribute("d", "M16,12V4h1V2H7v2h1v8l-2,2v2h5.2v6h1.6v-6H18v-2L16,12z");
    path.setAttribute("fill", active ? PIN_ACTIVE_FG : PIN_INACTIVE_FG);
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
