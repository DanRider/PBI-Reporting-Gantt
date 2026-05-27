// INF-3739 Phases 3b/3c/3d — filter panel controller.
//
// Holds the panel handles, owns the FilterState, drives bindings + slot
// displayName mutation + applyJsonFilter pushes + persistProperties round-
// trip. Single entry point so visual.ts only sees: mount once, call
// update(dataView, settings, viewport) per frame, read sizes for layout.

import powerbi from "powerbi-visuals-api";
import { mountMountablePanel, MountablePanelHandle } from "../panel/mountablePanel";
import {
    FilterDimBinding, FilterSlotSettings, FilterState,
    MAX_FILTER_DIMENSIONS, MAX_DISTINCT_VALUES,
    featuredBindings, comprehensiveBindings,
} from "./state";
import { mountFeaturedStrip, FeaturedStripHandle } from "./featuredStrip";
import { mountComprehensivePanel, ComprehensivePanelHandle } from "./comprehensivePanel";
import type { VisualFormattingSettingsModel } from "../../settings";

type IVisualHost = powerbi.extensibility.visual.IVisualHost;

export interface FilterPanelControllerOptions {
    host: IVisualHost;
    onChange: () => void;
}

export interface FilterPanelController {
    /** Featured strip height in px (0 when empty/hidden). */
    featuredHeightPx(): number;
    /** Comprehensive sidebar width in px (0 when empty/hidden). */
    comprehensiveWidthPx(): number;
    /** Reposition the panel containers within root (called by visual.ts layout).
     *  topOffsetPx pushes the featured strip BELOW any existing top chrome (e.g.
     *  master-slider strip) so they don't overlap. */
    layout(opts: { viewportWidth: number; viewportHeight: number; leftReservePx: number; topOffsetPx: number }): void;
    /** Update bindings, slot settings, FilterState, and re-render both surfaces. */
    update(
        dataView: powerbi.DataView | undefined,
        settings: VisualFormattingSettingsModel,
    ): { activeFilters: ReadonlyMap<string, ReadonlySet<string>> };
}

const FEATURED_ROW_HEIGHT_PX = 36;
const FEATURED_MAX_ROWS = 3;
const COMPREHENSIVE_DEFAULT_PX = 260;
const COMPREHENSIVE_MIN_PX = 200;
const COMPREHENSIVE_MAX_PX = 480;

