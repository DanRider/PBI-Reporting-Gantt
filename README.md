# Reporting Gantt

Generic timeline visual for Power BI. Activity swim lanes, chevron time axis, milestone markers with conditional left/right labels. Data-driven — works with any (Activity, Area, Start, End, MilestoneActivity, MilestoneDate, MilestoneType, MilestoneLabel, LabelPos)-shaped dataset.

MIT licensed. Local-only (no AppSource publish).

## What it renders

- **Forward-pointing chevron time axis** (Year + Quarter bands, with TODAY marker + past/future shading)
- **Swim lanes per Area** — N areas supported (no cap), bracket rails on the left
- **Activity bars** colored by Area (defaults from PBI theme palette, overridable per-area in Format pane), rounded ends, dynamic row height so the visual never overflows
- **Activity row labels** with staggered horizontal "lollipops" connecting label → bar start
- **Milestone markers** — choose your symbol (star, circle, triangle, square, diamond) per type, choose your size, choose your color
- **Conditional marker labels** with explicit L / R positioning, arrows (← / →) showing which marker a label belongs to
- **Auto-flip + truncation** for labels that would overflow the right edge or collide with a neighbor
- **Upper-left legend** showing the bound milestone types with their picked symbols + colors
- **Hover tooltips** on bars and markers

## Install

1. Open your Power BI Desktop report.
2. Visualizations pane → "…" → "Get more visuals" → "Import a visual from a file".
3. Select `dist/reportingGantt….<version>.pbiviz`.
4. Accept the security prompt → click **Import**.

The visual appears in the Visualizations pane under the name **Reporting Gantt**.

## Try the demo

Open `fixtures/PBI-Reporting-Gantt.pbip` in Power BI Desktop. The visual is already wired against the bundled `Demo-Roadmap-Source.xlsx` — a generic project-portfolio dataset for an industrial equipment manufacturer (24 activities across Production / Product Development / Supply Chain, 64 milestones across Major / Minor, date range Q4 2025 → Q4 2027).

> **Path note.** The Power Query M `Source` step uses an absolute path: `C:\CORTEX\projects\Reporting-Gantt\fixtures\Demo-Roadmap-Source.xlsx`. If you clone elsewhere, open Power Query → edit the `Source` step on both the **Activities** and **Milestones** tables → repoint at your local copy of the .xlsx. Then **Home → Refresh**.

Regenerate the demo dataset from source:

```
pip install openpyxl
python fixtures/generate_source.py
```

## Data contract

Two related tables joined by activity name. Sample fixture at `fixtures/Demo-Roadmap-Source.xlsx` (run `python fixtures/generate_source.py` to (re)generate).

### Activities table

| Column        | Type   | Required | Notes                                                                |
|---------------|--------|----------|----------------------------------------------------------------------|
| `Activity`    | text   | ✓        | PK, unique per row                                                   |
| `Area`        | text   | ✓        | Any value — drives swim-lane segmentation; sort order = first-seen-in-data |
| `Start Date`  | date   | ✓        |                                                                      |
| `End Date`    | date   | ✓        |                                                                      |
| `SortOrder`   | number | optional | If present, preserves your row ordering through PBI's row-rebucketing |

### Milestones table

| Column            | Type   | Required | Notes                                                                |
|-------------------|--------|----------|----------------------------------------------------------------------|
| `Activity`        | text   | ✓        | FK → Activities.Activity                                             |
| `Milestone Date`  | date   | ✓        |                                                                      |
| `Milestone Type`  | text   | ✓        | Any value — visual renders **first 2 distinct types**, drops the rest with a console warning |
| `Milestone Label` | text   | optional | Nullable — unlabeled markers allowed                                 |
| `Label Position`  | text   | optional | `L` / `R` shows the label on that side of the marker; `none` (or unbound) hides the label. Per-row hide control — the single source of truth for whether a given milestone's label renders. |

### Data role wiring

| Visual data role     | Source column                       |
|----------------------|-------------------------------------|
| Activity             | `Activities[Activity]`              |
| Area                 | `Activities[Area]`                  |
| Start Date           | `Activities[Start Date]`            |
| End Date             | `Activities[End Date]`              |
| Milestone Activity   | `Milestones[Activity]`              |
| Milestone Date       | `Milestones[Milestone Date]`        |
| Milestone Type       | `Milestones[Milestone Type]`        |
| Milestone Label      | `Milestones[Milestone Label]`       |
| Label Position       | `Milestones[Label Position]`        |

### PBI quirks worked around

- **Activities without any matching Milestone rows** are filtered out by PBI's relationship cross-join. Workaround: emit one phantom milestone row per such activity with `Milestone Type = "__phantom"`. The viewmodel filters phantom rows before render. See `fixtures/generate_source.py` for the pattern.
- **Multi-year date-span filtering** via Calendar→Activities[StartDate] alone breaks for activities spanning into a year that's not the start year. If you need date-span filtering, build a Calendar bridge table (Activity × Date row per active day).

## Format pane (8 cards)

### Layout

