// INF-3745 Phase A — dropdown-multi widget renderer.
//
// Collapsed trigger button "DimName: val1, val2 (N) ▾". Click → popover
// with search box + checkbox list + Clear/Done footer. Multi-select.
// Popover is absolutely positioned below the trigger (Phase A simple
// placement; Phase D adds viewport-edge detection).
//
// Document-click closes the popover unless the click is inside it.

import type { WidgetHandle, WidgetRenderer, WidgetOptions } from "./widget";
import { DENSITY, PILL_BORDER, positionPopoverBelow } from "./widgetCommon";
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
        root.style.cssText = "position:relative;display:inline-block;";
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

        // Popover (created up-front; visibility toggled via display).
        const popover = document.createElement("div");
        popover.className = "filter-widget-dropdown-popover";
        popover.style.cssText = [
            "position:absolute",
            "min-width:220px",
            "max-width:320px",
            `max-height:${POPOVER_MAX_HEIGHT_PX}px`,
            `background:${POPOVER_BG}`,
            `border:1px solid ${POPOVER_BORDER}`,
            "border-radius:4px",
            "box-shadow:0 4px 12px rgba(0,0,0,0.15)",
            "z-index:1000",
            "display:none",
            "flex-direction:column",
            "padding:6px",
            "box-sizing:border-box",
        ].join(";");
        root.appendChild(popover);

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
            if (matches.length === 0) {
                const empty = document.createElement("div");
                empty.textContent = "No matches";
                empty.style.cssText = "padding:6px 8px;color:#888;font-style:italic;font-size:11px;";
                list.appendChild(empty);
                return;
            }
            for (const v of matches.slice(0, 200)) {
                list.appendChild(buildCheckRow(v));
            }
            if (matches.length > 200) {
                const more = document.createElement("div");
                more.textContent = `(${matches.length - 200} more \u2014 narrow the search)`;
                more.style.cssText = "padding:6px 8px;color:#888;font-style:italic;font-size:11px;";
                list.appendChild(more);
            }
        }

        function buildCheckRow(value: string): HTMLLabelElement {
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
            cb.style.cssText = "margin:0;cursor:pointer;";
            cb.addEventListener("click", (e) => {
                e.stopPropagation();
                state.toggle(binding.dimName, value);
            });
            row.appendChild(cb);
            const span = document.createElement("span");
            span.textContent = value;
            span.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;";
            row.appendChild(span);
            row.addEventListener("mouseenter", () => { row.style.background = "#f0f0f3"; });
            row.addEventListener("mouseleave", () => { row.style.background = "transparent"; });
            row.addEventListener("click", (e) => e.stopPropagation());
            return row;
        }

        function setOpen(next: boolean): void {
            if (open === next) return;
            open = next;
            if (open) {
                positionPopoverBelow(trigger, popover);
                popover.style.display = "flex";
                renderList();
                // Defer document-click attach to AFTER this click bubble.
                setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
            } else {
                popover.style.display = "none";
                document.removeEventListener("click", onDocClick, true);
            }
        }

        function onDocClick(e: Event): void {
            if (!(e.target instanceof Node)) return;
            if (root.contains(e.target)) return;
            setOpen(false);
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
                document.removeEventListener("click", onDocClick, true);
                if (root.parentNode) root.parentNode.removeChild(root);
            },
            element: root,
        };
    },
};
