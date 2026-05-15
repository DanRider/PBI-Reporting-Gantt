"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

export const SYMBOL_DROPDOWN_ITEMS = [
    { value: "star",     displayName: "Star" },
    { value: "circle",   displayName: "Circle" },
    { value: "triangle", displayName: "Triangle" },
    { value: "square",   displayName: "Square" },
    { value: "diamond",  displayName: "Diamond" },
];

const LINE_STYLE_ITEMS = [
    { value: "solid",  displayName: "Solid" },
    { value: "dashed", displayName: "Dashed" },
    { value: "dotted", displayName: "Dotted" },
];

class TitleCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show", value: false });
    text = new formattingSettings.TextInput({ name: "text", displayName: "Text", value: "", placeholder: "Roadmap title" });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Size", value: 18 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    color = new formattingSettings.ColorPicker({ name: "color", displayName: "Color", value: { value: "#222222" } });
    alignment = new formattingSettings.ItemDropdown({
        name: "alignment", displayName: "Alignment",
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
        this.show, this.text, this.fontFamily, this.fontSize,
        this.bold, this.italic, this.underline, this.color, this.alignment,
    ];
}

// Milestones card — merged with what was previously MilestoneLabelsCard.
// Static slices: hoverExpansion + label-styling (overflow/color/font).
// Dynamic per-type slices appended in visual.ts getFormattingModel().
export class MilestonesCard extends FormattingSettingsCard {
    hoverExpansion = new formattingSettings.NumUpDown({
        name: "hoverExpansion", displayName: "Hover target expansion (% past marker edge)", value: 50,
    });
    labelOverflow = new formattingSettings.ItemDropdown({
        name: "labelOverflow", displayName: "Label overflow",
        items: [
            { value: "truncate", displayName: "Truncate with …" },
            { value: "hide",     displayName: "Hide colliding" },
            { value: "overflow", displayName: "Show all (may overlap)" },
        ],
        value: { value: "truncate", displayName: "Truncate with …" },
    });
    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor", displayName: "Label color", value: { value: "#000000" },
    });
    labelFontFamily = new formattingSettings.FontPicker({ name: "labelFontFamily", displayName: "Label font", value: "Segoe UI" });
    labelFontSize = new formattingSettings.NumUpDown({ name: "labelFontSize", displayName: "Label size", value: 8 });
    labelBold = new formattingSettings.ToggleSwitch({ name: "labelBold", displayName: "Label bold", value: false });
    labelItalic = new formattingSettings.ToggleSwitch({ name: "labelItalic", displayName: "Label italic", value: false });
    labelUnderline = new formattingSettings.ToggleSwitch({ name: "labelUnderline", displayName: "Label underline", value: false });

    name: string = "milestones";
    displayName: string = "Milestones";
    slices: Array<FormattingSettingsSlice> = [
        this.hoverExpansion,
        this.labelOverflow,
        this.labelColor,
        this.labelFontFamily,
        this.labelFontSize,
        this.labelBold,
        this.labelItalic,
        this.labelUnderline,
    ];
}

class ActivityLabelsCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show", value: true });
    activityLabelWidthPercent = new formattingSettings.NumUpDown({
        name: "activityLabelWidthPercent", displayName: "Label column width (% of visual width)", value: 14,
    });
    wrapText = new formattingSettings.ToggleSwitch({ name: "wrapText", displayName: "Wrap (2 lines)", value: true });
    overflowBehavior = new formattingSettings.ItemDropdown({
        name: "overflowBehavior", displayName: "When text doesn't fit",
        items: [
            { value: "truncate", displayName: "Truncate with …" },
            { value: "hide",     displayName: "Hide" },
            { value: "overflow", displayName: "Show (may overflow)" },
        ],
        value: { value: "truncate", displayName: "Truncate with …" },
    });
    fillMode = new formattingSettings.ItemDropdown({
        name: "fillMode", displayName: "Color mode",
        items: [
            { value: "grey", displayName: "Dark grey" },
            { value: "area", displayName: "Swim lane color" },
        ],
        value: { value: "grey", displayName: "Dark grey" },
    });
    customColor = new formattingSettings.ColorPicker({ name: "customColor", displayName: "Custom color", value: { value: "#2A2A2A" } });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Size", value: 10 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    name: string = "activityLabels";
    displayName: string = "Activity Labels";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.activityLabelWidthPercent, this.wrapText, this.overflowBehavior,
        this.fillMode, this.customColor, this.fontFamily, this.fontSize,
        this.bold, this.italic, this.underline,
    ];
}

