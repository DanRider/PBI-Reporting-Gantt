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
import {
    renderActivityLabels,
    ACTIVITY_LOLLIPOP_MIN_WIDTH,
    ActivityLabelsLayout,
} from "./render/gantt/activityLabels";
import { renderLegend, LEGEND_HEIGHT } from "./render/gantt/legend";
import { renderTimeNow, GridlineStyle } from "./render/gantt/timeNow";

// v2.0 configuration guide module — exported and available for a future
// explicit "show help" toggle from the format pane. Not gating render now.
import { renderConfigurationGuide } from "./configGuide";

// v2.0 simple table renderer — mounts in matrixDiv below the Gantt, reads
// directly from dataView.table.rows (existing v1.8 binding shape) so the
// matrix region is visible IMMEDIATELY without requiring v2.0-specific well
// bindings. The cortex-matrix substrate's full render can replace this in
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
import { mountSplitterBar, SplitterHandle } from "./render/splitterBar";

// v2.1 audit-fix — top-right hover-revealed controls to fully hide either
// region. Self-recall — same buttons toggle hide/show.
import { mountTopRightControls, TopRightControlsHandle } from "./render/topRightControls";

// v2.1 W1.5a (INF-3730) — selection state model. Drives the controls panel
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
const SWIM_LANE_MAX = 200;
const ACTIVITY_LABEL_MIN = 100;
const ACTIVITY_LABEL_MAX = 320;
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
}

