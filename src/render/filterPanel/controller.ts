// INF-3739 Phases 3b/3c/3d — filter panel controller.
//
// Owns the comprehensive-sidebar handle + the top slicer strip handle +
// the single FilterState. Sidebar mounts at top:0 full-height (selection-
// driven, opens via top-chrome filter icon); top slicer strip mounts
// below the master-slider chrome row and renders ONE pill-row per pinned
// dim. Cross-tier sync is implicit: both surfaces subscribe to the same
// FilterState, so a pill click in the strip and a checkbox toggle in the
// sidebar are over the same data. State mutations fire applyJsonFilter
// pushback to PBI's filter context + host.persistProperties for selection
// round-trip across .pbix save/reopen.

import powerbi from "powerbi-visuals-api";
import { mountMountablePanel, MountablePanelHandle } from "../panel/mountablePanel";
import {
    FilterDimBinding, FilterSlotSettings, FilterState, SlotWidget,
    MAX_FILTER_DIMENSIONS, MAX_DISTINCT_VALUES,
    comprehensiveBindings, pinnedBindings,
} from "./state";
import { mountComprehensivePanel, ComprehensivePanelHandle } from "./comprehensivePanel";
import { mountTopSlicerStrip, TopSlicerStripHandle, PinnedDensity } from "./topSlicerStrip";
import { pushFilters, persistSelections, persistPin, persistWidget } from "./persistence";
import type { VisualFormattingSettingsModel } from "../../settings";

type IVisualHost = powerbi.extensibility.visual.IVisualHost;

export interface FilterPanelControllerOptions {
    host: IVisualHost;
    onChange: () => void;
}

export interface FilterPanelController {
    /** Sidebar width in px when open; 0 when closed. */
    widthPx(): number;
    /** Total height in px reserved by all pinned top-slicer-strip rows; 0 when nothing pinned. */
    topSlicerHeightPx(): number;
    /** Active dim count for the icon badge. */
    activeCount(): number;
    /** True if the sidebar is currently open. */
    isOpen(): boolean;
    /** Toggle the sidebar (called by the top-chrome filter icon click). */
    toggleOpen(): void;
    /** Toggle a slot's pinned state (called by the in-sidebar pin button). */
    togglePin(slotIndex: number): void;
    /** Set a slot's widget choice (called by the in-sidebar widget picker). */
    setWidget(slotIndex: number, widget: SlotWidget): void;
    /** Reposition both panels within root. */
    layout(opts: {
        viewportWidth: number;
        viewportHeight: number;
    }): void;
    /** Update bindings, slot settings, FilterState, re-render both surfaces.
     *  Returns the active filter map; visual.ts uses it to narrow vm + table. */
    update(
        dataView: powerbi.DataView | undefined,
        settings: VisualFormattingSettingsModel,
    ): { activeFilters: ReadonlyMap<string, ReadonlySet<string>> };
}

const COMPREHENSIVE_DEFAULT_PX = 300;
const COMPREHENSIVE_MIN_PX = 240;
const COMPREHENSIVE_MAX_PX = 520;