export class SwimlanesCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show", value: true });
    swimLaneWidthPercent = new formattingSettings.NumUpDown({
        name: "swimLaneWidthPercent", displayName: "Swim lane width (% of visual width)", value: 10,
    });
    wrapText = new formattingSettings.ToggleSwitch({ name: "wrapText", displayName: "Wrap labels (one word per line)", value: true });
    useAreaColor = new formattingSettings.ToggleSwitch({ name: "useAreaColor", displayName: "Use swim lane color for label", value: true });
    labelColor = new formattingSettings.ColorPicker({ name: "labelColor", displayName: "Label color (when not using swim lane color)", value: { value: "#222222" } });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Size", value: 13 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    name: string = "swimlanes";
    displayName: string = "Swim Lanes";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.swimLaneWidthPercent, this.wrapText, this.useAreaColor, this.labelColor,
        this.fontFamily, this.fontSize, this.bold, this.italic, this.underline,
    ];
}

class LegendCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show legend (upper-left)", value: true });
    labelColor = new formattingSettings.ColorPicker({ name: "labelColor", displayName: "Label color", value: { value: "#222222" } });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Size", value: 12 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: false });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    name: string = "legend";
    displayName: string = "Legend";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.labelColor, this.fontFamily, this.fontSize,
        this.bold, this.italic, this.underline,
    ];
}

class LayoutCard extends FormattingSettingsCard {
    topMarginPercent = new formattingSettings.NumUpDown({ name: "topMarginPercent", displayName: "Top margin (%)", value: 1 });
    bottomMarginPercent = new formattingSettings.NumUpDown({ name: "bottomMarginPercent", displayName: "Bottom margin (%)", value: 1 });
    leftMarginPercent = new formattingSettings.NumUpDown({ name: "leftMarginPercent", displayName: "Left margin (%)", value: 1 });
    rightMarginPercent = new formattingSettings.NumUpDown({ name: "rightMarginPercent", displayName: "Right margin (%)", value: 1 });
    name: string = "layout";
    displayName: string = "Layout";
    slices: Array<FormattingSettingsSlice> = [
        this.topMarginPercent, this.bottomMarginPercent, this.leftMarginPercent, this.rightMarginPercent,
    ];
}

class TimeAxisCard extends FormattingSettingsCard {
    showYear = new formattingSettings.ToggleSwitch({ name: "showYear", displayName: "Show Year", value: true });
    yearFill = new formattingSettings.ColorPicker({ name: "yearFill", displayName: "Year chevron color", value: { value: "#205E8B" } });
    showQuarter = new formattingSettings.ToggleSwitch({ name: "showQuarter", displayName: "Show Quarter", value: true });
    quarterFill = new formattingSettings.ColorPicker({ name: "quarterFill", displayName: "Quarter chevron color", value: { value: "#357AAD" } });
    showMonth = new formattingSettings.ToggleSwitch({ name: "showMonth", displayName: "Show Month", value: false });
    monthFill = new formattingSettings.ColorPicker({ name: "monthFill", displayName: "Month chevron color", value: { value: "#5BA8D8" } });

