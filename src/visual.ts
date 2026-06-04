"use strict";

import "./../style/visual.less";
import { select as d3Select, Selection as d3Selection } from "d3-selection";

import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import {
    createTooltipServiceWrapper,
    ITooltipServiceWrapper,
} from "powerbi-visuals-utils-tooltiputils";

import { VisualFormattingSettingsModel } from "./settings";
import {
    buildAreaColorMap,
    buildMilestoneConfigMap,
    buildHealthIconMap,
    buildColorContext,
    typeColor,
    ColorContext,
} from "./utils/colors";
import { FontStyle } from "./utils/font";

import { convertDataView, RoadmapViewModel, Activity, Milestone } from "./viewmodel";
import { buildScale, quarterAlignedExtent } from "./utils/dateScale";
import { renderTimeAxis, computeAxisLayout, AxisLayoutInfo, ChevronStyle } from "./render/gantt/timeAxis";
import { renderBars } from "./render/gantt/bars";
import { renderMilestones, renderMilestoneLabels, computeVisibleLabels } from "./render/gantt/milestones";
import { renderSwimlanes } from "./render/gantt/swimlanes";
import { renderBaselineMarkLayer } from "./render/gantt/glidePath";
import { renderMilestoneBaselineGhosts } from "./render/gantt/glide/milestoneBaselineGhost";
import { SlipThresholds, slipToHealthColor, computeSlip } from "./model/activityState";
import {
    renderActivityLabels,
    anyActivityLabelWraps,
    ACTIVITY_LOLLIPOP_MIN_WIDTH,
    ActivityLabelsLayout,
} from "./render/gantt/activityLabels";
import { attachWidthDrag } from "./render/gantt/widthDrag";
import { renderLegend, LEGEND_HEIGHT } from "./render/gantt/legend";
import { renderTimeNow, GridlineStyle } from "./render/gantt/timeNow";

// v2.0 configuration guide module — exported and available for a future
// explicit "show help" toggle from the format pane. Not gating render now.
import { renderConfigurationGuide } from "./configGuide";

// v2.0 simple table renderer — mounts in matrixDiv below the Gantt, reads
// directly from dataView.table.rows (existing v1.8 binding shape) so the
// matrix region is visible IMMEDIATELY without requiring v2.0-specific well
// bindings. The rg-matrix substrate's full render can replace this in
// a later wave once matrix-shaped well bindings are reliably wireable.
import { renderSimpleTable } from "./render/table/simpleTable";

// v2.1 Wave 1 — controls panel chrome (hamburger + slide-in panel).
// Inserts on the LEFT of the visual area. When closed (default first-launch
// state) the panel occupies 0% width and the visual renders IDENTICALLY to
// v2.0. When open, every region's left edge shifts right by panel.widthPct().
import { mountControlsPanel, ControlsPanelHandle } from "./render/controlsPanel";

// v2.1 Wave 1 — vertical splitter between the Gantt region and the table
// region. Replaces the hardcoded 60/40 split with a drag-resize bar that
// has collapse-gantt / reset / collapse-table buttons. Each side has a
// minimum height so the user always sees enough of the collapsed region
// to remember it exists (1 row of content + the splitter bar).
import { mountSplitterBar, SplitterHandle, HiddenMode } from "./render/splitterBar";

// v2.1 audit-fix — top-right hover-revealed controls to fully hide either
// region. Self-recall — same buttons toggle hide/show.
import { mountTopRightControls, TopRightControlsHandle } from "./render/topRightControls";

// v2.1 audit-fix #24 — master time slider strip in the top row of the
// visual, above the Gantt/Table toggles. Auto-envelope derived from
// data extent; window filters milestones (24c) and (in 24b) tear-clips
// activity bars at the window bounds.
import { mountMasterTimeSlider, MasterTimeSliderHandle, MasterScope } from "./render/masterTimeSlider";
import { SliderRange, monthIndex, rangeToWindow, parseSliderRange } from "./render/inspector/timeSliderMath";

// v2.1 W1.5a — selection state model. Drives the controls panel
// (open/close + content). Clicks on selectable elements write to the store;
// the panel + (future) renderers subscribe to react. Root-level click
// handler clears selection when the click hits whitespace.
import { createSelectionStore, SelectionStore, Selection } from "./model/selection";

// v2.1 W1.5c — Inspector content renderers. One pure-DOM function per
// selection kind. Subscriber calls setContent(renderXDetail(...)) before
// setOpen(true) so the panel always has the right detail mounted when
// it slides open.
import { renderLaneDetail } from "./render/inspector/laneDetail";
import { renderActivityDetail } from "./render/inspector/activityDetail";
import { renderMilestoneDetail } from "./render/inspector/milestoneDetail";
import { bindingDisplayName, pluralize } from "./utils/bindingNames";

// v2.2 INF-3739 — two-tier in-visual filter panel (Featured strip + Comprehensive sidebar).
// Both surfaces mount on root and share one FilterState. Owned by FilterPanelController
// which also handles applyJsonFilter pushback + host.persistProperties round-trip.
import { mountFilterPanelController, FilterPanelController } from "./render/filterPanel/controller";

// v2.1 audit-fix #24 — slider + toggles share the top:6 chrome row.
// Just enough push so chart title doesn't render under the chrome.
// Tighter than the original 80px attempt (operator: "minimal").
const MASTER_SLIDER_CHROME_PX = 44;

// v2.1 W1 — initial Gantt/Table split (fraction of usable height given to
// Gantt) before the user drags the splitter or flips a toggle.
const INITIAL_GANTT_PCT = 0.6;
// v2.1 audit-fix #5 — drag minimums removed. Orchestrator: "lets allow
// the drag to go all the way to the bottom to all the way to the top."
// Drag now spans 0% to 100%. Toggle sliders at top-left provide the
// discrete affordance for full hide.
const MIN_GANTT_PX = 0;
const MIN_MATRIX_PX = 0;

const SWIM_LANE_MIN = 100;
// INF-3736 — caps raised from 200/320 to give the new drag handles real
// travel. The widthDrag percent clamps (swim-lane 3-70%, activity-label
// 5-70% in update()) are the user-facing ceilings; these pixel caps are
// the sanity bound for extreme viewports.
const SWIM_LANE_MAX = 800;
const ACTIVITY_LABEL_MIN = 100;
const ACTIVITY_LABEL_MAX = 800;
// INF-3736 — when activity labels will wrap at the current width, the
// 2-line render (cy ± LINE_OFFSET_PX) needs ≥ this row height to clear
// adjacent rows. Single-line keeps the original MIN_ROW_HEIGHT = 16.
const MIN_ROW_HEIGHT_FOR_WRAP = 24;
const OUTER_MARGIN_MIN = 0;
const OUTER_MARGIN_MAX = 80;

const MIN_ROW_HEIGHT = 16;
const MAX_ROW_HEIGHT = 32;
const TARGET_ROW_HEIGHT = 28;

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

