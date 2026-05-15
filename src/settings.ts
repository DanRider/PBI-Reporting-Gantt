"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

// Slices populated dynamically in visual.ts getFormattingModel() based on
// distinct Area values present in the current dataView.
export class AreaColorsCard extends FormattingSettingsCard {
    name: string = "areaColors";
    displayName: string = "Area Colors";
    slices: Array<FormattingSettingsSlice> = [];
}

const SYMBOL_DROPDOWN_ITEMS = [
    { value: "star",     displayName: "Star" },
    { value: "circle",   displayName: "Circle" },
    { value: "triangle", displayName: "Triangle" },
    { value: "square",   displayName: "Square" },
    { value: "diamond",  displayName: "Diamond" },
];

class MilestonesCard extends FormattingSettingsCard {
    type1Color = new formattingSettings.ColorPicker({
        name: "type1Color",
        displayName: "Slot 1 color",
        value: { value: "#FFC000" },
    });
    type1Symbol = new formattingSettings.ItemDropdown({
        name: "type1Symbol",
        displayName: "Slot 1 symbol",
        items: SYMBOL_DROPDOWN_ITEMS,
        value: SYMBOL_DROPDOWN_ITEMS[0],
    });
    type1Size = new formattingSettings.NumUpDown({
        name: "type1Size",
        displayName: "Slot 1 size (px)",
        value: 11,
    });
    type1ShowMarker = new formattingSettings.ToggleSwitch({
        name: "type1ShowMarker",
        displayName: "Slot 1 markers",
        value: true,
    });
    type1ShowLabel = new formattingSettings.ToggleSwitch({
        name: "type1ShowLabel",
        displayName: "Slot 1 labels",
        value: true,
    });
    type2Color = new formattingSettings.ColorPicker({
        name: "type2Color",
        displayName: "Slot 2 color",
        value: { value: "#000000" },
    });
    type2Symbol = new formattingSettings.ItemDropdown({
        name: "type2Symbol",
        displayName: "Slot 2 symbol",
        items: SYMBOL_DROPDOWN_ITEMS,
        value: SYMBOL_DROPDOWN_ITEMS[1],
    });
    type2Size = new formattingSettings.NumUpDown({
        name: "type2Size",
        displayName: "Slot 2 size (px)",
        value: 11,
    });
    type2ShowMarker = new formattingSettings.ToggleSwitch({
        name: "type2ShowMarker",
        displayName: "Slot 2 markers",
        value: true,
    });
    type2ShowLabel = new formattingSettings.ToggleSwitch({
        name: "type2ShowLabel",
        displayName: "Slot 2 labels",
        value: true,
    });
    hoverExpansion = new formattingSettings.NumUpDown({
        name: "hoverExpansion",
        displayName: "Hover target expansion (% past marker edge)",
        value: 50,
    });
    name: string = "milestones";
    displayName: string = "Milestones";
    slices: Array<FormattingSettingsSlice> = [
        this.type1Color,
        this.type1Symbol,
        this.type1Size,
        this.type1ShowMarker,
        this.type1ShowLabel,
        this.type2Color,
        this.type2Symbol,
        this.type2Size,
        this.type2ShowMarker,
        this.type2ShowLabel,
        this.hoverExpansion,
    ];
}

class ActivityLabelsCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show activity labels",
        value: true,
    });
    wrapText = new formattingSettings.ToggleSwitch({
        name: "wrapText",
        displayName: "Wrap text (up to 2 lines)",
        value: true,
    });
    overflowBehavior = new formattingSettings.ItemDropdown({
        name: "overflowBehavior",
        displayName: "When text doesn't fit",
        items: [
            { value: "truncate", displayName: "Truncate with …" },
            { value: "hide",     displayName: "Hide" },
            { value: "overflow", displayName: "Show (may overflow)" },
        ],
        value: { value: "truncate", displayName: "Truncate with …" },
    });
    fillMode = new formattingSettings.ItemDropdown({
        name: "fillMode",
        displayName: "Color mode",
        items: [
            { value: "grey", displayName: "Dark grey" },
            { value: "area", displayName: "Area color" },
        ],
        value: { value: "grey", displayName: "Dark grey" },
    });
    customColor = new formattingSettings.ColorPicker({
        name: "customColor",
        displayName: "Custom color (when mode = Dark grey, this overrides)",
        value: { value: "#2A2A2A" },
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font size",
        value: 10,
    });
    name: string = "activityLabels";
    displayName: string = "Activity Labels";
    slices: Array<FormattingSettingsSlice> = [
        this.show,
        this.wrapText,
        this.overflowBehavior,
        this.fillMode,
        this.customColor,
        this.fontSize,
    ];
}