export function mountFilterPanelController(
    root: HTMLElement,
    options: FilterPanelControllerOptions,
): FilterPanelController {
    const state = new FilterState();
    let open = false;
    // Optimistic pin overrides — persistProperties round-trips asynchronously
    // through PBI; this Map holds the most-recent user intent so the next
    // update() sees the toggled state before persisted settings catch up.
    const pinOverride: Map<number, boolean> = new Map();
    // INF-3745 Phase A — same optimistic-override pattern for widget choice.
    // Holds the most-recent user widget pick until persistProperties round-
    // trips it back through settings.
    const widgetOverride: Map<number, SlotWidget> = new Map();
    let restoredFromPersisted = false;
    let currentBindings: FilterDimBinding[] = [];
    let currentPinnedCount = 0;
    let lastPinnedBindings: FilterDimBinding[] = [];
    let lastSlots: FilterSlotSettings[] = [];
    let lastDensity: PinnedDensity = "compact";

    // Sidebar — mounts at top:0 right:0 height:100%, full visual height.
    const sidebarHost = document.createElement("div");
    sidebarHost.style.cssText = "width:100%;height:100%;";
    const sidebarPanel: MountablePanelHandle = mountMountablePanel(root, {
        position: "right",
        mode: "expandable",
        view: "normal",
        initialOpen: false,
        initialSizePx: COMPREHENSIVE_DEFAULT_PX,
        minSizePx: COMPREHENSIVE_MIN_PX,
        maxSizePx: COMPREHENSIVE_MAX_PX,
        onResize: () => options.onChange(),
    });
    sidebarPanel.setContent(buildSidebarComposition(sidebarHost, () => {
        open = false;
        sidebarPanel.setOpen(false);
        options.onChange();
    }));
    const sidebarRenderer: ComprehensivePanelHandle = mountComprehensivePanel(sidebarHost, state, {
        onTogglePin: (slotIndex: number) => {
            togglePinInternal(slotIndex);
        },
        isPinned: (slotIndex: number) => effectivePinned(slotIndex),
        onWidgetChange: (slotIndex: number, widget: SlotWidget) => {
            setWidgetInternal(slotIndex, widget);
        },
        currentWidget: (slotIndex: number) => effectiveWidget(slotIndex),
    });

    // Top slicer strip — mounts as an absolutely-positioned container that
    // visual.ts repositions on every frame to sit below the top chrome.
    const slicerContainer = document.createElement("div");
    slicerContainer.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        "width:100%",
        "z-index:9",
        "pointer-events:auto",
    ].join(";");
    root.appendChild(slicerContainer);
    const topSlicer: TopSlicerStripHandle = mountTopSlicerStrip(slicerContainer, state);

    // State subscribe — every mutation fires applyJsonFilter + persist + redraw.
    state.subscribe(() => {
        pushFilters(options.host, state, currentBindings);
        persistSelections(options.host, state);
        options.onChange();
    });

    function effectivePinned(slotIndex: number): boolean {
        if (pinOverride.has(slotIndex)) return pinOverride.get(slotIndex)!;
        return false;
    }

    function togglePinInternal(slotIndex: number): void {
        const next = !effectivePinned(slotIndex);
        pinOverride.set(slotIndex, next);
        persistPin(options.host, slotIndex, next);
        options.onChange();
    }

    function effectiveWidget(slotIndex: number): SlotWidget {
        if (widgetOverride.has(slotIndex)) return widgetOverride.get(slotIndex)!;
        return "auto";
    }

    function setWidgetInternal(slotIndex: number, widget: SlotWidget): void {
        widgetOverride.set(slotIndex, widget);
        persistWidget(options.host, slotIndex, widget);
        options.onChange();
    }

    return {
        widthPx(): number { return sidebarPanel.sizePx(); },
        topSlicerHeightPx(): number {
            // Packed clusters wrap with the browser's flex-wrap algorithm, so
            // the final rendered height depends on viewport width AND density.
            // Measure the strip's actual offsetHeight; fall back to 0 when no
            // pinned dims are present.
            if (currentPinnedCount === 0) return 0;
            return slicerContainer.offsetHeight || 0;
        },
        activeCount(): number { return state.activeCount(); },
        isOpen(): boolean { return open; },

        toggleOpen(): void {
            open = !open;
            sidebarPanel.setOpen(open);
            options.onChange();
        },

        togglePin(slotIndex: number): void { togglePinInternal(slotIndex); },
        setWidget(slotIndex: number, widget: SlotWidget): void { setWidgetInternal(slotIndex, widget); },

        layout(opts): void {
            // Sidebar: full-height on the right edge.
            const sp = sidebarPanel.element;
            sp.style.top = "0px";
            sp.style.height = opts.viewportHeight + "px";
            // Top slicer strip mounts in its OWN dedicated container at top:0,
            // full-width (minus sidebar). The existing chrome (toggles +
            // master slider) is pushed down by visual.ts to sit BELOW this
            // container.
            slicerContainer.style.top = "0px";
            slicerContainer.style.width = Math.max(0, opts.viewportWidth - sidebarPanel.sizePx()) + "px";
            topSlicer.render(lastPinnedBindings, lastSlots, lastDensity);
        },

        update(dataView, settings): { activeFilters: ReadonlyMap<string, ReadonlySet<string>> } {
            currentBindings = extractBindings(dataView);
            const slots: FilterSlotSettings[] = extractSlotSettings(settings, pinOverride, widgetOverride);
            mutateSlotLabels(settings, currentBindings);

            if (!restoredFromPersisted) {
                const raw = settings.filterPanelLayout.selectionsJson.value ?? "";
                if (raw.trim().length > 0) {
                    try {
                        const parsed = JSON.parse(raw);
                        const restored = FilterState.fromJSON(parsed);
                        for (const [k, vs] of restored.entries()) state.set(k, vs);
                    } catch { /* ignore */ }
                }
                restoredFromPersisted = true;
            }

            const comprehensive = comprehensiveBindings(currentBindings, slots);
            sidebarRenderer.render(comprehensive, slots);

            const pinned = pinnedBindings(currentBindings, slots);
            const density = extractPinnedDensity(settings);
            lastDensity = density;
            topSlicer.render(pinned, slots, density);
            currentPinnedCount = pinned.length;
            lastPinnedBindings = pinned;
            lastSlots = slots.slice();
            // Strip auto-sizes via browser flex-wrap; clear the explicit
            // height so the measured offsetHeight reflects actual content.
            slicerContainer.style.height = "auto";

            const activeFilters: Map<string, ReadonlySet<string>> = new Map();
            for (const [k, v] of state.entries()) activeFilters.set(k, v);
            return { activeFilters };
        },
    };
}

