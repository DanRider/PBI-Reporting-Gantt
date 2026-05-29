// INF-3739 — chip-bar + collapsible search dropdown widget (extracted).
//
// Lifted from comprehensivePanel.ts to keep that file under the 400-LOC
// cap. Exports the buildDropdownWidget / buildChip / buildSearchInput /
// buildCheckRow helpers used by the high-cardinality sidebar widget.
//
// INF-3744 Phase B will wrap these in the WidgetRenderer interface and
// make this file the shared search-chips renderer for both the sidebar
// AND the top slicer strip. For now it remains a sidebar-only helper
// module; the extraction preserves identical behavior.

import { FilterDimBinding, FilterState } from "../state";
import { buildCountBadge } from "./widgetCommon";

const BADGE_BG = "#1F77B4";
const BADGE_FG = "#ffffff";
const ROW_HOVER_BG = "#f0f0f3";
const MAX_LIST_HEIGHT_PX = 180;

export function buildDropdownWidget(
    binding: FilterDimBinding,
    state: FilterState,
    searchQueries: Map<string, string>,
    dropdownOpen: Map<string, boolean>,
): HTMLDivElement {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;";

    const selected = state.get(binding.dimName);

    const chipBar = document.createElement("div");
    chipBar.style.cssText = [
        "display:flex",
        "flex-wrap:wrap",
        "gap:4px",
        "padding:6px 8px",
        "border:1px solid #c0c0c0",
        "border-radius:3px",
        "min-height:28px",
        "cursor:pointer",
        "background:#fff",
    ].join(";");

    if (selected.size === 0) {
        const placeholder = document.createElement("span");
        placeholder.textContent = `Search ${binding.distinctValues.length} values…`;
        placeholder.style.cssText = "color:#999;font-size:11px;flex:1;";
        chipBar.appendChild(placeholder);
    } else {
        for (const v of Array.from(selected).sort()) {
            chipBar.appendChild(buildChip(v, () => state.toggle(binding.dimName, v)));
        }
    }
    const caret = document.createElement("span");
    caret.textContent = dropdownOpen.get(binding.dimName) ? "▴" : "▾";
    caret.style.cssText = "color:#666;font-size:10px;align-self:center;margin-left:auto;";
    chipBar.appendChild(caret);

    chipBar.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownOpen.set(binding.dimName, !dropdownOpen.get(binding.dimName));
        renderBody();
    });
    wrap.appendChild(chipBar);

    const bodyWrap = document.createElement("div");
    wrap.appendChild(bodyWrap);

    function renderBody(): void {
        while (bodyWrap.firstChild) bodyWrap.removeChild(bodyWrap.firstChild);
        if (!dropdownOpen.get(binding.dimName)) return;
        const search = buildSearchInput(binding.dimName, searchQueries, () => renderList());
        bodyWrap.appendChild(search);
        const list = document.createElement("div");
        list.style.cssText = [
            `max-height:${MAX_LIST_HEIGHT_PX}px`,
            "overflow-y:auto",
            "border:1px solid #e0e0e0",
            "border-radius:3px",
        ].join(";");
        bodyWrap.appendChild(list);

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
            for (const v of matches.slice(0, 200)) {
                list.appendChild(buildCheckRow(binding, v, state.get(binding.dimName).has(v), state));
            }
            if (matches.length > 200) {
                const more = document.createElement("div");
                more.textContent = `(${matches.length - 200} more — narrow the search)`;
                more.style.cssText = "padding:6px 8px;color:#888;font-style:italic;font-size:11px;";
                list.appendChild(more);
            }
        }
        renderList();
    }
    renderBody();
    return wrap;
}

export function buildChip(value: string, onRemove: () => void): HTMLSpanElement {
    const chip = document.createElement("span");
    chip.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "gap:4px",
        "padding:2px 6px 2px 8px",
        "border-radius:3px",
        `background:${BADGE_BG}`,
        `color:${BADGE_FG}`,
        "font-size:10px",
        "font-weight:600",
        "white-space:nowrap",
    ].join(";");
    const text = document.createElement("span");
    text.textContent = value;
    chip.appendChild(text);
    const x = document.createElement("span");
    x.textContent = "\u2715";
    x.style.cssText = "cursor:pointer;font-size:10px;padding:0 2px;";
    x.addEventListener("click", (e) => {
        e.stopPropagation();
        onRemove();
    });
    chip.appendChild(x);
    return chip;
}

export function buildSearchInput(
    dimName: string,
    searchQueries: Map<string, string>,
    onChange: () => void,
): HTMLInputElement {
    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search…";
    search.value = searchQueries.get(dimName) ?? "";
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
        searchQueries.set(dimName, search.value);
        onChange();
    });
    return search;
}

export function buildCheckRow(
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
    // Green accent matches the selection-count badge — color-codes
    // controls that mutate selection state.
    checkbox.style.cssText = "margin:0;cursor:pointer;accent-color:#2ca02c;";
    checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        state.toggle(binding.dimName, value);
    });
    row.appendChild(checkbox);
    const span = document.createElement("span");
    span.textContent = value;
    span.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;";
    row.appendChild(span);
    // Faceted count badge — important metadata, shown next to the value
    // label so users see how many records that value matches under the
    // current cross-filter state. Graceful fallback: no badge if state
    // has no row data plumbed yet.
    const counts = state.getValueCounts(binding.dimName);
    if (counts.size > 0) {
        row.appendChild(buildCountBadge(counts.get(value) ?? 0, false, "inline"));
    }
    row.addEventListener("mouseenter", () => { row.style.background = ROW_HOVER_BG; });
    row.addEventListener("mouseleave", () => { row.style.background = "transparent"; });
    row.addEventListener("click", (e) => e.stopPropagation());
    return row;
}
