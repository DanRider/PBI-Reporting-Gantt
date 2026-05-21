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

const GANTT_FRACTION_BOTH_BOUND = 0.6;

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

        // v2.1 W1 — controls panel chrome. Mounts AFTER guideDiv/matrixDiv on
        // root so the hamburger (z-index 11) overlays everything. initiallyOpen
        // is false so first-launch render is byte-identical to v2.0; the
        // onToggle callback re-runs update() with the cached lastOptions so
        // the layout recomputes against the new widthPct().
        this.controls = mountControlsPanel(this.root, {
            initiallyOpen: false,
            onToggle: () => this.requestRerender(),
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

        // v2.0 layout coordinator. The simple-table renderer reads from
        // dataView.table.rows (the v1.8 binding shape that's already
        // populated), so the matrix region mounts below the Gantt
        // whenever the v1.8 wells are bound — no additional matrix-side
        // wells required. Gantt fills the top 60%, matrix the bottom 40%.
        // When v1.8 wells are unbound, dataView.table.rows is empty;
        // renderSimpleTable handles that with an inline empty-state.
        const tableRowsPresent = !!(dataView?.table?.rows?.length);
        const ganttFraction = tableRowsPresent ? GANTT_FRACTION_BOTH_BOUND : 1;
        const ganttHeightPx = options.viewport.height * ganttFraction;
        const matrixHeightPx = options.viewport.height - ganttHeightPx;

        if (tableRowsPresent) {
            this.matrixDiv.style.display = "block";
            this.matrixDiv.style.top = ganttHeightPx + "px";
            this.matrixDiv.style.height = matrixHeightPx + "px";
            this.matrixDiv.style.left = panelWidthPx + "px";
            this.matrixDiv.style.width = (options.viewport.width - panelWidthPx) + "px";
            this.matrixDiv.style.background = "#ffffff";
            this.matrixDiv.style.borderTop = "2px solid #d0d0d0";
            renderSimpleTable(this.matrixDiv, dataView);
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

        const vm: RoadmapViewModel = convertDataView(dataView);

        const areaColorMap = buildAreaColorMap(vm.areaBindings, this.settings.swimlanes);
        const milestoneConfig = buildMilestoneConfigMap(vm.typeBindings, this.settings.milestones);
        const colors: ColorContext = buildColorContext(areaColorMap, milestoneConfig);

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
        renderLegend(
            this.legendG,
            vm.distinctTypes,
            colors,
            mc.legendShow.value,
            legendFont,
            mc.legendLabelColor.value.value,
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
