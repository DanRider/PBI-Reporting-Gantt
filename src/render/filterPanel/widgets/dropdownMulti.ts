// INF-3745 Phase A — dropdown-multi widget renderer.
//
// Collapsed trigger button "DimName: val1, val2 (N) ▾". Click → popover
// with search box + checkbox list + Clear/Done footer. Multi-select.
// Popover is absolutely positioned below the trigger (Phase A simple
// placement; Phase D adds viewport-edge detection).
//
// Document-click closes the popover unless the click is inside it.

import type { WidgetHandle, WidgetRenderer, WidgetOptions } from "./widget";
import {
    DENSITY, PILL_BORDER, buildCountBadge, buildClearButton,
    attachOutsideClickGuard, OutsideClickGuard,
} from "./widgetCommon";
import { dimLabel } from "../state";

const POPOVER_BG = "#ffffff";
const POPOVER_BORDER = "#c0c0c0";
const POPOVER_MAX_HEIGHT_PX = 260;
const LIST_MAX_HEIGHT_PX = 180;

export const dropdownMultiRenderer: WidgetRenderer = {
    mount(host: HTMLElement, opts: WidgetOptions): WidgetHandle {
        const { binding, slot, state, density } = opts;
        const d = DENSITY[density];

        const root = document.createElement("div");
        root.className = "filter-widget-dropdown-multi";
        // inline-flex so the trigger and optional clear-✕ align on a row.
        root.style.cssText = "position:relative;display:inline-flex;align-items:center;";
        host.appendChild(root);

        // Trigger button — collapsed summary.
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "filter-widget-dropdown-trigger";
        trigger.style.cssText = [
            `padding:${d.pillPaddingV}px ${d.pillPaddingH}px`,
            "border-radius:4px",
            "border:1px solid " + PILL_BORDER,
            "background:#fff",
            "color:#222",
            "cursor:pointer",
            "font-size:" + d.pillFontSizePx + "px",
            "font-weight:500",
            "white-space:nowrap",
            "user-select:none",
            "text-align:left",
            "max-width:280px",
            "overflow:hidden",
            "text-overflow:ellipsis",
        ].join(";");
        root.appendChild(trigger);

        // Clear-✕ — appears on the trigger row whenever the dim has an
        // active selection. Single click clears without opening the
        // popover. renderTrigger toggles its visibility.
        const triggerClearBtn = buildClearButton(() => state.clear(binding.dimName));
        triggerClearBtn.style.display = "none";
        root.appendChild(triggerClearBtn);

        // Popover (created up-front; visibility toggled via display).
        // Popover is portaled to document.body (not kept inside root) so
        // it escapes the slicer-strip's local stacking context. Otherwise
        // the gantt chart layer bleeds through it — same trap as
        // widgetPicker.ts (INF-3745 z-index fix). Append once at mount;
        // open/close just toggle display + reposition. Cleanup on destroy.
        const popover = document.createElement("div");
        popover.className = "filter-widget-dropdown-popover";
        popover.style.cssText = [
            "position:fixed",
            "min-width:220px",
            "max-width:320px",
            `max-height:${POPOVER_MAX_HEIGHT_PX}px`,
            `background:${POPOVER_BG}`,
            `border:1px solid ${POPOVER_BORDER}`,
            "border-radius:4px",
            "box-shadow:0 4px 12px rgba(0,0,0,0.15)",
            "z-index:2147483640",
            "display:none",
            "flex-direction:column",
            "padding:6px",
            "box-sizing:border-box",
        ].join(";");
        document.body.appendChild(popover);

        let open = false;
        let searchQuery = "";

        function summary(): string {
            const sel = state.get(binding.dimName);
            const label = dimLabel(binding, slot);
            if (sel.size === 0) return `${label}: All \u25be`;
            if (sel.size <= 2) {
                return `${label}: ${Array.from(sel).sort().join(", ")} \u25be`;
            }
            return `${label}: ${sel.size} selected \u25be`;
        }

        function renderTrigger(): void {
            trigger.textContent = summary();
            // Show clear-✕ only when this dim has an active selection.
            triggerClearBtn.style.display = state.get(binding.dimName).size > 0 ? "inline-flex" : "none";
        }

        // Popover content.
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = "Search\u2026";
        searchInput.style.cssText = [
            "width:100%",
            "padding:4px 6px",
            "border:1px solid #c0c0c0",
            "border-radius:3px",
            "font-size:11px",
            "box-sizing:border-box",
            "margin-bottom:4px",
        ].join(";");
        searchInput.addEventListener("click", (e) => e.stopPropagation());
        searchInput.addEventListener("input", () => {
            searchQuery = searchInput.value;
            renderList();
        });
        popover.appendChild(searchInput);

        const list = document.createElement("div");
        list.style.cssText = [
            `max-height:${LIST_MAX_HEIGHT_PX}px`,
            "overflow-y:auto",
            "border:1px solid #e0e0e0",
            "border-radius:3px",
            "flex:1",
        ].join(";");
        popover.appendChild(list);

        const footer = document.createElement("div");
        footer.style.cssText = [
            "display:flex",
            "justify-content:space-between",
            "padding-top:6px",
            "flex-shrink:0",
        ].join(";");
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.textContent = "Clear";
        clearBtn.style.cssText = [
            "background:transparent",
            "border:1px solid #c0c0c0",
            "border-radius:3px",
            "padding:3px 10px",
            "cursor:pointer",
            "font-size:11px",
            "color:#444",
        ].join(";");
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            state.clear(binding.dimName);
        });
        const doneBtn = document.createElement("button");
        doneBtn.type = "button";
        doneBtn.textContent = "Done";
        doneBtn.style.cssText = [
            "background:#1F77B4",
            "border:1px solid #1F77B4",
            "border-radius:3px",
            "padding:3px 12px",
            "cursor:pointer",
            "font-size:11px",
            "color:#fff",
            "font-weight:600",
        ].join(";");
        doneBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setOpen(false);
        });
        footer.appendChild(clearBtn);
        footer.appendChild(doneBtn);
        popover.appendChild(footer);

        function renderList(): void {
            const q = searchQuery.toLowerCase();
            while (list.firstChild) list.removeChild(list.firstChild);
            const matches = binding.distinctValues.filter(v => v.toLowerCase().includes(q));
            // Faceted counts under current cross-filters (empty map →
            // counts undefined → no badges rendered, graceful fallback).
            const counts = state.getValueCounts(binding.dimName);
            const hasCounts = counts.size > 0;
            if (matches.length === 0) {
                const empty = document.createElement("div");
                empty.textContent = "No matches";
                empty.style.cssText = "padding:6px 8px;color:#888;font-style:italic;font-size:11px;";
                list.appendChild(empty);
                return;
            }
            for (const v of matches.slice(0, 200)) {
                list.appendChild(buildCheckRow(v, hasCounts ? (counts.get(v) ?? 0) : undefined));
            }
            if (matches.length > 200) {
                const more = document.createElement("div");
                more.textContent = `(${matches.length - 200} more \u2014 narrow the search)`;
                more.style.cssText = "padding:6px 8px;color:#888;font-style:italic;font-size:11px;";
                list.appendChild(more);
            }
        }

        function buildCheckRow(value: string, count?: number): HTMLLabelElement {
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
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = state.get(binding.dimName).has(value);
            cb.style.cssText = "margin:0;cursor:pointer;accent-color:#2ca02c;";
            cb.addEventListener("click", (e) => {
                e.stopPropagation();
                state.toggle(binding.dimName, value);
            });
            row.appendChild(cb);
            const span = document.createElement("span");
            span.textContent = value;
            span.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;";
            row.appendChild(span);
            if (count !== undefined) {
                row.appendChild(buildCountBadge(count, false, "inline"));
            }
            row.addEventListener("mouseenter", () => { row.style.background = "#f0f0f3"; });
            row.addEventListener("mouseleave", () => { row.style.background = "transparent"; });
            row.addEventListener("click", (e) => e.stopPropagation());
            return row;
        }

        // INF-3774 — outside-click guard handle. Replaces the prior
        // setTimeout(0) + manual document.addEventListener pattern.
        let outsideGuard: OutsideClickGuard | null = null;

        function setOpen(next: boolean): void {
            if (open === next) return;
            open = next;
            if (open) {
                // Compute fixed coords from the trigger's viewport rect.
                // The popover lives in document.body (appended at mount);
                // we just toggle display + reposition here.
                const rect = trigger.getBoundingClientRect();
                popover.style.top = (rect.bottom + 4) + "px";
                popover.style.left = rect.left + "px";
                popover.style.display = "flex";
                renderList();
                // INF-3774 — synchronous capture-phase attach. Safe because
                // (a) addEventListener inside an in-flight event dispatch
                // does not catch that event, and (b) trigger.click calls
                // stopPropagation. The shared helper checks BOTH trigger
                // (root) and popover containment so clicking the trigger
                // again to toggle never misfires as an outside-click.
                outsideGuard = attachOutsideClickGuard(root, popover, () => setOpen(false));
            } else {
                popover.style.display = "none";
                outsideGuard?.dispose();
                outsideGuard = null;
            }
        }

        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            setOpen(!open);
        });

        renderTrigger();

        return {
            update(): void {
                renderTrigger();
                if (open) renderList();
            },
            destroy(): void {
                outsideGuard?.dispose();
                outsideGuard = null;
                // Popover lives in document.body — always remove on destroy.
                if (popover.parentNode) popover.parentNode.removeChild(popover);
                if (root.parentNode) root.parentNode.removeChild(root);
            },
            element: root,
        };
    },
};
