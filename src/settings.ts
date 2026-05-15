"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import SimpleCard = formattingSettings.SimpleCard;
import CompositeCard = formattingSettings.CompositeCard;
import Group = formattingSettings.Group;
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

// ── Milestones (composite card with 5 collapsible groups) ─────────────────
export class MilestonesCard extends CompositeCard {
    name: string = "milestones";
    displayName: string = "Milestones";

    // Hover behavior
    hoverExpansion = new formattingSettings.NumUpDown({
        name: "hoverExpansion", displayName: "Hover target expansion (% past marker edge)", value: 50,
    });

    // Label styling (shared across both types)
    labelOverflow = new formattingSettings.ItemDropdown({
        name: "labelOverflow", displayName: "Label overflow",
        items: [
            { value: "truncate", displayName: "Truncate with …" },
            { value: "hide",     displayName: "Hide colliding" },
            { value: "overflow", displayName: "Show all (may overlap)" },
        ],
        value: { value: "truncate", displayName: "Truncate with …" },
    });
    labelColor = new formattingSettings.ColorPicker({ name: "labelColor", displayName: "Label color", value: { value: "#000000" } });
    labelFontFamily = new formattingSettings.FontPicker({ name: "labelFontFamily", displayName: "Label font", value: "Segoe UI" });
    labelFontSize = new formattingSettings.NumUpDown({ name: "labelFontSize", displayName: "Label size", value: 8 });
    labelBold = new formattingSettings.ToggleSwitch({ name: "labelBold", displayName: "Label bold", value: false });
    labelItalic = new formattingSettings.ToggleSwitch({ name: "labelItalic", displayName: "Label italic", value: false });
    labelUnderline = new formattingSettings.ToggleSwitch({ name: "labelUnderline", displayName: "Label underline", value: false });

    // Legend (was standalone LegendCard, merged into Milestones in v1.6.0.0)
    legendShow = new formattingSettings.ToggleSwitch({ name: "legendShow", displayName: "Show legend", value: true });
    legendLabelColor = new formattingSettings.ColorPicker({ name: "legendLabelColor", displayName: "Legend label color", value: { value: "#222222" } });
    legendFontFamily = new formattingSettings.FontPicker({ name: "legendFontFamily", displayName: "Legend font", value: "Segoe UI" });
    legendFontSize = new formattingSettings.NumUpDown({ name: "legendFontSize", displayName: "Legend size", value: 10 });
    legendBold = new formattingSettings.ToggleSwitch({ name: "legendBold", displayName: "Legend bold", value: false });
    legendItalic = new formattingSettings.ToggleSwitch({ name: "legendItalic", displayName: "Legend italic", value: false });
    legendUnderline = new formattingSettings.ToggleSwitch({ name: "legendUnderline", displayName: "Legend underline", value: false });

    // Slot 1
    type1Color = new formattingSettings.ColorPicker({ name: "type1Color", displayName: "Color", value: { value: "#FFC000" } });
    type1Symbol = new formattingSettings.ItemDropdown({
        name: "type1Symbol", displayName: "Symbol",
        items: SYMBOL_DROPDOWN_ITEMS, value: SYMBOL_DROPDOWN_ITEMS[0],
    });
    type1Size = new formattingSettings.NumUpDown({ name: "type1Size", displayName: "Size (px)", value: 8 });
    type1ShowMarker = new formattingSettings.ToggleSwitch({ name: "type1ShowMarker", displayName: "Show markers", value: true });
    type1ShowLabel = new formattingSettings.ToggleSwitch({ name: "type1ShowLabel", displayName: "Show labels", value: true });

    // Slot 2
    type2Color = new formattingSettings.ColorPicker({ name: "type2Color", displayName: "Color", value: { value: "#000000" } });
    type2Symbol = new formattingSettings.ItemDropdown({
        name: "type2Symbol", displayName: "Symbol",
        items: SYMBOL_DROPDOWN_ITEMS, value: SYMBOL_DROPDOWN_ITEMS[0],
    });
    type2Size = new formattingSettings.NumUpDown({ name: "type2Size", displayName: "Size (px)", value: 8 });
    type2ShowMarker = new formattingSettings.ToggleSwitch({ name: "type2ShowMarker", displayName: "Show markers", value: true });
    type2ShowLabel = new formattingSettings.ToggleSwitch({ name: "type2ShowLabel", displayName: "Show labels", value: true });

