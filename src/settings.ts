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

const ALIGNMENT_ITEMS = [
    { value: "left",   displayName: "Left" },
    { value: "center", displayName: "Center" },
    { value: "right",  displayName: "Right" },
];

// ── Title (overrides PBI's built-in platform title — defaults OFF) ────────
// Declaring this object in capabilities.json + this card with show=false
// tells PBI's platform: don't auto-concatenate data role names as a title;
// instead use these settings. Default show=false suppresses the eyesore
// auto-title for every clone. Users can opt in to either this OR the more
// powerful Chart Title card below.
class TitleCard extends SimpleCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show", value: false });
    text = new formattingSettings.TextInput({
        name: "text", displayName: "Title text", placeholder: "",
        value: "",
    });
    fontColor = new formattingSettings.ColorPicker({ name: "fontColor", displayName: "Color", value: { value: "#222222" } });
    background = new formattingSettings.ColorPicker({ name: "background", displayName: "Background", value: { value: "#FFFFFF" } });
    alignment = new formattingSettings.ItemDropdown({
        name: "alignment", displayName: "Alignment",
        items: ALIGNMENT_ITEMS, value: ALIGNMENT_ITEMS[0],
    });
    name: string = "title";
    displayName: string = "Title";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.text, this.fontColor, this.background, this.alignment,
    ];
}

// ── Chart Title (custom title — independent of PBI's built-in Title card) ─
// Renders inside the SVG viewport at the top. Named "chartTitle" to avoid
// the duplicate-collision with PBI's platform "Title" object.
class ChartTitleCard extends SimpleCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show", value: false });
    text = new formattingSettings.TextInput({
        name: "text", displayName: "Title text", placeholder: "Project Roadmap",
        value: "Project Roadmap",
    });
    fontColor = new formattingSettings.ColorPicker({ name: "fontColor", displayName: "Color", value: { value: "#1F2937" } });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font", value: "Segoe UI" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Size", value: 18 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    alignment = new formattingSettings.ItemDropdown({
        name: "alignment", displayName: "Alignment",
        items: ALIGNMENT_ITEMS, value: ALIGNMENT_ITEMS[1],
    });
    name: string = "chartTitle";
    displayName: string = "Chart Title";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.text, this.fontColor, this.fontFamily, this.fontSize,
        this.bold, this.italic, this.underline, this.alignment,
    ];
}