export function mountFilterPanelController(
    root: HTMLElement,
    options: FilterPanelControllerOptions,
): FilterPanelController {
    const state = new FilterState();

    // Featured strip — top mount, fixed mode, view auto. Size is dynamic
    // (set per update from #featured-tier dims), so we mount with a
    // sentinel initial and override via panel.setOpen + content swap.
    const featuredHost = document.createElement("div");
    featuredHost.style.cssText = "width:100%;height:100%;";
    const featuredPanel: MountablePanelHandle = mountMountablePanel(root, {
        position: "top",
        mode: "fixed",
        view: "auto",
        initialOpen: false,
        initialSizePx: FEATURED_ROW_HEIGHT_PX,
        minSizePx: FEATURED_ROW_HEIGHT_PX,
        maxSizePx: FEATURED_ROW_HEIGHT_PX * FEATURED_MAX_ROWS,
    });
    featuredPanel.setContent(featuredHost);
    const featuredStrip: FeaturedStripHandle = mountFeaturedStrip(featuredHost, state);

    // Comprehensive sidebar — right mount, expandable, view normal.
    const comprehensiveHost = document.createElement("div");
    comprehensiveHost.style.cssText = "width:100%;height:100%;";
    const comprehensivePanel: MountablePanelHandle = mountMountablePanel(root, {
        position: "right",
        mode: "expandable",
        view: "normal",
        initialOpen: false,
        initialSizePx: COMPREHENSIVE_DEFAULT_PX,
        minSizePx: COMPREHENSIVE_MIN_PX,
        maxSizePx: COMPREHENSIVE_MAX_PX,
        onResize: () => options.onChange(),
    });
    comprehensivePanel.setContent(comprehensiveHost);
    const comprehensivePanelRenderer: ComprehensivePanelHandle =
        mountComprehensivePanel(comprehensiveHost, state);

    let lastDimCount = 0;
    let restoredFromPersisted = false;

    // Single subscription: every state mutation pushes to PBI + persists +
    // notifies the host for re-render. The view re-renders are handled by
    // the strip + sidebar's own state.subscribe.
    state.subscribe(() => {
        pushFilters(options.host, state, currentBindings);
        persistSelections(options.host, state);
        options.onChange();
    });

    let currentBindings: FilterDimBinding[] = [];

    return {
        featuredHeightPx(): number { return featuredPanel.sizePx(); },
        comprehensiveWidthPx(): number { return comprehensivePanel.sizePx(); },

        layout(opts): void {
            const fp = featuredPanel.element;
            fp.style.left = `${opts.leftReservePx}px`;
            fp.style.top = `${opts.topOffsetPx}px`;
            fp.style.width = `${Math.max(0, opts.viewportWidth - opts.leftReservePx - comprehensivePanel.sizePx())}px`;
            const cp = comprehensivePanel.element;
            cp.style.top = "0";
            cp.style.height = `${opts.viewportHeight}px`;
        },

        update(dataView, settings): { activeFilters: ReadonlyMap<string, ReadonlySet<string>> } {
            currentBindings = extractBindings(dataView);
            const slots: FilterSlotSettings[] = extractSlotSettings(settings);
            // Swim-lane idiom: mutate the live slot displayName so the Format
            // pane shows the bound column name instead of "Slot N".
            mutateSlotLabels(settings, currentBindings);

            // Restore persisted selections ONCE per session — the first
            // update where the formatting settings have populated.
            if (!restoredFromPersisted) {
                const raw = settings.filterPanelLayout.selectionsJson.value ?? "";
                if (raw.trim().length > 0) {
                    try {
                        const parsed = JSON.parse(raw);
                        const restored = FilterState.fromJSON(parsed);
                        for (const [k, vs] of restored.entries()) {
                            state.set(k, vs);
                        }
                    } catch {
                        // Ignore — fall back to empty state.
                    }
                }
                restoredFromPersisted = true;
            }

            // Honor showFeatured / showComprehensive toggles + empty-state
            // collapse: when no Featured-tier dims exist, hide the strip;
            // when no bindings at all, hide the comprehensive sidebar too.
            const showFeaturedToggle = settings.filterPanelLayout.showFeatured.value;
            const showComprehensiveToggle = settings.filterPanelLayout.showComprehensive.value;

            const featured = featuredBindings(currentBindings, slots);
            const comprehensive = comprehensiveBindings(currentBindings, slots);

            const featuredOpen = showFeaturedToggle && featured.length > 0;
            const comprehensiveOpen = showComprehensiveToggle && currentBindings.length > 0;

            featuredPanel.setOpen(featuredOpen);
            comprehensivePanel.setOpen(comprehensiveOpen);

            // Featured strip height scales with row count (1 row per dim, cap 3).
            // sizePx is constrained by primitive's min/max but is overridden
            // here on each update so the strip shrinks/grows with bindings.
            const rows = Math.min(FEATURED_MAX_ROWS, Math.max(1, featured.length));
            featuredPanel.element.style.height = featuredOpen ? `${FEATURED_ROW_HEIGHT_PX * rows}px` : "0px";

            featuredStrip.render(featured, slots);
            comprehensivePanelRenderer.render(comprehensive, slots);

            lastDimCount = currentBindings.length;

            // Build local filter map for vm filtering (visual.ts owns the
            // viewmodel; we just expose what's active).
            const activeFilters: Map<string, ReadonlySet<string>> = new Map();
            for (const [k, v] of state.entries()) activeFilters.set(k, v);
            return { activeFilters };
        },
    };

    function _suppressUnused(): void { void lastDimCount; }
    _suppressUnused();
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

function extractSlotSettings(settings: VisualFormattingSettingsModel): FilterSlotSettings[] {
    const fs = settings.filterSlots;
    const result: FilterSlotSettings[] = [];
    const slotRefs = [
        { tier: fs.slot1Tier, mode: fs.slot1Mode, label: fs.slot1Label },
        { tier: fs.slot2Tier, mode: fs.slot2Mode, label: fs.slot2Label },
        { tier: fs.slot3Tier, mode: fs.slot3Mode, label: fs.slot3Label },
        { tier: fs.slot4Tier, mode: fs.slot4Mode, label: fs.slot4Label },
        { tier: fs.slot5Tier, mode: fs.slot5Mode, label: fs.slot5Label },
        { tier: fs.slot6Tier, mode: fs.slot6Mode, label: fs.slot6Label },
        { tier: fs.slot7Tier, mode: fs.slot7Mode, label: fs.slot7Label },
        { tier: fs.slot8Tier, mode: fs.slot8Mode, label: fs.slot8Label },
    ];
    for (const s of slotRefs) {
        const tier = String(s.tier.value.value) as FilterSlotSettings["tier"];
        const mode = String(s.mode.value.value) as FilterSlotSettings["selectionMode"];
        result.push({
            tier: (tier === "featured" || tier === "comprehensive" || tier === "both" || tier === "hidden") ? tier : "comprehensive",
            selectionMode: (mode === "single" || mode === "multi" || mode === "search") ? mode : "multi",
            defaultSelection: "all",
            labelOverride: s.label.value ?? "",
        });
    }
    return result;
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

function pushFilters(
    host: IVisualHost,
    state: FilterState,
    bindings: ReadonlyArray<FilterDimBinding>,
): void {
    // Build IBasicFilter per active dim. Schema per PBI's filter API:
    //   { $schema, target:{ table, column }, operator, values: [...] }
    const byName = new Map(bindings.map(b => [b.dimName, b]));
    const filters: powerbi.IFilter[] = [];
    for (const [dimName, values] of state.entries()) {
        const b = byName.get(dimName);
        if (b === undefined) continue;
        const target = columnTarget(b.columnRef);
        if (target === null) continue;
        const filter = {
            // eslint-disable-next-line powerbi-visuals/no-http-string
            $schema: "http://powerbi.com/product/schema#basic",
            target,
            operator: "In",
            values: Array.from(values),
            filterType: 1,  // FilterType.Basic
        } as unknown as powerbi.IFilter;
        filters.push(filter);
    }
    // FilterAction.merge = 0. Push as ReplaceAll so cleared dims drop their filters.
    // Use number literal (1 = replace) for typing flexibility across SDK versions.
    try {
        host.applyJsonFilter(filters as unknown as powerbi.IFilter, "general", "filter", 1);
    } catch {
        // Some host shapes reject empty arrays; harmless.
    }
}

function persistSelections(host: IVisualHost, state: FilterState): void {
    try {
        host.persistProperties({
            merge: [{
                objectName: "filterPanelLayout",
                selector: undefined as unknown as powerbi.data.Selector,
                properties: { selectionsJson: JSON.stringify(state.toJSON()) },
            }],
        });
    } catch {
        // Harmless — persistence is best-effort; in-memory state still works.
    }
}

interface QualifiedColumn {
    table: string;
    column: string;
}

function columnTarget(col: powerbi.DataViewMetadataColumn): QualifiedColumn | null {
    const qn = col.queryName;
    if (!qn) return null;
    const dot = qn.indexOf(".");
    if (dot < 0) return null;
    return { table: qn.slice(0, dot), column: qn.slice(dot + 1) };
}