    // Groups — each renders as a collapsible subsection in the Format pane
    hoverGroup = new Group({
        name: "hoverGroup", displayName: "Hover behavior",
        slices: [this.hoverExpansion],
    });
    labelsGroup = new Group({
        name: "labelsGroup", displayName: "Labels",
        slices: [
            this.labelOverflow, this.labelColor,
            this.labelFontFamily, this.labelFontSize,
            this.labelBold, this.labelItalic, this.labelUnderline,
        ],
    });
    legendGroup = new Group({
        name: "legendGroup", displayName: "Legend",
        slices: [
            this.legendShow, this.legendLabelColor,
            this.legendFontFamily, this.legendFontSize,
            this.legendBold, this.legendItalic, this.legendUnderline,
        ],
    });
    type1Group = new Group({
        name: "type1Group", displayName: "Type 1",
        slices: [this.type1Color, this.type1Symbol, this.type1Size, this.type1ShowMarker, this.type1ShowLabel],
    });
    type2Group = new Group({
        name: "type2Group", displayName: "Type 2",
        slices: [this.type2Color, this.type2Symbol, this.type2Size, this.type2ShowMarker, this.type2ShowLabel],
    });

    groups: Group[] = [
        this.hoverGroup,
        this.labelsGroup,
        this.legendGroup,
        this.type1Group,
        this.type2Group,
    ];
}

// ── Activity Labels (simple card, not bloated) ────────────────────────────
class ActivityLabelsCard extends SimpleCard {
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

// ── Swim Lanes (composite card with 3 collapsible groups) ─────────────────
export class SwimlanesCard extends CompositeCard {
    name: string = "swimlanes";
    displayName: string = "Swim Lanes";

    // Layout
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show", value: true });
    swimLaneWidthPercent = new formattingSettings.NumUpDown({
        name: "swimLaneWidthPercent", displayName: "Swim lane width (% of visual width)", value: 10,
    });
    railAlignment = new formattingSettings.ItemDropdown({
        name: "railAlignment", displayName: "Rail alignment relative to label",
        items: [
            { value: "left",   displayName: "Left of label" },
            { value: "center", displayName: "Bisect label (center)" },
            { value: "right",  displayName: "Right of label" },
        ],
        value: { value: "right", displayName: "Right of label" },
    });
    wrapText = new formattingSettings.ToggleSwitch({ name: "wrapText", displayName: "Wrap labels (one word per line)", value: true });

    // Label styling
    useAreaColor = new formattingSettings.ToggleSwitch({ name: "useAreaColor", displayName: "Use swim lane color for label", value: true });
    labelColor = new formattingSettings.ColorPicker({ name: "labelColor", displayName: "Label color (when not using swim lane color)", value: { value: "#222222" } });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Size", value: 13 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });

    // Cap-8 swim-lane colors. DisplayNames overridden at runtime from areaBindings.
    slot1Color = new formattingSettings.ColorPicker({ name: "slot1Color", displayName: "Slot 1 color", value: { value: "#5C8A1C" } });
    slot2Color = new formattingSettings.ColorPicker({ name: "slot2Color", displayName: "Slot 2 color", value: { value: "#C1004F" } });
    slot3Color = new formattingSettings.ColorPicker({ name: "slot3Color", displayName: "Slot 3 color", value: { value: "#00A0DC" } });
    slot4Color = new formattingSettings.ColorPicker({ name: "slot4Color", displayName: "Slot 4 color", value: { value: "#9467BD" } });
    slot5Color = new formattingSettings.ColorPicker({ name: "slot5Color", displayName: "Slot 5 color", value: { value: "#8C564B" } });
    slot6Color = new formattingSettings.ColorPicker({ name: "slot6Color", displayName: "Slot 6 color", value: { value: "#E377C2" } });
    slot7Color = new formattingSettings.ColorPicker({ name: "slot7Color", displayName: "Slot 7 color", value: { value: "#7F7F7F" } });
    slot8Color = new formattingSettings.ColorPicker({ name: "slot8Color", displayName: "Slot 8 color", value: { value: "#BCBD22" } });

    layoutGroup = new Group({
        name: "swLayoutGroup", displayName: "Layout",
        slices: [this.show, this.swimLaneWidthPercent, this.railAlignment, this.wrapText],
    });
    labelGroup = new Group({
        name: "swLabelGroup", displayName: "Label styling",
        slices: [this.useAreaColor, this.labelColor, this.fontFamily, this.fontSize, this.bold, this.italic, this.underline],
    });
    colorsGroup = new Group({
        name: "swColorsGroup", displayName: "Colors",
        slices: [this.slot1Color, this.slot2Color, this.slot3Color, this.slot4Color,
                 this.slot5Color, this.slot6Color, this.slot7Color, this.slot8Color],
    });