function fmtDate(d: Date): string {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface TooltipConfig {
    showNote: boolean;
    hideRowWhenEmpty: boolean;
    emptyPlaceholder: string;
    // v2.2 T2 — bound-field labels. Resolved via bindingDisplayName at
    // call site so a user binding an "Workstream" column to the activity
    // role sees "Workstream" (not "Activity") as the tooltip row label.
    areaLabel: string;
    activityLabel: string;
    // INF-3787 — slip thresholds for the variance narrative in
    // activity tooltips. Same thresholds as the bullet escalation +
    // I-beam render, so the viewer sees consistent magnitude wording.
    slipThresholds: SlipThresholds;
}

// INF-3787 — signed days between two dates (later - earlier).
// Positive = later is after earlier (e.g. forecast after baseline = slipping).
function dayDelta(later: Date, earlier: Date): number {
    return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

function formatSlipNarrative(slipDays: number, magnitude: string): string {
    const sign = slipDays > 0 ? "+" : "";
    const direction =
        magnitude === "negligible" ? "on-track" :
        slipDays > 0              ? `${magnitude} slip` :
                                    `${magnitude} pulled in`;
    return `${sign}${slipDays} days (${direction})`;
}

function makeActivityTooltip(cfg: TooltipConfig): (a: Activity) => VisualTooltipDataItem[] {
    return (a: Activity) => {
        // First item's `header` field renders as the tooltip's title row (bold heading).
        const items: VisualTooltipDataItem[] = [
            { displayName: cfg.areaLabel, value: a.area, header: a.name },
            { displayName: "Start",       value: fmtDate(a.start) },
            { displayName: "End",         value: fmtDate(a.end) },
        ];
        // INF-3787 — variance narrative when baseline/actual bindings present.
        if (a.baselineEnd != null) {
            items.push({ displayName: "Baseline End", value: fmtDate(a.baselineEnd) });
            const slip = computeSlip(a.baselineEnd, a.end, cfg.slipThresholds);
            if (slip != null) {
                items.push({ displayName: "Slip",
                    value: formatSlipNarrative(slip.days, slip.magnitude) });
            }
        }
        if (a.actualStart != null) {
            items.push({ displayName: "Actual Start", value: fmtDate(a.actualStart) });
        }
        if (a.actualEnd != null) {
            items.push({ displayName: "Actual End", value: fmtDate(a.actualEnd) });
        }
        if (cfg.showNote) {
            const hasNote = a.note != null && a.note.trim().length > 0;
            if (hasNote) {
                items.push({ displayName: "Note", value: a.note as string });
            } else if (!cfg.hideRowWhenEmpty) {
                items.push({ displayName: "Note", value: cfg.emptyPlaceholder });
            }
        }
        return items;
    };
}

function makeMilestoneTooltip(cfg: TooltipConfig): (m: Milestone) => VisualTooltipDataItem[] {
    return (m: Milestone) => {
        const headerText = m.label ?? "(unlabeled)";
        const items: VisualTooltipDataItem[] = [
            { displayName: "Type",             value: m.type, header: headerText },
            { displayName: cfg.activityLabel,  value: m.activity },
            { displayName: "Date",             value: fmtDate(m.date) },
        ];
        // INF-3787 — milestone baseline date narrative when bound.
        if (m.baselineDate != null) {
            items.push({ displayName: "Baseline Date", value: fmtDate(m.baselineDate) });
            const shiftDays = dayDelta(m.date, m.baselineDate);
            if (shiftDays !== 0) {
                const sign = shiftDays > 0 ? "+" : "";
                items.push({ displayName: "Shift",
                    value: `${sign}${shiftDays} days (${shiftDays > 0 ? "delayed" : "pulled in"})` });
            }
        }
        if (cfg.showNote) {
            const hasNote = m.note != null && m.note.trim().length > 0;
            if (hasNote) {
                items.push({ displayName: "Note", value: m.note as string });
            } else if (!cfg.hideRowWhenEmpty) {
                items.push({ displayName: "Note", value: cfg.emptyPlaceholder });
            }
        }
        return items;
    };
}

function fontFromCard(card: {
    fontFamily: { value: string };
    fontSize:   { value: number };
    bold:       { value: boolean };
    italic:     { value: boolean };
    underline:  { value: boolean };
}): FontStyle {
    return {
        fontFamily: card.fontFamily.value,
        fontSize:   card.fontSize.value,
        bold:       card.bold.value,
        italic:     card.italic.value,
        underline:  card.underline.value,
    };
}

function milestoneLabelFont(card: {
    labelFontFamily: { value: string };
    labelFontSize:   { value: number };
    labelBold:       { value: boolean };
    labelItalic:     { value: boolean };
    labelUnderline:  { value: boolean };
}): FontStyle {
    return {
        fontFamily: card.labelFontFamily.value,
        fontSize:   card.labelFontSize.value,
        bold:       card.labelBold.value,
        italic:     card.labelItalic.value,
        underline:  card.labelUnderline.value,
    };
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    // v2.0 — matrix render region appended as a sibling of the SVG when
    // table-side wells are bound; hidden by display:none otherwise so the
    // v1.8 SVG-on-root render path is preserved unchanged.
    private matrixDiv: HTMLDivElement;
    // v2.0 — configuration guide region rendered when the v1.8 Gantt's
    // required wells (Activity + Start Date + End Date) aren't bound.
    // Replaces the v1.8 SVG "Bind Activity..." prompt with a richer
    // self-documenting help card.
    private guideDiv: HTMLDivElement;
    // v2.1 W1 — scrollable wrapper around the Gantt SVG. When the activity
    // body would exceed the visible Gantt region height (large datasets
    // squeezed past MIN_ROW_HEIGHT), the SVG grows past the wrapper and
    // rows scroll vertically inside instead of being clipped invisibly.
    private ganttScrollWrapper: HTMLDivElement;
    // v2.1 audit-fix #12 — thin header strip shown ONLY when the Gantt
    // region is fully hidden (toggle off). Carries the chart title so the
    // table-only view still has context. Hidden (display:none) when Gantt
    // is visible (the SVG renders its own title inside the chart).
    private ganttHiddenHeader: HTMLDivElement;
    private svg: d3Selection<SVGSVGElement, unknown, null, undefined>;
    private bgG: d3Selection<SVGGElement, unknown, null, undefined>;
    private axisG: d3Selection<SVGGElement, unknown, null, undefined>;
    private railG: d3Selection<SVGGElement, unknown, null, undefined>;
    private activityLabelsG: d3Selection<SVGGElement, unknown, null, undefined>;
    private labelBgG: d3Selection<SVGGElement, unknown, null, undefined>;
    private bodyG: d3Selection<SVGGElement, unknown, null, undefined>;
    private legendG: d3Selection<SVGGElement, unknown, null, undefined>;
    private chartTitleG: d3Selection<SVGGElement, unknown, null, undefined>;
    // INF-3736 — rendered last so its invisible drag handles paint on top of
    // everything else in their X-range. Hosts the column-boundary resize rects.
    private dragHandlesG: d3Selection<SVGGElement, unknown, null, undefined>;
    private tooltipService: ITooltipServiceWrapper;
    private settingsService: FormattingSettingsService;
    private settings: VisualFormattingSettingsModel;
    // v2.1 W1 — controls panel chrome handle + last-update cache (for re-render
    // when the panel toggles, since PBI's host re-call isn't guaranteed).
    private controls: ControlsPanelHandle;
    // v2.1 W1 — vertical splitter handle owns the Gantt/Table split fraction
    // and collapse mode. Same cached-options re-render pattern as controls.
    private splitter: SplitterHandle;
    // v2.1 audit-fix — top-right hover controls for fully hiding either region.
    private topRight: TopRightControlsHandle;
    // v2.1 audit-fix #24 — master time slider strip (top row, above the
    // Gantt/Table toggles). Drives the WHOLE chart's window. Inspector's
    // own slider stays independent — lane drill-down ignores master.
    private masterSlider: MasterTimeSliderHandle;
    // v2.2 INF-3739 — filter panel controller (top Featured strip + right Comprehensive sidebar).
    private filterPanel: FilterPanelController;
    // Last-known active filter map; visual.ts uses this to narrow vm before render.
    private activeFilters: ReadonlyMap<string, ReadonlySet<string>> = new Map();
    // v2.1 audit-fix #24 — master window state. Default: past 2Q + future
    // 6Q (forward-biased for roadmap use case). Clamped to envelope in
    // update() when data is delivered.
    // INF-3736 — startOffset/endOffset are MONTHS (was: quarters). Default
    // -6/+18 ≈ 2 quarters back, 6 quarters forward (same span as the old default).
    private masterRange: SliderRange = { kind: "range", startOffset: -6, endOffset: 18 };
    // INF-3736 — master slider scope flags. Default: both true (master filters
    // gantt AND table — same effective behavior as v2.1 + the new table path).
    // Persisted on objects.masterTimeSlider.filtersGantt/filtersTable.
    private masterFiltersGantt: boolean = true;
    private masterFiltersTable: boolean = true;
    // INF-3736 — transient column-width preview during drag (live reflow without
    // round-tripping through host.persistProperties on every pointermove). Cleared
    // on pointerup; the final value persists via persistColumnWidth().
    private transientActivityLabelPercent: number | null = null;
    private transientSwimLanePercent: number | null = null;
    // v2.1 W1.5a — selection state store. Single source of truth for what
    // the user has clicked; drives the panel + (future) renderer highlights.
    private selectionStore: SelectionStore;
    // v2.1 W1.5c — last RoadmapViewModel cached from update(). The selection
    // subscriber fires asynchronously (e.g. on a click that happens AFTER an
    // update() returned) and needs the current vm to feed the Inspector
    // renderers. Updated at the top of every update() after convertDataView.
    private lastViewmodel: RoadmapViewModel | null = null;
    // v2.1 audit-fix #8 — per-activity palette color map cached from
    // update(). Built in lane focus mode; passed into Inspector renderers
    // so each card / h3 shows the same color bubble as the Gantt rail.
    private lastActivityColors: Record<string, string> | undefined = undefined;
    // v2.1 audit-fix #17 — milestone-type color map (Major→yellow, Minor→
    // black, etc.) cached for the activity Inspector's milestone gallery
    // tiles, which front each milestone with a type-colored ★.
    private lastTypeColors: Record<string, string> | undefined = undefined;
    // INF-3736 — galleryRange (lane Inspector slider state) removed: master
    // slider with scope toggles now owns all filtering. mountTimeSlider stays
    // in the library; the Inspector no longer mounts it.
    // v2.1 audit-fix #11 — 3-state milestone-type cycle per legend entry.
    // Click sequence: visible → transparent → hidden → visible.
    //   "visible"     → opacity 1, normal render
    //   "transparent" → opacity 0.3 in chart, 0.5 in legend
    //   "hidden"      → opacity 0 in chart + pointer-events none; legend
    //                   entry rendered grey with international disabled
    //                   slash overlay (circle + diagonal line)
    // Absence from the map = "visible" (Map is sparse, only non-default).
    private milestoneTypeState: Map<string, "transparent" | "hidden"> = new Map();
    private lastOptions: VisualUpdateOptions | null = null;
    // INF-3819 — flips true after the first update() applies any persisted
    // splitter hiddenMode to the in-memory splitter. Subsequent updates trust
    // the splitter's in-session state (kept in sync with metadata.objects via
    // persistHiddenMode in the onToggleHidden handler).
    private initialHiddenApplied = false;
    // Chrome transition state — tracks the slicer strip's visibility
    // (= pinnedCount > 0) across update() ticks so we can detect the 0↔1
    // boundary and wrap that one DOM mutation in startViewTransition().
    // Per-tick state changes that don't cross the boundary apply layout
    // synchronously with no animation.
    private lastStripVisible: boolean = false;
    // Skips the View Transition on the very first update() — the fixture
    // can load with pinned dims, and we don't want an animated "boot"
    // from a non-existent zero state into the initial pinned state.
    private firstUpdate: boolean = true;
    // INF-379X — layout context cached from each full update() so the
    // splitter's onLiveDrag fast-path (applyDragLayout) can recompute
    // splitter-affected geometry WITHOUT re-running data conversion,
    // gantt SVG content render, or table HTML render. These four values
    // are stable during a drag (user cannot drag splitter AND resize
    // controls/filter panel simultaneously).
    private lastTopSlicerHeightPx: number = 0;
    private lastPanelWidthPx: number = 0;
    private lastComprehensiveWidthPx: number = 0;
    private lastTableRowsPresent: boolean = false;

    constructor(options?: VisualConstructorOptions) {
        // pbiviz 6.2's auto-generated visualPlugin.ts emits
        // create: (options?: VisualConstructorOptions) per IVisualPlugin's
        // signature; the strict-null check on the call site requires us to
        // accept optional and assert. PBI never actually calls without
        // options at runtime; this is a type-shape adapter, not a defense.
        if (!options) throw new Error("Visual requires VisualConstructorOptions");
        this.host = options.host;
        this.root = options.element;
        this.settingsService = new FormattingSettingsService();
        this.settings = new VisualFormattingSettingsModel();

        // v2.0 — SVG mounts directly on root per the v1.8 pattern, sized via
        // explicit width/height attributes set in update() from viewport dims.
        // The matrix region is appended as a SIBLING of the SVG (also on root)
        // with position:absolute so it can overlay the bottom 40% of root when
        // table-side wells are bound; display:none keeps it out of the layout
        // entirely when unbound, preserving v1.8 render verbatim.
        this.root.style.position = "relative";

        // v2.1 W1 — Gantt SVG mounts inside a scrollable wrapper div. The
        // wrapper owns position:absolute on root (its left/width/height get
        // set in update() from viewport - panelWidthPx and ganttHeightPx).
        // The SVG inside flows in normal block layout with width=100% and a
        // content-fit height set in update() once bodyH is known. When the
        // activity body exceeds the visible region, the SVG grows past the
        // wrapper and overflow-y:auto scrolls rows into view.
        this.ganttScrollWrapper = document.createElement("div");
        this.ganttScrollWrapper.className = "gantt-scroll-wrapper";
        this.ganttScrollWrapper.style.position = "absolute";
        this.ganttScrollWrapper.style.left = "0";
        this.ganttScrollWrapper.style.top = "0";
        this.ganttScrollWrapper.style.width = "100%";
        this.ganttScrollWrapper.style.overflowY = "auto";
        this.ganttScrollWrapper.style.overflowX = "hidden";
        this.root.appendChild(this.ganttScrollWrapper);

        // v2.1 audit-fix #12 — Gantt-hidden header. Initially hidden;
        // shown only when splitter.hiddenMode() === "gantt". Provides a
        // title strip so the table-only view still has visual context.
        this.ganttHiddenHeader = document.createElement("div");
        this.ganttHiddenHeader.className = "gantt-hidden-header";
        this.ganttHiddenHeader.style.cssText = [
            "position:absolute",
            "top:0",
            "left:0",
            "width:100%",
            "height:40px",
            "display:none",
            "align-items:center",
            "justify-content:center",
            "background:#fafafa",
            "border-bottom:1px solid #d0d0d0",
            "box-sizing:border-box",
            "padding:0 16px",
            "font-family:'Segoe UI', system-ui, sans-serif",
            "z-index:7",
        ].join(";");
        this.root.appendChild(this.ganttHiddenHeader);

        this.svg = d3Select(this.ganttScrollWrapper)
            .append("svg")
            .attr("class", "reporting-gantt")
            .attr("width", "100%")
            .attr("height", "100%");

        this.tooltipService = createTooltipServiceWrapper(
            this.host.tooltipService,
            this.root
        );

        this.matrixDiv = document.createElement("div");
        this.matrixDiv.className = "matrix-region";
        this.matrixDiv.style.position = "absolute";
        this.matrixDiv.style.left = "0";
        this.matrixDiv.style.width = "100%";
        this.matrixDiv.style.overflow = "auto";
        this.matrixDiv.style.display = "none";
        this.root.appendChild(this.matrixDiv);

        this.guideDiv = document.createElement("div");
        this.guideDiv.className = "config-guide";
        this.guideDiv.style.position = "absolute";
        this.guideDiv.style.left = "0";
        this.guideDiv.style.top = "0";
        this.guideDiv.style.width = "100%";
        this.guideDiv.style.height = "100%";
        this.guideDiv.style.display = "flex";
        this.guideDiv.style.alignItems = "flex-start";
        this.guideDiv.style.justifyContent = "center";
        this.guideDiv.style.overflow = "auto";
        this.guideDiv.style.background = "#fff";
        this.guideDiv.style.zIndex = "10";
        this.root.appendChild(this.guideDiv);
        renderConfigurationGuide(this.guideDiv, undefined);

        // v2.1 W1.5a — selection store initialization. Created
        // BEFORE the panel so the panel's onDismiss callback can capture it.
        // Initial Selection is "none" → panel starts closed. Persistence +
        // rehydration from objects.selectedActivity happens in W1.5c.
        this.selectionStore = createSelectionStore({ kind: "none" });

        // v2.1 W1.5a — controls panel mounts on root with the new
        // selection-driven API. No hamburger; the × in the panel header
        // fires onDismiss → clear selection → subscriber chain closes the
        // panel. Initial state is closed (kind: "none" matches).
        this.controls = mountControlsPanel(this.root, {
            onDismiss: () => this.selectionStore.set({ kind: "none" }),
            // v2.1 audit-fix #15 — re-render the layout when the user
            // drags the panel's right-edge handle to resize. The layout
            // coordinator reads panel.widthPct() to size the Gantt + table
            // regions; without this callback the panel would resize but
            // the regions wouldn't reflow.
            onWidthChange: () => this.requestRerender(),
        });

        // v2.1 W1.5a + W1.5c — selection store subscriber. For non-none
        // selections, mount the appropriate Inspector layout into the panel
        // BEFORE opening it (so the panel never slides in with stale or
        // empty content). For "none", just close. requestRerender so the
        // layout coordinator recomputes against the new widthPct().
        // onSelect: passed to every Inspector renderer so they can navigate
        // by mutating the same selection store. Clicking an activity row in
        // the lane Inspector fires this, which triggers THIS subscriber
        // again, which swaps content to activityDetail — the panel never
        // closes between navigations.
        const onSelect = (next: Selection): void => {
            this.selectionStore.set(next);
        };
        this.selectionStore.subscribe((sel: Selection) => {
            // v2.1 audit-fix #16 — correct ordering for BOTH layout reflow
            // AND fresh activityColors:
            //   1. setOpen(open ? true : false) — flips state so widthPct()
            //      returns the new value (20% open / 0% closed) when
            //      update() reads it next.
            //   2. requestRerender() — update() lays out Gantt + table
            //      regions against the new widthPct AND populates
            //      lastActivityColors from the lane-focus block.
            //   3. setContent(...) — reads fresh lastActivityColors so
            //      color bubbles render immediately on the FIRST lane click.
            // Audit-fix #14 inverted (1) and (2), which fixed the bubble
            // bug but broke layout (Gantt SVG stayed at left:0 while the
            // panel slid over its labels). This ordering fixes both.
            if (sel.kind === "none") {
                this.controls.setOpen(false);
                this.requestRerender();
            } else {
                this.controls.setOpen(true);
                this.requestRerender();
                if (this.lastViewmodel) {
                    switch (sel.kind) {
                        case "lane":
                            // INF-3736 — lane Inspector no longer mounts its own slider
                            // (master slider with scope toggles owns all filtering).
                            this.controls.setContent(renderLaneDetail(
                                sel.laneName,
                                this.lastViewmodel,
                                onSelect,
                                this.lastActivityColors,
                                // v2.2 T2 + S2 — bound-field nouns for the count
                                // line. Read from lastOptions (the closure can't
                                // capture dataView directly; subscriber fires
                                // after update()).
                                bindingDisplayName("activity", this.lastOptions?.dataViews?.[0], "activity"),
                                "milestone",
                            ));
                            break;
                        case "activity":
                            this.controls.setContent(renderActivityDetail(
                                sel.activityName,
                                this.lastViewmodel,
                                onSelect,
                                this.lastActivityColors,
                                this.lastTypeColors,
                                // INF-3815 — pass Activity Inspector format settings so
                                // the slide-out honors showProgressBar + progressBarSource.
                                {
                                    showProgressBar: this.settings.activityInspector.showProgressBar.value,
                                    progressBarSource: this.settings.activityInspector.progressBarSource.value.value as "auto" | "userField",
                                },
                            ));
                            break;
                        case "milestone":
                            this.controls.setContent(renderMilestoneDetail(
                                sel.milestoneLabel,
                                sel.activityName,
                                this.lastViewmodel,
                                onSelect,
                                this.lastActivityColors,
                                // v2.2 B2 — host.launchUrl is the supported way
                                // to open external URLs from a PBI custom visual.
                                (url: string) => this.host.launchUrl(url),
                                // v2.2 B3 — Health dot palette from the Format
                                // pane's Milestone Health Colors card. Allows
                                // domain-specific overrides of the green/yellow/red.
                                {
                                    green:    this.settings.milestoneHealthColors.green.value.value,
                                    yellow:   this.settings.milestoneHealthColors.yellow.value.value,
                                    red:      this.settings.milestoneHealthColors.red.value.value,
                                    fallback: "#888888",
                                },
                            ));
                            break;
                    }
                }
            }
        });

        // v2.1 W1.5a — root-level whitespace click. Clicks that bubble
        // here (i.e. didn't hit a selectable element with stopPropagation)
        // clear the selection, which closes the panel via the subscriber.
        // Selectable elements added in W1.5b will stopPropagation on their
        // own click handlers. The panel itself also stopPropagation's
        // (set inside mountControlsPanel), so interacting with the panel
        // doesn't dismiss itself.
        this.root.addEventListener("click", () => {
            this.selectionStore.set({ kind: "none" });
        });

        // v2.1 W1 — splitter bar mounts between the Gantt region and the
        // matrix region. Its onChange callback triggers a full re-render so
        // both regions resize against the new ganttHeightPx / matrixHeightPx
        // and the splitter bar itself repositions to the new boundary.
        this.splitter = mountSplitterBar(this.root, {
            initialPct: INITIAL_GANTT_PCT,
            minGanttPx: MIN_GANTT_PX,
            minMatrixPx: MIN_MATRIX_PX,
            // INF-379X followup — drag-frame AND drag-commit both route
            // through requestRerender (full update). The fast-path
            // applyDragLayout() approach was deliberately omitting the
            // gantt SVG content render, which left swim-lane row heights
            // locked at pre-drag values — operator: "swim lanes appear
            // to be a static size while they were previously expanding
            // and contracting." Full update on each rAF frame restores
            // the live row-reflow; the rAF coalesce + .splitter-dragging
            // CSS-transition-disable rule give us 60fps tracking as long
            // as update() completes in <16ms (well within budget on the
            // fixture). On very large datasets where update() exceeds
            // 16ms, frame rate gracefully degrades — Track A's vertical-
            // stack rebuild is the long-term path to constant-time drag.
            onChange: () => this.requestRerender(),
        });

        // v2.2 INF-3739 — filter panel controller mounted BEFORE topRight so the
        // filter-icon (leftmost in topRight) can read isOpen / activeCount at
        // construction. Selection-driven: starts closed; opens via icon click.
        this.filterPanel = mountFilterPanelController(this.root, {
            host: this.host,
            onChange: () => {
                this.topRight.refresh();
                this.requestRerender();
            },
        });

        // v2.1 audit-fix — top-left cluster of Roadmap / Table toggle sliders.
        // v2.2 INF-3739 — leads with a filter icon that toggles the filter
        // sidebar; badge surfaces active-filter count even when sidebar is closed.
        this.topRight = mountTopRightControls(this.root, {
            isHidden: (region) => this.splitter.hiddenMode() === region,
            onToggleHidden: (region) => {
                const next = this.splitter.hiddenMode() === region ? "none" : region;
                this.splitter.setHidden(next);
                // INF-3819 — persist the splitter choice so toggle-off survives
                // reload + publish. Mirrors the slider/column-width persist
                // pattern further down this file.
                this.persistHiddenMode(next);
                this.topRight.refresh();
            },
            onToggleFilter: () => {
                this.filterPanel.toggleOpen();
                this.topRight.refresh();
            },
            getFilterActiveCount: () => this.filterPanel.activeCount(),
            isFilterOpen: () => this.filterPanel.isOpen(),
        });

        // v2.1 audit-fix #24 — master time slider mounts on root above the
        // Gantt/Table toggles. onChange updates masterRange and triggers a
        // full re-render so milestones (24c) and activity tears (24b)
        // recompute against the new window.
        this.masterSlider = mountMasterTimeSlider(this.root, {
            onChange: (next: SliderRange) => {
                this.masterRange = next;
                this.persistSliderRange("masterTimeSlider", next);
                this.requestRerender();
            },
            // INF-3736 — scope toggles. User picks which regions the filter applies to.
            onScopeChange: (next: MasterScope) => {
                this.masterFiltersGantt = next.filtersGantt;
                this.masterFiltersTable = next.filtersTable;
                this.persistMasterScope(next);
                this.requestRerender();
            },
        });

        this.bgG = this.svg.append("g").attr("class", "background-layer");
        this.axisG = this.svg.append("g").attr("class", "time-axis");
        this.railG = this.svg.append("g").attr("class", "swimlane-rail-group");
        this.activityLabelsG = this.svg.append("g").attr("class", "activity-labels");
        this.labelBgG = this.svg.append("g").attr("class", "label-backgrounds");
        this.bodyG = this.svg.append("g").attr("class", "body");
        this.legendG = this.svg.append("g").attr("class", "legend");
        this.chartTitleG = this.svg.append("g").attr("class", "chart-title");
        // INF-3736 — appended LAST so invisible drag handles paint above all
        // other layers in their narrow X-range, winning the hit-test.
        this.dragHandlesG = this.svg.append("g").attr("class", "drag-handles");
    }

    public update(options: VisualUpdateOptions): void {
        // v2.1 W1 — stash the last options so the controls-panel onToggle
        // callback can re-invoke update() with the same dataView/viewport
        // when the panel opens/closes (PBI host isn't guaranteed to re-call
        // update() on a pure DOM toggle).
        this.lastOptions = options;

        const dataView = options.dataViews && options.dataViews[0];

        this.settings = this.settingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            dataView
        );

        // INF-3819 — on first update, honor any previously-persisted splitter
        // hiddenMode. The splitter's in-memory default is "none"; the persisted
        // value lives in dataView.metadata.objects.ganttLayout.hiddenMode and
        // is populated into settings.ganttLayout.hiddenMode by the line above.
        // Apply ONLY on first update — subsequent updates trust the splitter's
        // in-session state (which the persist call inside onToggleHidden keeps
        // in sync with metadata for the next reload).
        if (!this.initialHiddenApplied) {
            const persistedHidden = this.settings.layout.hiddenMode.value.value as HiddenMode;
            if (persistedHidden !== this.splitter.hiddenMode()) {
                this.splitter.setHidden(persistedHidden);
                this.topRight.refresh();
            }
            this.initialHiddenApplied = true;
        }

        // v2.2 INF-3739 — drive both filter panels off the same FilterState.
        // Returns the active filter map; visual.ts uses it to narrow the vm
        // BEFORE rendering, in addition to PBI's cross-visual applyJsonFilter
        // pushback (which the controller fires on every state mutation).
        const filterResult = this.filterPanel.update(dataView, this.settings);
        this.activeFilters = filterResult.activeFilters;

        // INF-3736 — drag-resize reconcile: once persisted settings catch up
        // to the transient drag value, retire the transient. Bridges pointerup
        // → host.persistProperties round-trip without flicker.
        if (this.transientSwimLanePercent !== null &&
            Math.abs(this.settings.swimlanes.swimLaneWidthPercent.value - this.transientSwimLanePercent) < 0.01) {
            this.transientSwimLanePercent = null;
        }
        if (this.transientActivityLabelPercent !== null &&
            Math.abs(this.settings.activityLabels.activityLabelWidthPercent.value - this.transientActivityLabelPercent) < 0.01) {
            this.transientActivityLabelPercent = null;
        }

        // v2.0 configuration guide — kept hidden by default. The earlier
        // Wave 4 gate (early-return on !ganttRequirementsMet) was wrong:
        // PBI calls update() with empty-data dataViews during the pre-
        // refresh state where bindings exist in visual.json but data has
        // not been delivered yet, and the gate incorrectly treated that
        // as "wells unbound" — blocking v1.8's own empty-state render
        // path. The fix: always let v1.8 render (it handles empty data
        // gracefully), and reserve the guide for a less-aggressive use.
        // The guide module is still exported and available for a future
        // explicit "show help" toggle from the format pane.
        this.guideDiv.style.display = "none";

        // v2.1 W1 — controls panel offset. When the panel is open, the panel
        // reserves widthPct() of root on the LEFT; every other region's left
        // edge shifts right by panelWidthPx and its width shrinks accordingly.
        // When the panel is closed (default first-launch state), widthPct() is
        // 0, panelWidthPx is 0, and the v2.0 render is preserved byte-identical.
        const panelWidthPct = this.controls.widthPct();
        const panelWidthPx = options.viewport.width * (panelWidthPct / 100);
        // INF-3736 — master slider now self-positions (top:6 right:6 anchor,
        // expands leftward from a time-filter icon). No external sizing needed.

        // v2.2 INF-3739 — comprehensive filter sidebar reserves N px on the right
        // FULL VERTICAL HEIGHT (top:0 to viewport.height). The master-slider
        // strip and chart and table all narrow to leave the sidebar's column
        // free. The top slicer strip mounts in its OWN dedicated container at
        // top:0; the existing chrome (toggles + master slider) is pushed down
        // by the slicer's total height so nothing overlaps.
        const comprehensiveWidthPx = this.filterPanel.widthPx();
        this.masterSlider.setRightReserve(comprehensiveWidthPx);

        // === Chrome transition: pure CSS ===
        //
        // INF-3751: simplified from View Transitions API to plain CSS
        // transitions on layout properties. Three motions are choreographed
        // by CSS in visual.less:
        //   - toggle row's `top` (6 ↔ 6+stripH)         — CSS transition
        //   - master slider's `top` (6 ↔ 6+stripH)      — CSS transition
        //   - slicer strip's `max-width` + `opacity`    — CSS transition
        //
        // Direction class (.opening / .closing) is applied to
        // documentElement BEFORE the DOM mutations so visual.less can
        // sequence the two phases via `transition-delay`:
        //   .opening : row drops first → strip slides out 1050ms later
        //   .closing : strip retracts first → row rises 1050ms later
        // Class is removed after the longest transition completes (~2100ms).
        //
        // Funnel is anchored at top:6 left:6 on root with no transition or
        // view-transition-name — it never moves.
        const stripVisible = this.filterPanel.pinnedCount() > 0;
        const isTransition = !this.firstUpdate && stripVisible !== this.lastStripVisible;
        this.lastStripVisible = stripVisible;
        this.firstUpdate = false;

        if (isTransition) {
            const direction = stripVisible ? "opening" : "closing";
            const root = document.documentElement;
            root.classList.add(direction);
            // Force a style recalc so the .opening / .closing rules match
            // against the upcoming property changes in filterPanel.layout()
            // BELOW. Without this, the browser may use the prior style
            // cache (no class) when the strip's clip-path / row's top
            // change, and the directional transition-delay rules in
            // visual.less wouldn't apply — manifests as "the strip
            // appears before the row moves" because the delay was lost.
            void root.offsetHeight;
            // Clear after the longest possible animation completes (phase 1
            // 1000ms + buffer 50ms + phase 2 1000ms + safety margin).
            window.setTimeout(() => {
                root.classList.remove(direction);
            }, 2200);
        }

        this.filterPanel.layout({
            viewportWidth: options.viewport.width,
            viewportHeight: options.viewport.height,
        });
        // INF-3751: on closing direction (unpin-last), the strip keeps its
        // content + height for 1050ms so the clip-path wipe is visible.
        // During this window, slicerContainer.offsetHeight is still ~36
        // (strip min-height + padding-bottom). If we read offsetHeight
        // here, row/slider/chart would stay at top:42 throughout the wipe.
        // Force topSlicerHeightPx=0 when stripVisible is false so the row
        // + slider + chart's `top` transitions immediately to their
        // post-collapse positions, riding upward in parallel with the
        // clip-path wipe. Brief content overlap during transit is
        // accepted — z-index ordering puts toggle-row chrome above the
        // strip's residual content.
        const topSlicerHeightPx = stripVisible ? this.filterPanel.topSlicerHeightPx() : 0;
        this.masterSlider.setTopOffset(topSlicerHeightPx);
        this.topRight.setTopOffset(topSlicerHeightPx);

        // v2.1 audit-fix #8 — vm + focused-lane + activityColors computed
        // EARLY so the layout coordinator (which calls renderSimpleTable for
        // the table region) can read the tint maps. Originally these lived
        // after the layout coordinator, but the table render needs them.
        // v2.2 INF-3739 — narrow dataView UPSTREAM of convertDataView so both
        // the chart (vm) AND the table (renderSimpleTable, which reads dataView
        // directly) see the same filtered row set. In real reports,
        // host.applyJsonFilter pushback re-queries upstream and this narrow is
        // a near-noop; in fixture mode it's the only thing that filters.
        // Empty swim lanes collapse automatically because convertDataView
        // builds areaGroups from rows present — drop a lane's activities and
        // the lane disappears from vm.areaGroups.
        const effectiveDataView = narrowDataView(dataView, this.activeFilters);
        let vm: RoadmapViewModel = convertDataView(effectiveDataView);

        // INF-3736 — restore persisted master slider state from PBI objects bag.
        // Null-safe through the whole optional chain; any missing layer OR
        // JSON.parse failure OR shape-mismatch falls back silently to the
        // existing in-memory defaults (no console noise). The window itself
        // is JSON-stringified because the discriminated-union SliderRange
        // doesn't flatten to PBI's properties bag; the scope booleans are
        // native bool properties.
        const objs = dataView?.metadata?.objects as
            | { masterTimeSlider?: { windowJson?: string; filtersGantt?: boolean; filtersTable?: boolean } }
            | undefined;
        const masterJson = objs?.masterTimeSlider?.windowJson;
        if (typeof masterJson === "string") {
            const parsed = parseSliderRange(masterJson);
            if (parsed) this.masterRange = parsed;
        }
        if (typeof objs?.masterTimeSlider?.filtersGantt === "boolean") {
            this.masterFiltersGantt = objs.masterTimeSlider.filtersGantt;
        }
        if (typeof objs?.masterTimeSlider?.filtersTable === "boolean") {
            this.masterFiltersTable = objs.masterTimeSlider.filtersTable;
        }

        // INF-3736 — master slider envelope in MONTHS (was: quarters).
        // pastMonths = today.idx − extentStart.idx; futureMonths = extentEnd.idx
        // − today.idx. Both clamped to ≥0 so an extent entirely in the future
        // doesn't create a negative-past slider. Stored range clamped to
        // envelope so older persisted ranges don't fall outside current ticks.
        const today = new Date();
        const todayMI = monthIndex(today);
        const pastMonths = Math.max(0, todayMI - monthIndex(vm.dateExtent[0]));
        const futureMonths = Math.max(0, monthIndex(vm.dateExtent[1]) - todayMI);
        if (this.masterRange.kind === "range") {
            const lo = -pastMonths;
            const hi = futureMonths;
            const s = Math.max(lo, Math.min(hi, this.masterRange.startOffset));
            const e = Math.max(lo, Math.min(hi, this.masterRange.endOffset));
            if (s !== this.masterRange.startOffset || e !== this.masterRange.endOffset) {
                this.masterRange = { kind: "range", startOffset: s, endOffset: e };
            }
        }
        this.masterSlider.update(
            { pastMonths, futureMonths },
            this.masterRange,
            { filtersGantt: this.masterFiltersGantt, filtersTable: this.masterFiltersTable },
        );
        // INF-3736 — hide the entire anchor (icon + strip) only when there's no
        // useful target region at all (both regions hidden). Otherwise the icon
        // stays visible so the user can always re-expand. Scope-based collapse
        // to icon is handled inside masterTimeSlider via applyAutoCollapse().
        const ganttVisible = this.splitter.hiddenMode() !== "gantt";
        const tableVisible = this.splitter.hiddenMode() !== "table";
        this.masterSlider.setVisible(ganttVisible || tableVisible);

        // v2.1 audit-fix #24b — master window applied to vm BEFORE lane
        // focus so the chart axis (xScale from vm.dateExtent), activities,
        // and milestones all narrow to the slider's window in one pass.
        //  - Activities fully outside window: dropped.
        //  - Activities partially in window: start/end clamped to window
        //    bounds (visual flat-clip; zigzag tear lands in a follow-up).
        //  - Milestones outside window: dropped (no marker rendered).
        //  - vm.dateExtent overridden to window so xScale fits exactly.
        const masterWindow = rangeToWindow(this.masterRange, today);
        // INF-3736 — apply window to chart vm only when scope includes Gantt.
        if (masterWindow && this.masterFiltersGantt) {
            const fromMs = masterWindow.fromMs;
            const toMs = masterWindow.toMs;
            const windowedActivities = vm.activities
                .filter(a => a.end.getTime() >= fromMs && a.start.getTime() <= toMs)
                .map(a => {
                    const startMs = a.start.getTime();
                    const endMs = a.end.getTime();
                    if (startMs >= fromMs && endMs <= toMs) return a;
                    return {
                        ...a,
                        start: startMs < fromMs ? new Date(fromMs) : a.start,
                        end: endMs > toMs ? new Date(toMs) : a.end,
                    };
                });
            const windowedMilestones = vm.milestones.filter(m => {
                const t = m.date.getTime();
                return t >= fromMs && t <= toMs;
            });
            vm = {
                ...vm,
                activities: windowedActivities,
                milestones: windowedMilestones,
                dateExtent: [new Date(fromMs), new Date(toMs)] as [Date, Date],
            };
        }

        // Focused lane derived from current selection:
        //   kind=lane     → sel.laneName
        //   kind=activity → activity.area lookup
        //   kind=milestone→ milestone.activity → activity.area lookup
        const selForFocus = this.selectionStore.get();
        let focusedLaneName: string | null = null;
        if (selForFocus.kind === "lane") {
            focusedLaneName = selForFocus.laneName;
        } else if (selForFocus.kind === "activity") {
            focusedLaneName = vm.activities.find(a => a.name === selForFocus.activityName)?.area ?? null;
        } else if (selForFocus.kind === "milestone") {
            const m = vm.milestones.find(mm =>
                (mm.label ?? "(unlabeled)") === selForFocus.milestoneLabel &&
                mm.activity === selForFocus.activityName);
            focusedLaneName = m ? (vm.activities.find(a => a.name === m.activity)?.area ?? null) : null;
        }

        const ACTIVITY_PALETTE = [
            "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
            "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
        ];

        let activityColors: Record<string, string> | undefined;
        if (focusedLaneName != null) {
            const oldToNewIndex = new Map<string, number>();
            const filteredActivities = vm.activities
                .filter(a => a.area === focusedLaneName)
                .map((a, i) => {
                    oldToNewIndex.set(a.name, i);
                    return { ...a, index: i };
                });
            const activityNames = new Set(filteredActivities.map(a => a.name));
            const filteredMilestones = vm.milestones
                .filter(m => activityNames.has(m.activity))
                .map(m => ({ ...m, parentRowIndex: oldToNewIndex.get(m.activity) ?? -1 }));
            const filteredAreaGroups = filteredActivities.length > 0 ? [{
                area: focusedLaneName,
                startRowIndex: 0,
                endRowIndex: filteredActivities.length - 1,
            }] : [];
            vm = {
                ...vm,
                activities: filteredActivities,
                milestones: filteredMilestones,
                areaGroups: filteredAreaGroups,
            };

            activityColors = {};
            filteredActivities.forEach((a, i) => {
                activityColors![a.name] = ACTIVITY_PALETTE[i % ACTIVITY_PALETTE.length];
            });
        }

        this.lastViewmodel = vm;
        this.lastActivityColors = activityColors;

        // INF-3736 — inspector slider removed; master slider's filtersTable
        // scope now drives the table window. The table-filter wiring is
        // applied in the renderSimpleTable call below.

        const areaColorMap = buildAreaColorMap(vm.areaBindings, this.settings.swimlanes);
        const milestoneConfig = buildMilestoneConfigMap(vm.typeBindings, this.settings.milestones);
        // v2.2 INF-3738 V3 — per-value health icon map. Loop-invariant;
        // built once per render from healthBindings × static slot settings.
        // Matches swim-lane / milestone-type buildXMap shape.
        const healthIconMap = buildHealthIconMap(vm.healthBindings, this.settings.activityHealthIcons);
        const colors: ColorContext = buildColorContext(areaColorMap, milestoneConfig, activityColors);

        // v2.1 audit-fix #17 — milestone-type color map for the activity
        // Inspector's milestone gallery tiles. Cached so the subscriber's
        // setContent can read it on the next click without an extra
        // colors-context dependency.
        const typeColors: Record<string, string> = {};
        for (const t of vm.distinctTypes) {
            typeColors[t] = typeColor(t, colors);
        }
        this.lastTypeColors = typeColors;

        // v2.1 W1 — layout coordinator now defers Gantt/Table height to the
        // splitter handle (initial 60/40, draggable, collapsible). When the
        // v1.8 wells are unbound the table region isn't rendered and the
        // splitter bar hides — Gantt occupies the full viewport height as
        // in v2.0. When bound, the splitter sits between the regions and
        // its barHeightPx() is taken out of the available height so the
        // bar itself never overlaps either region's content.
        const tableRowsPresent = !!(dataView?.table?.rows?.length);
        this.splitter.setVisible(tableRowsPresent);
        // INF-3768+3772: REVERSES the prior INF-3759 "matrix-stays-constant"
        // architecture per operator's clarified UX intent: gantt + matrix
        // share the below-strip viewport and divide proportionally at the
        // splitter's userPct ratio. As the slicer strip grows, BOTH shrink
        // proportionally — matching operator's "same container, divide by
        // percent" intent. Track A's vertical-stack rebuild (INF-3769) will
        // refactor this surface; this surgical fix gets the behavior
        // correct in the meantime.
        // Sum invariant: topSlicer + gantt + bar + matrix === viewport.
        const splitterViewportHeight = Math.max(0, options.viewport.height - topSlicerHeightPx);
        // INF-3768: bar height counted only when the table region is bound
        // (otherwise the bar is hidden via setVisible(false) and reserves
        // no real estate — keeps the sum invariant exact at unbound state).
        const splitterBarHeightPx = tableRowsPresent ? this.splitter.barHeightPx() : 0;
        const ganttHeightPx = tableRowsPresent
            ? this.splitter.ganttHeightPx(splitterViewportHeight)
            : splitterViewportHeight;
        const matrixHeightPx = tableRowsPresent
            ? this.splitter.matrixHeightPx(splitterViewportHeight)
            : 0;

        // INF-379X — cache the layout context that applyDragLayout()
        // needs to recompute splitter geometry without a full update().
        // These four are stable during a drag (user cannot simultaneously
        // drag splitter AND resize controls/filter panel).
        this.lastTopSlicerHeightPx = topSlicerHeightPx;
        this.lastPanelWidthPx = panelWidthPx;
        this.lastComprehensiveWidthPx = comprehensiveWidthPx;
        this.lastTableRowsPresent = tableRowsPresent;

        // INF-3779 — push the inspector / controls popout down below the
        // slicer + chrome row; let it span from there to the viewport
        // bottom. Full left-rail surface covering gantt + splitter +
        // matrix regions — operator-aligned behavior; restores the
        // pre-clip-to-gantt span that existed before an earlier
        // audit-fix introduced the artificial gantt-bottom clip.
        this.controls.setVerticalBounds(
            topSlicerHeightPx,
            Math.max(0, options.viewport.height - topSlicerHeightPx),
        );

        // v2.1 audit-fix #12 — when Gantt is fully hidden via the top-left
        // toggle, render a thin header strip with the chart title so the
        // table-only view still has visual context. Adjust matrix top to
        // sit below the header.
        const ganttHiddenHeaderPx = this.splitter.hiddenMode() === "gantt" ? 40 : 0;
        // audit-fix #24c — when ONLY the table is visible (Gantt toggled off),
        // the table region underlaps the master slider chrome row. Push the
        // gantt-hidden header AND the matrix region down by the chrome reserve.
        const ganttHiddenChromePush = this.splitter.hiddenMode() === "gantt" ? MASTER_SLIDER_CHROME_PX : 0;
        if (ganttHiddenHeaderPx > 0) {
            const ct = this.settings.chartTitle;
            const ctText = (ct.text.value ?? "").trim();
            const displayText = (ct.show.value && ctText.length > 0) ? ctText : "(Gantt hidden)";
            this.ganttHiddenHeader.textContent = displayText;
            this.ganttHiddenHeader.style.display = "flex";
            this.ganttHiddenHeader.style.top = (topSlicerHeightPx + ganttHiddenChromePush) + "px";
            this.ganttHiddenHeader.style.left = panelWidthPx + "px";
            // v2.2 INF-3739 — reserve comprehensive sidebar width on the right.
            this.ganttHiddenHeader.style.width = Math.max(0, options.viewport.width - panelWidthPx - comprehensiveWidthPx) + "px";
            this.ganttHiddenHeader.style.color = ct.show.value ? ct.fontColor.value.value : "#666";
            this.ganttHiddenHeader.style.fontSize = (ct.fontSize.value ?? 14) + "px";
            this.ganttHiddenHeader.style.fontWeight = ct.bold.value ? "bold" : "600";
            this.ganttHiddenHeader.style.fontStyle = ct.italic.value ? "italic" : "normal";
            this.ganttHiddenHeader.style.textDecoration = ct.underline.value ? "underline" : "none";
            const align = (ct.alignment.value.value as "left" | "center" | "right") || "center";
            this.ganttHiddenHeader.style.justifyContent =
                align === "left" ? "flex-start" :
                align === "right" ? "flex-end" : "center";
        } else {
            this.ganttHiddenHeader.style.display = "none";
        }

        if (tableRowsPresent) {
            // INF-3772: splitter bar sits AT y = topSlicer + ganttHeightPx —
            // directly between gantt-wrapper bottom and matrix top. Pre-fix
            // used `ganttHeightPx` alone, missing the topSlicer offset, so
            // the bar visually occluded the bottom topSlicer-px of gantt
            // content (z-index:6) and left a topSlicer-sized gap above the
            // matrix. Matrix top calculation at line 1001 already accounts
            // for both offsets (topSlicer + ganttHeightPx + bar) so no
            // change needed there.
            this.splitter.layout({
                leftPx: panelWidthPx,
                topPx: topSlicerHeightPx + ganttHeightPx,
                widthPx: options.viewport.width - panelWidthPx,
            });
            this.matrixDiv.style.display = "block";
            // INF-3768 (followup) — anchor the matrix BOTTOM to viewport
            // bottom (bottom:0); height auto-derives from top+bottom in
            // position:absolute. Pre-fix used top + height — during a
            // splitter drag the height was recomputed every rAF tick,
            // briefly showing the matrix shrink from the bottom before
            // snapping back to fill. Anchored bottom = no transient
            // resize, since the bottom y-coord is invariant at 0.
            // v2.1 audit-fix #12 + #24c — Gantt-hidden header + chrome
            // reserve still push the matrix TOP down; bottom stays put.
            this.matrixDiv.style.top = (topSlicerHeightPx + ganttHeightPx + splitterBarHeightPx + ganttHiddenHeaderPx + ganttHiddenChromePush) + "px";
            this.matrixDiv.style.bottom = "0px";
            this.matrixDiv.style.height = "auto";
            this.matrixDiv.style.left = panelWidthPx + "px";
            // v2.2 INF-3739 — reserve comprehensive sidebar width on the right.
            this.matrixDiv.style.width = Math.max(0, options.viewport.width - panelWidthPx - comprehensiveWidthPx) + "px";
            this.matrixDiv.style.background = "#ffffff";
            // The splitter bar's top/bottom borders replace the matrix
            // region's prior border-top — removing the doubled divider.
            this.matrixDiv.style.borderTop = "none";
            // v2.1 W1.5b + audit-fix — table row click + selection-driven
            // filter + highlight. Derive both from current selection:
            //   kind=lane     → filter to that area; no row highlight
            //   kind=activity → filter to that activity name; highlight it
            //   kind=milestone→ filter to milestone's activity; highlight it
            //   kind=none     → no filter, no highlight
            const sel = this.selectionStore.get();
            let filterActivityNames: readonly string[] | undefined;
            let filterAreaNames: readonly string[] | undefined;
            let highlightActivityName: string | undefined;
            if (sel.kind === "lane") {
                filterAreaNames = [sel.laneName];
            } else if (sel.kind === "activity") {
                filterActivityNames = [sel.activityName];
                highlightActivityName = sel.activityName;
            } else if (sel.kind === "milestone") {
                filterActivityNames = [sel.activityName];
                highlightActivityName = sel.activityName;
            }
            // v2.1 audit-fix #8 — row tinting:
            //   lane focus → tint by activity palette color (rowTintByActivity)
            //   default    → tint by lane/area color (rowTintByArea)
            // Alternating low/high opacity inside simpleTable creates band
            // texture without big solid color blocks.
            const rowTintByActivity = activityColors;
            const rowTintByArea = focusedLaneName != null ? undefined : areaColorMap;
            renderSimpleTable(this.matrixDiv, effectiveDataView, {
                onSelectActivity: (activityName: string) => {
                    this.selectionStore.set({ kind: "activity", activityName });
                },
                filterActivityNames,
                filterAreaNames,
                highlightActivityName,
                rowTintByActivity,
                rowTintByArea,
                // INF-3736 — master slider's filtersTable scope drives table window.
                filterMilestoneDateMs: (masterWindow && this.masterFiltersTable) ? masterWindow : undefined,
            });
        } else {
            this.matrixDiv.style.display = "none";
        }

        const viewport = options.viewport;
        // v2.2 INF-3739 — width also reserves comprehensive sidebar on the right.
        const width = Math.max(0, viewport.width - panelWidthPx - comprehensiveWidthPx);
        // v2.1 audit-fix #24c — wrapper starts BELOW the slider chrome so
        // when the SVG content scrolls vertically it gets clipped at the
        // chrome boundary (was: content scrolled up behind the transparent
        // slider strip). Only push when gantt is visible.
        // v2.2 INF-3739 — additional push for any pinned top-slicer-strip rows.
        const wrapperChromeOffset = (ganttHeightPx > 0 ? MASTER_SLIDER_CHROME_PX : 0) + topSlicerHeightPx;
        // INF-3759 fix: wrapper HEIGHT subtracts only the slider chrome,
        // not topSlicer. topSlicer is already accounted for outside the
        // gantt region (it lives ABOVE the gantt region's top, not inside
        // it). Subtracting it from height too creates a topSlicer-sized
        // whitespace gap between the gantt wrapper bottom and the splitter
        // bar that grows linearly each time the strip flex-wraps.
        const wrapperHeightSubtract = (ganttHeightPx > 0 ? MASTER_SLIDER_CHROME_PX : 0);
        const height = Math.max(0, ganttHeightPx - wrapperHeightSubtract);

        this.ganttScrollWrapper.style.left = panelWidthPx + "px";
        this.ganttScrollWrapper.style.top = wrapperChromeOffset + "px";
        this.ganttScrollWrapper.style.width = width + "px";
        this.ganttScrollWrapper.style.height = height + "px";
        this.svg.attr("width", width).attr("height", height);

        // vm + focused-lane + activityColors block moved earlier (right after
        // panelWidthPx) so the table render can access activityColors /
        // areaColorMap for row tinting.

        // Override SwimlanesCard slot color displayNames from bound area names so the
        // Format pane shows actual data values ("Tech Modernization" not "Slot 1 color").
        // Hide unused slot color pickers (visible: false) so Format pane stays tidy.
        const sw = this.settings.swimlanes;
        const swSlots = [sw.slot1Color, sw.slot2Color, sw.slot3Color, sw.slot4Color,
                         sw.slot5Color, sw.slot6Color, sw.slot7Color, sw.slot8Color];
        for (let i = 0; i < swSlots.length; i++) {
            const binding = vm.areaBindings[i];
            if (binding) {
                swSlots[i].visible = true;
                swSlots[i].displayName = binding.areaName;
            } else {
                swSlots[i].visible = false;
            }
        }

        // Override MilestonesCard type1/type2 GROUP displayNames from bound type names —
        // the GROUP becomes the user-facing label (e.g., "Capability Enabler" as the
        // collapsible subsection title). Individual slice displayNames inside the group
        // are short ("Color", "Symbol", "Size (px)", "Show markers", "Show labels").
        const mc = this.settings.milestones;
        const slot1Type = vm.typeBindings[0]?.typeName;
        const slot2Type = vm.typeBindings[1]?.typeName;
        mc.type1Group.visible = slot1Type != null;
        if (slot1Type) mc.type1Group.displayName = slot1Type;
        mc.type2Group.visible = slot2Type != null;
        if (slot2Type) mc.type2Group.displayName = slot2Type;
        // Hide marker-controls individually too (extra safety for cap-1 data scenarios)
        const hideIfNoType = (slot: "type1" | "type2", hasType: boolean) => {
            const visible = hasType;
            mc[`${slot}Color`].visible = visible;
            mc[`${slot}Symbol`].visible = visible;
            mc[`${slot}Size`].visible = visible;
            mc[`${slot}ShowMarker`].visible = visible;
        };
        hideIfNoType("type1", slot1Type != null);
        hideIfNoType("type2", slot2Type != null);

        // v2.2 INF-3738 V3 — Override ActivityHealthIconsCard slot
        // displayNames from bound health values so the Format pane shows
        // actual data values ("Production symbol" not "Slot 1 symbol").
        // Hide unused slots so the Format pane stays tidy and only exposes
        // slots for values present in the user's data. Same pattern as the
        // swim-lane slot color displayName overrides above.
        const ahi = this.settings.activityHealthIcons;
        const ahiTriples = [
            [ahi.slot1Symbol, ahi.slot1Color, ahi.slot1Size],
            [ahi.slot2Symbol, ahi.slot2Color, ahi.slot2Size],
            [ahi.slot3Symbol, ahi.slot3Color, ahi.slot3Size],
            [ahi.slot4Symbol, ahi.slot4Color, ahi.slot4Size],
            [ahi.slot5Symbol, ahi.slot5Color, ahi.slot5Size],
        ];
        for (let i = 0; i < ahiTriples.length; i++) {
            const binding = vm.healthBindings[i];
            const triple = ahiTriples[i];
            const sym = triple[0];
            const col = triple[1];
            const sz  = triple[2];
            if (binding) {
                sym.visible = true; col.visible = true; sz.visible = true;
                sym.displayName = `${binding.healthValue} symbol`;
                col.displayName = `${binding.healthValue} color`;
                sz.displayName  = `${binding.healthValue} size (px)`;
            } else {
                sym.visible = false; col.visible = false; sz.visible = false;
            }
        }

        // ── Outer margins ─────────────────────────────────────────────────────
        // audit-fix #24c — wrapper top now carries the chrome offset (see
        // wrapperChromeOffset above), so topMarginPx is back to the user's
        // natural value. Avoids double-pushing the chart title.
        const topMarginPx    = clamp(width * (this.settings.layout.topMarginPercent.value    / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const bottomMarginPx = clamp(width * (this.settings.layout.bottomMarginPercent.value / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const leftMarginPx   = clamp(width * (this.settings.layout.leftMarginPercent.value   / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const rightMarginPx  = clamp(width * (this.settings.layout.rightMarginPercent.value  / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);

        // ── Chart Title (custom) ─────────────────────────────────────────────
        // Renders inside the SVG viewport at the top. Independent from PBI's
        // built-in platform Title (which can be hidden via Format pane → Title → Show off).
        this.chartTitleG.selectAll("*").remove();
        let chartTitleHeight = 0;
        const ct = this.settings.chartTitle;
        const ctText = (ct.text.value ?? "").trim();
        if (ct.show.value && ctText.length > 0) {
            const ctFontSize = ct.fontSize.value;
            const ctPaddingY = 8;
            chartTitleHeight = ctFontSize + ctPaddingY * 2;
            const ctAlignment = ct.alignment.value.value as "left" | "center" | "right";
            const ctAnchor =
                ctAlignment === "left"  ? "start" :
                ctAlignment === "right" ? "end"   : "middle";
            const ctX =
                ctAlignment === "left"  ? leftMarginPx + 8 :
                ctAlignment === "right" ? width - rightMarginPx - 8 :
                width / 2;
            this.chartTitleG.append("text")
                .attr("x", ctX)
                .attr("y", topMarginPx + ctPaddingY + ctFontSize / 2)
                .attr("text-anchor", ctAnchor)
                .attr("dominant-baseline", "middle")
                .attr("fill", ct.fontColor.value.value)
                .attr("font-family", ct.fontFamily.value)
                .attr("font-size", ctFontSize)
                .attr("font-weight", ct.bold.value ? "bold" : "normal")
                .attr("font-style", ct.italic.value ? "italic" : "normal")
                .attr("text-decoration", ct.underline.value ? "underline" : "none")
                .text(ctText);
        }

        const headerOffset = topMarginPx + chartTitleHeight;

        // ── No-data state ─────────────────────────────────────────────────────
        if (vm.activities.length === 0 && vm.milestones.length === 0) {
            this.axisG.selectAll("*").remove();
            this.bgG.selectAll("*").remove();
            this.railG.selectAll("*").remove();
            this.activityLabelsG.selectAll("*").remove();
            this.labelBgG.selectAll("*").remove();
            this.bodyG.selectAll("*").remove();
            this.legendG.selectAll("*").remove();
            this.dragHandlesG.selectAll("*").remove();
            this.svg.selectAll(".no-data").remove();
            this.svg.append("text")
                .attr("class", "no-data")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("fill", "#999")
                .attr("font-size", 13)
                .text("Bind Activity, Swim Lane, Start Date, End Date to see the roadmap.");
            return;
        }
        this.svg.selectAll(".no-data").remove();

        // ── Inner-content dimensions ─────────────────────────────────────────
        // INF-3736 — transient drag preview overrides settings if active.
        const leftRailPct = (this.transientSwimLanePercent ?? this.settings.swimlanes.swimLaneWidthPercent.value) / 100;
        const labelAreaPct = (this.transientActivityLabelPercent ?? this.settings.activityLabels.activityLabelWidthPercent.value) / 100;

        const leftRailWidth = clamp(width * leftRailPct, SWIM_LANE_MIN, SWIM_LANE_MAX);
        const activityLabelWidth = clamp(width * labelAreaPct, ACTIVITY_LABEL_MIN, ACTIVITY_LABEL_MAX);

        const leftMargin = leftMarginPx + leftRailWidth + activityLabelWidth + ACTIVITY_LOLLIPOP_MIN_WIDTH;
        const rightMargin = rightMarginPx;

        // ── Axis layout (3-level toggleable) ─────────────────────────────────
        const tAxis = this.settings.timeAxis;
        const axisLayout: AxisLayoutInfo = computeAxisLayout(
            { year: tAxis.showYear.value, quarter: tAxis.showQuarter.value, month: tAxis.showMonth.value },
            tAxis.showTodayLabel.value,
        );
        const axisH = axisLayout.totalH;

        // INF-3736 — when the activity label column is narrow enough that
        // any label will wrap to 2 lines, lift the row-height floor so the
        // wrapped lines (cy ± LINE_OFFSET_PX) clear adjacent rows. Detected
        // per render so the chart breathes cleanly as the user drags narrower.
        const labelsWillWrap =
            this.settings.activityLabels.wrapText.value &&
            anyActivityLabelWraps(
                vm.activities,
                activityLabelWidth,
                fontFromCard(this.settings.activityLabels),
            );
        const minRowH = labelsWillWrap ? MIN_ROW_HEIGHT_FOR_WRAP : MIN_ROW_HEIGHT;

        const availableBodyH = Math.max(
            minRowH * vm.activities.length,
            height - headerOffset - axisH - bottomMarginPx
        );
        const computedRowH = Math.floor(availableBodyH / Math.max(1, vm.activities.length));
        const rowHeight = Math.max(minRowH, Math.min(MAX_ROW_HEIGHT, computedRowH || TARGET_ROW_HEIGHT));
        const bodyH = rowHeight * vm.activities.length;

        const domain = quarterAlignedExtent(vm.dateExtent);
        const xScale = buildScale(domain, width, leftMargin, rightMargin);

        const todayLineColor = tAxis.todayLabelColor.value.value;
        const axisFont = fontFromCard(tAxis);

        // ── Time axis ─────────────────────────────────────────────────────────
        this.axisG.attr("transform", `translate(0, ${headerOffset})`);
        const now = (tAxis.showTodayLine.value || tAxis.showTodayLabel.value) ? new Date() : null;
        renderTimeAxis(this.axisG, xScale, domain, now, {
            levels: { year: tAxis.showYear.value, quarter: tAxis.showQuarter.value, month: tAxis.showMonth.value },
            fills: {
                year: tAxis.yearFill.value.value,
                quarter: tAxis.quarterFill.value.value,
                month: tAxis.monthFill.value.value,
            },
            chevronStyle: tAxis.chevronStyle.value.value as ChevronStyle,
            todayLabel: { show: tAxis.showTodayLabel.value, color: todayLineColor },
            font: axisFont,
        });

        const bodyY = headerOffset + axisH;

        // v2.1 W1 — grow the SVG to fit the body when content (header + axis +
        // body + bottom margin) exceeds the visible Gantt region. The wrapper
        // clips at `height`; SVG content above that triggers vertical scroll.
        // When content fits, SVG stays at the visible height — no scrollbar.
        const ganttContentHeight = headerOffset + axisH + bodyH + bottomMarginPx;
        const svgRenderHeight = Math.max(height, ganttContentHeight);
        this.svg.attr("height", svgRenderHeight);

        // ── Background: gridlines + past/future shading + TODAY line ─────────
        const bgY = headerOffset + (axisLayout.yearY >= 0 ? axisLayout.yearH : 0);
        const bgH = (axisH - (axisLayout.yearY >= 0 ? axisLayout.yearH : 0)) + bodyH;
        this.bgG.attr("transform", `translate(0, ${bgY})`);
        renderTimeNow(this.bgG, xScale, domain, bgH, {
            showTodayLine: tAxis.showTodayLine.value,
            todayLineColor: todayLineColor,
            showPastShading: tAxis.showPastShading.value,
            pastFillColor: tAxis.pastShadingColor.value.value,
            pastOpacity: Math.max(0, Math.min(100, tAxis.pastShadingOpacityPct.value)) / 100,
            showFutureShading: tAxis.showFutureShading.value,
            futureFillColor: tAxis.futureShadingColor.value.value,
            futureOpacity: Math.max(0, Math.min(100, tAxis.futureShadingOpacityPct.value)) / 100,
            quarterGridlines: {
                show: tAxis.showQuarterGridlines.value,
                color: tAxis.quarterGridlineColor.value.value,
                opacity: Math.max(0, Math.min(100, tAxis.quarterGridlineOpacityPct.value)) / 100,
                style: tAxis.quarterGridlineStyle.value.value as GridlineStyle,
            },
            monthGridlines: {
                show: tAxis.showMonthGridlines.value,
                color: tAxis.monthGridlineColor.value.value,
                opacity: Math.max(0, Math.min(100, tAxis.monthGridlineOpacityPct.value)) / 100,
                style: tAxis.monthGridlineStyle.value.value as GridlineStyle,
            },
        });

        // ── Legend (upper-left corner of header band) ─────────────────────────
        // Legend properties now live on MilestonesCard (merged in v1.6.0.0).
        const legendFont = {
            fontFamily: mc.legendFontFamily.value,
            fontSize:   mc.legendFontSize.value,
            bold:       mc.legendBold.value,
            italic:     mc.legendItalic.value,
            underline:  mc.legendUnderline.value,
        };
        this.legendG.attr("transform", `translate(${leftMarginPx}, ${headerOffset})`);
        // v2.1 audit-fix #11 — pass a LegendTypeState map (Map<typeName,
        // "transparent" | "hidden">) built from the sparse internal state.
        // Click cycles visible → transparent → hidden → visible.
        const typeStateMap = new Map<string, "visible" | "transparent" | "hidden">();
        for (const [k, v] of this.milestoneTypeState) typeStateMap.set(k, v);
        renderLegend(
            this.legendG,
            vm.distinctTypes,
            colors,
            mc.legendShow.value,
            legendFont,
            mc.legendLabelColor.value.value,
            typeStateMap,
            (typeName: string) => {
                const cur = this.milestoneTypeState.get(typeName) ?? "visible";
                const next: "visible" | "transparent" | "hidden" =
                    cur === "visible" ? "transparent"
                  : cur === "transparent" ? "hidden"
                  : "visible";
                if (next === "visible") {
                    this.milestoneTypeState.delete(typeName);
                } else {
                    this.milestoneTypeState.set(typeName, next);
                }
                this.requestRerender();
            },
        );

        // ── Swim-lane rails ───────────────────────────────────────────────────
        this.railG.attr("transform", `translate(${leftMarginPx}, ${bodyY})`);
        renderSwimlanes(this.railG, vm.areaGroups, rowHeight, colors, leftRailWidth, {
            show: this.settings.swimlanes.show.value,
            // INF-3736 — wrap is always on; the format-pane toggle was
            // removed since wrap is required for drag-to-resize to produce
            // useful sizing as the column narrows.
            wrapText: true,
            // INF-3821 — operator-set truncation; 0 = off (preserves prior behavior).
            labelMaxChars: this.settings.swimlanes.labelMaxChars.value,
            useAreaColor: this.settings.swimlanes.useAreaColor.value,
            labelColor: this.settings.swimlanes.labelColor.value.value,
            railAlignment: this.settings.swimlanes.railAlignment.value.value as "left" | "center" | "right",
            font: fontFromCard(this.settings.swimlanes),
            // v2.1 audit-fix — click label to select lane. Renderer attaches
            // the handler at element creation with pointer-events:bounding-box
            // (the prior d3-selectAll-after-render path didn't fire reliably).
            onSelectLane: (laneName: string) => {
                this.selectionStore.set({ kind: "lane", laneName });
            },
        });

        // ── Activity labels + lollipops ───────────────────────────────────────
        const labelsLayout: ActivityLabelsLayout = {
            areaStartX: leftMarginPx + leftRailWidth + 8,
        };
        this.activityLabelsG.attr("transform", `translate(0, ${bodyY})`);
        // INF-3787 Phase 5 re-spec — EARNED-escalation principle.
        // Build a per-activity slip-derived bullet color map BEFORE
        // renderActivityLabels so the bullet's resolution chain can
        // fall through to slip color when an explicit health value
        // isn't bound. Format-pane Glide Path thresholds override the
        // defaults; the same palette as Milestone Health backs both
        // surfaces so the viewer reads one vocabulary.
        const glidePathCard = this.settings.glidePath;
        const slipThresholds: SlipThresholds = {
            negligibleDays: glidePathCard.slipNegligibleDays.value,
            minorDays: glidePathCard.slipMinorDays.value,
            majorDays: glidePathCard.slipMajorDays.value,
        };
        const slipBulletPalette = {
            green:    this.settings.milestoneHealthColors.green.value.value,
            yellow:   this.settings.milestoneHealthColors.yellow.value.value,
            red:      this.settings.milestoneHealthColors.red.value.value,
            fallback: "#888888",
        };
        const slipBulletColorByActivity = new Map<string, string>();
        for (const a of vm.activities) {
            if (a.health != null && a.health.trim().length > 0) continue;
            const slip = computeSlip(a.baselineEnd, a.end, slipThresholds);
            const color = slipToHealthColor(slip, slipBulletPalette);
            if (color != null) slipBulletColorByActivity.set(a.name, color);
        }
        renderActivityLabels(this.activityLabelsG, vm.activities, rowHeight, labelsLayout, xScale, {
            show: this.settings.activityLabels.show.value,
            fillMode: this.settings.activityLabels.fillMode.value.value as "grey" | "area",
            customColor: this.settings.activityLabels.customColor.value.value,
            font: fontFromCard(this.settings.activityLabels),
            areaWidth: activityLabelWidth,
            wrapText: this.settings.activityLabels.wrapText.value,
            overflowBehavior: this.settings.activityLabels.overflowBehavior.value.value as "truncate" | "hide" | "overflow",
            // v2.1 audit-fix — click the activity TEXT label on the left
            // rail (not just the bar) to select the activity.
            onSelectActivity: (activityName: string) => {
                this.selectionStore.set({ kind: "activity", activityName });
            },
            // v2.2 L2 + L3 — alert palette for the activity bullet (left dot).
            // Fallback path when no per-value icon is bound. Same palette as
            // B3's milestone Health dot so the user has ONE Format-pane card
            // driving both surfaces.
            healthPalette: {
                green:    this.settings.milestoneHealthColors.green.value.value,
                yellow:   this.settings.milestoneHealthColors.yellow.value.value,
                red:      this.settings.milestoneHealthColors.red.value.value,
                fallback: "#888888",
            },
            // v2.2 INF-3738 — per-value icon binding (primary path when bound).
            // Maps activity.health -> { symbol, color, size } per the
            // Activity Health Icons Format-pane card.
            healthIconMap,
            // INF-3787 — slip-derived bullet color override (tier-3
            // fallback, after healthIconMap + healthPalette+health).
            slipBulletColorByActivity,
        }, colors);

        // ── Bars + markers + milestone labels ─────────────────────────────────
        const chartLeftEdge = leftMargin;
        const chartRightEdge = width - rightMarginPx - 10;
        const milestoneCard = this.settings.milestones;
        const labelFont = milestoneLabelFont(milestoneCard);
        const labelOverflow = milestoneCard.labelOverflow.value.value as "truncate" | "hide" | "overflow";
        const renderedLabels = computeVisibleLabels(
            vm.milestones, colors, xScale, rowHeight, chartLeftEdge, chartRightEdge, labelFont, labelOverflow
        );

        this.labelBgG.selectAll("*").remove();

        this.bodyG.attr("transform", `translate(0, ${bodyY})`);
        const barsSel = renderBars(this.bodyG, vm.activities, xScale, rowHeight, colors);
        const starsSel = renderMilestones(
            this.bodyG, vm.milestones, xScale, rowHeight, colors,
            milestoneCard.hoverExpansion.value
        );
        renderMilestoneLabels(this.bodyG, renderedLabels, rowHeight, {
            labelColor: milestoneCard.labelColor.value.value,
            font: labelFont,
            overflowBehavior: labelOverflow,
        });
        // INF-3787 — bullet-chart variance vocabulary: single dark
        // vertical tick at xScale(baselineEnd) inside each shifted bar.
        // Position relative to bar's right edge encodes magnitude +
        // direction implicitly. Fires automatically for non-negligible
        // slip; bullet escalation (already wired) handles the per-row
        // status story through the existing health palette.
        renderBaselineMarkLayer(this.bodyG, vm.activities, xScale, rowHeight, { slipThresholds });
        // Milestone ghosts: hollow outline + connector at baseline
        // date when milestoneBaselineDate is bound. Separate visual
        // concern (point markers, not bars). MS Project Tracking
        // Gantt convention.
        renderMilestoneBaselineGhosts(this.bodyG, vm.milestones, xScale, rowHeight, colors);

        // INF-3736 — invisible column-boundary drag handles. Two 8px-wide
        // <rect> overlays spanning the full body height, positioned in the
        // gap BETWEEN columns where no other content paints. col-resize
        // cursor on hover; no visible chrome at rest. Optimistic-UI pattern:
        // pointermove updates transient + rerenders; pointerup persists and
        // lets the reconcile at top of update() retire the transient.
        this.dragHandlesG.attr("transform", `translate(0, ${bodyY})`);
        this.dragHandlesG.selectAll("*").remove();

        const onResizeSwimLane = (newPercent: number, isCommit: boolean): void => {
            this.transientSwimLanePercent = newPercent;
            if (isCommit) {
                // INF-3736 — drop the drag-mode CSS override so subsequent
                // hover/leave fades resume normal 120ms behavior.
                this.dragHandlesG.classed("dragging", false);
                this.persistColumnWidth("swimlanes", "swimLaneWidthPercent", newPercent);
            } else {
                // INF-3736 — first pointermove of a drag. Class persists on
                // the parent <g> across re-renders, so newly-appended grips
                // inherit the no-transition / opacity:1 rule and don't
                // flicker as the cursor sweeps along.
                this.dragHandlesG.classed("dragging", true);
                this.requestRerender();
            }
        };
        const onResizeActivityLabel = (newPercent: number, isCommit: boolean): void => {
            this.transientActivityLabelPercent = newPercent;
            if (isCommit) {
                this.dragHandlesG.classed("dragging", false);
                this.persistColumnWidth("activityLabels", "activityLabelWidthPercent", newPercent);
            } else {
                this.dragHandlesG.classed("dragging", true);
                this.requestRerender();
            }
        };

        // INF-3736 — swim-lane right-edge handle. <g class="resize-grip">
        // wraps the invisible hit-rect + 3 grey grip dots. CSS in visual.less
        // hides the dots at rest and fades them in on group :hover.
        const swimGroup = this.dragHandlesG.append("g").attr("class", "resize-grip");
        const swimHandle = swimGroup.append("rect")
            .attr("class", "swimlane-resize-handle")
            .attr("x", leftMarginPx + leftRailWidth)
            .attr("y", 0)
            .attr("width", 8)
            .attr("height", bodyH)
            .attr("fill", "transparent")
            .style("pointer-events", "all")
            .node();
        for (const dy of [-7, 0, 7]) {
            swimGroup.append("circle")
                .attr("class", "grip-dot")
                .attr("cx", leftMarginPx + leftRailWidth + 4)
                .attr("cy", bodyH / 2 + dy)
                .attr("r", 1.5)
                .attr("fill", "#888");
        }
        if (swimHandle) {
            attachWidthDrag(swimHandle, leftMarginPx, options.viewport.width, 3, 70, onResizeSwimLane);
        }

        // INF-3736 — activity-label right-edge handle. Same grip pattern.
        const labelGroup = this.dragHandlesG.append("g").attr("class", "resize-grip");
        const labelHandle = labelGroup.append("rect")
            .attr("class", "activity-label-resize-handle")
            .attr("x", leftMarginPx + leftRailWidth + 8 + activityLabelWidth - 4)
            .attr("y", 0)
            .attr("width", 8)
            .attr("height", bodyH)
            .attr("fill", "transparent")
            .style("pointer-events", "all")
            .node();
        for (const dy of [-7, 0, 7]) {
            labelGroup.append("circle")
                .attr("class", "grip-dot")
                .attr("cx", leftMarginPx + leftRailWidth + 8 + activityLabelWidth)
                .attr("cy", bodyH / 2 + dy)
                .attr("r", 1.5)
                .attr("fill", "#888");
        }
        if (labelHandle) {
            attachWidthDrag(labelHandle, leftMarginPx + leftRailWidth + 8, options.viewport.width, 5, 70, onResizeActivityLabel);
        }

        const tooltipCard = this.settings.tooltip;
        // v2.2 T2 — resolve bound-field labels so tooltips reflect the
        // user's column names ("Workstream" / "Department") instead of
        // the static "Activity" / "Swim Lane" fallbacks.
        const tooltipCfg: TooltipConfig = {
            showNote: tooltipCard.showNote.value,
            hideRowWhenEmpty: tooltipCard.hideRowWhenEmpty.value,
            emptyPlaceholder: (tooltipCard.emptyPlaceholder.value ?? "").length > 0
                ? tooltipCard.emptyPlaceholder.value
                : "(no note recorded)",
            areaLabel:     bindingDisplayName("area",     dataView, "Swim Lane"),
            activityLabel: bindingDisplayName("activity", dataView, "Activity"),
            // INF-3787 — slip thresholds threaded so tooltip narrative uses
            // the same magnitude bands as the bullet + I-beam render path.
            slipThresholds,
        };
        this.tooltipService.addTooltip(barsSel, makeActivityTooltip(tooltipCfg));
        this.tooltipService.addTooltip(starsSel, makeMilestoneTooltip(tooltipCfg));

        // v2.1 W1.5b — Gantt SVG click → selection. Each handler stopPropagation's
        // so the click doesn't bubble to the root-level whitespace handler (which
        // would clear selection). barsSel carries Activity datum from renderBars'
        // .data() join; starsSel carries Milestone. swim-lane labels use the
        // data-area attribute set in swimlanes.ts (no d3 data binding there).
        barsSel.style("cursor", "pointer").on("click", (e: MouseEvent, a: Activity) => {
            e.stopPropagation();
            this.selectionStore.set({ kind: "activity", activityName: a.name });
        });
        starsSel.style("cursor", "pointer").on("click", (e: MouseEvent, m: Milestone) => {
            e.stopPropagation();
            this.selectionStore.set({
                kind: "milestone",
                milestoneLabel: m.label ?? "(unlabeled)",
                activityName: m.activity,
            });
        });
        // milestone-hit is a wider transparent circle on top of the marker —
        // it's the primary click target for milestones (better fit-target for
        // small star markers). Attach the same handler.
        this.bodyG.selectAll<SVGCircleElement, Milestone>("circle.milestone-hit")
            .style("cursor", "pointer")
            .on("click", (e: MouseEvent, m: Milestone) => {
                e.stopPropagation();
                this.selectionStore.set({
                    kind: "milestone",
                    milestoneLabel: m.label ?? "(unlabeled)",
                    activityName: m.activity,
                });
            });
        // v2.1 audit-fix — swim-lane label click was unreliable via the
        // post-render selectAll pattern (SVG text pointer-events default).
        // The handler now lives inside renderSwimlanes via the
        // onSelectLane callback option. Same for activity labels via
        // renderActivityLabels' onSelectActivity. The post-render selectAll
        // calls for those two are removed.

        // v2.1 audit-fix — visual breadcrumb highlight on the Gantt SVG.
        // Selected activity bar gets a thick orange stroke. Selected
        // milestone star gets enlarged stroke. Selected swim-lane label
        // is bolded via the data-area attribute matched here (no need to
        // change swimlanes.ts again).
        const selForHighlight = this.selectionStore.get();
        const selectedActivityName =
            selForHighlight.kind === "activity" ? selForHighlight.activityName :
            selForHighlight.kind === "milestone" ? selForHighlight.activityName :
            null;
        const selectedLaneName =
            selForHighlight.kind === "lane" ? selForHighlight.laneName : null;
        const selectedMilestoneKey =
            selForHighlight.kind === "milestone"
                ? `${selForHighlight.milestoneLabel}|${selForHighlight.activityName}`
                : null;

        // v2.1 audit-fix #9 — selected-bar outline uses the activity's
        // PALETTE color (the same blue/orange/green seen in the rail
        // bullet + panel bubble + table tint). The hardcoded #FF8C00
        // orange was a leftover from before activityColors existed.
        // Falls back to #FF8C00 outside lane focus (no palette assigned).
        barsSel
            .attr("stroke", (a: Activity) => {
                if (a.name !== selectedActivityName) return "none";
                return activityColors?.[a.name] ?? "#FF8C00";
            })
            .attr("stroke-width", (a: Activity) => a.name === selectedActivityName ? 3 : 0);
        this.bodyG.selectAll<SVGPathElement, Milestone>("path.milestone-marker")
            .attr("stroke", (m: Milestone) => {
                const k = `${m.label ?? "(unlabeled)"}|${m.activity}`;
                if (k !== selectedMilestoneKey) return "none";
                return activityColors?.[m.activity] ?? "#FF8C00";
            })
            .attr("stroke-width", (m: Milestone) => {
                const k = `${m.label ?? "(unlabeled)"}|${m.activity}`;
                return k === selectedMilestoneKey ? 3 : 0;
            });

        // v2.1 audit-fix #11 — 3-state dim/hide based on milestoneTypeState:
        //   "visible"     → opacity 1
        //   "transparent" → opacity 0.3
        //   "hidden"      → opacity 0 + pointer-events none (no click target)
        const typeState = this.milestoneTypeState;
        const opacityForType = (t: string): number => {
            const s = typeState.get(t);
            return s === "hidden" ? 0 : s === "transparent" ? 0.3 : 1;
        };
        const pointerForType = (t: string): string =>
            typeState.get(t) === "hidden" ? "none" : "auto";
        this.bodyG.selectAll<SVGPathElement, Milestone>("path.milestone-marker")
            .style("opacity", (m: Milestone) => opacityForType(m.type))
            .style("pointer-events", (m: Milestone) => pointerForType(m.type));
        this.bodyG.selectAll<SVGCircleElement, Milestone>("circle.milestone-hit")
            .style("opacity", (m: Milestone) => opacityForType(m.type))
            .style("pointer-events", (m: Milestone) => pointerForType(m.type));
        this.bodyG.selectAll<SVGTextElement, { milestone: Milestone }>("text.milestone-label")
            .style("opacity", (d) => opacityForType(d.milestone.type))
            .style("pointer-events", (d) => pointerForType(d.milestone.type));
        // Swim-lane label bold-when-selected. Match by data-area.
        this.railG.selectAll<SVGTextElement, unknown>("text.swimlane-label")
            .attr("font-weight", function (this: SVGTextElement) {
                return this.getAttribute("data-area") === selectedLaneName ? "bold" : "normal";
            });
        // Activity label bold-when-selected. Match by data-activity.
        this.activityLabelsG.selectAll<SVGTextElement, unknown>("text.activity-label")
            .attr("font-weight", function (this: SVGTextElement) {
                return this.getAttribute("data-activity") === selectedActivityName ? "bold" : "normal";
            });
    }

    // INF-3736 — persist a slider window state into PBI's objects bag so it
    // survives report reload / page nav. Wrapped here so onChange callbacks
    // don't need to know the persistProperties shape. PBI fires a fresh
    // update() asynchronously after this — the top-of-update read picks the
    // new value up; we don't await it.
    private persistSliderRange(objectName: "masterTimeSlider", range: SliderRange): void {
        this.host.persistProperties({
            merge: [{
                objectName,
                selector: undefined as unknown as powerbi.data.Selector,
                properties: { windowJson: JSON.stringify(range) },
            }],
        });
    }

    // INF-3736 — persist a column-width percent (e.g. swimLaneWidthPercent or
    // activityLabelWidthPercent) into the matching settings object. Called on
    // pointerup; PBI fires a fresh update() asynchronously so the persisted
    // value flows back through populateFormattingSettingsModel.
    private persistColumnWidth(
        objectName: "swimlanes" | "activityLabels",
        propertyName: "swimLaneWidthPercent" | "activityLabelWidthPercent",
        percent: number,
    ): void {
        this.host.persistProperties({
            merge: [{
                objectName,
                selector: undefined as unknown as powerbi.data.Selector,
                properties: { [propertyName]: percent },
            }],
        });
    }

    // INF-3736 — persist master slider scope booleans (filtersGantt / filtersTable).
    private persistMasterScope(scope: MasterScope): void {
        this.host.persistProperties({
            merge: [{
                objectName: "masterTimeSlider",
                selector: undefined as unknown as powerbi.data.Selector,
                properties: { filtersGantt: scope.filtersGantt, filtersTable: scope.filtersTable },
            }],
        });
    }

    // INF-3819 — persist the splitter hidden-mode so the upper-right Roadmap/Table
    // toggle survives reload + publish. Before this fix, splitter.setHidden()
    // mutated in-memory state only; on PBI Service reload the splitter snapped
    // back to "none" and operators who hid the Table region saw it reappear.
    private persistHiddenMode(mode: HiddenMode): void {
        this.host.persistProperties({
            merge: [{
                objectName: "ganttLayout",
                selector: undefined as unknown as powerbi.data.Selector,
                properties: { hiddenMode: mode },
            }],
        });
    }

    // v2.1 W1 — re-run the full layout + render against the cached lastOptions.
    // Triggered by the controls-panel onToggle callback when the panel opens or
    // closes, since PBI's host doesn't re-call update() on a pure DOM toggle.
    private requestRerender(): void {
        if (this.lastOptions) {
            this.update(this.lastOptions);
        }
    }

    /** INF-379X — fast-path layout invoked by the splitter's onLiveDrag
     *  callback (rAF-coalesced during pointermove). Mutates ONLY the
     *  splitter-affected geometry (~4 style writes + 1 SVG attr write).
     *  Skips: data conversion, gantt SVG content render, table HTML
     *  render, filter panel layout — none of which change during a
     *  drag. Content reflows on pointerup via the splitter's onChange
     *  → requestRerender path (full update). The cached layout context
     *  (lastTopSlicerHeightPx etc.) is populated by each full update();
     *  during a drag those values are stable (user cannot drag + resize
     *  panels simultaneously). */
    private applyDragLayout(): void {
        if (this.lastOptions === null) return;
        const viewport = this.lastOptions.viewport;

        const tableRowsPresent = this.lastTableRowsPresent;
        const topSlicerHeightPx = this.lastTopSlicerHeightPx;
        const panelWidthPx = this.lastPanelWidthPx;
        const comprehensiveWidthPx = this.lastComprehensiveWidthPx;

        const splitterViewportHeight = Math.max(0, viewport.height - topSlicerHeightPx);
        const splitterBarHeightPx = tableRowsPresent ? this.splitter.barHeightPx() : 0;
        const ganttHeightPx = tableRowsPresent
            ? this.splitter.ganttHeightPx(splitterViewportHeight)
            : splitterViewportHeight;
        const ganttHiddenHeaderPx = this.splitter.hiddenMode() === "gantt" ? 40 : 0;
        const ganttHiddenChromePush =
            this.splitter.hiddenMode() === "gantt" ? MASTER_SLIDER_CHROME_PX : 0;

        // Splitter bar — top is below gantt wrapper (INF-3772 anchor).
        if (tableRowsPresent) {
            this.splitter.layout({
                leftPx: panelWidthPx,
                topPx: topSlicerHeightPx + ganttHeightPx,
                widthPx: viewport.width - panelWidthPx,
            });
        }

        // Matrix top moves with drag; bottom stays anchored at 0
        // (INF-3768 followup). Height auto-derives in CSS.
        if (tableRowsPresent) {
            this.matrixDiv.style.top = (topSlicerHeightPx + ganttHeightPx + splitterBarHeightPx + ganttHiddenHeaderPx + ganttHiddenChromePush) + "px";
        }

        // Gantt scroll wrapper — top is master-slider-chrome + topSlicer
        // when gantt visible; height is gantt minus chrome reserve.
        const wrapperChromeOffset = (ganttHeightPx > 0 ? MASTER_SLIDER_CHROME_PX : 0) + topSlicerHeightPx;
        const wrapperHeightSubtract = (ganttHeightPx > 0 ? MASTER_SLIDER_CHROME_PX : 0);
        const wrapperHeight = Math.max(0, ganttHeightPx - wrapperHeightSubtract);
        this.ganttScrollWrapper.style.top = wrapperChromeOffset + "px";
        this.ganttScrollWrapper.style.height = wrapperHeight + "px";
        // INF-3781 followup — DO NOT mutate SVG width/height during drag.
        // The SVG's content (axes, bars, swimlanes) was laid out at the
        // pre-drag dimensions by the last full update(); shrinking the
        // SVG attr would clip the content INSIDE the SVG (no scroll bar)
        // because the wrapper's overflow:auto only kicks in when SVG
        // height > wrapper height. By leaving SVG dimensions intact,
        // the wrapper's overflow naturally reveals a scrollbar when
        // user drags the splitter up to shrink the gantt — content
        // scrolls inside the wrapper at its original layout. Content
        // reflows tightly to new dimensions on pointerup via the full
        // update() path.
    }

    /** INF-3770 — flush any debounced filter-pane persistence writes
     *  before the visual is torn down. PBI calls destroy() on tab close /
     *  visual removal; without this flush, the last debounce window of
     *  user state (up to 300ms of pending persistSelections, 50ms of
     *  pending applyJsonFilter) would be lost. */
    public destroy(): void {
        this.filterPanel.flushPersistence();
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // All slots use static declared properties — Format-pane edits round-trip
        // cleanly through populateFormattingSettingsModel. DisplayNames are
        // updated in update() from data bindings; no dynamic slice generation here.
        return this.settingsService.buildFormattingModel(this.settings);
    }

}

// v2.2 INF-3739 — narrow a dataView's rows by an active-filters map.
// When no filters are active, returns the original dataView unchanged
// (no allocation). When active, returns a shallow clone with a filtered
// rows array; metadata + column descriptors stay reference-equal. Filter
// dim names map to column displayNames; selected values are sets of
// stringified row cell values. Rows pass when every active dim's cell
// value is present in its corresponding selection set.
function narrowDataView(
    dataView: powerbi.DataView | undefined,
    activeFilters: ReadonlyMap<string, ReadonlySet<string>>,
): powerbi.DataView | undefined {
    if (activeFilters.size === 0) return dataView;
    if (!dataView?.table?.rows || !dataView.table.columns) return dataView;
    const cols = dataView.table.columns;
    const filterByColIdx = new Map<number, ReadonlySet<string>>();
    for (let i = 0; i < cols.length; i++) {
        const sel = activeFilters.get(cols[i].displayName);
        if (sel !== undefined && sel.size > 0) filterByColIdx.set(i, sel);
    }
    if (filterByColIdx.size === 0) return dataView;
    const passingRows = dataView.table.rows.filter(row => {
        for (const [idx, sel] of filterByColIdx) {
            const v = row[idx];
            if (v === null || v === undefined || !sel.has(String(v))) return false;
        }
        return true;
    });
    return {
        ...dataView,
        table: {
            ...dataView.table,
            rows: passingRows,
        },
    };
}