// Per-label visibility lives on the Milestones card (type1ShowLabel / type2ShowLabel).
// This card holds the layout properties only.
class MilestoneLabelsCard extends FormattingSettingsCard {
    overflowBehavior = new formattingSettings.ItemDropdown({
        name: "overflowBehavior",
        displayName: "When labels collide",
        items: [
            { value: "truncate", displayName: "Truncate with …" },
            { value: "hide",     displayName: "Hide colliding labels" },
            { value: "overflow", displayName: "Show all (may overlap)" },
        ],
        value: { value: "truncate", displayName: "Truncate with …" },
    });
    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Label color (shared across types)",
        value: { value: "#000000" },
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font size",
        value: 8,
    });
    name: string = "milestoneLabels";
    displayName: string = "Milestone Labels";
    slices: Array<FormattingSettingsSlice> = [
        this.overflowBehavior,
        this.labelColor,
        this.fontSize,
    ];
}

class SwimlanesCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show left-rail swim lanes",
        value: true,
    });
    wrapText = new formattingSettings.ToggleSwitch({
        name: "wrapText",
        displayName: "Wrap area labels (one word per line)",
        value: true,
    });
    name: string = "swimlanes";
    displayName: string = "Swim Lanes";
    slices: Array<FormattingSettingsSlice> = [this.show, this.wrapText];
}

class LegendCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show legend (upper-left)",
        value: true,
    });
    name: string = "legend";
    displayName: string = "Legend";
    slices: Array<FormattingSettingsSlice> = [this.show];
}

class LayoutCard extends FormattingSettingsCard {
    leftRailWidthPercent = new formattingSettings.NumUpDown({
        name: "leftRailWidthPercent",
        displayName: "Left rail width (% of visual width)",
        value: 7,
    });
    activityLabelWidthPercent = new formattingSettings.NumUpDown({
        name: "activityLabelWidthPercent",
        displayName: "Activity label width (% of visual width)",
        value: 14,
    });
    rightMarginPercent = new formattingSettings.NumUpDown({
        name: "rightMarginPercent",
        displayName: "Right margin (% of visual width)",
        value: 4,
    });
    name: string = "layout";
    displayName: string = "Layout";
    slices: Array<FormattingSettingsSlice> = [
        this.leftRailWidthPercent,
        this.activityLabelWidthPercent,
        this.rightMarginPercent,
    ];
}

class TimeAxisCard extends FormattingSettingsCard {
    showTodayLine = new formattingSettings.ToggleSwitch({
        name: "showTodayLine",
        displayName: "Show TODAY dashed line",
        value: true,
    });
    showTodayLabel = new formattingSettings.ToggleSwitch({
        name: "showTodayLabel",
        displayName: "Show TODAY label in axis",
        value: true,
    });
    todayLabelColor = new formattingSettings.ColorPicker({
        name: "todayLabelColor",
        displayName: "TODAY label / line color",
        value: { value: "#444444" },
    });
    showPastShading = new formattingSettings.ToggleSwitch({
        name: "showPastShading",
        displayName: "Show past-area shading",
        value: true,
    });
    pastShadingColor = new formattingSettings.ColorPicker({
        name: "pastShadingColor",
        displayName: "Past shading color",
        value: { value: "#000000" },
    });
    pastShadingOpacityPct = new formattingSettings.NumUpDown({
        name: "pastShadingOpacityPct",
        displayName: "Past shading opacity (%)",
        value: 10,
    });
    showFutureShading = new formattingSettings.ToggleSwitch({
        name: "showFutureShading",
        displayName: "Show future-area shading",
        value: false,
    });
    futureShadingColor = new formattingSettings.ColorPicker({
        name: "futureShadingColor",
        displayName: "Future shading color",
        value: { value: "#FFFAF0" },
    });
    futureShadingOpacityPct = new formattingSettings.NumUpDown({
        name: "futureShadingOpacityPct",
        displayName: "Future shading opacity (%)",
        value: 50,
    });
    name: string = "timeAxis";
    displayName: string = "Time Axis";
    slices: Array<FormattingSettingsSlice> = [
        this.showTodayLine,
        this.showTodayLabel,
        this.todayLabelColor,
        this.showPastShading,
        this.pastShadingColor,
        this.pastShadingOpacityPct,
        this.showFutureShading,
        this.futureShadingColor,
        this.futureShadingOpacityPct,
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    layout = new LayoutCard();
    areaColors = new AreaColorsCard();
    milestones = new MilestonesCard();
    activityLabels = new ActivityLabelsCard();
    milestoneLabels = new MilestoneLabelsCard();
    swimlanes = new SwimlanesCard();
    legend = new LegendCard();
    timeAxis = new TimeAxisCard();

    cards = [
        this.layout,
        this.areaColors,
        this.milestones,
        this.activityLabels,
        this.milestoneLabels,
        this.swimlanes,
        this.legend,
        this.timeAxis,
    ];
}
