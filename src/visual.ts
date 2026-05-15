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
import { renderTimeAxis, computeAxisLayout, AxisLayoutInfo, ChevronStyle } from "./render/timeAxis";
import { renderBars } from "./render/bars";
import { renderMilestones, renderMilestoneLabels, computeVisibleLabels } from "./render/milestones";
import { renderSwimlanes } from "./render/swimlanes";
import {
    renderActivityLabels,
    ACTIVITY_LOLLIPOP_MIN_WIDTH,
    ActivityLabelsLayout,
} from "./render/activityLabels";
import { renderLegend, LEGEND_HEIGHT } from "./render/legend";
import { renderTimeNow, GridlineStyle } from "./render/timeNow";

const TITLE_BOTTOM_GAP = 4;

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

// Build a FontStyle from the milestones-card label* properties (label font is
// distinct from the marker config, lives on the same card after v1.3.0.0 merge).
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

        // ── Outer margins ─────────────────────────────────────────────────────
        const topMarginPx    = clamp(width * (this.settings.layout.topMarginPercent.value    / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const bottomMarginPx = clamp(width * (this.settings.layout.bottomMarginPercent.value / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const leftMarginPx   = clamp(width * (this.settings.layout.leftMarginPercent.value   / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);
        const rightMarginPx  = clamp(width * (this.settings.layout.rightMarginPercent.value  / 100), OUTER_MARGIN_MIN, OUTER_MARGIN_MAX);

        // ── Title ──────────────────────────────────────────────────────────────
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

        // ── Time axis (renders into axisG; returns the same layout for confirmation) ──
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

        // ── Background: gridlines + past/future shading + TODAY line ─────────
        // Gridlines extend from the BOTTOM of the year band (or top of axis if no year)
        // through the chart body, so they visually anchor to the chevron tick boundaries.
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

        // ── Legend (upper-left) ───────────────────────────────────────────────
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

        this.tooltipService.addTooltip(barsSel, activityTooltip);
        this.tooltipService.addTooltip(starsSel, milestoneTooltip);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // Swim Lanes — static slices + per-swim-lane ColorPickers
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

        // Milestones — static label-styling + dynamic per-type slices
        const milestoneStaticSlices: formattingSettings.Slice[] = [
            this.settings.milestones.hoverExpansion,
            this.settings.milestones.labelOverflow,
            this.settings.milestones.labelColor,
            this.settings.milestones.labelFontFamily,
            this.settings.milestones.labelFontSize,
            this.settings.milestones.labelBold,
            this.settings.milestones.labelItalic,
            this.settings.milestones.labelUnderline,
        ];
        const perTypeSlices: formattingSettings.Slice[] = [];
        for (const typeName of this.lastDistinctTypes) {
            const cfg = this.lastMilestoneConfig[typeName];
            if (!cfg) continue;
            const sel = { id: typeName } as powerbi.data.Selector;
            const symbolItem = SYMBOL_DROPDOWN_ITEMS.find(i => i.value === cfg.symbol) ?? SYMBOL_DROPDOWN_ITEMS[0];
            perTypeSlices.push(
                new formattingSettings.ColorPicker({
                    name: "fill", displayName: `${typeName} — color`, selector: sel,
                    value: { value: cfg.color },
                }),
                new formattingSettings.ItemDropdown({
                    name: "symbol", displayName: `${typeName} — symbol`,
                    items: SYMBOL_DROPDOWN_ITEMS, value: symbolItem, selector: sel,
                }),
                new formattingSettings.NumUpDown({
                    name: "size", displayName: `${typeName} — size (px)`,
                    value: cfg.size, selector: sel,
                }),
                new formattingSettings.ToggleSwitch({
                    name: "showMarker", displayName: `${typeName} — show markers`,
                    value: cfg.showMarker, selector: sel,
                }),
                new formattingSettings.ToggleSwitch({
                    name: "showLabel", displayName: `${typeName} — show labels`,
                    value: cfg.showLabel, selector: sel,
                }),
            );
        }
        this.settings.milestones.slices = [...milestoneStaticSlices, ...perTypeSlices];

        return this.settingsService.buildFormattingModel(this.settings);
    }
}
