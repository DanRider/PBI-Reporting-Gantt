"use strict";

import "./../style/visual.less";
import { select as d3Select, Selection as d3Selection } from "d3-selection";

import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { formattingSettings, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import {
    createTooltipServiceWrapper,
    ITooltipServiceWrapper,
} from "powerbi-visuals-utils-tooltiputils";

import { VisualFormattingSettingsModel, SYMBOL_DROPDOWN_ITEMS } from "./settings";
import {
    buildAreaColorMap,
    buildMilestoneConfigMap,
    buildColorContext,
    readSwimLaneColorOverrides,
    readMilestoneOverrides,
    ColorContext,
    MilestoneTypeConfig,
} from "./utils/colors";
import { FontStyle, applyFont } from "./utils/font";

import { convertDataView, RoadmapViewModel, Activity, Milestone } from "./viewmodel";
import { buildScale, quarterAlignedExtent } from "./utils/dateScale";
import { renderTimeAxis, axisTotalHeight, AXIS_DEFAULTS } from "./render/timeAxis";
import { renderBars } from "./render/bars";
import { renderMilestones, renderMilestoneLabels, computeVisibleLabels } from "./render/milestones";
import { renderSwimlanes } from "./render/swimlanes";
import {
    renderActivityLabels,
    ACTIVITY_LOLLIPOP_MIN_WIDTH,
    ActivityLabelsLayout,
} from "./render/activityLabels";
import { renderLegend, LEGEND_HEIGHT } from "./render/legend";
import { renderTimeNow } from "./render/timeNow";

const TITLE_BOTTOM_GAP = 4;

// Pixel safety clamps so degenerate viewport sizes don't produce unusable layouts.
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

function activityTooltip(a: Activity): VisualTooltipDataItem[] {
    return [
        { displayName: "Activity", value: a.name },
        { displayName: "Swim Lane", value: a.area },
        { displayName: "Start", value: fmtDate(a.start) },
        { displayName: "End", value: fmtDate(a.end) },
    ];
}

function milestoneTooltip(m: Milestone): VisualTooltipDataItem[] {
    return [
        { displayName: "Activity", value: m.activity },
        { displayName: "Date", value: fmtDate(m.date) },
        { displayName: "Type", value: m.type },
        { displayName: "Label", value: m.label ?? "(unlabeled)" },
    ];
}

// Helper: build a FontStyle bundle from a settings card that has the standard
// fontFamily/fontSize/bold/italic/underline 5-tuple.
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

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private svg: d3Selection<SVGSVGElement, unknown, null, undefined>;
    private bgG: d3Selection<SVGGElement, unknown, null, undefined>;
    private titleG: d3Selection<SVGGElement, unknown, null, undefined>;
    private axisG: d3Selection<SVGGElement, unknown, null, undefined>;
    private railG: d3Selection<SVGGElement, unknown, null, undefined>;
    private activityLabelsG: d3Selection<SVGGElement, unknown, null, undefined>;
    private labelBgG: d3Selection<SVGGElement, unknown, null, undefined>;
    private bodyG: d3Selection<SVGGElement, unknown, null, undefined>;
    private legendG: d3Selection<SVGGElement, unknown, null, undefined>;
    private tooltipService: ITooltipServiceWrapper;
    private settingsService: FormattingSettingsService;
    private settings: VisualFormattingSettingsModel;

    private lastDistinctAreas: string[] = [];
    private lastAreaColorMap: Record<string, string> = {};
    private lastDistinctTypes: string[] = [];
    private lastMilestoneConfig: Record<string, MilestoneTypeConfig> = {};

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.root = options.element;
        this.settingsService = new FormattingSettingsService();

        this.svg = d3Select(this.root)
            .append("svg")
            .attr("class", "reporting-gantt")
            .attr("width", "100%")
            .attr("height", "100%");

        this.tooltipService = createTooltipServiceWrapper(
            this.host.tooltipService,
            this.root
        );

        this.bgG = this.svg.append("g").attr("class", "background-layer");
        this.titleG = this.svg.append("g").attr("class", "visual-title");
        this.axisG = this.svg.append("g").attr("class", "time-axis");
        this.railG = this.svg.append("g").attr("class", "swimlane-rail-group");
        this.activityLabelsG = this.svg.append("g").attr("class", "activity-labels");
        this.labelBgG = this.svg.append("g").attr("class", "label-backgrounds");
        this.bodyG = this.svg.append("g").attr("class", "body");
        this.legendG = this.svg.append("g").attr("class", "legend");
    }

    public update(options: VisualUpdateOptions): void {
        const dataView = options.dataViews && options.dataViews[0];
        this.settings = this.settingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            dataView
        );

        const viewport = options.viewport;
        const width = viewport.width;
        const height = viewport.height;

        this.svg.attr("width", width).attr("height", height);

        const vm: RoadmapViewModel = convertDataView(dataView);

        const persistedAreaOverrides = readSwimLaneColorOverrides(dataView);
        const areaColorMap = buildAreaColorMap(vm.distinctAreas, persistedAreaOverrides);
        const persistedMilestoneOverrides = readMilestoneOverrides(dataView);
        const milestoneConfig = buildMilestoneConfigMap(vm.distinctTypes, persistedMilestoneOverrides);
        const colors: ColorContext = buildColorContext(areaColorMap, milestoneConfig);

        this.lastDistinctAreas = vm.distinctAreas;
        this.lastAreaColorMap = areaColorMap;
        this.lastDistinctTypes = vm.distinctTypes;
        this.lastMilestoneConfig = milestoneConfig;

        // ── Outer margins (4-side, all default 1%) ────────────────────────────
        const topMarginPx    = clamp(width * (this.settings.layout.topMarginPercent.value    / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const bottomMarginPx = clamp(width * (this.settings.layout.bottomMarginPercent.value / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const leftMarginPx   = clamp(width * (this.settings.layout.leftMarginPercent.value   / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const rightMarginPx  = clamp(width * (this.settings.layout.rightMarginPercent.value  / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);

        // ── Title ──────────────────────────────────────────────────────────────
        // Render at the top of the SVG when show=true and text is non-empty.
        // Title block's bottom edge sets the Y baseline that everything else
        // (axis, body, legend) shifts down from.
        const titleSettings = this.settings.title;
        const titleFont = fontFromCard(titleSettings);
        const titleText = titleSettings.text.value || "";
        const titleShown = titleSettings.show.value && titleText.length > 0;
        let titleHeight = 0;
        this.titleG.selectAll("*").remove();
        if (titleShown) {
            titleHeight = Math.max(titleFont.fontSize * 1.6, 28);
            const alignment = titleSettings.alignment.value.value as "left" | "center" | "right";
            const textAnchor = alignment === "left" ? "start" : alignment === "right" ? "end" : "middle";
            const innerLeft = leftMarginPx + 6;
            const innerRight = width - rightMarginPx - 6;
            const titleX = alignment === "left" ? innerLeft : alignment === "right" ? innerRight : (innerLeft + innerRight) / 2;
            const titleY = topMarginPx + titleHeight / 2;
            const tSel = this.titleG.append("text")
                .attr("class", "visual-title-text")
                .attr("x", titleX)
                .attr("y", titleY)
                .attr("text-anchor", textAnchor)
                .attr("dominant-baseline", "central")
                .attr("fill", titleSettings.color.value.value)
                .text(titleText);
            applyFont(tSel, titleFont);
        }
        const titleBlockH = titleShown ? titleHeight + TITLE_BOTTOM_GAP : 0;
        const headerOffset = topMarginPx + titleBlockH;

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
        // Swim-lane width lives on the Swim Lanes card; activity-label width on the
        // Activity Labels card (was both on Layout in v1.1; reorg per INF-3523).
        const leftRailPct = this.settings.swimlanes.swimLaneWidthPercent.value / 100;
        const labelAreaPct = this.settings.activityLabels.activityLabelWidthPercent.value / 100;

        const leftRailWidth = clamp(width * leftRailPct, SWIM_LANE_MIN, SWIM_LANE_MAX);
        const activityLabelWidth = clamp(width * labelAreaPct, ACTIVITY_LABEL_MIN, ACTIVITY_LABEL_MAX);

        // chart-x = leftMarginPx + swim-lane width + activity-label width + lollipop gap
        const leftMargin = leftMarginPx + leftRailWidth + activityLabelWidth + ACTIVITY_LOLLIPOP_MIN_WIDTH;
        const rightMargin = rightMarginPx;

        const axisH = axisTotalHeight();
        const availableBodyH = Math.max(
            MIN_ROW_HEIGHT * vm.activities.length,
            height - headerOffset - axisH - bottomMarginPx
        );
        const computedRowH = Math.floor(availableBodyH / Math.max(1, vm.activities.length));
        const rowHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, computedRowH || TARGET_ROW_HEIGHT));
        const bodyH = rowHeight * vm.activities.length;

        const domain = quarterAlignedExtent(vm.dateExtent);
        const xScale = buildScale(domain, width, leftMargin, rightMargin);

        const tAxis = this.settings.timeAxis;
        const todayLineColor = tAxis.todayLabelColor.value.value;
        const axisFont = fontFromCard(tAxis);

        // ── Time axis ─────────────────────────────────────────────────────────
        this.axisG.attr("transform", `translate(0, ${headerOffset})`);
        const now = (tAxis.showTodayLine.value || tAxis.showTodayLabel.value) ? new Date() : null;
        renderTimeAxis(this.axisG, xScale, domain, now, {
            todayLabel: { show: tAxis.showTodayLabel.value, color: todayLineColor },
            axisLabelColor: tAxis.axisLabelColor.value.value,
            font: axisFont,
        });

        const bodyY = headerOffset + axisH;

        // ── Background (past/future shading + TODAY line) ─────────────────────
        const bgY = headerOffset + AXIS_DEFAULTS.yearBandH;
        const bgH = AXIS_DEFAULTS.todaySlotH + AXIS_DEFAULTS.quarterBandH + bodyH;
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
        });

        // ── Legend (upper-left corner of header band, below title if any) ────
        this.legendG.attr("transform", `translate(${leftMarginPx}, ${headerOffset})`);
        renderLegend(
            this.legendG,
            vm.distinctTypes,
            colors,
            this.settings.legend.show.value,
            fontFromCard(this.settings.legend),
            this.settings.legend.labelColor.value.value,
        );

        // ── Swim-lane rails ───────────────────────────────────────────────────
        this.railG.attr("transform", `translate(${leftMarginPx}, ${bodyY})`);
        renderSwimlanes(this.railG, vm.areaGroups, rowHeight, colors, leftRailWidth, {
            show: this.settings.swimlanes.show.value,
            wrapText: this.settings.swimlanes.wrapText.value,
            useAreaColor: this.settings.swimlanes.useAreaColor.value,
            labelColor: this.settings.swimlanes.labelColor.value.value,
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
        const milestoneLabelFont = fontFromCard(this.settings.milestoneLabels);
        const milestoneOverflow = this.settings.milestoneLabels.overflowBehavior.value.value as "truncate" | "hide" | "overflow";
        const renderedLabels = computeVisibleLabels(
            vm.milestones, colors, xScale, rowHeight, chartLeftEdge, chartRightEdge, milestoneLabelFont, milestoneOverflow
        );

        this.labelBgG.selectAll("*").remove();

        this.bodyG.attr("transform", `translate(0, ${bodyY})`);
        const barsSel = renderBars(this.bodyG, vm.activities, xScale, rowHeight, colors);
        const starsSel = renderMilestones(
            this.bodyG, vm.milestones, xScale, rowHeight, colors,
            this.settings.milestones.hoverExpansion.value
        );
        renderMilestoneLabels(this.bodyG, renderedLabels, rowHeight, {
            labelColor: this.settings.milestoneLabels.labelColor.value.value,
            font: milestoneLabelFont,
            overflowBehavior: milestoneOverflow,
        });

        this.tooltipService.addTooltip(barsSel, activityTooltip);
        this.tooltipService.addTooltip(starsSel, milestoneTooltip);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // Swim Lanes card now contains BOTH the static slices (show/width/font/etc.)
        // AND a per-swim-lane ColorPicker for each distinct value. The standalone
        // "Swim Lane Colors" card was consolidated here in v1.2.0.0.
        // Persistence: selector{id: areaName} -> objects.swimlanes[areaName].fill
        const swimlaneStaticSlices: formattingSettings.Slice[] = [
            this.settings.swimlanes.show,
            this.settings.swimlanes.swimLaneWidthPercent,
            this.settings.swimlanes.wrapText,
            this.settings.swimlanes.useAreaColor,
            this.settings.swimlanes.labelColor,
            this.settings.swimlanes.fontFamily,
            this.settings.swimlanes.fontSize,
            this.settings.swimlanes.bold,
            this.settings.swimlanes.italic,
            this.settings.swimlanes.underline,
        ];
        const swimlaneColorSlices: formattingSettings.Slice[] = this.lastDistinctAreas.map(area =>
            new formattingSettings.ColorPicker({
                name: "fill",
                displayName: area,
                selector: { id: area } as powerbi.data.Selector,
                value: { value: this.lastAreaColorMap[area] ?? "#888888" },
            })
        );
        this.settings.swimlanes.slices = [...swimlaneStaticSlices, ...swimlaneColorSlices];

        // Milestones — 5 slices per distinct type
        const perTypeSlices: formattingSettings.Slice[] = [];
        for (const typeName of this.lastDistinctTypes) {
            const cfg = this.lastMilestoneConfig[typeName];
            if (!cfg) continue;
            const sel = { id: typeName } as powerbi.data.Selector;
            const symbolItem = SYMBOL_DROPDOWN_ITEMS.find(i => i.value === cfg.symbol) ?? SYMBOL_DROPDOWN_ITEMS[0];
            perTypeSlices.push(
                new formattingSettings.ColorPicker({
                    name: "fill",
                    displayName: `${typeName} — color`,
                    selector: sel,
                    value: { value: cfg.color },
                }),
                new formattingSettings.ItemDropdown({
                    name: "symbol",
                    displayName: `${typeName} — symbol`,
                    items: SYMBOL_DROPDOWN_ITEMS,
                    value: symbolItem,
                    selector: sel,
                }),
                new formattingSettings.NumUpDown({
                    name: "size",
                    displayName: `${typeName} — size (px)`,
                    value: cfg.size,
                    selector: sel,
                }),
                new formattingSettings.ToggleSwitch({
                    name: "showMarker",
                    displayName: `${typeName} — show markers`,
                    value: cfg.showMarker,
                    selector: sel,
                }),
                new formattingSettings.ToggleSwitch({
                    name: "showLabel",
                    displayName: `${typeName} — show labels`,
                    value: cfg.showLabel,
                    selector: sel,
                }),
            );
        }
        this.settings.milestones.slices = [this.settings.milestones.hoverExpansion, ...perTypeSlices];

        return this.settingsService.buildFormattingModel(this.settings);
    }
}
