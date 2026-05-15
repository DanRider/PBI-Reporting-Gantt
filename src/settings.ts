"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

// Symbol options shared with visual.ts for dynamic Milestones-card slice generation.
export const SYMBOL_DROPDOWN_ITEMS = [
    { value: "star",     displayName: "Star" },
    { value: "circle",   displayName: "Circle" },
    { value: "triangle", displayName: "Triangle" },
    { value: "square",   displayName: "Square" },
    { value: "diamond",  displayName: "Diamond" },
];

// Title card — custom title at the top of the visual. Standard font + color + alignment controls.
class TitleCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: false,
    });
    text = new formattingSettings.TextInput({
        name: "text",
        displayName: "Text",
        value: "",
        placeholder: "Roadmap title",
    });
    fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font",
        value: "Segoe UI",
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Size",
        value: 18,
    });
    bold = new formattingSettings.ToggleSwitch({
        name: "bold",
        displayName: "Bold",
        value: true,
    });
    italic = new formattingSettings.ToggleSwitch({
        name: "italic",
        displayName: "Italic",
        value: false,
    });
    underline = new formattingSettings.ToggleSwitch({
        name: "underline",
        displayName: "Underline",
        value: false,
    });
    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Color",
        value: { value: "#222222" },
    });
    alignment = new formattingSettings.ItemDropdown({
        name: "alignment",
        displayName: "Alignment",
        items: [
            { value: "left",   displayName: "Left" },
            { value: "center", displayName: "Center" },
            { value: "right",  displayName: "Right" },
        ],
        value: { value: "center", displayName: "Center" },
    });
    name: string = "title";
    displayName: string = "Title";
    slices: Array<FormattingSettingsSlice> = [
        this.show,
        this.text,
        this.fontFamily,
        this.fontSize,
        this.bold,
        this.italic,
        this.underline,
        this.color,
        this.alignment,
    ];
}

export class AreaColorsCard extends FormattingSettingsCard {
    name: string = "areaColors";
    displayName: string = "Swim Lane Colors";
    slices: Array<FormattingSettingsSlice> = [];   // populated dynamically
}

export class MilestonesCard extends FormattingSettingsCard {
    hoverExpansion = new formattingSettings.NumUpDown({
        name: "hoverExpansion",
        displayName: "Hover target expansion (% past marker edge)",
        value: 50,
    });
    name: string = "milestones";
    displayName: string = "Milestones";
    slices: Array<FormattingSettingsSlice> = [this.hoverExpansion];
}

class ActivityLabelsCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: true,
    });
    wrapText = new formattingSettings.ToggleSwitch({
        name: "wrapText",
        displayName: "Wrap (2 lines)",
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
            { value: "area", displayName: "Swim lane color" },
        ],
        value: { value: "grey", displayName: "Dark grey" },
    });
    customColor = new formattingSettings.ColorPicker({
        name: "customColor",
        displayName: "Custom color",
        value: { value: "#2A2A2A" },
    });
    fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font",
        value: "Segoe UI",
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Size",
        value: 10,
    });
    bold = new formattingSettings.ToggleSwitch({
        name: "bold",
        displayName: "Bold",
        value: true,
    });
    italic = new formattingSettings.ToggleSwitch({
        name: "italic",
        displayName: "Italic",
        value: false,
    });
    underline = new formattingSettings.ToggleSwitch({
        name: "underline",
        displayName: "Underline",
        value: false,
    });
    name: string = "activityLabels";
    displayName: string = "Activity Labels";
    slices: Array<FormattingSettingsSlice> = [
        this.show,
        this.wrapText,
        this.overflowBehavior,
        this.fillMode,
        this.customColor,
        this.fontFamily,
        this.fontSize,
        this.bold,
        this.italic,
        this.underline,
    ];
}