    groups: Group[] = [this.layoutGroup, this.labelGroup, this.colorsGroup];
}

// ── Layout (just 4 margins) ───────────────────────────────────────────────
class LayoutCard extends SimpleCard {
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

// ── Time Axis (composite card with 7 collapsible groups) ──────────────────
class TimeAxisCard extends CompositeCard {
    name: string = "timeAxis";
    displayName: string = "Time Axis";

    chevronStyle = new formattingSettings.ItemDropdown({
        name: "chevronStyle", displayName: "Chevron style",
        items: [
            { value: "nested",    displayName: "Nested arrow" },
            { value: "pentagon",  displayName: "Pentagon" },
            { value: "rectangle", displayName: "Rectangle" },
        ],
        value: { value: "nested", displayName: "Nested arrow" },
    });

    showYear = new formattingSettings.ToggleSwitch({ name: "showYear", displayName: "Show Year", value: true });
    yearFill = new formattingSettings.ColorPicker({ name: "yearFill", displayName: "Year chevron color", value: { value: "#E8E8E8" } });

    showQuarter = new formattingSettings.ToggleSwitch({ name: "showQuarter", displayName: "Show Quarter", value: true });
    quarterFill = new formattingSettings.ColorPicker({ name: "quarterFill", displayName: "Quarter chevron color", value: { value: "#D0D0D0" } });
    showQuarterGridlines = new formattingSettings.ToggleSwitch({ name: "showQuarterGridlines", displayName: "Show quarter gridlines", value: true });
    quarterGridlineColor = new formattingSettings.ColorPicker({ name: "quarterGridlineColor", displayName: "Quarter gridline color", value: { value: "#888888" } });
    quarterGridlineOpacityPct = new formattingSettings.NumUpDown({ name: "quarterGridlineOpacityPct", displayName: "Quarter gridline opacity (%)", value: 30 });
    quarterGridlineStyle = new formattingSettings.ItemDropdown({
        name: "quarterGridlineStyle", displayName: "Quarter gridline style",
        items: LINE_STYLE_ITEMS, value: { value: "dashed", displayName: "Dashed" },
    });

    showMonth = new formattingSettings.ToggleSwitch({ name: "showMonth", displayName: "Show Month", value: false });
    monthFill = new formattingSettings.ColorPicker({ name: "monthFill", displayName: "Month chevron color", value: { value: "#B8B8B8" } });
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

    chevronGroup = new Group({ name: "taChevronGroup", displayName: "Chevron style", slices: [this.chevronStyle] });
    yearGroup = new Group({ name: "taYearGroup", displayName: "Year band", slices: [this.showYear, this.yearFill] });
    quarterGroup = new Group({
        name: "taQuarterGroup", displayName: "Quarter band",
        slices: [this.showQuarter, this.quarterFill, this.showQuarterGridlines, this.quarterGridlineColor, this.quarterGridlineOpacityPct, this.quarterGridlineStyle],
    });
    monthGroup = new Group({
        name: "taMonthGroup", displayName: "Month band",
        slices: [this.showMonth, this.monthFill, this.showMonthGridlines, this.monthGridlineColor, this.monthGridlineOpacityPct, this.monthGridlineStyle],
    });
    todayGroup = new Group({
        name: "taTodayGroup", displayName: "TODAY marker",
        slices: [this.showTodayLine, this.showTodayLabel, this.todayLabelColor],
    });
    shadingGroup = new Group({
        name: "taShadingGroup", displayName: "Past / future shading",
        slices: [this.showPastShading, this.pastShadingColor, this.pastShadingOpacityPct,
                 this.showFutureShading, this.futureShadingColor, this.futureShadingOpacityPct],
    });
    fontGroup = new Group({
        name: "taFontGroup", displayName: "Font",
        slices: [this.fontFamily, this.fontSize, this.bold, this.italic, this.underline],
    });

    groups: Group[] = [
        this.chevronGroup, this.yearGroup, this.quarterGroup, this.monthGroup,
        this.todayGroup, this.shadingGroup, this.fontGroup,
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    layout = new LayoutCard();
    milestones = new MilestonesCard();
    activityLabels = new ActivityLabelsCard();
    swimlanes = new SwimlanesCard();
    timeAxis = new TimeAxisCard();

    cards = [
        this.layout,
        this.swimlanes,
        this.activityLabels,
        this.milestones,
        this.timeAxis,
    ];
}