// ── Tooltip (note-row visibility + empty-state behavior) ──────────────────
class TooltipCard extends SimpleCard {
    showNote = new formattingSettings.ToggleSwitch({ name: "showNote", displayName: "Show Note row", value: true });
    hideRowWhenEmpty = new formattingSettings.ToggleSwitch({
        name: "hideRowWhenEmpty", displayName: "Hide row when no note", value: false,
    });
    emptyPlaceholder = new formattingSettings.TextInput({
        name: "emptyPlaceholder", displayName: "Placeholder for empty notes",
        placeholder: "(no note recorded)", value: "(no note recorded)",
    });
    name: string = "tooltip";
    displayName: string = "Tooltip";
    slices: Array<FormattingSettingsSlice> = [
        this.showNote, this.hideRowWhenEmpty, this.emptyPlaceholder,
    ];
}

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

    // Slot 2
    type2Color = new formattingSettings.ColorPicker({ name: "type2Color", displayName: "Color", value: { value: "#000000" } });
    type2Symbol = new formattingSettings.ItemDropdown({
        name: "type2Symbol", displayName: "Symbol",
        items: SYMBOL_DROPDOWN_ITEMS, value: SYMBOL_DROPDOWN_ITEMS[0],
    });
    type2Size = new formattingSettings.NumUpDown({ name: "type2Size", displayName: "Size (px)", value: 8 });
    type2ShowMarker = new formattingSettings.ToggleSwitch({ name: "type2ShowMarker", displayName: "Show markers", value: true });

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
        slices: [this.type1Color, this.type1Symbol, this.type1Size, this.type1ShowMarker],
    });
    type2Group = new Group({
        name: "type2Group", displayName: "Type 2",
        slices: [this.type2Color, this.type2Symbol, this.type2Size, this.type2ShowMarker],
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
    // INF-3736 — explicit "Wrap labels" toggle removed. Swim-lane labels
    // always wrap when they don't fit (auto-wrap), since wrap is required
    // for the new drag-to-resize behavior to produce useful sizing.
    // (The capabilities.json declaration for `wrapText` is retained as a
    // harmless stored bit; the visual no longer reads it.)

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
        slices: [this.show, this.swimLaneWidthPercent, this.railAlignment],
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
    name: string = "ganttLayout";
    displayName: string = "Roadmap Layout";
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

// v2.2 INF-3738 — per-value icon + color + size for the activity bullet
// (left dot). Mirrors the milestone-type cap-N pattern: 5 fixed slots,
// first 5 distinct values from data bind to slots, slot displayNames
// overridden at runtime in visual.ts to show the actual data value.
const HEALTH_SYMBOL_ITEMS = [
    { value: "warning", displayName: "Warning" },
    { value: "block",   displayName: "Blocked" },
    { value: "pause",   displayName: "Paused" },
    { value: "x",       displayName: "Off Track" },
    { value: "circle",  displayName: "Dot" },
];

class ActivityHealthIconsCard extends SimpleCard {
    // v2.2 INF-3738 V2 — each slot has a valueMatch text field. User types
    // the value from their data column that should get this slot's icon.
    // Default icons + colors are the project-status defaults (warning/block/
    // pause/x/circle) but the value-to-icon mapping is the USER's call —
    // explicit binding, not data-first-seen.

    // Slot 1 defaults: ⚠ warning + yellow
    slot1Symbol = new formattingSettings.ItemDropdown({
        name: "slot1Symbol", displayName: "Slot 1 symbol",
        items: HEALTH_SYMBOL_ITEMS,
        value: { value: "warning", displayName: "Warning" },
    });
    slot1Color = new formattingSettings.ColorPicker({
        name: "slot1Color", displayName: "Slot 1 color", value: { value: "#e6b800" },
    });
    slot1Size = new formattingSettings.NumUpDown({
        name: "slot1Size", displayName: "Slot 1 size (px)", value: 12,
    });
    // Slot 2 defaults: ⛔ block + red
    slot2Symbol = new formattingSettings.ItemDropdown({
        name: "slot2Symbol", displayName: "Slot 2 symbol",
        items: HEALTH_SYMBOL_ITEMS,
        value: { value: "block", displayName: "Blocked" },
    });
    slot2Color = new formattingSettings.ColorPicker({
        name: "slot2Color", displayName: "Slot 2 color", value: { value: "#d62728" },
    });
    slot2Size = new formattingSettings.NumUpDown({
        name: "slot2Size", displayName: "Slot 2 size (px)", value: 12,
    });
    // Slot 3 defaults: ⏸ pause + grey
    slot3Symbol = new formattingSettings.ItemDropdown({
        name: "slot3Symbol", displayName: "Slot 3 symbol",
        items: HEALTH_SYMBOL_ITEMS,
        value: { value: "pause", displayName: "Paused" },
    });
    slot3Color = new formattingSettings.ColorPicker({
        name: "slot3Color", displayName: "Slot 3 color", value: { value: "#888888" },
    });
    slot3Size = new formattingSettings.NumUpDown({
        name: "slot3Size", displayName: "Slot 3 size (px)", value: 12,
    });
    // Slot 4 defaults: ✗ x + red
    slot4Symbol = new formattingSettings.ItemDropdown({
        name: "slot4Symbol", displayName: "Slot 4 symbol",
        items: HEALTH_SYMBOL_ITEMS,
        value: { value: "x", displayName: "Off Track" },
    });
    slot4Color = new formattingSettings.ColorPicker({
        name: "slot4Color", displayName: "Slot 4 color", value: { value: "#d62728" },
    });
    slot4Size = new formattingSettings.NumUpDown({
        name: "slot4Size", displayName: "Slot 4 size (px)", value: 12,
    });
    // Slot 5 defaults: ● circle + green
    slot5Symbol = new formattingSettings.ItemDropdown({
        name: "slot5Symbol", displayName: "Slot 5 symbol",
        items: HEALTH_SYMBOL_ITEMS,
        value: { value: "circle", displayName: "Dot" },
    });
    slot5Color = new formattingSettings.ColorPicker({
        name: "slot5Color", displayName: "Slot 5 color", value: { value: "#2ca02c" },
    });
    slot5Size = new formattingSettings.NumUpDown({
        name: "slot5Size", displayName: "Slot 5 size (px)", value: 12,
    });
    name: string = "activityHealthIcons";
    displayName: string = "Activity Health Icons";
    slices: FormattingSettingsSlice[] = [
        this.slot1Symbol, this.slot1Color, this.slot1Size,
        this.slot2Symbol, this.slot2Color, this.slot2Size,
        this.slot3Symbol, this.slot3Color, this.slot3Size,
        this.slot4Symbol, this.slot4Color, this.slot4Size,
        this.slot5Symbol, this.slot5Color, this.slot5Size,
    ];
}

// v2.2 B3 — palette for the milestone Inspector's Health dot. Drives the
// healthColor() utility, which maps both literal color names AND semantic
// status strings (On Track / At Risk / Off Track / Blocked / etc.) to
// these 3 colors. Defaults pick standard data-viz hues.
class MilestoneHealthColorsCard extends SimpleCard {
    green = new formattingSettings.ColorPicker({
        name: "green",  displayName: "Green (on-track)",  value: { value: "#2ca02c" },
    });
    yellow = new formattingSettings.ColorPicker({
        name: "yellow", displayName: "Yellow (at-risk)",  value: { value: "#e6b800" },
    });
    red = new formattingSettings.ColorPicker({
        name: "red",    displayName: "Red (off-track)",   value: { value: "#d62728" },
    });
    name: string = "milestoneHealthColors";
    displayName: string = "Milestone Health Colors";
    slices: FormattingSettingsSlice[] = [this.green, this.yellow, this.red];
}

// v2.2 INF-3739 — per-slot tier/mode/label for the 8 filter dimension slots.
// Mirrors swimlanes / activityHealthIcons cap-N pattern: static declared
// slots, displayNames overridden at runtime from bound column names (swim-lane
// idiom) so each slot's controls show "Segment", "Investment Category", etc.
const FILTER_TIER_ITEMS = [
    { value: "comprehensive", displayName: "Visible in sidebar" },
    { value: "hidden",        displayName: "Hidden" },
];
const FILTER_MODE_ITEMS = [
    { value: "single", displayName: "Single-select" },
    { value: "multi",  displayName: "Multi-select" },
    { value: "search", displayName: "Search" },
];
// INF-3745 Phase A — widget polymorphism. slotNWidget replaces slotNMode
// as the per-slot rendering choice. "auto" defers to resolveWidget() which
// picks by (column type, distinct cardinality).
const FILTER_WIDGET_ITEMS = [
    { value: "auto",           displayName: "Auto" },
    { value: "pills-multi",    displayName: "Pills (multi)" },
    { value: "pills-single",   displayName: "Pills (single)" },
    { value: "dropdown-multi", displayName: "Dropdown" },
    { value: "search-chips",   displayName: "Search" },
    { value: "range-slider",   displayName: "Range slider" },
];

function makeFilterSlot(n: 1|2|3|4|5|6|7|8): {
    tier: formattingSettings.ItemDropdown;
    mode: formattingSettings.ItemDropdown;
    widget: formattingSettings.ItemDropdown;
    label: formattingSettings.TextInput;
    pinned: formattingSettings.ToggleSwitch;
    group: Group;
} {
    const tier = new formattingSettings.ItemDropdown({
        name: `slot${n}Tier`, displayName: `Slot ${n} tier`,
        items: FILTER_TIER_ITEMS,
        value: { value: "comprehensive", displayName: "Visible in sidebar" },
    });
    const mode = new formattingSettings.ItemDropdown({
        name: `slot${n}Mode`, displayName: `Slot ${n} mode (deprecated)`,
        items: FILTER_MODE_ITEMS,
        value: { value: "multi", displayName: "Multi-select" },
    });
    const widget = new formattingSettings.ItemDropdown({
        name: `slot${n}Widget`, displayName: `Slot ${n} widget`,
        items: FILTER_WIDGET_ITEMS,
        value: { value: "auto", displayName: "Auto" },
    });
    const label = new formattingSettings.TextInput({
        name: `slot${n}Label`, displayName: `Slot ${n} label override`,
        placeholder: "", value: "",
    });
    const pinned = new formattingSettings.ToggleSwitch({
        name: `slot${n}Pinned`, displayName: `Slot ${n} pinned as top slicer`,
        value: false,
    });
    // INF-3745 Phase A — drop slotNMode from the group (still declared on
    // the card for back-compat reads); the widget enum is the new control.
    const group = new Group({
        name: `filterSlot${n}Group`, displayName: `Slot ${n}`,
        slices: [pinned, tier, widget, label],
    });
    return { tier, mode, widget, label, pinned, group };
}

export class FilterSlotsCard extends CompositeCard {
    name: string = "filterSlots";
    displayName: string = "Filter Slots";

    private readonly _slots = [
        makeFilterSlot(1), makeFilterSlot(2), makeFilterSlot(3), makeFilterSlot(4),
        makeFilterSlot(5), makeFilterSlot(6), makeFilterSlot(7), makeFilterSlot(8),
    ];

    slot1Tier = this._slots[0].tier; slot1Mode = this._slots[0].mode; slot1Widget = this._slots[0].widget; slot1Label = this._slots[0].label; slot1Pinned = this._slots[0].pinned;
    slot2Tier = this._slots[1].tier; slot2Mode = this._slots[1].mode; slot2Widget = this._slots[1].widget; slot2Label = this._slots[1].label; slot2Pinned = this._slots[1].pinned;
    slot3Tier = this._slots[2].tier; slot3Mode = this._slots[2].mode; slot3Widget = this._slots[2].widget; slot3Label = this._slots[2].label; slot3Pinned = this._slots[2].pinned;
    slot4Tier = this._slots[3].tier; slot4Mode = this._slots[3].mode; slot4Widget = this._slots[3].widget; slot4Label = this._slots[3].label; slot4Pinned = this._slots[3].pinned;
    slot5Tier = this._slots[4].tier; slot5Mode = this._slots[4].mode; slot5Widget = this._slots[4].widget; slot5Label = this._slots[4].label; slot5Pinned = this._slots[4].pinned;
    slot6Tier = this._slots[5].tier; slot6Mode = this._slots[5].mode; slot6Widget = this._slots[5].widget; slot6Label = this._slots[5].label; slot6Pinned = this._slots[5].pinned;
    slot7Tier = this._slots[6].tier; slot7Mode = this._slots[6].mode; slot7Widget = this._slots[6].widget; slot7Label = this._slots[6].label; slot7Pinned = this._slots[6].pinned;
    slot8Tier = this._slots[7].tier; slot8Mode = this._slots[7].mode; slot8Widget = this._slots[7].widget; slot8Label = this._slots[7].label; slot8Pinned = this._slots[7].pinned;

    groups: Group[] = this._slots.map(s => s.group);
}

const PINNED_DENSITY_ITEMS = [
    { value: "comfortable", displayName: "Comfortable" },
    { value: "compact",     displayName: "Compact" },
    { value: "dense",       displayName: "Dense" },
];

export class FilterPanelLayoutCard extends SimpleCard {
    showFeatured = new formattingSettings.ToggleSwitch({
        name: "showFeatured", displayName: "Show Featured strip", value: true,
    });
    showComprehensive = new formattingSettings.ToggleSwitch({
        name: "showComprehensive", displayName: "Show Comprehensive sidebar", value: true,
    });
    comprehensiveSizePx = new formattingSettings.NumUpDown({
        name: "comprehensiveSizePx", displayName: "Comprehensive sidebar width (px)", value: 260,
    });
    selectionsJson = new formattingSettings.TextInput({
        name: "selectionsJson", displayName: "Persisted selections (JSON)",
        placeholder: "{}", value: "",
    });
    pinnedDensity = new formattingSettings.ItemDropdown({
        name: "pinnedDensity", displayName: "Pinned slicer density",
        items: PINNED_DENSITY_ITEMS,
        value: PINNED_DENSITY_ITEMS[1],  // default: compact
    });
    name: string = "filterPanelLayout";
    displayName: string = "Filter Panel Layout";
    slices: FormattingSettingsSlice[] = [
        this.showFeatured, this.showComprehensive, this.comprehensiveSizePx,
        this.pinnedDensity, this.selectionsJson,
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    title = new TitleCard();
    chartTitle = new ChartTitleCard();
    layout = new LayoutCard();
    milestones = new MilestonesCard();
    milestoneHealthColors = new MilestoneHealthColorsCard();
    activityHealthIcons = new ActivityHealthIconsCard();
    activityLabels = new ActivityLabelsCard();
    swimlanes = new SwimlanesCard();
    timeAxis = new TimeAxisCard();
    tooltip = new TooltipCard();
    filterSlots = new FilterSlotsCard();
    filterPanelLayout = new FilterPanelLayoutCard();

    cards = [
        this.title,
        this.chartTitle,
        this.layout,
        this.swimlanes,
        this.activityLabels,
        this.activityHealthIcons,
        this.milestones,
        this.milestoneHealthColors,
        this.timeAxis,
        this.tooltip,
        this.filterSlots,
        this.filterPanelLayout,
    ];
}