| Property                       | Default | Notes                                                          |
|--------------------------------|---------|----------------------------------------------------------------|
| `leftRailWidthPercent`         | 7%      | Width of the swim-lane bracket rail (% of visual width).      |
| `activityLabelWidthPercent`    | 14%     | Width of the activity row label column.                       |
| `rightMarginPercent`           | 4%      | Right-edge whitespace.                                        |

Plot area = `100% − leftRail − activityLabel − rightMargin`. All clamp to safe min/max.

### Area Colors (dynamic — N entries)

One color picker per distinct `Area` value found in the data. Defaults derived from `host.colorPalette.getColor(areaName).value` (deterministic per-string from the report theme palette). User overrides persist across `.pbix` save/reopen, keyed by area name (so the override stays put even if you swap data).

### Milestones (fixed 2 slots)

The visual binds the **first 2 distinct milestone types** seen in the data to slots 1 and 2. Each slot has its own:

- `typeNColor` — fill color
- `typeNSymbol` — `star` / `circle` / `triangle` / `square` / `diamond`
- `typeNSize` — pixel size (default 11)
- `typeNShowMarker` — toggle marker visibility. Hiding markers also hides their labels (compound rule — labels require their marker to be visible).

Plus a global `hoverExpansion` (default 50%) controlling the invisible hover hit-area beyond the visible marker.

**Label visibility rule** (as of v1.7.1.0):
```
label renders iff
  (label data role has non-empty text) AND
  (Label Position != "none")           — per-row hide via the Milestones table
  AND (this type's Show markers = on)  — compound with marker visibility
```

If your data has 3+ distinct milestone types, the 3rd+ are dropped with a console warning. (This is the "max 2" cap by design — keeps the visual readable.)

### Activity Labels

| Property            | Default          | Notes                                                                                      |
|---------------------|------------------|--------------------------------------------------------------------------------------------|
| `show`              | on               | Master toggle                                                                              |
| `wrapText`          | on               | Wrap long activity names to 2 lines                                                       |
| `overflowBehavior`  | truncate         | `truncate` (adds …) / `hide` / `overflow`                                                  |
| `fillMode`          | grey             | `grey` / `area` (use the row's area color)                                                 |
| `customColor`       | `#2A2A2A`        | Override applied when `fillMode=grey`                                                      |
| `fontSize`          | 10               |                                                                                            |

### Milestone Labels

This card controls label **layout** (text size, color, collision/overflow behavior). Per-row label **visibility** is data-driven via the `Label Position` column on the Milestones table — set a row's value to `none` to hide that one label, or leave the column unbound to hide every label.

| Property            | Default     | Notes                                                                                          |
|---------------------|-------------|------------------------------------------------------------------------------------------------|
| `overflowBehavior`  | truncate    | `truncate` / `hide colliding` / `overflow`                                                     |
| `fontSize`          | 8           | Drives the dynamic minimum-truncation-width threshold                                         |
| `labelColor`        | black       | Single color shared across both types                                                          |

Auto-flip (right-edge labels mirror to the opposite side) is **always on** — viewport-correctness, not stylistic.

### Swim Lanes

| Property     | Default | Notes                                                                                  |
|--------------|---------|----------------------------------------------------------------------------------------|
| `show`       | on      | Master toggle for left rail brackets + rotated area labels                            |
| `wrapText`   | on      | Wrap area labels inside the rail width                                                |

### Legend

| Property | Default | Notes                                                                |
|----------|---------|----------------------------------------------------------------------|
| `show`   | on      | Renders the type swatches at the **upper-left corner** of the visual |

Legend renders in the otherwise-unused space above the swim-lane rails. Each entry uses the user-picked symbol + size + color for that bound type.

### Time Axis

| Property                  | Default     | Notes                                                                            |
|---------------------------|-------------|----------------------------------------------------------------------------------|
| `showTodayLine`           | on          | Vertical dashed line at today's date                                             |
| `showTodayLabel`          | on          | "TODAY \|" text label anchored to the line                                       |
| `todayLabelColor`         | `#444444`   |                                                                                  |
| `showPastShading`         | on          | Tints the area to the left of TODAY                                              |
| `pastShadingColor`        | `#000000`   |                                                                                  |
| `pastShadingOpacityPct`   | 10          |                                                                                  |
| `showFutureShading`       | off         | Tints the area to the right of TODAY                                             |
| `futureShadingColor`      | `#FFFAF0`   | Warm cream                                                                       |
| `futureShadingOpacityPct` | 50          |                                                                                  |

## Build

```
npm install
npm run package
```

Outputs `dist/reportingGantt….<version>.pbiviz`.

## Source / dev

- TypeScript + SVG (no third-party visual code forked)
- Architectural patterns informed by reading source of MIT-licensed Microsoft visuals (`microsoft/powerbi-visuals-gantt`, `microsoft/powerbi-visuals-timeline`)
- Build: `npm run package` → `dist/<guid>.<version>.pbiviz`
- Test: drop the .pbiviz into any PBI Desktop report's `CustomVisuals/<guid>/` folder, kill PBIDesktop, relaunch

## License

MIT — see [LICENSE](LICENSE).