function buildSidebarComposition(host: HTMLElement, onClose: () => void): HTMLDivElement {
    const composition = document.createElement("div");
    composition.style.cssText = [
        "display:flex",
        "flex-direction:column",
        "height:100%",
        "width:100%",
        "box-sizing:border-box",
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = [
        "display:flex",
        "align-items:center",
        "justify-content:space-between",
        "padding:6px 10px",
        "border-bottom:1px solid #c0c0c0",
        "min-height:32px",
        "box-sizing:border-box",
        "flex-shrink:0",
        "background:#e8e8ec",
        "font-family:'Segoe UI',system-ui,sans-serif",
        "font-size:13px",
        "font-weight:600",
        "color:#222",
    ].join(";");
    const title = document.createElement("span");
    title.textContent = "Filters";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "\u2715";
    closeBtn.setAttribute("aria-label", "Close filter sidebar");
    closeBtn.style.cssText = [
        "background:transparent",
        "border:none",
        "cursor:pointer",
        "font-size:16px",
        "color:#555",
        "padding:2px 8px",
        "line-height:1",
        "border-radius:3px",
    ].join(";");
    closeBtn.addEventListener("mouseenter", () => { closeBtn.style.background = "#f0f0f3"; });
    closeBtn.addEventListener("mouseleave", () => { closeBtn.style.background = "transparent"; });
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onClose();
    });
    header.appendChild(closeBtn);

    composition.appendChild(header);

    host.style.flex = "1";
    host.style.overflow = "hidden";
    composition.appendChild(host);

    return composition;
}

