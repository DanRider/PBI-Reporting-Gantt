// INF-3739 Phase 3c — Comprehensive-tier sidebar render.
//
// Renders every bound filter dim (except those tier-marked "hidden") as a
// vertical stack of multi-select listboxes inside the MountablePanel content
// slot. Each dim block has: header (dim label + active count badge + clear),
// search box, scrollable value list with checkboxes. Footer has a global
// "Clear all" button. Subscribes to the same FilterState as FeaturedStrip;
// cross-tier sync is implicit (single source of truth).
//
// Pure DOM, strict-TS clean.

import { FilterDimBinding, FilterSlotSettings, FilterState, dimLabel } from "./state";

const SIDEBAR_BG = "#ffffff";
const SIDEBAR_BORDER = "#c0c0c0";
const HEADER_BG = "#e8e8ec";
const BADGE_BG = "#1F77B4";
const BADGE_FG = "#ffffff";
const ROW_HOVER_BG = "#f0f0f3";
const FOOTER_BG = "#f6f6f8";
const MAX_LIST_HEIGHT_PX = 180;

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

    const header = document.createElement("div");
    header.style.cssText = [
        "padding:8px 12px",
        `background:${HEADER_BG}`,
        `border-bottom:1px solid ${SIDEBAR_BORDER}`,
        "font-weight:600",
        "font-size:13px",
        "color:#333",
        "flex-shrink:0",
    ].join(";");
    header.textContent = "Filters";
    root.appendChild(header);

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
                body.appendChild(buildDimBlock(b, slot, state, searchQueries));
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
): HTMLDivElement {
    const block = document.createElement("div");
    block.style.cssText = "margin-bottom:14px;";

    const hdr = document.createElement("div");
    hdr.style.cssText = [
        "display:flex",
        "align-items:center",
        "justify-content:space-between",
        "padding:4px 0",
        "border-bottom:1px solid #e0e0e0",
        "margin-bottom:4px",
    ].join(";");
    const hdrLabel = document.createElement("span");
    hdrLabel.textContent = dimLabel(binding, slot);
    hdrLabel.style.cssText = "font-weight:600;color:#222;";
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

    // Per-dim search box (debounce-free; type, the listbox re-renders).
    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search…";
    search.value = searchQueries.get(binding.dimName) ?? "";
    search.style.cssText = [
        "width:100%",
        "padding:4px 6px",
        "border:1px solid #c0c0c0",
        "border-radius:3px",
        "font-size:11px",
        "box-sizing:border-box",
        "margin-bottom:4px",
    ].join(";");
    search.addEventListener("click", (e) => e.stopPropagation());
    search.addEventListener("input", () => {
        searchQueries.set(binding.dimName, search.value);
        renderList();
    });
    block.appendChild(search);

    const list = document.createElement("div");
    list.style.cssText = [
        `max-height:${MAX_LIST_HEIGHT_PX}px`,
        "overflow-y:auto",
        "border:1px solid #e0e0e0",
        "border-radius:3px",
    ].join(";");
    block.appendChild(list);

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
            list.appendChild(buildRow(binding, v, state.get(binding.dimName).has(v), state));
        }
    }
    renderList();

    return block;
}

function buildRow(
    binding: FilterDimBinding,
    value: string,
    active: boolean,
    state: FilterState,
): HTMLLabelElement {
    const row = document.createElement("label");
    row.style.cssText = [
        "display:flex",
        "align-items:center",
        "gap:6px",
        "padding:3px 6px",
        "cursor:pointer",
        "font-size:11px",
        "color:#333",
    ].join(";");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = active;
    checkbox.style.cssText = "margin:0;cursor:pointer;";
    checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        state.toggle(binding.dimName, value);
    });
    row.appendChild(checkbox);
    const span = document.createElement("span");
    span.textContent = value;
    span.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;";
    row.appendChild(span);
    row.addEventListener("mouseenter", () => { row.style.background = ROW_HOVER_BG; });
    row.addEventListener("mouseleave", () => { row.style.background = "transparent"; });
    row.addEventListener("click", (e) => e.stopPropagation());
    return row;
}