class MilestoneLabelsCard extends FormattingSettingsCard {
    overflowBehavior = new formattingSettings.ItemDropdown({
        name: "overflowBehavior",
        displayName: "When labels collide",
        items: [
            { value: "truncate", displayName: "Truncate with …" },
            { value: "hide",     displayName: "Hide colliding" },
            { value: "overflow", displayName: "Show all (may overlap)" },
        ],
        value: { value: "truncate", displayName: "Truncate with …" },
    });
    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Label color",
        value: { value: "#000000" },
    });
    fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font",
        value: "Segoe UI",
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Size",
        value: 8,
    });
    bold = new formattingSettings.ToggleSwitch({
        name: "bold",
        displayName: "Bold",
        value: false,
    });
    italic = new formattingSettings.ToggleSwitch({
        name: "italic",
        displayName: "Italic",
        value: false,
    });
    underline = new formattingSettings.ToggleSwitch({
        name: "underline",
        displayName: "Underline",
        value: false,
    });
    name: string = "milestoneLabels";
    displayName: string = "Milestone Labels";
    slices: Array<FormattingSettingsSlice> = [
        this.overflowBehavior,
        this.labelColor,
        this.fontFamily,
        this.fontSize,
        this.bold,
        this.italic,
        this.underline,
    ];
}

class SwimlanesCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: true,
    });
    wrapText = new formattingSettings.ToggleSwitch({
        name: "wrapText",
        displayName: "Wrap labels (one word per line)",
        value: true,
    });
    useAreaColor = new formattingSettings.ToggleSwitch({
        name: "useAreaColor",
        displayName: "Use swim lane color for label",
        value: true,
    });
    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Label color (when not using swim lane color)",
        value: { value: "#222222" },
    });
    fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font",
        value: "Segoe UI",
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Size",
        value: 13,
    });
    bold = new formattingSettings.ToggleSwitch({
        name: "bold",
        displayName: "Bold",
        value: true,
    });
    italic = new formattingSettings.ToggleSwitch({
        name: "italic",
        displayName: "Italic",
        value: false,
    });
    underline = new formattingSettings.ToggleSwitch({
        name: "underline",
        displayName: "Underline",
        value: false,
    });
    name: string = "swimlanes";
    displayName: string = "Swim Lanes";
    slices: Array<FormattingSettingsSlice> = [
        this.show,
        this.wrapText,
        this.useAreaColor,
        this.labelColor,
        this.fontFamily,
        this.fontSize,
        this.bold,
        this.italic,
        this.underline,
    ];
}

class LegendCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show legend (upper-left)",
        value: true,
    });
    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Label color",
        value: { value: "#222222" },
    });
    fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font",
        value: "Segoe UI",
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Size",
        value: 12,
    });
    bold = new formattingSettings.ToggleSwitch({
        name: "bold",
        displayName: "Bold",
        value: false,
    });
    italic = new formattingSettings.ToggleSwitch({
        name: "italic",
        displayName: "Italic",
        value: false,
    });
    underline = new formattingSettings.ToggleSwitch({
        name: "underline",
        displayName: "Underline",
        value: false,
    });
    name: string = "legend";
    displayName: string = "Legend";
    slices: Array<FormattingSettingsSlice> = [
        this.show,
        this.labelColor,
        this.fontFamily,
        this.fontSize,
        this.bold,
        this.italic,
        this.underline,
    ];
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
    axisLabelColor = new formattingSettings.ColorPicker({
        name: "axisLabelColor",
        displayName: "Year/Quarter label color",
        value: { value: "#333333" },
    });
    fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font",
        value: "Segoe UI",
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Size",
        value: 12,
    });
    bold = new formattingSettings.ToggleSwitch({
        name: "bold",
        displayName: "Bold",
        value: true,
    });
    italic = new formattingSettings.ToggleSwitch({
        name: "italic",
        displayName: "Italic",
        value: false,
    });
    underline = new formattingSettings.ToggleSwitch({
        name: "underline",
        displayName: "Underline",
        value: false,
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
        this.axisLabelColor,
        this.fontFamily,
        this.fontSize,
        this.bold,
        this.italic,
        this.underline,
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    title = new TitleCard();
    layout = new LayoutCard();
    areaColors = new AreaColorsCard();
    milestones = new MilestonesCard();
    activityLabels = new ActivityLabelsCard();
    milestoneLabels = new MilestoneLabelsCard();
    swimlanes = new SwimlanesCard();
    legend = new LegendCard();
    timeAxis = new TimeAxisCard();

    cards = [
        this.title,
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