    showQuarterGridlines = new formattingSettings.ToggleSwitch({ name: "showQuarterGridlines", displayName: "Show quarter gridlines", value: false });
    quarterGridlineColor = new formattingSettings.ColorPicker({ name: "quarterGridlineColor", displayName: "Quarter gridline color", value: { value: "#888888" } });
    quarterGridlineOpacityPct = new formattingSettings.NumUpDown({ name: "quarterGridlineOpacityPct", displayName: "Quarter gridline opacity (%)", value: 30 });
    quarterGridlineStyle = new formattingSettings.ItemDropdown({
        name: "quarterGridlineStyle", displayName: "Quarter gridline style",
        items: LINE_STYLE_ITEMS, value: { value: "dashed", displayName: "Dashed" },
    });

    showMonthGridlines = new formattingSettings.ToggleSwitch({ name: "showMonthGridlines", displayName: "Show month gridlines", value: false });
    monthGridlineColor = new formattingSettings.ColorPicker({ name: "monthGridlineColor", displayName: "Month gridline color", value: { value: "#CCCCCC" } });
    monthGridlineOpacityPct = new formattingSettings.NumUpDown({ name: "monthGridlineOpacityPct", displayName: "Month gridline opacity (%)", value: 25 });
    monthGridlineStyle = new formattingSettings.ItemDropdown({
        name: "monthGridlineStyle", displayName: "Month gridline style",
        items: LINE_STYLE_ITEMS, value: { value: "dotted", displayName: "Dotted" },
    });

    showTodayLine = new formattingSettings.ToggleSwitch({ name: "showTodayLine", displayName: "Show TODAY dashed line", value: true });
    showTodayLabel = new formattingSettings.ToggleSwitch({ name: "showTodayLabel", displayName: "Show TODAY label in axis", value: true });
    todayLabelColor = new formattingSettings.ColorPicker({ name: "todayLabelColor", displayName: "TODAY label / line color", value: { value: "#444444" } });

    showPastShading = new formattingSettings.ToggleSwitch({ name: "showPastShading", displayName: "Show past-area shading", value: true });
    pastShadingColor = new formattingSettings.ColorPicker({ name: "pastShadingColor", displayName: "Past shading color", value: { value: "#000000" } });
    pastShadingOpacityPct = new formattingSettings.NumUpDown({ name: "pastShadingOpacityPct", displayName: "Past shading opacity (%)", value: 10 });

    showFutureShading = new formattingSettings.ToggleSwitch({ name: "showFutureShading", displayName: "Show future-area shading", value: false });
    futureShadingColor = new formattingSettings.ColorPicker({ name: "futureShadingColor", displayName: "Future shading color", value: { value: "#FFFAF0" } });
    futureShadingOpacityPct = new formattingSettings.NumUpDown({ name: "futureShadingOpacityPct", displayName: "Future shading opacity (%)", value: 50 });

    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Size", value: 12 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });

    name: string = "timeAxis";
    displayName: string = "Time Axis";
    slices: Array<FormattingSettingsSlice> = [
        // Hierarchy levels
        this.showYear, this.yearFill,
        this.showQuarter, this.quarterFill,
        this.showMonth, this.monthFill,
        // Per-granularity gridlines
        this.showQuarterGridlines, this.quarterGridlineColor, this.quarterGridlineOpacityPct, this.quarterGridlineStyle,
        this.showMonthGridlines, this.monthGridlineColor, this.monthGridlineOpacityPct, this.monthGridlineStyle,
        // TODAY
        this.showTodayLine, this.showTodayLabel, this.todayLabelColor,
        // Shading
        this.showPastShading, this.pastShadingColor, this.pastShadingOpacityPct,
        this.showFutureShading, this.futureShadingColor, this.futureShadingOpacityPct,
        // Font (applied to all chevron labels via per-level scaling)
        this.fontFamily, this.fontSize, this.bold, this.italic, this.underline,
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    title = new TitleCard();
    layout = new LayoutCard();
    milestones = new MilestonesCard();
    activityLabels = new ActivityLabelsCard();
    swimlanes = new SwimlanesCard();
    legend = new LegendCard();
    timeAxis = new TimeAxisCard();

    cards = [
        this.title,
        this.layout,
        this.swimlanes,
        this.activityLabels,
        this.milestones,
        this.legend,
        this.timeAxis,
    ];
}