function makeActivityTooltip(cfg: TooltipConfig): (a: Activity) => VisualTooltipDataItem[] {
    return (a: Activity) => {
        // First item's `header` field renders as the tooltip's title row (bold heading).
        const items: VisualTooltipDataItem[] = [
            { displayName: "Swim Lane", value: a.area, header: a.name },
            { displayName: "Start",     value: fmtDate(a.start) },
            { displayName: "End",       value: fmtDate(a.end) },
        ];
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
            { displayName: "Type",     value: m.type, header: headerText },
            { displayName: "Activity", value: m.activity },
            { displayName: "Date",     value: fmtDate(m.date) },
        ];
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
    // v2.1 audit-fix #22 — quarterly time slider state for the lane
    // Inspector. Range = { startOffset, endOffset } in quarter offsets
    // from today's quarter. "all" disables the window filter entirely.
    // Default: ±1 quarter centered on today.
    private galleryRange:
        | { kind: "all" }
        | { kind: "range"; startOffset: number; endOffset: number }
        = { kind: "range", startOffset: -1, endOffset: 1 };
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

        // v2.1 W1.5a (INF-3730) — selection store initialization. Created
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
                        case "lane": {
                            // v2.1 audit-fix #22 — quarterly slider replaces
                            // chips. Range handler self-references so the
                            // slider stays interactive across multiple drags
                            // (lesson banked from audit-fix #21).
                            const onRangeChange = (nextRange: typeof this.galleryRange): void => {
                                this.galleryRange = nextRange;
                                if (this.lastViewmodel) {
                                    const s = this.selectionStore.get();
                                    if (s.kind === "lane") {
                                        this.controls.setContent(renderLaneDetail(
                                            s.laneName,
                                            this.lastViewmodel,
                                            onSelect,
                                            this.lastActivityColors,
                                            this.galleryRange,
                                            onRangeChange,
                                        ));
                                    }
                                }
                            };
                            this.controls.setContent(renderLaneDetail(
                                sel.laneName,
                                this.lastViewmodel,
                                onSelect,
                                this.lastActivityColors,
                                this.galleryRange,
                                onRangeChange,
                            ));
                            break;
                        }
                        case "activity":
                            this.controls.setContent(renderActivityDetail(
                                sel.activityName,
                                this.lastViewmodel,
                                onSelect,
                                this.lastActivityColors,
                                this.lastTypeColors,
                            ));
                            break;
                        case "milestone":
                            this.controls.setContent(renderMilestoneDetail(
                                sel.milestoneLabel,
                                sel.activityName,
                                this.lastViewmodel,
                                onSelect,
                                this.lastActivityColors,
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
            onChange: () => this.requestRerender(),
        });

        // v2.1 audit-fix — top-right cluster of "Hide Gantt" / "Hide Table"
        // buttons. Hover-revealed (opacity 0.25 → 1). Same buttons toggle
        // hide/show — self-recall, no separate affordance needed.
        this.topRight = mountTopRightControls(this.root, {
            isHidden: (region) => this.splitter.hiddenMode() === region,
            onToggleHidden: (region) => {
                const next = this.splitter.hiddenMode() === region ? "none" : region;
                this.splitter.setHidden(next);
                this.topRight.refresh();
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

        // v2.1 audit-fix #8 — vm + focused-lane + activityColors computed
        // EARLY so the layout coordinator (which calls renderSimpleTable for
        // the table region) can read the tint maps. Originally these lived
        // after the layout coordinator, but the table render needs them.
        let vm: RoadmapViewModel = convertDataView(dataView);

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

        const areaColorMap = buildAreaColorMap(vm.areaBindings, this.settings.swimlanes);
        const milestoneConfig = buildMilestoneConfigMap(vm.typeBindings, this.settings.milestones);
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
        const ganttHeightPx = tableRowsPresent
            ? this.splitter.ganttHeightPx(options.viewport.height)
            : options.viewport.height;
        const matrixHeightPx = tableRowsPresent
            ? this.splitter.matrixHeightPx(options.viewport.height)
            : 0;
        const splitterBarHeightPx = this.splitter.barHeightPx();

        // v2.1 audit-fix #12 — when Gantt is fully hidden via the top-left
        // toggle, render a thin header strip with the chart title so the
        // table-only view still has visual context. Adjust matrix top to
        // sit below the header.
        const ganttHiddenHeaderPx = this.splitter.hiddenMode() === "gantt" ? 40 : 0;
        if (ganttHiddenHeaderPx > 0) {
            const ct = this.settings.chartTitle;
            const ctText = (ct.text.value ?? "").trim();
            const displayText = (ct.show.value && ctText.length > 0) ? ctText : "(Gantt hidden)";
            this.ganttHiddenHeader.textContent = displayText;
            this.ganttHiddenHeader.style.display = "flex";
            this.ganttHiddenHeader.style.left = panelWidthPx + "px";
            this.ganttHiddenHeader.style.width = (options.viewport.width - panelWidthPx) + "px";
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
            // Splitter bar sits AT y = ganttHeightPx, immediately below the
            // Gantt scroll wrapper. Matrix region starts at ganttHeightPx +
            // splitterBarHeightPx so the bar lives in its own band.
            this.splitter.layout({
                leftPx: panelWidthPx,
                topPx: ganttHeightPx,
                widthPx: options.viewport.width - panelWidthPx,
            });
            this.matrixDiv.style.display = "block";
            // v2.1 audit-fix #12 — when Gantt is hidden, push matrix down
            // by the header height so the header stays visible.
            this.matrixDiv.style.top = (ganttHeightPx + splitterBarHeightPx + ganttHiddenHeaderPx) + "px";
            this.matrixDiv.style.height = (matrixHeightPx - ganttHiddenHeaderPx) + "px";
            this.matrixDiv.style.left = panelWidthPx + "px";
            this.matrixDiv.style.width = (options.viewport.width - panelWidthPx) + "px";
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
            renderSimpleTable(this.matrixDiv, dataView, {
                onSelectActivity: (activityName: string) => {
                    this.selectionStore.set({ kind: "activity", activityName });
                },
                filterActivityNames,
                filterAreaNames,
                highlightActivityName,
                rowTintByActivity,
                rowTintByArea,
            });
        } else {
            this.matrixDiv.style.display = "none";
        }

        const viewport = options.viewport;
        const width = viewport.width - panelWidthPx;
        const height = ganttHeightPx;

        // v2.1 W1 — wrapper owns the visible Gantt region's left/width/height
        // (driven by the controls panel widthPct). SVG inside flows naturally
        // with width=wrapper-inner and height initially = visible region; the
        // height is re-set later in this update() once bodyH is known, to
        // max(visibleHeight, contentHeight), so the wrapper's overflow-y
        // scrolls when the activity body exceeds the visible region.
        this.ganttScrollWrapper.style.left = panelWidthPx + "px";
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

        // ── Outer margins ─────────────────────────────────────────────────────
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
        const leftRailPct = this.settings.swimlanes.swimLaneWidthPercent.value / 100;
        const labelAreaPct = this.settings.activityLabels.activityLabelWidthPercent.value / 100;

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

        const availableBodyH = Math.max(
            MIN_ROW_HEIGHT * vm.activities.length,
            height - headerOffset - axisH - bottomMarginPx
        );
        const computedRowH = Math.floor(availableBodyH / Math.max(1, vm.activities.length));
        const rowHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, computedRowH || TARGET_ROW_HEIGHT));
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
            wrapText: this.settings.swimlanes.wrapText.value,
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

        const tooltipCard = this.settings.tooltip;
        const tooltipCfg: TooltipConfig = {
            showNote: tooltipCard.showNote.value,
            hideRowWhenEmpty: tooltipCard.hideRowWhenEmpty.value,
            emptyPlaceholder: (tooltipCard.emptyPlaceholder.value ?? "").length > 0
                ? tooltipCard.emptyPlaceholder.value
                : "(no note recorded)",
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

    // v2.1 W1 — re-run the full layout + render against the cached lastOptions.
    // Triggered by the controls-panel onToggle callback when the panel opens or
    // closes, since PBI's host doesn't re-call update() on a pure DOM toggle.
    private requestRerender(): void {
        if (this.lastOptions) {
            this.update(this.lastOptions);
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // All slots use static declared properties — Format-pane edits round-trip
        // cleanly through populateFormattingSettingsModel. DisplayNames are
        // updated in update() from data bindings; no dynamic slice generation here.
        return this.settingsService.buildFormattingModel(this.settings);
    }
}
