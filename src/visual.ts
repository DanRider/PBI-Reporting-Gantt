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
    readAreaColorOverrides,
    readMilestoneOverrides,
    ColorContext,
    MilestoneTypeConfig,
} from "./utils/colors";

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

const TOP_MARGIN = 4;
const BOTTOM_MARGIN = 8;

const LEFT_RAIL_MIN = 100;
const LEFT_RAIL_MAX = 200;
const ACTIVITY_LABEL_MIN = 100;
const ACTIVITY_LABEL_MAX = 320;
const RIGHT_MARGIN_MIN = 40;
const RIGHT_MARGIN_MAX = 120;

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
        { displayName: "Area", value: a.area },
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

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private svg: d3Selection<SVGSVGElement, unknown, null, undefined>;
    private bgG: d3Selection<SVGGElement, unknown, null, undefined>;
    private axisG: d3Selection<SVGGElement, unknown, null, undefined>;
    private railG: d3Selection<SVGGElement, unknown, null, undefined>;
    private activityLabelsG: d3Selection<SVGGElement, unknown, null, undefined>;
    private labelBgG: d3Selection<SVGGElement, unknown, null, undefined>;
    private bodyG: d3Selection<SVGGElement, unknown, null, undefined>;
    private legendG: d3Selection<SVGGElement, unknown, null, undefined>;
    private tooltipService: ITooltipServiceWrapper;
    private settingsService: FormattingSettingsService;
    private settings: VisualFormattingSettingsModel;

    // Stashed per-render so getFormattingModel() can rebuild dynamic slices for both
    // AreaColors (one ColorPicker per area) and Milestones (5 slices per type).
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

        // Build dynamic color context — areas + milestone types both data-driven, both with persisted overrides.
        const persistedAreaOverrides = readAreaColorOverrides(dataView);
        const areaColorMap = buildAreaColorMap(vm.distinctAreas, persistedAreaOverrides);
        const persistedMilestoneOverrides = readMilestoneOverrides(dataView);
        const milestoneConfig = buildMilestoneConfigMap(vm.distinctTypes, persistedMilestoneOverrides);
        const colors: ColorContext = buildColorContext(areaColorMap, milestoneConfig);

        // Stash for getFormattingModel
        this.lastDistinctAreas = vm.distinctAreas;
        this.lastAreaColorMap = areaColorMap;
        this.lastDistinctTypes = vm.distinctTypes;
        this.lastMilestoneConfig = milestoneConfig;

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
                .text("Bind Activity, Area, Start Date, End Date to see the roadmap.");
            return;
        }
        this.svg.selectAll(".no-data").remove();

        const leftRailPct = this.settings.layout.leftRailWidthPercent.value / 100;
        const labelAreaPct = this.settings.layout.activityLabelWidthPercent.value / 100;
        const rightMarginPct = this.settings.layout.rightMarginPercent.value / 100;

        const leftRailWidth = clamp(width * leftRailPct, LEFT_RAIL_MIN, LEFT_RAIL_MAX);
        const activityLabelWidth = clamp(width * labelAreaPct, ACTIVITY_LABEL_MIN, ACTIVITY_LABEL_MAX);
        const rightMargin = clamp(width * rightMarginPct, RIGHT_MARGIN_MIN, RIGHT_MARGIN_MAX);

        const leftMargin = leftRailWidth + activityLabelWidth + ACTIVITY_LOLLIPOP_MIN_WIDTH;

        const axisH = axisTotalHeight();
        const availableBodyH = Math.max(
            MIN_ROW_HEIGHT * vm.activities.length,
            height - TOP_MARGIN - axisH - BOTTOM_MARGIN
        );
        const computedRowH = Math.floor(availableBodyH / Math.max(1, vm.activities.length));
        const rowHeight = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, computedRowH || TARGET_ROW_HEIGHT));
        const bodyH = rowHeight * vm.activities.length;

        const domain = quarterAlignedExtent(vm.dateExtent);
        const xScale = buildScale(domain, width, leftMargin, rightMargin);

        const tAxis = this.settings.timeAxis;
        const todayLineColor = tAxis.todayLabelColor.value.value;

        this.axisG.attr("transform", `translate(0, ${TOP_MARGIN})`);
        const now = (tAxis.showTodayLine.value || tAxis.showTodayLabel.value) ? new Date() : null;
        renderTimeAxis(this.axisG, xScale, domain, now, {
            show: tAxis.showTodayLabel.value,
            color: todayLineColor,
        });

        const bodyY = TOP_MARGIN + axisH;

        const bgY = TOP_MARGIN + AXIS_DEFAULTS.yearBandH;
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

        // Legend — upper-left, one entry per distinct milestone type
        this.legendG.attr("transform", `translate(0, ${TOP_MARGIN})`);
        renderLegend(this.legendG, vm.distinctTypes, colors, this.settings.legend.show.value);

        this.railG.attr("transform", `translate(0, ${bodyY})`);
        renderSwimlanes(this.railG, vm.areaGroups, rowHeight, colors,
            this.settings.swimlanes.show.value, leftRailWidth,
            this.settings.swimlanes.wrapText.value);

        const labelsLayout: ActivityLabelsLayout = {
            areaStartX: leftRailWidth + 8,
        };
        this.activityLabelsG.attr("transform", `translate(0, ${bodyY})`);
        renderActivityLabels(this.activityLabelsG, vm.activities, rowHeight, labelsLayout, xScale, {
            show: this.settings.activityLabels.show.value,
            fillMode: this.settings.activityLabels.fillMode.value.value as "grey" | "area",
            customColor: this.settings.activityLabels.customColor.value.value,
            fontSize: this.settings.activityLabels.fontSize.value,
            areaWidth: activityLabelWidth,
            wrapText: this.settings.activityLabels.wrapText.value,
            overflowBehavior: this.settings.activityLabels.overflowBehavior.value.value as "truncate" | "hide" | "overflow",
        }, colors);

        // Bars + markers + labels
        const chartLeftEdge = leftMargin;
        const chartRightEdge = width - 10;
        const labelFontSize = this.settings.milestoneLabels.fontSize.value;
        const milestoneOverflow = this.settings.milestoneLabels.overflowBehavior.value.value as "truncate" | "hide" | "overflow";
        const renderedLabels = computeVisibleLabels(
            vm.milestones, colors, xScale, rowHeight, chartLeftEdge, chartRightEdge, labelFontSize, milestoneOverflow
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
            fontSize: labelFontSize,
            overflowBehavior: milestoneOverflow,
        });

        this.tooltipService.addTooltip(barsSel, activityTooltip);
        this.tooltipService.addTooltip(starsSel, milestoneTooltip);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // Area Colors — one ColorPicker per distinct area, persisted by selector{id}
        this.settings.areaColors.slices = this.lastDistinctAreas.map(area =>
            new formattingSettings.ColorPicker({
                name: "fill",
                displayName: area,
                selector: { id: area } as powerbi.data.Selector,
                value: { value: this.lastAreaColorMap[area] ?? "#888888" },
            })
        );

        // Milestones — 5 slices per distinct type (color, symbol, size, showMarker, showLabel)
        // displayName uses the type name as prefix so users see their actual data values.
        // hoverExpansion stays static at the top of the card.
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