function extractBindings(dataView: powerbi.DataView | undefined): FilterDimBinding[] {
    const rows = dataView?.table?.rows;
    const cols = dataView?.table?.columns;
    if (!rows || !cols) return [];
    const result: FilterDimBinding[] = [];
    let slotIndex = 0;
    for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const roles = col.roles ?? {};
        if (!roles["filterDimensions"]) continue;
        if (slotIndex >= MAX_FILTER_DIMENSIONS) break;
        const distinct = new Set<string>();
        for (const r of rows) {
            const v = r[i];
            if (v === null || v === undefined) continue;
            const s = String(v);
            distinct.add(s);
            if (distinct.size >= MAX_DISTINCT_VALUES) break;
        }
        result.push({
            dimName: col.displayName,
            slotIndex,
            columnRef: col,
            distinctValues: Array.from(distinct).sort((a, b) => a.localeCompare(b)),
        });
        slotIndex++;
    }
    return result;
}

const VALID_WIDGETS: ReadonlySet<SlotWidget> = new Set<SlotWidget>([
    "auto", "pills-multi", "pills-single", "dropdown-multi", "search-chips", "range-slider",
]);

function extractSlotSettings(
    settings: VisualFormattingSettingsModel,
    pinOverride: ReadonlyMap<number, boolean>,
    widgetOverride: ReadonlyMap<number, SlotWidget>,
): FilterSlotSettings[] {
    const fs = settings.filterSlots;
    const slotRefs = [
        { tier: fs.slot1Tier, widget: fs.slot1Widget, label: fs.slot1Label, pinned: fs.slot1Pinned },
        { tier: fs.slot2Tier, widget: fs.slot2Widget, label: fs.slot2Label, pinned: fs.slot2Pinned },
        { tier: fs.slot3Tier, widget: fs.slot3Widget, label: fs.slot3Label, pinned: fs.slot3Pinned },
        { tier: fs.slot4Tier, widget: fs.slot4Widget, label: fs.slot4Label, pinned: fs.slot4Pinned },
        { tier: fs.slot5Tier, widget: fs.slot5Widget, label: fs.slot5Label, pinned: fs.slot5Pinned },
        { tier: fs.slot6Tier, widget: fs.slot6Widget, label: fs.slot6Label, pinned: fs.slot6Pinned },
        { tier: fs.slot7Tier, widget: fs.slot7Widget, label: fs.slot7Label, pinned: fs.slot7Pinned },
        { tier: fs.slot8Tier, widget: fs.slot8Widget, label: fs.slot8Label, pinned: fs.slot8Pinned },
    ];
    return slotRefs.map((s, idx) => {
        const tier = String(s.tier.value.value) as FilterSlotSettings["tier"];
        const widgetRaw = String(s.widget.value.value);
        const widgetPersisted: SlotWidget =
            VALID_WIDGETS.has(widgetRaw as SlotWidget) ? (widgetRaw as SlotWidget) : "auto";
        const persistedPinned = !!s.pinned.value;
        const pinned = pinOverride.has(idx) ? pinOverride.get(idx)! : persistedPinned;
        const widget = widgetOverride.has(idx) ? widgetOverride.get(idx)! : widgetPersisted;
        return {
            tier: (tier === "comprehensive" || tier === "hidden") ? tier : "comprehensive",
            widget,
            defaultSelection: "all",
            labelOverride: s.label.value ?? "",
            pinned,
        };
    });
}

function mutateSlotLabels(
    settings: VisualFormattingSettingsModel,
    bindings: ReadonlyArray<FilterDimBinding>,
): void {
    const fs = settings.filterSlots;
    const groups = fs.groups;
    for (let i = 0; i < MAX_FILTER_DIMENSIONS; i++) {
        const b = bindings[i];
        const g = groups[i];
        if (g === undefined) continue;
        g.displayName = b !== undefined ? b.dimName : `Slot ${i + 1} (unbound)`;
    }
}

function extractPinnedDensity(settings: VisualFormattingSettingsModel): PinnedDensity {
    const v = String(settings.filterPanelLayout.pinnedDensity.value.value);
    if (v === "comfortable" || v === "compact" || v === "dense") return v;
    return "compact";
}
