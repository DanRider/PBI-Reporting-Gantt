// INF-3739 — filter panel controller. Owns sidebar + top slicer strip
// handles + the shared FilterState. Cross-tier sync via FilterState
// subscribers; mutations fire applyJsonFilter pushback + persistProperties.

import powerbi from "powerbi-visuals-api";
import { mountMountablePanel, MountablePanelHandle } from "../panel/mountablePanel";
import {
    FilterDimBinding, FilterSlotSettings, FilterState, SlotWidget,
    MAX_FILTER_DIMENSIONS, MAX_DISTINCT_VALUES,
    comprehensiveBindings, pinnedBindings,
} from "./state";
import { mountComprehensivePanel, ComprehensivePanelHandle } from "./comprehensivePanel";
import { mountTopSlicerStrip, TopSlicerStripHandle, PinnedDensity } from "./topSlicerStrip";
import { persistPin, persistWidget, persistSortOrders } from "./persistence";
import { createPersistenceQueue, PersistenceQueue } from "./persistenceQueue";
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
    /** Count of currently-pinned dims. */
    pinnedCount(): number;
    /** First child of slicerContainer (the strip element). null if not mounted. */
    slicerStripElement(): HTMLElement | null;
    /** INF-3770 — flush debounced writes; called from visual.destroy(). */
    flushPersistence(): void;
    layout(opts: { viewportWidth: number; viewportHeight: number }): void;
    /** Returns active filter map (used by visual.ts to narrow vm + table). */
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
    // Optimistic overrides — hold user intent until PBI persistProperties round-trips.
    const pinOverride: Map<number, boolean> = new Map();
    const widgetOverride: Map<number, SlotWidget> = new Map();
    // INF-3758 — sortOrder override map (slotIndex → sortOrder). Layered on
    // top of the persisted sortOrdersJson so drag changes are visible
    // immediately, then survive the persistProperties round-trip.
    const sortOrderOverride: Map<number, number> = new Map();
    // In-memory only; "Apply to filter pane" routes sidebar value-row render to slicer widget.
    const applyToFilterPaneOverride: Map<number, boolean> = new Map();
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
        isApplyToFilterPane: (slotIndex: number) => applyToFilterPaneOverride.get(slotIndex) === true,
        onToggleApplyToFilterPane: (slotIndex: number) => {
            const next = applyToFilterPaneOverride.get(slotIndex) !== true;
            applyToFilterPaneOverride.set(slotIndex, next);
            options.onChange();
        },
        onReorder: (newSortOrders: ReadonlyArray<number>) => {
            // INF-3758 — operator dropped a drag. Apply the array to all 8
            // slots (one entry per slot, in slot-index order), persist, and
            // re-render. The override map shadows persisted values so the
            // sidebar + strip reflow immediately.
            sortOrderOverride.clear();
            for (let i = 0; i < newSortOrders.length; i++) {
                sortOrderOverride.set(i, newSortOrders[i]);
            }
            persistSortOrders(options.host, newSortOrders);
            options.onChange();
        },
    });

    // INF-3751: left:36 clears anchored funnel. z-index:9 avoids right Filters panel.
    // padding-bottom:12 = clearance for pill count badges (widgetCommon.ts:bottomOffset).
    const slicerContainer = document.createElement("div");
    slicerContainer.style.cssText = [
        "position:absolute",
        "left:36px",
        "top:0",
        "width:100%",
        "z-index:9",
        "pointer-events:auto",
        "padding-bottom:12px",
    ].join(";");
    root.appendChild(slicerContainer);
    const topSlicer: TopSlicerStripHandle = mountTopSlicerStrip(slicerContainer, state);

    // INF-3770 — debounced host-write queue (cadences in persistenceQueue.ts).
    // options.onChange stays synchronous so in-visual rerender is instant;
    // only the cross-visual filter + settings round-trips debounce.
    const persistenceQueue: PersistenceQueue = createPersistenceQueue(options.host, state);
    state.subscribe(() => {
        persistenceQueue.schedule(currentBindings);
        options.onChange();
    });

    function effectivePinned(slotIndex: number): boolean {
        // lastSlots has post-merge state (pinOverride + persisted).
        return lastSlots[slotIndex]?.pinned ?? false;
    }

    function togglePinInternal(slotIndex: number): void {
        const next = !effectivePinned(slotIndex);
        pinOverride.set(slotIndex, next);
        persistPin(options.host, slotIndex, next);
        options.onChange();
    }

    function effectiveWidget(slotIndex: number): SlotWidget {
        return lastSlots[slotIndex]?.widget ?? "auto";
    }

    function setWidgetInternal(slotIndex: number, widget: SlotWidget): void {
        widgetOverride.set(slotIndex, widget);
        persistWidget(options.host, slotIndex, widget);
        options.onChange();
    }

    return {
        widthPx(): number { return sidebarPanel.sizePx(); },
        topSlicerHeightPx(): number {
            // Measure rendered offsetHeight (flex-wrap depends on viewport).
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
        pinnedCount(): number { return currentPinnedCount; },
        slicerStripElement(): HTMLElement | null {
            return slicerContainer.firstElementChild as HTMLElement | null;
        },
        flushPersistence(): void { persistenceQueue.flush(); },

        layout(opts): void {
            const sp = sidebarPanel.element;
            sp.style.top = "0px";
            sp.style.height = opts.viewportHeight + "px";
            slicerContainer.style.top = "0px";
            // Width = viewport - sidebar - 36 funnel-clearance (matches left:36).
            slicerContainer.style.width = Math.max(0, opts.viewportWidth - sidebarPanel.sizePx() - 36) + "px";
            topSlicer.render(lastPinnedBindings, lastSlots, lastDensity);
        },

        update(dataView, settings): { activeFilters: ReadonlyMap<string, ReadonlySet<string>> } {
            currentBindings = extractBindings(dataView);
            // Feed row tuples for cross-filtered count badges.
            state.setRows(extractFilterRows(dataView, currentBindings));
            const persistedSortOrders = extractPersistedSortOrders(settings);
            const slots: FilterSlotSettings[] = extractSlotSettings(
                settings, pinOverride, widgetOverride, sortOrderOverride, persistedSortOrders,
            );
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
            // INF-3751: strip render deferred to layout() (after class set).
            currentPinnedCount = pinned.length;
            lastPinnedBindings = pinned;
            lastSlots = slots.slice();
            slicerContainer.style.height = "auto"; // flex-wrap measures actual content

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

/** Row tuples (dimName→value) for faceted-count computation. */
function extractFilterRows(
    dataView: powerbi.DataView | undefined,
    bindings: ReadonlyArray<FilterDimBinding>,
): ReadonlyArray<ReadonlyMap<string, string>> {
    const rows = dataView?.table?.rows;
    const cols = dataView?.table?.columns;
    if (!rows || !cols || bindings.length === 0) return [];
    // Map column index → dimName for fast row projection.
    const colIdxToDim = new Map<number, string>();
    for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const roles = col.roles ?? {};
        if (!roles["filterDimensions"]) continue;
        colIdxToDim.set(i, col.displayName);
    }
    const out: Array<ReadonlyMap<string, string>> = [];
    for (const r of rows) {
        const tuple = new Map<string, string>();
        for (const [idx, dn] of colIdxToDim) {
            const v = r[idx];
            if (v === null || v === undefined) continue;
            tuple.set(dn, String(v));
        }
        if (tuple.size > 0) out.push(tuple);
    }
    return out;
}

function extractBindings(dataView: powerbi.DataView | undefined): FilterDimBinding[] {
    const rows = dataView?.table?.rows;
    const cols = dataView?.table?.columns;
    if (!rows || !cols) return [];
    const result: FilterDimBinding[] = [];
    let slotIndex = 0;
    // INF-3817 — collect column displayNames that overflow the 8-cap so we
    // can name them in the console warning. Prior behavior silently dropped
    // bindings past slot 8; operators had no signal. This is the Option C
    // first-step controller-level visibility while the architectural lift
    // (drop the slot1..slot8 hardcoding, generate algorithmically) lives
    // under INF-3791 v3.x.
    const overflowNames: string[] = [];
    for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const roles = col.roles ?? {};
        if (!roles["filterDimensions"]) continue;
        if (slotIndex >= MAX_FILTER_DIMENSIONS) {
            overflowNames.push(col.displayName);
            continue;
        }
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
    // INF-3817 — log the overflow once per operator session. Guards against
    // console spam (extractBindings runs every visual.update() tick during
    // a normal interaction session). Devs + advanced operators see the
    // signal in DevTools; the visual-chip surface for non-DevTools operators
    // lands with the v3.x lift work tracked under INF-3791.
    if (overflowNames.length > 0) {
        warnOverflowOnce(overflowNames);
    }
    return result;
}

let lastOverflowKey = "";
function warnOverflowOnce(names: string[]): void {
    const key = names.join("|");
    if (key === lastOverflowKey) return;
    lastOverflowKey = key;
    // eslint-disable-next-line no-console
    console.warn(
        `[Reporting-Gantt INF-3817] Filter Dimensions are capped at ${MAX_FILTER_DIMENSIONS}; ` +
        `${names.length} additional binding(s) were dropped: ${names.join(", ")}. ` +
        `The algorithmic uncap lands with v3.x (INF-3791).`,
    );
}

const VALID_WIDGETS: ReadonlySet<SlotWidget> = new Set<SlotWidget>([
    "auto", "pills-multi", "pills-single", "dropdown-multi", "search-chips", "range-slider",
]);

function extractSlotSettings(
    settings: VisualFormattingSettingsModel,
    pinOverride: ReadonlyMap<number, boolean>,
    widgetOverride: ReadonlyMap<number, SlotWidget>,
    sortOrderOverride: ReadonlyMap<number, number>,
    persistedSortOrders: ReadonlyArray<number | undefined>,
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
        // INF-3758 sortOrder resolution: override > persisted > undefined.
        const sortOrder = sortOrderOverride.has(idx)
            ? sortOrderOverride.get(idx)!
            : persistedSortOrders[idx];
        return {
            tier: (tier === "comprehensive" || tier === "hidden") ? tier : "comprehensive",
            widget,
            defaultSelection: "all",
            labelOverride: s.label.value ?? "",
            pinned,
            sortOrder,
        };
    });
}

/** INF-3758 — parse the persisted sortOrdersJson array from the layout card.
 *  Returns 8-element array; index i corresponds to slot i. Missing entries
 *  default to undefined (falls back to slotIndex for ordering). Invalid JSON
 *  or shape returns all-undefined; graceful fallback to bind-order behavior. */
function extractPersistedSortOrders(
    settings: VisualFormattingSettingsModel,
): ReadonlyArray<number | undefined> {
    const raw = settings.filterPanelLayout.sortOrdersJson.value ?? "";
    const out: (number | undefined)[] = new Array(MAX_FILTER_DIMENSIONS).fill(undefined);
    if (raw.trim().length === 0) return out;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return out;
        for (let i = 0; i < Math.min(parsed.length, MAX_FILTER_DIMENSIONS); i++) {
            const v = parsed[i];
            if (typeof v === "number" && Number.isFinite(v)) out[i] = v;
        }
    } catch { /* malformed JSON — fall back to all-undefined */ }
    return out;
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
